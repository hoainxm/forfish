// Danh tính hiển thị ở sheet Tài khoản — THUẦN, test được.
//
// Bối cảnh (2026-07-21): webhook provision KHÔNG set user_metadata.full_name
// (đợt bulk 30/06 + webhook tự tạo sd123456 cũng vậy) → sheet chỉ còn SĐT.
// Tên thật nằm ở bảng `customers` (đồng bộ từ CRM, RLS own-row) và đã có sẵn
// trong OwnedAssets.customerName (/api/me/sdvico). Ưu tiên: customers (tươi
// theo CRM) → user_metadata (account tạo tay có full_name) → không có.
// Tên từ CRM có thể dính rác "\r\n" (ca thật: "TEST CASE NPP\r\n") — làm sạch.

export function cleanPersonName(raw: string | null | undefined): string {
  return (raw ?? "").replace(/\s+/g, " ").trim();
}

export function accountDisplayName(
  customerName: string | null | undefined,
  metadataName: string | null | undefined,
): string {
  return cleanPersonName(customerName) || cleanPersonName(metadataName);
}

/** "Đã mua 3 thiết bị" / "" khi chưa có gì (đừng bày số 0 buồn bã). */
export function deviceCountLine(count: number | null | undefined): string {
  if (!count || count <= 0) return "";
  return `Đã mua ${count} thiết bị SDVICO`;
}

/** "Đang quản lý 2 tàu" / "" khi chưa thêm tàu nào (sổ tàu tự ghi của bà con). */
export function boatCountLine(count: number | null | undefined): string {
  if (!count || count <= 0) return "";
  return `Đang quản lý ${count} tàu`;
}
