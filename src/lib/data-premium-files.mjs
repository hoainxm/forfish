// FILE DỮ LIỆU CHỈ GÓI ĐỌC ĐƯỢC (2026-10-27, anh Long: "tất cả tải lưu server đi" — lớp gói phải chặn THẬT, không
// chỉ khoá giao diện). Thuần, không phụ thuộc — dùng chung script build (scripts/encode-data.mjs) và test.
//
// Các file này mã SDF2 bằng KHOÁ GÓI (`app_config.data_key_premium`, build đầu tự sinh — ngẫu nhiên, KHÔNG suy từ
// khoá chủ: tài khoản thường giữ khoá chủ trong máy, suy được là tự tính ra khoá gói). /api/data-key chỉ trao khoá gói
// cho tài khoản premium. File mã vẫn phát qua CDN + SW giữ như mọi file khác (offline không đổi) — khác biệt duy
// nhất: tài khoản thường tải về là bản không giải được.

/** Nguồn cho bán (CC-BY) hoặc phục vụ dự báo cá / dẫn đường. */
export const PREMIUM_SDF2 = new Set([
  "reef-shapes-aca.v1.pmtiles", // hình rạn chi tiết — Allen Coral Atlas (CC-BY)
  "chat-day.v1.pmtiles", // chất đáy — Allen Coral Atlas (CC-BY)
  "chat-day.v1.json",
  "reef-depth.v1.bin", // độ sâu rạn xa bờ — HHU24SWDSCS / SCSBathy10 (CC-BY), cho dẫn đường
  "fish-climatology.v1.json", // mùa vụ cá — dự báo cá
]);
