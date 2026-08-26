"use client";

// ĐỒNG BỘ SỔ per-máy ↔ server theo SĐT (P1). Xem docs/specs/dong-bo-so-per-may.md.
//
// OFFLINE-FIRST (bất biến): localStorage vẫn là nguồn ĐỌC chính — mất sóng vẫn
// thấy đủ. Server chỉ là bản sao để máy khác kéo về. Mọi lời gọi mạng NUỐT LỖI
// (authedFetch trả res=null khi mất sóng) — không bao giờ chặn màn / ném lỗi.
//
// Luật đồng bộ P1 = LAST-WRITE-WINS mức kind theo mốc client (ms):
//  · Ghi local → đánh dấu dirty + mốc = now, ĐẨY (giữ dirty nếu mất sóng).
//  · Kéo (mở app/online/đăng nhập): server mới hơn (mốc lớn hơn) → NHẬN về.
//  · Sổ đã có sẵn từ trước (chưa từng đẩy) mà server chưa có → SEED lên 1 lần.
// Xung đột 2 máy sửa offline: bên đồng bộ sau thắng (nợ: chưa merge từng item).

import { authedFetch } from "@/lib/device-token-store";
import { SYNC_KINDS, type SyncKind } from "@/lib/user-sync-core";

/** kind → khoá localStorage (giữ NGUYÊN khoá hiện có, không dời dữ liệu). */
const KEY: Record<SyncKind, string> = {
  boats: "forfish.boats.v1",
  maintenance: "forfish.maintenance.v1",
  materials: "forfish.products.v1",
  crew: "forfish.crew.v1", // P2 — chưa đấu
  documents: "forfish.documents.v1", // P3 — chưa đấu
};

/** Sổ đang đồng bộ. P1: boats/maintenance/materials (không nhạy cảm). P2 (2026-08-26):
 *  THÊM crew (CCCD) + documents (metadata giấy tờ) — chủ dự án chốt đồng bộ HẾT,
 *  privacy policy /quyen-rieng-tu đã cập nhật khai lưu server. Ảnh giấy tờ = P3. */
const ACTIVE: readonly SyncKind[] = [
  "boats",
  "maintenance",
  "materials",
  "crew",
  "documents",
];

/** Bookkeeping đồng bộ, DEVICE-LOCAL (không sao lưu, không chia máy — xem offline-backup). */
const META_KEY = "forfish.sync.v1";
/** Bắn khi NHẬN bản server về → màn đang mở re-hydrate (boat-store, component). */
export const USER_SYNC_EVENT = "forfish:usersync";

interface Meta {
  at: number; // mốc ghi client gần nhất (ms)
  dirty: boolean; // có sửa chưa đẩy được không
}
type MetaMap = Partial<Record<SyncKind, Meta>>;

function readMeta(): MetaMap {
  try {
    return JSON.parse(window.localStorage.getItem(META_KEY) ?? "{}") as MetaMap;
  } catch {
    return {};
  }
}
function metaOf(kind: SyncKind): Meta {
  return readMeta()[kind] ?? { at: 0, dirty: false };
}
function setMeta(kind: SyncKind, patch: Partial<Meta>): void {
  try {
    const m = readMeta();
    m[kind] = { ...(m[kind] ?? { at: 0, dirty: false }), ...patch };
    window.localStorage.setItem(META_KEY, JSON.stringify(m));
  } catch {
    /* máy chặn localStorage → thôi, không hỏng gì */
  }
}

function readRaw(kind: SyncKind): string | null {
  try {
    return window.localStorage.getItem(KEY[kind]);
  } catch {
    return null;
  }
}
function writeRaw(kind: SyncKind, json: string): void {
  try {
    window.localStorage.setItem(KEY[kind], json);
  } catch {
    /* hết chỗ → giữ bản cũ, lần sau kéo lại */
  }
}

/** Sổ có dữ liệu thật đáng đẩy không (mảng/không rỗng). Rỗng thì đừng seed. */
function hasLocalData(kind: SyncKind): boolean {
  const raw = readRaw(kind);
  if (raw == null || raw === "" || raw === "[]" || raw === "{}") return false;
  try {
    const v = JSON.parse(raw) as unknown;
    if (Array.isArray(v)) return v.length > 0;
    if (v && typeof v === "object") return Object.keys(v).length > 0;
    return false;
  } catch {
    return false;
  }
}

function emitSync(kind: SyncKind): void {
  try {
    window.dispatchEvent(new CustomEvent(USER_SYNC_EVENT, { detail: { kind } }));
  } catch {
    /* ignore */
  }
}

function adoptServer(kind: SyncKind, data: unknown, at: number): void {
  writeRaw(kind, JSON.stringify(data));
  setMeta(kind, { at, dirty: false });
  emitSync(kind);
}

/** Đẩy 1 sổ lên server. Giữ dirty nếu mất sóng/lỗi để lần sau thử lại. */
async function pushKind(kind: SyncKind): Promise<void> {
  const raw = readRaw(kind);
  if (raw == null) return;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return; // JSON hỏng → KHÔNG đẩy rác lên server
  }
  const at = metaOf(kind).at || Date.now();
  const { res } = await authedFetch("/api/me/sync", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, data, clientUpdatedAt: at }),
  });
  if (!res || !res.ok) return; // mất sóng / 401 / 5xx → giữ dirty
  const j = (await res.json().catch(() => null)) as {
    stale?: boolean;
    server?: { data: unknown; clientUpdatedAt: number };
  } | null;
  if (j?.stale && j.server) {
    adoptServer(kind, j.server.data, j.server.clientUpdatedAt); // server mới hơn
  } else {
    setMeta(kind, { dirty: false });
  }
}

/** Gọi SAU khi ghi 1 sổ thành công (saveUserJson trả true). Đánh dấu + đẩy. */
export function markLocalWrite(kind: SyncKind): void {
  if (!ACTIVE.includes(kind)) return;
  setMeta(kind, { at: Date.now(), dirty: true });
  void pushKind(kind);
}

/** Kéo mọi sổ + đẩy dirty/seed. Gọi lúc mở app / online lại / vừa đăng nhập. */
export async function syncAll(): Promise<void> {
  if (typeof window === "undefined") return;
  const seen = new Set<SyncKind>();
  const { res } = await authedFetch("/api/me/sync", { method: "GET" });
  if (res && res.ok) {
    const j = (await res.json().catch(() => null)) as {
      ok?: boolean;
      items?: { kind: SyncKind; data: unknown; clientUpdatedAt: number }[];
    } | null;
    if (j?.ok && Array.isArray(j.items)) {
      for (const it of j.items) {
        if (!ACTIVE.includes(it.kind)) continue;
        seen.add(it.kind);
        if (it.clientUpdatedAt > metaOf(it.kind).at) {
          adoptServer(it.kind, it.data, it.clientUpdatedAt); // server mới hơn → nhận
        }
      }
    }
  } else {
    return; // mất sóng khi kéo → chưa làm gì, lần sau thử lại (KHÔNG mất dữ liệu)
  }
  // Đẩy sổ dirty; và SEED sổ có sẵn mà server chưa có (data cũ trước khi bật sync).
  for (const kind of ACTIVE) {
    if (!seen.has(kind) && hasLocalData(kind) && metaOf(kind).at === 0) {
      setMeta(kind, { at: Date.now(), dirty: true });
    }
    if (metaOf(kind).dirty) await pushKind(kind);
  }
}

/** Danh sách kind đang đồng bộ (cho UI/nhắc). */
export const ACTIVE_SYNC_KINDS = ACTIVE;
export { SYNC_KINDS };
