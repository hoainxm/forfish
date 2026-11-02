// TRẦN DÒNG CẢNH BÁO CỦA KHUNG DẪN ĐƯỜNG (rà Vietmap 2026-11-02, 07 §10.7 U).
// Ranh giới, hiểm hoạ, "đang trong vùng", trú bão, câu đang đọc, máy thiếu giọng
// trước đây cứ chồng thêm — ven bờ có bão là khung cao gần nửa màn, bản đồ dưới
// sàn 60 %. Luật: dòng ĐỎ luôn hiện (an toàn, không giấu); còn lại lấp cho đủ
// `tran` dòng theo thứ tự đưa vào, phần thừa gộp thành "+N" (chạm mở hết).
// THUẦN LOGIC — test ở __tests__/hud-tran.test.ts.

export type DongHud = { id: string; red: boolean };

export const HUD_TRAN = 2;

export function xepDongHud(
  dong: readonly DongHud[],
  moRong: boolean,
  tran = HUD_TRAN,
): { hien: Set<string>; an: number } {
  if (moRong) return { hien: new Set(dong.map((d) => d.id)), an: 0 };
  const hien = new Set(dong.filter((d) => d.red).map((d) => d.id));
  for (const d of dong) {
    if (hien.size >= tran) break;
    hien.add(d.id);
  }
  return { hien, an: dong.length - hien.size };
}
