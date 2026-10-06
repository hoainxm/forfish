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
import { clearUserScopedData } from "@/lib/auth-scope";
import { offlineIdentityPhone } from "@/lib/offline-identity";
import { normalizeVnPhone } from "@/lib/phone";
import { liveIds, SYNC_KINDS, type SyncKind } from "@/lib/user-sync-core";

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
  /** BASE của gộp 3 chiều (2026-10-06): id các mục máy thấy ở lần đồng bộ
   *  gần nhất (nhận về hoặc đẩy lên xong). Vắng = chưa biết (máy đời cũ). */
  ids?: string[];
}
/** `_owner` = SĐT CHỦ của các cuốn đang nằm trong máy (2026-10-06). Khác người
 *  đang đăng nhập ⇒ sổ trong máy là của tài khoản trước ⇒ dọn, không đẩy. */
type MetaMap = Partial<Record<SyncKind, Meta>> & { _owner?: string };

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

/**
 * XOÁ SỔ MỐC ĐỒNG BỘ — cả bản trong BỘ NHỚ (`metaCache`) lẫn localStorage.
 * Gọi khi bà con TỰ ĐĂNG XUẤT / GỠ TÀI KHOẢN khỏi máy (trao máy cho người khác),
 * đi CÙNG lượt xoá dữ liệu chủ tàu (`clearUserScopedData`).
 *
 * VÌ SAO PHẢI XOÁ CẢ MỐC (không chỉ dữ liệu): đăng xuất xoá `forfish.boats.v1`…
 * nhưng để lại sổ mốc thì lần đăng nhập lại `syncAll` so LWW
 * `server.clientUpdatedAt > metaOf().at` HOÁ FALSE (mốc cũ còn nguyên = ngang
 * server) ⇒ KHÔNG kéo bản server về ⇒ CHỦ THẬT đăng nhập lại vẫn thấy TRỐNG.
 * Đưa mốc về 0 thì `server.at > 0` ⇒ kéo lại đủ.
 *
 * VÌ SAO XOÁ CẢ BẢN BỘ NHỚ: `metaCache` mới là nguồn sự thật trong phiên (xem
 * chú thích khối trên) — xoá mỗi localStorage thì phiên đang chạy VẪN so bằng
 * mốc cũ. Đặt `{}` (không phải `null`) để phiên này chắc chắn sạch kể cả khi
 * `removeItem` ném (máy chặn storage).
 *
 * KHÔNG BAO GIỜ ném.
 */
export function clearSyncMeta(): void {
  metaCache = {};
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(META_KEY);
  } catch {
    /* bản bộ nhớ đã sạch — phiên này so đúng, lần mở sau đọc ra "{}" */
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
  setMeta(kind, { at, dirty: false, ids: liveIds(data) ?? undefined });
  emitSync(kind);
}

/** SĐT chuẩn hoá, rỗng ⇒ null (so người cho đúng một khuôn với server). */
function phoneKey(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const p = normalizeVnPhone(raw);
  return p.length >= 10 ? p : null;
}

function setOwner(phone: string): void {
  const m = readMeta();
  m._owner = phone;
  try {
    window.localStorage.setItem(META_KEY, JSON.stringify(m));
  } catch {
    /* bản bộ nhớ đã đúng cho phiên này */
  }
}

/**
 * SỔ TRONG MÁY LÀ CỦA NGƯỜI KHÁC? (2026-10-06)
 *
 * Đường thật: máy A của chủ X bị đá (X đăng nhập máy B) — nhánh "bị đá" CỐ Ý
 * giữ dữ liệu để dùng ngoài biển. Rồi tài khoản Y đăng nhập máy A. Trước đây
 * không ai dọn: Y thấy tàu + giấy tờ + CCCD thuyền viên của X, và nếu sổ của X
 * còn "dirty" thì `syncAll` ĐẨY sổ của X vào tài khoản Y. Nay: chủ sổ khác
 * người server vừa xác nhận ⇒ xoá sổ chủ tàu trong máy + sổ mốc, rồi kéo đúng
 * của Y. Chỉ chạy khi SERVER trả SĐT (có sóng, đã đăng nhập) — mất sóng không
 * bao giờ dọn.
 */
function switchOwnerIfNeeded(serverPhone: string): void {
  const owner = readMeta()._owner;
  if (owner && owner !== serverPhone) {
    clearUserScopedData();
    clearSyncMeta();
    for (const k of ACTIVE) emitSync(k); // màn đang mở về trống ngay
  }
  if (readMeta()._owner !== serverPhone) setOwner(serverPhone);
}

/** Đẩy 1 sổ lên server. Giữ dirty nếu mất sóng/lỗi để lần sau thử lại. */
async function pushKind(kind: SyncKind): Promise<void> {
  /*  KHÔNG ĐẨY SỔ CỦA NGƯỜI KHÁC: chủ sổ trong máy khác người đang dùng máy
      ⇒ thôi, để `syncAll` (có server xác nhận) dọn rồi kéo đúng sổ. */
  const owner = readMeta()._owner;
  const me = phoneKey(offlineIdentityPhone());
  if (owner && me && owner !== me) return;
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
    // baseIds: null = chưa biết base ⇒ server gộp kiểu HỢP (không suy ra xoá)
    body: JSON.stringify({
      kind,
      data,
      clientUpdatedAt: at,
      baseIds: metaOf(kind).ids ?? null,
    }),
  });
  if (!res || !res.ok) return; // mất sóng / 401 / 5xx → giữ dirty
  const j = (await res.json().catch(() => null)) as {
    stale?: boolean;
    merged?: boolean;
    server?: { data: unknown; clientUpdatedAt: number };
  } | null;
  if (j?.server) {
    /*  Server trả cuốn ĐÃ GỘP (hoặc bản mới hơn — server đời cũ). Chỉ nhận về
        khi máy KHÔNG ghi thêm gì trong lúc chờ: có ghi thêm thì lượt đẩy của
        lần ghi đó đang đi, server sẽ gộp tiếp — nhận bây giờ là đè mất nó. */
    if (metaOf(kind).at === at) {
      adoptServer(kind, j.server.data, j.server.clientUpdatedAt);
    }
  } else {
    setMeta(kind, { dirty: false, ids: liveIds(data) ?? undefined });
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
      phone?: string;
      items?: { kind: SyncKind; data: unknown; clientUpdatedAt: number }[];
    } | null;
    if (!j?.ok) return; // trả lời lạ ⇒ chưa đụng gì, lần sau thử lại
    const serverPhone = phoneKey(j.phone);
    if (serverPhone) switchOwnerIfNeeded(serverPhone);
    if (Array.isArray(j.items)) {
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
        const m = metaOf(it.kind);
        if (it.clientUpdatedAt > m.at && !m.dirty) {
          adoptServer(it.kind, it.data, it.clientUpdatedAt); // server mới hơn → nhận
        } else if (!m.dirty && m.ids === undefined) {
          // máy đời cũ, sổ đã khớp server: lấy cuốn server làm BASE cho lần gộp sau
          const ids = liveIds(it.data);
          if (ids) setMeta(it.kind, { ids });
        }
      }
    }
  } else {
    return; // mất sóng khi kéo → chưa làm gì, lần sau thử lại (KHÔNG mất dữ liệu)
  }
  /*  Đẩy sổ dirty; và SEED MỌI sổ có dữ liệu mà server CHƯA CÓ DÒNG nào.
      Đổi 2026-10-06: bản cũ chỉ seed khi mốc = 0. Đo prod: 2 chủ tàu có giấy
      tờ trên server mà KHÔNG có dòng "tàu" — mốc tàu ≠ 0 (đã từng ghi) nhưng
      chưa lên được ⇒ không bao giờ seed lại ⇒ đăng nhập máy khác không có tàu,
      giấy gắn tàu bị ẩn. Server chưa có dòng nghĩa là không có gì để mất. */
  for (const kind of ACTIVE) {
    if (!seen.has(kind) && hasLocalData(kind)) {
      setMeta(kind, { at: metaOf(kind).at || Date.now(), dirty: true });
    }
    if (metaOf(kind).dirty) await pushKind(kind);
  }
}

/** Danh sách kind đang đồng bộ (cho UI/nhắc). */
export const ACTIVE_SYNC_KINDS = ACTIVE;
export { SYNC_KINDS };
