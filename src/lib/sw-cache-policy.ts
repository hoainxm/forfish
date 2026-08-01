// LUẬT CACHE CỦA SERVICE WORKER — nguồn SỰ THẬT, thuần, có test.
//
// VÌ SAO TÁCH RA ĐÂY: `public/sw.js` là file tĩnh (không qua bundler) nên không
// import được TypeScript. Danh sách dưới đây là bản CANONICAL; sw.js giữ một
// bản sao và test `sw-cache-policy.test.ts` ĐỌC sw.js để bắt hai bên lệch nhau.
// Thêm route /api mới thì sửa CẢ HAI, test sẽ nhắc.
//
// VÌ SAO CẦN ALLOWLIST (2026-08-01, review ngoài chỉ ra + tự soi thấy nặng hơn):
// SW đang cache MỌI `/api/*` GET, mà từ 2026-08-01 còn cứu cả 401/403 bằng bản
// trong kho (luật "đã tải thì cứ dùng"). Ghép hai thứ đó lại trên MỘT ĐIỆN
// THOẠI DÙNG CHUNG (chuyện thường trên tàu: chủ tàu và bạn thuyền chung máy) =
// đổi tài khoản vẫn đọc được phản hồi của người trước, kể cả khi máy chủ đã trả
// 401. Luật "đã tải thì cứ dùng" chỉ đúng cho DỰ BÁO/GIÁ — thứ ai xem cũng như
// nhau; KHÔNG đúng cho hồ sơ cá nhân.
//
// Quy tắc: chỉ cache thứ KHÔNG gắn với danh tính người dùng.

/** Tiền tố /api ĐƯỢC cache + được cứu bằng bản trong kho khi lỗi/từ chối. */
export const API_CACHE_ALLOW = [
  "/api/fish-forecast", // bản đồ cá — giống nhau cho mọi người premium
  "/api/storms", // tin bão — công khai
  "/api/weather-snapshot", // lưới gió/sóng cron tính sẵn
  "/api/salinity",
  "/api/sea-scalar",
  "/api/currents-depth",
  "/api/nautical", // hải đồ tĩnh
  "/api/port-prices", // giá cá — công khai
  "/api/fuel-price", // giá dầu — công khai
] as const;

/**
 * Đường dẫn /api này có được cache không.
 *
 * KHÔNG nằm trong danh sách = mạng lo, không ghi kho, không cứu. Cụ thể loại:
 * `/api/me`, `/api/crew-reports`, `/api/product-inquiries`, `/api/push`,
 * `/api/auth`, `/api/sdvico`, `/api/sdwork`, `/api/cron`, `/api/admin` —
 * hoặc gắn danh tính, hoặc là hành động ghi, hoặc là việc của máy chủ.
 */
export function isCacheableApiPath(pathname: string): boolean {
  return API_CACHE_ALLOW.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}
