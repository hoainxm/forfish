// NHẮC HẠN GIẤY TỜ KHI MỞ APP — nửa TRONG MÁY của `lib/doc-reminders.ts`
// (2026-10-20, user: "làm cả thông báo khi mở app lên nữa").
//
// Thông báo điện thoại (cron máy chủ) KHÔNG tới được ba nhóm: máy chưa bật
// chuông / iPhone chưa "Thêm vào MH chính", giấy chỉ nằm trong máy (chưa đồng
// bộ được — ngoài biển mất sóng nhiều ngày), và máy mất sóng lúc cron chạy. Nên
// mở app lên thì tự xét lại CÙNG LỊCH MỐC (30·25·20·15·10 rồi hằng ngày 5→0,
// quá hạn mỗi 30 ngày ×3) từ kho máy — không mạng, chạy được ngoài khơi.
//
// SỔ "ĐÃ BÁO TRONG APP" riêng ở máy (`forfish.docRemindSeen.v1`), khoá cùng
// khuôn với sổ máy chủ (`<ref>.<hạn>.<mốc>`). Chạm thông báo điện thoại mở
// `/tau?tab=giay-to&nhac=<khoá>~…` ⇒ đánh dấu luôn các khoá đó, mở app lần sau
// không hiện lại đúng chuyện vừa đọc.
//
// Sổ này là bộ nhớ đệm "đã nhắc", KHÔNG phải dữ liệu của bà con: ghi hỏng thì
// chỉ hiện lại lời nhắc một lần nữa, không mất gì.

import { readUserList } from "@/lib/user-list-store";
import { addDaysIso } from "@/lib/days";
import {
  dueReminders,
  expiringItemsOf,
  parseDocPushUrl,
  type DueReminder,
} from "@/lib/doc-reminders";

export const DOC_REMIND_SEEN_KEY = "forfish.docRemindSeen.v1";
/** Bỏ khoá của hạn đã qua quá ngần này ngày (quá hạn nhắc tối đa tới −90). */
const SEEN_KEEP_DAYS = 120;

const KEY_EXPIRY = /\.(\d{4}-\d{2}-\d{2})\.[tq]\d+$/;

/** Giữ khoá còn dùng được: hạn chưa quá `SEEN_KEEP_DAYS`, khoá lạ thì bỏ. Thuần. */
export function pruneSeenKeys(keys: Iterable<string>, todayIso: string): string[] {
  const floor = addDaysIso(todayIso, -SEEN_KEEP_DAYS);
  const out = new Set<string>();
  for (const k of keys) {
    const m = KEY_EXPIRY.exec(k);
    if (m && m[1] >= floor) out.add(k);
  }
  return [...out];
}

export function loadSeenKeys(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const v: unknown = JSON.parse(window.localStorage.getItem(DOC_REMIND_SEEN_KEY) ?? "[]");
    return new Set(Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

export function markSeenKeys(keys: string[], todayIso: string): void {
  if (typeof window === "undefined" || keys.length === 0) return;
  const next = pruneSeenKeys([...loadSeenKeys(), ...keys], todayIso);
  try {
    window.localStorage.setItem(DOC_REMIND_SEEN_KEY, JSON.stringify(next));
  } catch {
    /* máy hết chỗ ⇒ lần mở sau nhắc lại một lần nữa — không mất dữ liệu */
  }
}

/** Mở từ thông báo điện thoại (`?nhac=`) ⇒ coi như đã báo các khoá đó. */
export function markSeenFromUrl(url: string, todayIso: string): void {
  markSeenKeys(parseDocPushUrl(url), todayIso);
}

/** Lời nhắc tới mốc mà app CHƯA báo, đọc thẳng kho máy. Gấp nhất trước. */
export function localDueReminders(todayIso: string): DueReminder[] {
  const list = (key: string) => {
    const r = readUserList<unknown>(key);
    return r.ok ? r.list : [];
  };
  const items = expiringItemsOf({
    documents: list("forfish.documents.v1"),
    crew: list("forfish.crew.v1"),
    boats: list("forfish.boats.v1"),
  });
  return dueReminders(items, loadSeenKeys(), todayIso);
}
