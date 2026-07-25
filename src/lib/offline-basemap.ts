// NỀN TỐI GIẢN KHI MẤT SÓNG — bà con giữa biển vẫn thấy bờ, thấy đảo.
//
// Lỗ hổng đã bịt: mọi ô bản đồ nền lấy từ host ngoài (cartocdn) nên service
// worker không giữ được (public/sw.js bỏ qua khác origin). Mất sóng là nền
// trắng: có số gió sóng, có điểm nóng cá, nhưng mũi tên lơ lửng giữa khoảng
// không, không biết bờ đâu, đảo đâu → mất định hướng, nguy hiểm.
//
// Cách bịt: hình bờ + đảo đóng gói sẵn trong máy (public/data/vn-coast.v1.json,
// sinh bởi scripts/generate-coastline.mjs, nguồn Natural Earth public domain,
// SW giữ sẵn từ lúc cài) — khi ô nền không về thì bật lớp này lên.
//
// Nguyên tắc: CÓ MẠNG THÌ KHÔNG VẼ (nền thật đẹp hơn, vẽ chồng chỉ gây rối).

/** Hình bờ + đảo trong máy (đã nằm trong danh sách SW giữ sẵn). */
export const COAST_DATA_URL = "/data/vn-coast.v1.json";

/* Màu NỘI DUNG BẢN ĐỒ (không phải token UI) — chọn theo tông hải đồ giấy:
   đất màu cát nhạt, viền bờ nâu xám, nước là màu nền của style. */
export const OFFLINE_LAND_COLOR = "#e8e0cd";
export const OFFLINE_COAST_COLOR = "#9c8f74";

/**
 * Bao nhiêu ô nền tải trượt thì coi là "nền không về". 3 ô: một ô lỗi lẻ có
 * thể do ô đó thiếu ở nhà cung cấp; ba ô liên tiếp thì đúng là đứt đường.
 */
export const BASEMAP_FAIL_LIMIT = 3;

export type BasemapHealth = {
  /** navigator.onLine — máy có nghĩ là đang có mạng không */
  online: boolean;
  /** số ô nền tải trượt tính từ lần tải được gần nhất */
  fails: number;
};

/**
 * Có bật nền tối giản trong máy hay không.
 * Máy báo mất mạng → bật ngay (không cần chờ đủ 3 ô lỗi).
 * Máy báo có mạng nhưng ô nền vẫn trượt (wifi cảng "có mà không ra") → bật khi
 * trượt đủ ngưỡng.
 */
export function shouldUseOfflineBasemap(h: BasemapHealth): boolean {
  return !h.online || h.fails >= BASEMAP_FAIL_LIMIT;
}

/**
 * Câu nhắc cho bà con — nói việc, không nói từ kỹ thuật ("tile", "offline",
 * "cache"). null = không cần nhắc gì.
 */
export function offlineBasemapNote(h: BasemapHealth): string | null {
  if (!shouldUseOfflineBasemap(h)) return null;
  return h.online
    ? "Mạng yếu, bản đồ chưa tải về được. Đang dùng hình bờ biển lưu trong máy."
    : "Mất sóng. Đang dùng hình bờ biển lưu trong máy.";
}

/**
 * Đếm ô nền trượt: tải được thì về 0 (đường đã thông trở lại), trượt thì +1.
 * Tách ra hàm thuần để test được, và để chỗ gọi không tự bịa quy tắc.
 */
export function nextFailCount(prev: number, ok: boolean): number {
  return ok ? 0 : prev + 1;
}
