// TRANG CHỦ THEO VAI (spec 17 §4.2) — phần thuần, có test (home-vai.test.ts).

import type { MarketListing } from "./market-listings-core";
import type { ViecHoSo, ViecTin } from "./viec";

/** Trần số tin bán hiện ở trang chủ vai Thu mua. */
export const CA_DANG_BAN_TOI_DA = 5;

/** Chữ so tỉnh / loài: thường + bỏ dấu + đ→d + gộp khoảng trắng ("Quảng Ngãi" = "quang  ngai"). */
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
  loaiMua: readonly string[] = [],
): (MarketListing & { dungLoai: boolean })[] {
  const tinh = chuanTinh(tinhCangNha);
  const gan = (l: MarketListing) => (tinh !== "" && chuanTinh(l.province) === tinh ? 0 : 1);
  return listings
    .filter((l) => l.side === "ban" && l.status === "open" && !l.mine)
    .map((l) => ({ ...l, dungLoai: khopLoai(l.species, loaiMua) }))
    .sort((a, b) => Number(b.dungLoai) - Number(a.dungLoai) || gan(a) - gan(b) || b.postedOn.localeCompare(a.postedOn))
    .slice(0, Math.max(0, n));
}

/**
 * Loài trong tin (chữ tự do: "Cá ngừ đại dương 1,2 tấn") có thuộc danh sách loài vựa mua không — so không dấu, hai
 * chiều chứa nhau ("ngừ" khớp "cá ngừ đại dương"). Mục loài ngắn hơn 2 ký tự bỏ qua (tránh "cá" khớp mọi thứ).
 */
export function khopLoai(loaiTin: string | undefined, loaiMua: readonly string[]): boolean {
  const t = chuanTinh(loaiTin).replace(/^ca /, "");
  if (!t) return false;
  return loaiMua.some((m) => {
    const k = chuanTinh(m).replace(/^ca /, "");
    return k.length >= 2 && (t.includes(k) || k.includes(t));
  });
}

/* ── ĐI BẠN: tin tuyển hợp hồ sơ ─────────────────────────────────────────── */

/** Số tin tuyển ở trang chủ Đi bạn. */
export const VIEC_TRANG_CHU = 3;

/**
 * Điểm khớp tin tuyển với hồ sơ tìm tàu: nghề (3) · vị trí (2) · cảng muốn đi (2). Không hồ sơ ⇒ 0 hết (chỉ xếp ngày).
 * `hopNghe` = khớp nghề — nhãn "Hợp nghề" trên thẻ.
 */
export function diemViec(t: ViecTin, h: Pick<ViecHoSo, "nghe" | "viTri" | "ports"> | null): number {
  if (!h) return 0;
  return (
    (h.nghe.includes(t.nghe) ? 3 : 0) +
    (t.viTri.some((v) => h.viTri.includes(v)) ? 2 : 0) +
    (h.ports.includes(t.portId) ? 2 : 0)
  );
}

/** Tin tuyển cho trang chủ Đi bạn: đang mở, không phải tin mình; khớp hồ sơ nhiều lên trước, rồi tin mới. */
export function viecHop(
  tin: readonly ViecTin[],
  hoSo: Pick<ViecHoSo, "nghe" | "viTri" | "ports"> | null,
  now: number,
  n = VIEC_TRANG_CHU,
): (ViecTin & { hopNghe: boolean })[] {
  return tin
    .filter((t) => t.status === "mo" && !t.cuaToi && Date.parse(t.expiresAt) > now)
    .map((t) => ({ t, d: diemViec(t, hoSo) }))
    .sort((a, b) => b.d - a.d || b.t.createdAt.localeCompare(a.t.createdAt))
    .slice(0, Math.max(0, n))
    .map(({ t }) => ({ ...t, hopNghe: !!hoSo && hoSo.nghe.includes(t.nghe) }));
}

/* ── THU MUA: giá tuần các loài mình mua ─────────────────────────────────── */

export const GIA_TRANG_CHU = 4;

/** Giá tuần cho trang chủ Thu mua: loài khớp hồ sơ vựa lên trước; không khai loài ⇒ n dòng đầu bảng. */
export function giaQuanTam<T extends { species: string }>(gia: readonly T[], loaiMua: readonly string[], n = GIA_TRANG_CHU): T[] {
  const khop = gia.filter((g) => khopLoai(g.species, loaiMua));
  const con = gia.filter((g) => !khop.includes(g));
  return [...khop, ...con].slice(0, Math.max(0, n));
}

/* ── ĐẠI LÝ: việc cần làm ngay ───────────────────────────────────────────── */

export type ViecDaiLy = { key: string; ten: string; href: string; so: number };

/**
 * Chỉ những việc CÓ SỐ (>0), theo thứ tự gấp: đơn chờ xác nhận · khách báo đã chuyển khoản · yêu cầu báo giá mới ·
 * món sắp hết. Rỗng ⇒ màn nói "Không có việc cần làm".
 */
export function viecDaiLy(s: {
  donCho: number;
  baoChuyen: number;
  yeuCauMoi: number;
  sapHet: number;
}): ViecDaiLy[] {
  const ds: ViecDaiLy[] = [
    { key: "don", ten: `${s.donCho} đơn chờ xác nhận`, href: "/ban-hang/don", so: s.donCho },
    { key: "chuyen", ten: `${s.baoChuyen} khách báo đã chuyển khoản`, href: "/ban-hang/don", so: s.baoChuyen },
    { key: "yeu-cau", ten: `${s.yeuCauMoi} khách cần món chợ chưa có`, href: "/ban-hang/yeu-cau", so: s.yeuCauMoi },
    { key: "sap-het", ten: `${s.sapHet} món sắp hết hàng`, href: "/ban-hang/san-pham?loc=sap-het", so: s.sapHet },
  ];
  return ds.filter((v) => Number.isFinite(v.so) && v.so > 0);
}
