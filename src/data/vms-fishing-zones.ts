// VÙNG BIỂN VMS — 3 lớp ranh giới từ dữ liệu hệ thống giám sát tàu cá (VMS)
// do SDVico chuyển 2026-07-28 ("Dữ liệu vùng biển VMS mới_280726", 3 file
// GeoJSON gốc ~1,6MB): vùng ĐƯỢC PHÉP đánh bắt, vùng CẦN CHÚ Ý khi đánh bắt
// (quanh Hoàng Sa/Trường Sa), vùng CHỈ ĐƯỢC đánh cá đáy (giáp ranh VN–Indonesia,
// áp dụng sau khi Hiệp định phân định ĐQKT VN–Indonesia có hiệu lực).
//
// vms-zones.json là bản GIẢN LƯỢC để nhúng bundle (Douglas-Peucker ~1km, làm
// tròn 4 số lẻ, bỏ mảnh ven bờ <3km — script scripts/convert-vms-zones.py).
// Đường `duong200hl` trong file gốc KHÔNG lấy: trùng ranh giới ngoài đã vẽ
// (vn-maritime-border.ts, 75 điểm — vẫn là nguồn cho cảnh báo khoảng cách).
//
// LƯU Ý (như vùng lộng): SƠ ĐỒ THAM KHẢO để bà con hình dung, KHÔNG phải căn
// cứ pháp lý — ranh chính thức tra Chi cục Thủy sản / Cục Thủy sản.

import vmsZones from "@/data/vms-zones.json";

export type VmsZoneId = "allowed" | "caution" | "bottomOnly";

/** Ngày bộ dữ liệu VMS được cung cấp (hiện ở chú thích panel Cài đặt) */
export const VMS_ZONES_UPDATED: string = vmsZones.updated;

function fc(id: VmsZoneId): GeoJSON.FeatureCollection {
  return vmsZones[id] as unknown as GeoJSON.FeatureCollection;
}

/** Vùng được phép đánh bắt (toàn dải biển VN, có lỗ đảo) */
export function vmsAllowedGeoJSON(): GeoJSON.FeatureCollection {
  return fc("allowed");
}
/** Vùng cần chú ý khi đánh bắt — 13 khu quanh Hoàng Sa/Trường Sa */
export function vmsCautionGeoJSON(): GeoJSON.FeatureCollection {
  return fc("caution");
}
/** Vùng chỉ được đánh bắt cá đáy — giáp ranh VN–Indonesia */
export function vmsBottomOnlyGeoJSON(): GeoJSON.FeatureCollection {
  return fc("bottomOnly");
}
