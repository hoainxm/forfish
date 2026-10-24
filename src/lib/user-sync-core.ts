// ĐỒNG BỘ SỔ per-máy — phần THUẦN dùng chung route (server) + client.
// (không import gì phía trình duyệt/Node để cả hai bên dùng được, có test.)
import { dropDeleted, keepDeleted, stripDeleted } from "./sync-tombstone";

/** Các "sổ" được đồng bộ. P1 đấu boats/maintenance/materials; crew/documents ở P2/P3.
 *  PHẢI khớp check `kind in (...)` của migration 0050_user_docs.sql. */
export const SYNC_KINDS = [
  "boats",
  "maintenance",
  "materials",
  "crew",
  "documents",
] as const;

export type SyncKind = (typeof SYNC_KINDS)[number];

export function isSyncKind(x: unknown): x is SyncKind {
  return typeof x === "string" && (SYNC_KINDS as readonly string[]).includes(x);
}

/** Một dòng đồng bộ (server ↔ client cùng hình). `data` giữ NGUYÊN shape
 *  forfish.<kind>.v1 (mảng hoặc object), không diễn giải ở tầng sync. */
export interface SyncRow {
  kind: SyncKind;
  data: unknown;
  /** mốc ghi phía client (ms). Lớn hơn = mới hơn (last-write-wins mức kind). */
  clientUpdatedAt: number;
}

/** Bản ghi PUT hợp lệ chưa. Trả lý do lỗi (null = hợp lệ) để route trả code rõ. */
export function invalidPut(body: unknown): string | null {
  if (!body || typeof body !== "object") return "bad_body";
  const b = body as Record<string, unknown>;
  if (!isSyncKind(b.kind)) return "bad_kind";
  if (!("data" in b)) return "no_data";
  if (typeof b.clientUpdatedAt !== "number" || !Number.isFinite(b.clientUpdatedAt)) {
    return "bad_updated_at";
  }
  // Trần cỡ (rà Codex 2026-10-19). Đo prod cùng ngày: cuốn lớn nhất 787 ký tự,
  // 5 mục ⇒ trần cách xa hàng nghìn lần, chỉ chặn payload bất thường làm phình
  // jsonb. Ảnh giấy tờ đi route riêng (0051), không nằm trong cuốn.
  if (Array.isArray(b.data) && b.data.length > SYNC_MAX_ITEMS) return "too_large";
  if (JSON.stringify(b.data ?? null).length > SYNC_MAX_CHARS) return "too_large";
  return null;
}

/** Trần một cuốn sổ đồng bộ — xem invalidPut. */
export const SYNC_MAX_ITEMS = 5_000;
export const SYNC_MAX_CHARS = 2_000_000;

// ── QUYẾT ĐỊNH MỘT LẦN PUT (thuần — route chạy trong vòng CAS) ─────────────
//
// Route /api/me/sync đọc bản server (kèm `rev`), gọi hàm này, rồi ghi CÓ ĐIỀU
// KIỆN `rev = rev đã đọc` (0064). Trượt ⇒ đọc lại và gọi lại hàm này trên bản
// mới — nên quyết định phải thuần, không tự đọc/ghi gì.

export interface PutInput {
  kind: SyncKind;
  data: unknown;
  clientUpdatedAt: number;
  /** undefined = máy đời cũ không gửi base; null = gửi nhưng không biết */
  baseIds?: readonly string[] | null;
}

export type PutReply = {
  ok: true;
  stale?: true;
  merged?: true;
  server?: { kind: SyncKind; data: unknown; clientUpdatedAt: number };
};

export type PutDecision =
  | { action: "reply"; reply: PutReply }
  | { action: "write"; write: { data: unknown; clientUpdatedAt: number }; reply: PutReply };

export function decidePut(
  cur: { data: unknown; clientUpdatedAt: number } | null,
  put: PutInput,
  nowIso: string,
): PutDecision {
  const { kind, data, clientUpdatedAt } = put;
  /*  GỘP THEO MỤC (máy mới gửi `baseIds`). Cuốn không phải mảng mục có `id`
      ⇒ mergeById trả null ⇒ rơi xuống luật cũ bên dưới. */
  if (put.baseIds !== undefined && cur) {
    const merged = mergeById(cur.data, data, put.baseIds, clientUpdatedAt >= cur.clientUpdatedAt);
    if (merged) {
      const serverLive = stripDeleted(cur.data);
      // Gộp xong y hệt server ⇒ không ghi, chỉ trả về để máy nhận cho khớp.
      if (JSON.stringify(merged) === JSON.stringify(serverLive)) {
        return {
          action: "reply",
          reply: { ok: true, server: { kind, data: serverLive, clientUpdatedAt: cur.clientUpdatedAt } },
        };
      }
      // Mốc mới PHẢI lớn hơn mốc server: máy khác so `server > mốc của mình`
      // để biết có bản mới mà kéo về.
      const newAt = Math.max(clientUpdatedAt, cur.clientUpdatedAt + 1);
      return {
        action: "write",
        write: { data: keepDeleted(cur.data, merged, nowIso), clientUpdatedAt: newAt },
        reply: { ok: true, merged: true, server: { kind, data: merged, clientUpdatedAt: newAt } },
      };
    }
  }
  // LAST-WRITE-WINS nguyên cuốn: bản server mới hơn thì KHÔNG đè — trả về để
  // máy nhận (cùng luật GET: không mang theo thứ đã xoá).
  if (cur && cur.clientUpdatedAt > clientUpdatedAt) {
    return {
      action: "reply",
      reply: {
        ok: true,
        stale: true,
        server: { kind, data: stripDeleted(cur.data), clientUpdatedAt: cur.clientUpdatedAt },
      },
    };
  }
  /*  GIỮ BẢN ĐÃ XOÁ Ở SERVER (chủ dự án 2026-09-01): bản ghi biến mất so với
      lần đẩy trước thì Ở LẠI trong cuốn với cờ `_deleted` — GET lọc bỏ.
      DẤU XOÁ THẮNG (2026-10-24): máy chưa biết tin xoá mà đẩy cả cuốn còn mục
      đó thì KHÔNG cho nó sống lại; trả cuốn đã lọc để máy đó bỏ theo. */
  const sach = dropDeleted(cur?.data, data);
  const boBot = sach !== data;
  return {
    action: "write",
    write: { data: keepDeleted(cur?.data, sach, nowIso), clientUpdatedAt },
    reply: boBot
      ? { ok: true, server: { kind, data: sach, clientUpdatedAt } }
      : { ok: true },
  };
}

// ── GỘP THEO TỪNG MỤC (2026-10-06) ──────────────────────────────────────────
//
// User: "mỗi tài khoản lưu trữ và quản lý hồ sơ tàu của họ, đăng nhập ở thiết
// bị khác vẫn xem được, hiện tại thì không". Luật cũ = LAST-WRITE-WINS NGUYÊN
// CUỐN: máy nào ghi sau thì cả cuốn của máy đó đè lên server. Hai máy (điện
// thoại + máy tính, hay máy cũ vừa bị đá còn sổ chưa đẩy) là mất đồ thật — đo
// prod cùng ngày: có giấy tờ trỏ vào tàu KHÔNG còn trên server (tàu tạo ở một
// máy, cuốn "tàu" của máy kia đè mất), tàu đó không tombstone vì server chưa
// từng thấy nó.
//
// Nay: GỘP 3 CHIỀU THEO `id`, với BASE = tập id máy đã thấy ở lần đồng bộ trước
// (giữ trong `forfish.sync.v1`). Nhờ base mới phân biệt được hai chuyện trông
// y hệt nhau trên một cuốn sổ:
//   · id vắng ở máy, có ở base  ⇒ MÁY XOÁ        ⇒ bỏ
//   · id vắng ở máy, không ở base ⇒ MÁY KHÁC THÊM ⇒ giữ
//   · id có ở máy, vắng ở server mà có ở base ⇒ MÁY KHÁC XOÁ ⇒ bỏ
//   · id có ở máy, không ở base   ⇒ MÁY THÊM      ⇒ giữ
//   · có ở cả hai ⇒ bản của bên GHI SAU (mốc cuốn) thắng
// Không biết base (máy đời cũ, lần đầu sau cập nhật) ⇒ KHÔNG suy ra "máy xoá":
// thà một mục đã xoá hiện lại (bấm xoá lại được) còn hơn mất đồ (không lấy lại
// được). Bản ghi server đã gắn `_deleted` thì luôn coi là đã xoá.

type IdItem = Record<string, unknown> & { id: string };

function asIdItems(v: unknown): IdItem[] | null {
  if (!Array.isArray(v)) return null;
  for (const x of v) {
    if (!x || typeof x !== "object" || Array.isArray(x)) return null;
    if (typeof (x as { id?: unknown }).id !== "string") return null;
  }
  return v as IdItem[];
}

/** Id các mục CÒN SỐNG của một cuốn (bỏ `_deleted`); null = không phải mảng
 *  mục có `id` (cuốn dạng khác ⇒ không gộp được, giữ luật cũ). */
export function liveIds(data: unknown): string[] | null {
  const items = asIdItems(data);
  if (!items) return null;
  return items.filter((x) => x._deleted !== true).map((x) => x.id);
}

/** Base gửi kèm PUT hợp lệ chưa: null (không biết) hoặc mảng chuỗi có trần. */
export function isValidBaseIds(v: unknown): v is string[] | null {
  if (v === null) return true;
  return (
    Array.isArray(v) && v.length <= 10_000 && v.every((x) => typeof x === "string")
  );
}

/**
 * Gộp cuốn của MÁY vào cuốn của SERVER. Trả `null` khi không gộp được (một bên
 * không phải mảng mục có `id`) ⇒ chỗ gọi giữ luật cũ.
 *
 * @param server   cuốn đang nằm trên server (CÓ THỂ chứa mục `_deleted`)
 * @param device   cuốn máy vừa đẩy lên
 * @param baseIds  id máy thấy ở lần đồng bộ trước; null = không biết
 * @param deviceWins mục có ở cả hai thì lấy bản của máy (máy ghi sau)
 */
export function mergeById(
  server: unknown,
  device: unknown,
  baseIds: readonly string[] | null,
  deviceWins: boolean,
): IdItem[] | null {
  const sv = asIdItems(server);
  const dv = asIdItems(device);
  if (!sv || !dv) return null;
  const base = baseIds ? new Set(baseIds) : null;
  const sLive = new Map<string, IdItem>();
  const sDead = new Set<string>();
  for (const x of sv) {
    if (x._deleted === true) sDead.add(x.id);
    else sLive.set(x.id, x);
  }
  const out: IdItem[] = [];
  const taken = new Set<string>();
  for (const x of dv) {
    if (taken.has(x.id)) continue; // id trùng trong cùng cuốn — giữ cái đầu
    const s = sLive.get(x.id);
    if (s) {
      out.push(deviceWins ? x : s);
    } else if (sDead.has(x.id)) {
      continue; // server đã ghi nhận xoá (máy khác hoặc chính máy này trước đó)
    } else if (base && base.has(x.id)) {
      continue; // máy đã thấy nó trên server, nay server không còn ⇒ máy khác xoá
    } else {
      out.push(x); // máy thêm
    }
    taken.add(x.id);
  }
  for (const [id, s] of sLive) {
    if (taken.has(id)) continue;
    if (base && base.has(id)) continue; // máy đã thấy rồi xoá đi ⇒ máy xoá
    out.push(s); // máy khác thêm (hoặc không biết base ⇒ giữ, không đoán là xoá)
    taken.add(id);
  }
  return out;
}
