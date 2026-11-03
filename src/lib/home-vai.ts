// TRANG CHỦ THEO VAI (spec 17 §4.2) — phần thuần, có test (home-vai.test.ts).

import type { MarketListing } from "./market-listings-core";

/** Trần số tin bán hiện ở trang chủ vai Thu mua. */
export const CA_DANG_BAN_TOI_DA = 5;

/** Chữ so tỉnh: thường + bỏ dấu + đ→d + gộp khoảng trắng ("Quảng Ngãi" = "quang  ngai"). */
const chuanTinh = (s: string | undefined): string =>
  (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/**
 * "Cá đang bán gần cảng" cho vai Thu mua: tin BÁN đang mở, không phải tin của mình; cùng tỉnh cảng nhà lên trước,
 * trong mỗi nhóm tin mới trước. Chưa khai cảng ⇒ chỉ xếp theo ngày.
 */
export function caDangBan(
  listings: readonly MarketListing[],
  tinhCangNha: string | undefined,
  n = CA_DANG_BAN_TOI_DA,
): MarketListing[] {
  const tinh = chuanTinh(tinhCangNha);
  const gan = (l: MarketListing) => (tinh !== "" && chuanTinh(l.province) === tinh ? 0 : 1);
  return listings
    .filter((l) => l.side === "ban" && l.status === "open" && !l.mine)
    .slice()
    .sort((a, b) => gan(a) - gan(b) || b.postedOn.localeCompare(a.postedOn))
    .slice(0, Math.max(0, n));
}
