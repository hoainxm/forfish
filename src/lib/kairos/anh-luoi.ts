// BỐ CỤC LƯỚI ẢNH THẺ BÀI kiểu Facebook (post-card `Images`, 07 Kairos). THUẦN.
//  · 1 ảnh  ⇒ "mot": một ô theo tỉ lệ thật của ảnh (dọc 4:5, ngang theo ảnh, kẹp cao)
//  · 2 ảnh  ⇒ "hai": hai cột vuông
//  · 3 ảnh  ⇒ "ba" : ô trái cao hai hàng, hai ô phải
//  · ≥4 ảnh ⇒ "bon": lưới 2×2, ô thứ tư phủ "+N" (N = số ảnh còn lại)

export type KieuLuoi = "mot" | "hai" | "ba" | "bon";

export interface BoCucAnh {
  /** số ô hiện (0..4) */
  so: number;
  /** số "+N" phủ ô cuối (0 = không phủ) */
  them: number;
  /** null khi không có ảnh */
  kieu: KieuLuoi | null;
}

const KIEU: KieuLuoi[] = ["mot", "hai", "ba", "bon"];

export function boCucAnh(n: number): BoCucAnh {
  const tong = Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  if (!tong) return { so: 0, them: 0, kieu: null };
  const so = Math.min(tong, 4);
  return { so, them: tong - so, kieu: KIEU[so - 1] };
}
