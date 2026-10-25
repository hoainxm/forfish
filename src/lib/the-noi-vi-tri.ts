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

/*
  NEO CẠNH NÚT (luật 03 §6 mục 9, anh Long 2026-10-23: "click từ nút thì nó hiện ra bên cạnh
  nút vì lúc đó tay họ đang ở gần nút rồi, tự dưng kéo xuống dưới cả thì nó không thuận
  tiện"). Popover / menu / danh sách chọn ngắn mở từ một nút nằm NGAY CẠNH nút đó.

  Dọc: ưu tiên DƯỚI nút; không đủ chỗ thì lật LÊN; cả hai phía đều chật thì chọn phía rộng
  hơn và trả `maxH` để lớp nổi cuộn trong (không bao giờ tràn khung). Ngang: nút ở nửa phải
  khung ⇒ mép phải lớp nổi thẳng mép phải nút; nửa trái ⇒ thẳng mép trái — rồi kẹp trong
  khung. Mọi toạ độ tính trong KHUNG (cột app 480px, đáy là mép trên dock).
*/
export type NutNeo = { left: number; top: number; right: number; bottom: number };

export function viTriNeoNut({
  nut,
  w,
  h,
  pw,
  ph,
  le = 8,
  cach = 6,
}: {
  nut: NutNeo;
  /** kích thước tự nhiên của lớp nổi */
  w: number;
  h: number;
  /** kích thước khung */
  pw: number;
  ph: number;
  le?: number;
  cach?: number;
}): { left: number; top: number; maxH: number; tren: boolean; canhPhai: boolean } {
  const kep = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));
  const choDuoi = ph - le - (nut.bottom + cach);
  const choTren = nut.top - cach - le;
  let tren = false;
  if (h > choDuoi && (h <= choTren || choTren > choDuoi)) tren = true;
  const maxH = Math.max(0, tren ? choTren : choDuoi);
  const hThat = Math.min(h, maxH);
  const top = tren ? nut.top - cach - hThat : nut.bottom + cach;
  const canhPhai = (nut.left + nut.right) / 2 > pw / 2;
  const left = kep(canhPhai ? nut.right - w : nut.left, le, pw - w - le);
  return { left, top, maxH, tren, canhPhai };
}
