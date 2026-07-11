// Header cho fetch NGUỒN NGOÀI từ server. NOAA CoastWatch ERDDAP trả 403 cho
// User-Agent mặc định của node/undici ("node") — chính là gốc RK-002 "dự báo
// cá chưa tải được" (xác minh 2026-07-02: UA mặc định 403, UA định danh 200).
// Quy ước lịch sự với nguồn miễn phí: nói rõ mình là ai + link liên hệ.
export const SOURCE_FETCH_HEADERS = {
  "user-agent": "SDFish/1.0 (app du bao bien cho ngu dan VN; +https://forfish-alpha.vercel.app)",
} as const;
