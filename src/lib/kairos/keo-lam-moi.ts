// KAIROS — VUỐT XUỐNG LÀM MỚI: luật thuần (ngưỡng theo cỡ chữ gốc của máy, chế độ chữ to vẫn đúng).

/** Kéo xuống chừng này (rem) ở đầu trang rồi thả ⇒ làm mới. */
export const KEO_LAM_MOI = 4.5;

/** Ngưỡng px theo cỡ chữ gốc (px của 1rem). Cỡ lạ (0/NaN/âm) ⇒ coi 16. */
export function nguongKeo(remPx: number): number {
  const r = Number.isFinite(remPx) && remPx > 0 ? remPx : 16;
  return KEO_LAM_MOI * r;
}

export type TrangThaiKeo = "nghi" | "keo" | "tha";

/** `d` = quãng đã kéo (px, đã nặng tay). 0 ⇒ nghỉ; dưới ngưỡng ⇒ "Kéo để làm mới"; đủ ⇒ "Thả để làm mới". */
export function trangThaiKeo(d: number, nguong: number): TrangThaiKeo {
  if (!(d > 0)) return "nghi";
  return d >= nguong ? "tha" : "keo";
}
