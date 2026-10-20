/*
  LUẬT THU NGĂN GIÓ SÓNG — hàm thuần (tách khỏi fishing-map-view 2026-10-20, rà
  Codex lần 7). Hai thứ giữ ngăn mở, KHÁC NHAU về quyền:

  · `border` — đang RẤT GẦN ranh giới: dòng cảnh báo đỏ nằm trong ngăn. Chặn cả
    đồng hồ tự-thu LẪN lệnh ép ẩn của lớp nổi khác (giấu cảnh báo an toàn là cấm).
  · `held` — người dùng bấm "Giữ mở": chỉ chặn ĐỒNG HỒ. Lớp nổi khác (Dẫn đường,
    panel Lớp, menu chạm-giữ…) vẫn được ép ẩn để không chồng hai bảng; ép ẩn hay
    thu bằng bất cứ đường nào cũng là BỎ GHIM (lần mở sau về luật 3 giây).
*/

export type SheetLocks = { border: boolean; held: boolean };

/** Đồng hồ 3 giây được phép thu ngăn? */
export function canAutoHide(l: SheetLocks): boolean {
  return !l.border && !l.held;
}

/** Lớp nổi khác được phép ép ẩn ngăn? (ghim của người dùng KHÔNG chặn) */
export function canForceHide(l: SheetLocks): boolean {
  return !l.border;
}

/** Ghim chỉ sống khi ngăn đang mở — mọi đường thu (chạm bản đồ, ép ẩn, "Thu",
 *  vuốt) đều bỏ ghim. */
export function heldAfterSize(held: boolean, size: string): boolean {
  return size === "half" ? held : false;
}
