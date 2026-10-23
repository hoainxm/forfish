/*
  VỊ TRÍ THẺ NỔI TRÊN BẢN ĐỒ — một luật cho 12 thẻ thông tin + menu chạm giữ (rà bố cục
  2026-10-22). Trước đây mỗi thẻ tự kẹp theo `window.innerWidth/innerHeight` với chiều cao
  ĐOÁN CỨNG (180–240px) ⇒ trên máy tính (khung app 480px giữa màn rộng) thẻ tràn khỏi khung
  bản đồ; thẻ dài hơn số đoán thì đè xuống dưới đáy. Nay kẹp theo KHUNG CHA THẬT (bản đồ)
  và KÍCH THƯỚC THẬT của thẻ, đo sau khi vẽ.

  Luật: canh giữa ngang theo điểm chạm, kẹp cách mép `le`; ưu tiên nằm DƯỚI điểm chạm
  (`cach` px), không đủ chỗ thì lật LÊN TRÊN, vẫn không đủ thì kẹp trong khung.
*/
export type KhungTheNoi = {
  /** điểm chạm, toạ độ trong khung cha */
  x: number;
  y: number;
  /** kích thước thẻ */
  w: number;
  h: number;
  /** kích thước khung cha (bản đồ) */
  pw: number;
  ph: number;
  /** lề tối thiểu tới mép khung — mặc định 8 */
  le?: number;
  /** khoảng cách thẻ ↔ điểm chạm — mặc định 12 */
  cach?: number;
};

export function viTriTheNoi({ x, y, w, h, pw, ph, le = 8, cach = 12 }: KhungTheNoi): {
  left: number;
  top: number;
  /** true = thẻ nằm TRÊN điểm chạm */
  tren: boolean;
} {
  const kep = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));
  const left = kep(x - w / 2, le, pw - w - le);
  const duoi = y + cach;
  if (duoi + h <= ph - le) return { left, top: duoi, tren: false };
  const tren = y - cach - h;
  if (tren >= le) return { left, top: tren, tren: true };
  return { left, top: kep(duoi, le, ph - h - le), tren: false };
}
