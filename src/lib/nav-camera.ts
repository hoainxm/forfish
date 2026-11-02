// CAMERA BÁM TÀU KHI DẪN ĐƯỜNG — đặt tàu lệch NGƯỢC hướng đang chạy (rà Vietmap
// 2026-11-02). Bản đồ giữ Bắc ở trên (không xoay), nên trước đây tàu luôn bị đẩy
// xuống 72 % màn: chạy về Nam thì phía trước chỉ còn ~28 % màn, một phần dưới HUD.
// Vietmap xoay bản đồ theo mũi xe; ở đây giữ Bắc (thuyền trưởng đọc hải đồ theo
// Bắc) và chỉ dời chỗ đặt tàu để phần nhìn phía trước luôn rộng.
// Chiều dọc không đưa tàu lên quá giữa màn một chút: HUD nằm ở nửa trên.
// THUẦN LOGIC — test ở __tests__/nav-camera.test.ts.

/** độ lệch dọc khi chạy hướng Bắc / chưa biết hướng (phần chiều cao khung) */
export const CAM_LECH_DOC = 0.22;
/** độ lệch ngang tối đa khi chạy Đông/Tây (phần chiều rộng khung) */
export const CAM_LECH_NGANG = 0.25;
/** chạy về Nam thì tàu lên trên tâm tối đa bấy nhiêu (phần chiều cao) — chừa chỗ HUD */
export const CAM_LECH_LEN_MAX = 0.05;

/** offset [x, y] px cho `flyTo` — dương y = tàu nằm dưới tâm */
export function lechCamera(headingDeg: number | null, w: number, h: number): [number, number] {
  if (headingDeg == null || !Number.isFinite(headingDeg)) return [0, Math.round(h * CAM_LECH_DOC)];
  const r = (headingDeg * Math.PI) / 180;
  const x = -Math.sin(r) * CAM_LECH_NGANG * w;
  const y = Math.max(-CAM_LECH_LEN_MAX * h, Math.cos(r) * CAM_LECH_DOC * h);
  return [Math.round(x) || 0, Math.round(y) || 0]; // `|| 0` bỏ -0
}
