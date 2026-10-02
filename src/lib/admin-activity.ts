// Nhật ký hoạt động admin — mã hành động + nhãn (THUẦN, client-safe: dùng chung
// route ghi log + UI tab Nhật ký). Bảng: admin_activity_log (migration 0019).
// Quy ước mã: '<khu>.<việc>'. Thêm mã mới thì THÊM nhãn ở ACTION_LABEL (test bắt
// buộc mọi mã có nhãn) để UI không hiện mã trần khó hiểu.

export const ADMIN_ACTIONS = [
  // Tài khoản
  "account.create",
  "account.grant",
  "account.downgrade",
  "account.reset-password",
  "account.set-flags",
  "account.delete",
  "account.set-care-flag",
  "account.record-payment",
  "account.reconcile-payment",
  "account.set-kind",
  "account.revoke-sessions",
  "account.test-token",
  // Sản phẩm
  "product.create",
  "product.update",
  "product.delete",
  // Thuyền viên (cảnh báo)
  "crew.create",
  "crew.moderate",
  "crew.delete",
  // Chỗ bán
  "sell.create",
  "sell.update",
  "sell.delete",
  // Thông báo
  "push.send",
  // Yêu cầu
  "inquiry.update",
  "inquiry.delete",
  // Đơn hàng
  "order.update",
  // Vùng biển
  "zone.create",
  "zone.update",
  "zone.delete",
  // Phân quyền
  "staff.set-permissions",
  "staff.set-role",
  "staff.set-scope",
  // Tự kiểm tra: nút "Kiểm tra ghi nhật ký" ở tab Nhật ký ghi thử một dòng —
  // để biết nhật ký CÓ ghi được không mà không phải đợi một thao tác thật
  "system.log-probe",
] as const;

export type AdminActionKey = (typeof ADMIN_ACTIONS)[number];

export const ACTION_LABEL: Record<AdminActionKey, string> = {
  "account.create": "Tạo tài khoản",
  "account.grant": "Cấp/gia hạn premium",
  "account.downgrade": "Hạ về thường",
  "account.reset-password": "Đặt lại mật khẩu",
  "account.set-flags": "Đổi ghi chú theo dõi",
  "account.delete": "Xóa tài khoản",
  "account.set-care-flag": "Đổi cờ chăm khách",
  "account.record-payment": "Ghi nhận mã chuyển khoản",
  "account.reconcile-payment": "Xác nhận đã đối chiếu tiền",
  "account.set-kind": "Đổi loại tài khoản (thật/test/demo)",
  "account.revoke-sessions": "Đăng xuất mọi máy",
  "account.test-token": "Cấp chuỗi thử (script test)",
  "product.create": "Thêm sản phẩm",
  "product.update": "Sửa sản phẩm",
  "product.delete": "Xóa sản phẩm",
  "crew.create": "Thêm cảnh báo thuyền viên",
  "crew.moderate": "Duyệt/từ chối/rút cảnh báo",
  "crew.delete": "Xóa cảnh báo thuyền viên",
  "sell.create": "Thêm đầu mối chỗ bán",
  "sell.update": "Sửa đầu mối chỗ bán",
  "sell.delete": "Xóa đầu mối chỗ bán",
  "push.send": "Gửi thông báo",
  "inquiry.update": "Đổi trạng thái yêu cầu",
  "inquiry.delete": "Xóa yêu cầu",
  "order.update": "Cập nhật đơn hàng",
  "zone.create": "Thêm vùng biển",
  "zone.update": "Sửa vùng biển",
  "zone.delete": "Xóa vùng biển",
  "staff.set-permissions": "Đổi phân quyền quản lý",
  "staff.set-role": "Nâng/hạ quản trị viên",
  "staff.set-scope": "Đổi tầm nhìn quản lý",
  "system.log-probe": "Kiểm tra ghi nhật ký",
};

/** Nhãn tiếng Việt cho một mã; mã lạ (log cũ) trả về chính mã. */
export function actionLabel(action: string): string {
  return (ACTION_LABEL as Record<string, string>)[action] ?? action;
}

/** Hành động XÓA/nhạy cảm — UI tô đỏ để lọc nhanh khi soát "thao tác bậy". */
const DANGER_ACTIONS = new Set<string>([
  "account.delete",
  "account.reset-password",
  "account.downgrade",
  "product.delete",
  "crew.delete",
  "sell.delete",
  "inquiry.delete",
  "zone.delete",
  "staff.set-permissions",
  // nâng/hạ quản trị viên = đổi quyền cao nhất — luôn phải soi
  "staff.set-role",
  "staff.set-scope",
  "account.set-kind",
  "account.revoke-sessions",
]);

export function isDangerAction(action: string): boolean {
  return DANGER_ACTIONS.has(action);
}
