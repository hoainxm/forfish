// NHẮC HẠN GIẤY TỜ QUA THÔNG BÁO ĐIỆN THOẠI — luật THUẦN (2026-10-06).
//
// User: "báo nhắc nhở/đổ chuông trên điện thoại khi sắp tới thời hạn hết giấy an
// toàn thực phẩm, phép khai thác, an toàn kỹ thuật, bảo hiểm,...". Trước đây hạn
// giấy chỉ hiện ở dải khẩn Trang chủ — bà con phải MỞ app mới thấy. Nay cron
// `/api/cron/notify-docs` mỗi sáng đọc bản đồng bộ (`user_docs`, kind documents +
// crew + boats) rồi đẩy Web Push: điện thoại REO như tin nhắn, app đóng vẫn reo.
//
// Không fetch, không DB, không Date.now() trong thân hàm ⇒ test được trọn vẹn.
//
// MỐC NHẮC: 30 · 15 · 7 · 3 · 1 ngày trước + đúng hôm hết hạn (0). Mỗi mốc MỘT
// lần cho MỘT ngày hết hạn. Cron lỡ vài hôm thì gửi đúng mốc HIỆN TẠI, không dồn
// mọi mốc đã qua (bà con không cần 3 tin cùng lúc nói cùng một chuyện).
// ĐÃ QUÁ HẠN: nhắc lại mỗi 30 ngày, tối đa 3 lần — giấy phép khai thác hết hạn là
// không được ra khơi, nhắc một lần rồi im là không đủ; nhắc mãi thì thành rác.
//
// KHỬ TRÙNG KHÔNG CẦN MIGRATION (cùng khuôn bão — lib/storm-push.ts): mỗi lần
// đẩy ghi 1 dòng `push_messages` (sent_by='system:docs', target_phone) với `url`
// = `/tau?tab=giay-to&nhac=<khoá>~<khoá>`. URL vừa là đường mở đúng tab khi chạm,
// vừa là SỔ ĐÃ GỬI. Khoá = `<loại>.<id>.<ngày hết hạn>.<mốc>` ⇒ gia hạn giấy (ngày
// hết hạn mới) tự sinh khoá mới, nhắc lại từ đầu.
//
// MỘT TIN/CHỦ TÀU/LƯỢT: gộp mọi giấy tới mốc trong cùng buổi sáng vào một thông
// báo (≤1 lần/ngày — đúng nhịp tầng 3 của 07 §12). Cùng `tag` ⇒ tin mới ĐÈ tin
// cũ trên máy, không xếp chồng.

import { daysUntil } from "@/lib/days";
import { formatVnDate } from "@/lib/format";
import { kindLabel, type DocumentKind } from "@/lib/documents";

export const DOC_PUSH_SENT_BY = "system:docs";
export const DOC_PUSH_TAG = "giay-to";
/** Mốc nhắc trước hạn (ngày). Thứ tự tăng dần. */
export const DOC_REMIND_DAYS = [0, 1, 3, 7, 15, 30] as const;
/** Quá hạn: nhắc lại mỗi ngần này ngày … */
export const DOC_OVERDUE_EVERY_DAYS = 30;
/** … tối đa ngần này lần. */
export const DOC_OVERDUE_MAX = 3;
/** Cửa sổ đọc lại "đã gửi": phủ trọn 30 ngày trước hạn + nhịp quá hạn. */
export const DOC_SENT_WINDOW_DAYS = 45;
/** Một tin liệt kê tối đa ngần này dòng, còn lại "và N giấy khác". */
const MAX_LINES = 3;

/** Một thứ có hạn của chủ tàu — rút từ giấy tờ tàu hoặc sổ thuyền viên. */
export interface ExpiringItem {
  /** khoá ổn định: `doc:<id>` · `crew-bh:<id>` · `crew-cc:<id>` */
  ref: string;
  /** câu gọi tên cho bà con đọc, đã kèm tên tàu/người nếu cần */
  label: string;
  expiresOn: string; // YYYY-MM-DD
}

/** Mốc HIỆN TẠI của một hạn; null = chưa tới mốc nào / đã nhắc đủ quá hạn. */
export function reminderStep(days: number): string | null {
  if (!Number.isFinite(days)) return null;
  if (days >= 0) {
    const m = DOC_REMIND_DAYS.find((d) => days <= d);
    return m == null ? null : `t${m}`;
  }
  const lan = Math.floor((-days - 1) / DOC_OVERDUE_EVERY_DAYS);
  return lan < DOC_OVERDUE_MAX ? `q${lan}` : null;
}

export function reminderKey(item: ExpiringItem, step: string): string {
  return `${item.ref}.${item.expiresOn}.${step}`;
}

/** Khoá đi trong URL — chỉ giữ ký tự an toàn (id cũ có thể lạ). */
function urlSafe(k: string): string {
  return k.replace(/[^A-Za-z0-9._:-]/g, "_");
}

export function docPushUrl(keys: string[]): string {
  return `/tau?tab=giay-to&nhac=${keys.map(urlSafe).join("~")}`;
}

/** Đọc lại khoá đã gửi từ URL các dòng push_messages cũ. URL lạ ⇒ bỏ qua. */
export function parseDocPushUrl(url: string | null | undefined): string[] {
  if (!url) return [];
  const m = /[?&]nhac=([^&#]*)/.exec(url);
  if (!m || !m[1]) return [];
  return m[1].split("~").filter(Boolean);
}

export interface DueReminder {
  item: ExpiringItem;
  days: number;
  key: string;
}

/** Các hạn tới mốc mà CHƯA gửi; xếp gấp nhất trước. */
export function dueReminders(
  items: ExpiringItem[],
  sentKeys: ReadonlySet<string>,
  todayIso: string,
): DueReminder[] {
  const out: DueReminder[] = [];
  for (const item of items) {
    if (!item.expiresOn) continue;
    const days = daysUntil(item.expiresOn, todayIso);
    const step = reminderStep(days);
    if (!step) continue;
    const key = urlSafe(reminderKey(item, step));
    if (sentKeys.has(key)) continue;
    out.push({ item, days, key });
  }
  return out.sort((a, b) => a.days - b.days);
}

function whenText(days: number, expiresOn: string): string {
  if (days < 0) return `đã quá hạn ${-days} ngày`;
  if (days === 0) return "hết hạn HÔM NAY";
  return `còn ${days} ngày (hết ${formatVnDate(expiresOn)})`;
}

/** Tiêu đề + thân thông báo. Giọng "bà con", không jargon. */
export function docPushMessage(due: DueReminder[]): { title: string; body: string } {
  const expired = due.some((d) => d.days <= 0);
  const title = expired ? "Giấy tờ đã hết hạn" : "Giấy tờ sắp hết hạn";
  const lines = due
    .slice(0, MAX_LINES)
    .map((d) => `${d.item.label} ${whenText(d.days, d.item.expiresOn)}.`);
  if (due.length > MAX_LINES) lines.push(`Và ${due.length - MAX_LINES} giấy khác.`);
  lines.push("Bà con lo gia hạn sớm để khỏi bị phạt.");
  return { title, body: lines.join(" ") };
}

// ── Rút hạn từ bản đồng bộ (`user_docs.data` — jsonb do máy bà con ghi) ─────
// Dữ liệu từ máy ⇒ KHÔNG tin shape: mảng hỏng / dòng thiếu trường ⇒ bỏ dòng đó.

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const str = (v: unknown): string | undefined =>
  typeof v === "string" && v.trim() ? v.trim() : undefined;
const asArray = (v: unknown): Record<string, unknown>[] =>
  Array.isArray(v)
    ? v.filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
    : [];

/**
 * Giấy tờ tàu + bảo hiểm/chứng chỉ thuyền viên → danh sách hạn.
 * Nhiều tàu ⇒ kèm tên tàu ("Tàu Bình Minh: …") — đúng AC-7 của 08 (việc đa tàu
 * phải nói rõ của tàu nào). Giấy cũ chưa gắn tàu = của tàu đầu (như màn Giấy tờ).
 */
export function expiringItemsOf(input: {
  documents: unknown;
  crew: unknown;
  boats: unknown;
}): ExpiringItem[] {
  const boats = asArray(input.boats);
  const boatName = new Map<string, string>();
  for (const b of boats) {
    const id = str(b.id);
    if (id) boatName.set(id, str(b.name) ?? "tàu");
  }
  const many = boatName.size > 1;
  const items: ExpiringItem[] = [];

  for (const d of asArray(input.documents)) {
    const id = str(d.id);
    const exp = str(d.expiresOn);
    if (!id || !exp || !ISO.test(exp)) continue;
    const kind = (str(d.kind) ?? "khac") as DocumentKind;
    const name = str(d.label) ?? kindLabel(kind);
    const bid = str(d.boatId);
    const prefix = many && bid && boatName.has(bid) ? `${boatName.get(bid)}: ` : "";
    items.push({ ref: `doc:${id}`, label: `${prefix}${name}`, expiresOn: exp });
  }

  for (const c of asArray(input.crew)) {
    const id = str(c.id);
    if (!id) continue;
    const who = str(c.name) ?? "thuyền viên";
    const bh = str(c.insuranceExpiry);
    if (c.hasInsurance === true && bh && ISO.test(bh)) {
      items.push({ ref: `crew-bh:${id}`, label: `Bảo hiểm của ${who}`, expiresOn: bh });
    }
    const cc = str(c.certExpiry);
    if (cc && ISO.test(cc)) {
      items.push({
        ref: `crew-cc:${id}`,
        label: `${str(c.certLabel) ?? "Chứng chỉ"} của ${who}`,
        expiresOn: cc,
      });
    }
  }
  return items;
}
