// VỊ TRÍ ICON SEN BIỂN — kéo đi được, nhớ trong máy (thuần + kho, có test).
//
// Chủ dự án 2026-10-17: "cái float sen biển gốc phải cho phép kéo đi được". Vị trí
// lưu theo MÉP TRÁI + MÉP ĐÁY (px) của icon trong khung bản đồ — đáy để icon bám
// dải dưới như cũ khi màn đổi cao (bàn phím bật, xoay máy). Luôn kẹp trong khung.

/** Khoá forfish.* (ops/state-registry.md) — chuyện của MÁY NÀY, không sao lưu. */
export const SEN_VI_TRI_KEY = "forfish.senbien.vitri.v1";

export type ViTriIcon = { left: number; bottom: number };

/** Chỗ cũ của icon nổi: `left-2` (8px), `bottom-36` (144px). */
export const VI_TRI_GOC: ViTriIcon = { left: 8, bottom: 144 };

/** Cỡ icon (h-16 w-16) và lề tối thiểu với mép khung. */
export const ICON_PX = 64;
const LE = 8;

/** Kẹp icon trong khung `w × h`; số hỏng ⇒ chỗ gốc. */
export function kepViTri(p: ViTriIcon, w: number, h: number): ViTriIcon {
  const ok = (v: number) => Number.isFinite(v);
  const base = ok(p.left) && ok(p.bottom) ? p : VI_TRI_GOC;
  if (!(w > 0 && h > 0)) return base;
  const maxL = Math.max(LE, w - ICON_PX - LE);
  const maxB = Math.max(LE, h - ICON_PX - LE);
  return {
    left: Math.round(Math.min(maxL, Math.max(LE, base.left))),
    bottom: Math.round(Math.min(maxB, Math.max(LE, base.bottom))),
  };
}

/** Kéo quá ngần này (px) mới tính là kéo — dưới đó là chạm (gọi). */
export const NGUONG_KEO_PX = 8;

export function laKeo(dx: number, dy: number): boolean {
  return Math.hypot(dx, dy) > NGUONG_KEO_PX;
}

/**
 * Bong bóng mở về PHÍA NÀO của icon: icon ở nửa trên khung ⇒ mở xuống dưới,
 * nửa dưới ⇒ mở lên trên; icon ở nửa phải ⇒ canh theo mép phải icon.
 */
export function huongBongBong(p: ViTriIcon, w: number, h: number): { len: boolean; phai: boolean } {
  const tamY = h - p.bottom - ICON_PX / 2; // từ mép trên
  const tamX = p.left + ICON_PX / 2;
  return { len: !(h > 0) || tamY > h * 0.4, phai: w > 0 && tamX > w / 2 };
}

export function docViTri(): ViTriIcon {
  try {
    const raw = window.localStorage.getItem(SEN_VI_TRI_KEY);
    if (!raw) return VI_TRI_GOC;
    const v = JSON.parse(raw) as Partial<ViTriIcon>;
    return typeof v?.left === "number" && typeof v?.bottom === "number" ? { left: v.left, bottom: v.bottom } : VI_TRI_GOC;
  } catch {
    return VI_TRI_GOC;
  }
}

/** Ghi hỏng (riêng tư/đầy) thì thôi — chỉ mất chỗ đã kéo, không mất dữ liệu bà con. */
export function ghiViTri(p: ViTriIcon): void {
  try {
    window.localStorage.setItem(SEN_VI_TRI_KEY, JSON.stringify(p));
  } catch {
    /* bỏ qua */
  }
}
