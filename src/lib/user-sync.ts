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
//
// NỢ NÀY CHỦ DỰ ÁN CHỐT BỎ QUA (2026-09-01): *"ko xảy ra tình trạng đó nên ko
// cần lo"* — mỗi chủ tàu dùng MỘT máy, nên cảnh "máy A xoá, máy B chưa biết mà
// sửa sau rồi ghi đè" không có thật ngoài hiện trường. Đừng đầu tư merge từng
// dòng cho tới khi có ca hai máy thật. Hành vi hiện tại đã chốt bằng test
// (`sync-tombstone.test.ts` — ca "MÁY CŨ chưa biết tin xoá"): nó là QUYẾT ĐỊNH,
// không phải tai nạn.

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

/*  ── SỔ BOOKKEEPING GIỮ TRONG BỘ NHỚ, localStorage CHỈ LÀ BẢN LƯU ──────────
    Sửa 2026-09-01 (chủ dự án: *"t xoá việc đó rồi thì có lý do gì nó hiện lại
    ko? bug?"* — có, đây là một trong các đường).

    LỖI CŨ: `setMeta` ghi thẳng localStorage và NUỐT lỗi kèm chú thích "máy chặn
    localStorage → thôi, không hỏng gì". Hỏng thật, và hỏng đúng chỗ đau nhất:
    dữ liệu (`forfish.maintenance.v1`) và mốc thời gian (`forfish.sync.v1`) là
    HAI lần ghi riêng. Máy chật — chuyện thường trên điện thoại có bản đồ +
    ảnh giấy tờ — thì ghi dữ liệu lọt mà ghi mốc rớt. Hệ quả dây chuyền:

      xoá một việc  →  dữ liệu mới ghi được, mốc VẪN LÀ SỐ CŨ
                    →  `pushKind` gửi lên mốc cũ ⇒ server trả `stale`
                    →  `adoptServer` GHI ĐÈ bản vừa xoá bằng bản cũ của server
                    →  việc hiện lại y nguyên, không một lời báo.

    Cùng đường đó ở nhánh kéo: `server.clientUpdatedAt > metaOf().at` cũng ra
    `adoptServer`. Bà con xoá bao nhiêu lần cũng thấy nó về.

    NAY: bản đồ mốc sống trong biến module, đọc localStorage đúng MỘT lần lúc
    khởi động. Mọi phép so đều đọc bộ nhớ, nên ghi localStorage rớt cũng không
    làm sai mốc trong phiên đang chạy. localStorage thành BẢN LƯU cho lần mở
    sau, không còn là nguồn sự thật.

    NỢ CÒN LẠI (nói thẳng, đừng để người sau tưởng đã kín): tắt app khi máy đang
    chật VÀ sổ chưa đẩy được lên server thì lần mở sau mốc về 0, server thắng,
    sửa đổi offline đó vẫn mất. Bịt hẳn phải ghi mốc CHUNG một lần với dữ liệu
    (một khoá, một lần ghi) — việc đó đụng khuôn lưu của cả 5 sổ, để đợt riêng. */
let metaCache: MetaMap | null = null;

function readMeta(): MetaMap {
  if (metaCache) return metaCache;
  try {
    metaCache = JSON.parse(
      window.localStorage.getItem(META_KEY) ?? "{}",
    ) as MetaMap;
  } catch {
    metaCache = {};
  }
  return metaCache;
}
function metaOf(kind: SyncKind): Meta {
  return readMeta()[kind] ?? { at: 0, dirty: false };
}
/** Trả `false` khi KHÔNG lưu được xuống máy (mốc vẫn đúng trong phiên này). */
function setMeta(kind: SyncKind, patch: Partial<Meta>): boolean {
  const m = readMeta();
  m[kind] = { ...(m[kind] ?? { at: 0, dirty: false }), ...patch };
  try {
    window.localStorage.setItem(META_KEY, JSON.stringify(m));
    return true;
  } catch {
    /*  Không lưu được thì THÔI, nhưng `metaCache` đã cập nhật nên mọi phép so
        trong phiên này vẫn đúng — đó mới là thứ chặn được cảnh xoá-rồi-hiện-lại. */
    return false;
  }
}

/** Chỉ dùng cho test — dựng lại trạng thái sạch giữa các ca. */
export function __resetSyncMetaCache(): void {
  metaCache = null;
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
        /*  KHÔNG NHẬN BẢN SERVER ĐÈ LÊN SỬA ĐỔI CHƯA KỊP ĐẨY (2026-09-01).
            `dirty` = máy này có sửa mà chưa lên được server (sửa lúc mất
            sóng — ca thường trực của ngư dân). Nhận về lúc đó là ghi đè đúng
            thứ bà con vừa làm bằng bản server chưa hề biết tới nó: xoá một
            việc bảo dưỡng giữa biển, có sóng lại là nó về chỗ cũ.
            Bỏ qua lượt này thôi, KHÔNG mất bản server: vòng ngay dưới sẽ đẩy
            bản của máy lên, và nếu server thật sự mới hơn thì `pushKind` nhận
            câu trả lời `stale` rồi mới nhận về — lúc đó máy đã đẩy xong nên
            không còn gì để mất. */
        if (it.clientUpdatedAt > metaOf(it.kind).at && !metaOf(it.kind).dirty) {
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
