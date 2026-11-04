/*
  LOÀI BÀ CON ĐÁNH (2026-11-04, anh Long: "dự báo tất cả các loài đang ko cần thiết,
  lúc vô đó nên chọn loài nào đó, cho chọn 2-3 loài").

  Bà con chỉ đánh vài loài theo nghề của tàu. Vào lớp Dự báo cá lần đầu ⇒ hỏi "đánh
  loài nào?", chọn tối đa 3; lưu trong máy (`forfish.fishPicks.v1`) để lần sau mở là
  thấy ngay. Bản đồ chỉ tô theo các loài đã chọn: điểm ô = điểm CAO NHẤT trong các loài
  đó (ô có một loài mình đánh là đáng đi).

  "Thông minh" ở hai chỗ, đều tính trong máy (không cần sóng):
  · chạm NGHỀ (Câu ngừ / Lưới vây / …) ⇒ điền sẵn 3 loài của nghề đó, ưu tiên loài
    ĐANG VỤ ở vùng đang xem;
  · danh sách gợi ý = loài đang vụ ở vùng đang xem, xếp đầu.
*/
import type { Nghe } from "@/lib/lo-trinh/types";

export const MAX_FISH_PICKS = 3;
const KHO = "forfish.fishPicks.v1";

/** Loài chính theo nghề (tên ngắn = khoá SPECIES_META). Thứ tự = loài hay gặp nhất trước. */
export const LOAI_THEO_NGHE: Record<Nghe, string[]> = {
  "cau-ngu": ["ngừ vây vàng", "ngừ mắt to", "ngừ vằn", "cá cờ", "nục heo"],
  "luoi-vay": ["cá nục", "cá cơm", "cá trích", "bạc má", "cá tráo", "cá sòng", "ngừ vằn"],
  "luoi-re": ["cá thu", "ngừ chù", "ngừ ồ", "ngừ chấm", "cá ngân", "cá chim"],
  "chup-muc": ["mực xà", "mực ống", "cá cơm"],
};

/** Gợi ý 3 loài cho một nghề: chỉ loài bản đồ có, loài đang vụ ở vùng lên trước. */
export function goiYTheoNghe(
  nghe: Nghe,
  available: readonly string[],
  dangVu: ReadonlySet<string>,
): string[] {
  const co = new Set(available);
  const ds = LOAI_THEO_NGHE[nghe].filter((s) => co.has(s));
  const xep = [...ds.filter((s) => dangVu.has(s)), ...ds.filter((s) => !dangVu.has(s))];
  return xep.slice(0, MAX_FISH_PICKS);
}

/** Nghề khớp đúng bộ loài đang chọn (để chip nghề sáng lại khi mở lại), không khớp ⇒ null. */
export function ngheCuaBo(
  picks: readonly string[],
  available: readonly string[],
  dangVu: ReadonlySet<string>,
): Nghe | null {
  if (!picks.length) return null;
  const key = [...picks].sort().join("|");
  for (const n of Object.keys(LOAI_THEO_NGHE) as Nghe[]) {
    if ([...goiYTheoNghe(n, available, dangVu)].sort().join("|") === key) return n;
  }
  return null;
}

/** Bật/tắt một loài, giữ trần 3 (đầy thì không thêm — chip khác mờ đi). */
export function togglePick(picks: readonly string[], sp: string): string[] {
  if (picks.includes(sp)) return picks.filter((s) => s !== sp);
  if (picks.length >= MAX_FISH_PICKS) return [...picks];
  return [...picks, sp];
}

/** Điểm ô theo bộ loài: cao nhất trong các loài đã chọn. Bộ rỗng ⇒ điểm chung `s`. */
export function diemTheoBo(
  cell: { s: number; sp?: Record<string, number> },
  picks: readonly string[],
): number {
  if (!picks.length) return cell.s;
  let m = 0;
  for (const p of picks) m = Math.max(m, cell.sp?.[p] ?? 0);
  return m;
}

/** Loài nổi ở ô theo bộ: các loài đã chọn, điểm cao trước, bỏ loài 0 điểm. */
export function loaiNoiTheoBo(
  cell: { top: string[]; sp?: Record<string, number> },
  picks: readonly string[],
): string[] {
  if (!picks.length) return cell.top;
  return picks
    .filter((p) => (cell.sp?.[p] ?? 0) > 0)
    .sort((a, b) => (cell.sp?.[b] ?? 0) - (cell.sp?.[a] ?? 0));
}

/** Đọc bộ đã lưu. null = CHƯA chọn lần nào (⇒ mở bước chọn). Hỏng/không đọc được ⇒ null. */
export function loadFishPicks(): string[] | null {
  try {
    const raw = globalThis.localStorage?.getItem(KHO);
    if (!raw) return null;
    const v: unknown = JSON.parse(raw);
    if (!Array.isArray(v)) return null;
    const ds = v.filter((x): x is string => typeof x === "string").slice(0, MAX_FISH_PICKS);
    return ds.length ? ds : null;
  } catch {
    return null;
  }
}

/** Lưu bộ; trả false khi máy không cho ghi (chế độ ẩn danh…) để caller vẫn dùng trong phiên. */
export function saveFishPicks(picks: readonly string[]): boolean {
  try {
    globalThis.localStorage?.setItem(KHO, JSON.stringify(picks.slice(0, MAX_FISH_PICKS)));
    return true;
  } catch {
    return false;
  }
}
