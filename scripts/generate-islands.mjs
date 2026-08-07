// Sinh DANH SÁCH ĐẢO có tên (nhãn hải đồ) cho Trục 1 — chạy MỘT LẦN:
//   node scripts/generate-islands.mjs
//
// Đầu ra: public/data/vn-islands.v1.json — FeatureCollection<Point> với
//   properties: { name, type, group, admin, rank }
//     name  — tên TIẾNG VIỆT (nhãn trên bản đồ)
//     type  — dao | da | bai | con | quan-dao (đảo/đá/bãi/cồn/quần đảo)
//     group — ven-bo | hoang-sa | truong-sa
//     admin — tỉnh/thành (Hoàng Sa/Trường Sa GÁN CỨNG theo chủ quyền VN)
//     rank  — 1 (lớn, hiện sớm) · 2 · 3 (nhỏ, hiện khi zoom sâu) → symbol-sort-key
//
// ── NGUỒN & CHỦ QUYỀN ─────────────────────────────────────────────────────
// Dữ liệu tự soạn (curated) từ WIKIPEDIA TIẾNG VIỆT — toạ độ + tên là DỮ KIỆN,
// không vướng bản quyền. VÌ SAO KHÔNG lấy thẳng OpenStreetMap/GeoNames: ở
// Hoàng Sa & Trường Sa hai nguồn đó chỉ có tên chữ Hán (高尖石) hoặc tên
// Anh/Philippines (Subi Reef, Zamora Reef), KHÔNG có tên tiếng Việt — dùng thô
// là lọt đúng nhãn sai chủ quyền mà app phải tránh (chủ dự án chốt 2026-08-07).
// Đơn vị hành chính Hoàng Sa (TP Đà Nẵng) / Trường Sa (tỉnh Khánh Hòa) GÁN
// CỨNG theo group, KHÔNG lấy từ nguồn ngoài.
//
// CỔNG TỰ KIỂM ở cuối file: quét toàn bộ tên, nếu còn BẤT KỲ ký tự CJK (Hán)
// nào thì NÉM lỗi, không ghi file — để không đời nào lọt nhãn nhạy cảm.

import { writeFileSync, mkdirSync } from "node:fs";

// ── ĐẢO VEN BỜ (group ven-bo) — Wikipedia "Danh sách đảo Việt Nam" ──────────
const VEN_BO = [
  { name: "Bạch Long Vĩ", lat: 20.131, lng: 107.7291, type: "dao", admin: "Hải Phòng", rank: 1 },
  { name: "Cô Tô", lat: 20.9821, lng: 107.7571, type: "dao", admin: "Quảng Ninh", rank: 1 },
  { name: "Đảo Trần", lat: 21.2378, lng: 107.9589, type: "dao", admin: "Quảng Ninh", rank: 2 },
  { name: "Thanh Lân", lat: 21.0, lng: 107.8116, type: "dao", admin: "Quảng Ninh", rank: 2 },
  { name: "Vĩnh Thực", lat: 21.3734, lng: 107.9135, type: "dao", admin: "Quảng Ninh", rank: 2 },
  { name: "Cái Chiên", lat: 21.3292, lng: 107.7681, type: "dao", admin: "Quảng Ninh", rank: 3 },
  { name: "Quan Lạn", lat: 20.9, lng: 107.5167, type: "dao", admin: "Quảng Ninh", rank: 2 },
  { name: "Ngọc Vừng", lat: 20.818, lng: 107.3526, type: "dao", admin: "Quảng Ninh", rank: 2 },
  { name: "Trà Bản", lat: 20.9619, lng: 107.5056, type: "dao", admin: "Quảng Ninh", rank: 2 },
  { name: "Tuần Châu", lat: 20.9292, lng: 106.9892, type: "dao", admin: "Quảng Ninh", rank: 2 },
  { name: "Cát Bà", lat: 20.7239, lng: 107.0578, type: "dao", admin: "Hải Phòng", rank: 1 },
  { name: "Cát Hải", lat: 20.8036, lng: 106.8942, type: "dao", admin: "Hải Phòng", rank: 2 },
  { name: "Hòn Dấu", lat: 20.6672, lng: 106.8164, type: "dao", admin: "Hải Phòng", rank: 2 },
  { name: "Hòn Mê", lat: 19.3723, lng: 105.927, type: "quan-dao", admin: "Thanh Hóa", rank: 2 },
  { name: "Hòn Ngư", lat: 18.8, lng: 105.7667, type: "dao", admin: "Nghệ An", rank: 2 },
  { name: "Hòn Mắt", lat: 18.7967, lng: 105.9575, type: "dao", admin: "Nghệ An", rank: 2 },
  { name: "Hòn La", lat: 17.9336, lng: 106.5306, type: "dao", admin: "Quảng Trị", rank: 2 },
  { name: "Cồn Cỏ", lat: 17.1591, lng: 107.339, type: "dao", admin: "Quảng Trị", rank: 2 },
  { name: "Cù Lao Chàm", lat: 15.9511, lng: 108.5231, type: "quan-dao", admin: "Đà Nẵng", rank: 1 },
  { name: "Lý Sơn", lat: 15.3716, lng: 109.1189, type: "dao", admin: "Quảng Ngãi", rank: 1 },
  { name: "Cù Lao Xanh", lat: 13.6158, lng: 109.3506, type: "dao", admin: "Gia Lai", rank: 2 },
  { name: "Hòn Tre", lat: 12.2128, lng: 109.2864, type: "dao", admin: "Khánh Hòa", rank: 1 },
  { name: "Hòn Tằm", lat: 12.1764, lng: 109.2417, type: "dao", admin: "Khánh Hòa", rank: 3 },
  { name: "Hòn Miễu", lat: 12.1897, lng: 109.2236, type: "dao", admin: "Khánh Hòa", rank: 3 },
  { name: "Hòn Rùa", lat: 12.2897, lng: 109.2422, type: "dao", admin: "Khánh Hòa", rank: 3 },
  { name: "Bình Ba", lat: 11.8377, lng: 109.2402, type: "dao", admin: "Khánh Hòa", rank: 2 },
  { name: "Cù Lao Câu", lat: 11.2267, lng: 108.8274, type: "dao", admin: "Lâm Đồng", rank: 2 },
  { name: "Hòn Bà", lat: 10.6958, lng: 107.9922, type: "dao", admin: "Lâm Đồng", rank: 3 },
  { name: "Phú Quý", lat: 10.5165, lng: 108.9326, type: "dao", admin: "Lâm Đồng", rank: 1 },
  { name: "Long Sơn", lat: 10.4639, lng: 107.0833, type: "dao", admin: "TP.HCM", rank: 2 },
  { name: "Côn Đảo", lat: 8.6824, lng: 106.6072, type: "quan-dao", admin: "TP.HCM", rank: 1 },
  { name: "Phú Quốc", lat: 10.2161, lng: 103.9594, type: "dao", admin: "An Giang", rank: 1 },
  { name: "Quần đảo An Thới", lat: 9.9565, lng: 104.0169, type: "quan-dao", admin: "An Giang", rank: 2 },
  { name: "Quần đảo Bà Lụa", lat: 10.1364, lng: 104.5271, type: "quan-dao", admin: "An Giang", rank: 2 },
  { name: "Quần đảo Hải Tặc", lat: 10.3023, lng: 104.326, type: "quan-dao", admin: "An Giang", rank: 2 },
  { name: "Hòn Nghệ", lat: 10.0275, lng: 104.5531, type: "dao", admin: "An Giang", rank: 2 },
  { name: "Hòn Sơn", lat: 9.8, lng: 104.6333, type: "dao", admin: "An Giang", rank: 2 },
  { name: "Nam Du", lat: 9.6792, lng: 104.3538, type: "quan-dao", admin: "An Giang", rank: 1 },
  { name: "Thổ Chu", lat: 9.3, lng: 103.483, type: "dao", admin: "An Giang", rank: 2 },
  { name: "Hòn Đá Bạc", lat: 9.1792, lng: 104.8003, type: "dao", admin: "Cà Mau", rank: 3 },
  { name: "Hòn Chuối", lat: 8.9476, lng: 104.5265, type: "dao", admin: "Cà Mau", rank: 2 },
  { name: "Hòn Khoai", lat: 8.4355, lng: 104.833, type: "dao", admin: "Cà Mau", rank: 2 },
];

// ── HOÀNG SA (group hoang-sa, admin CỨNG "TP Đà Nẵng") ─────────────────────
const HOANG_SA = [
  { name: "Đảo Phú Lâm", lat: 16.8333, lng: 112.3333, type: "dao", rank: 1 },
  { name: "Đảo Linh Côn", lat: 16.6667, lng: 112.7333, type: "dao", rank: 1 },
  { name: "Đảo Cây", lat: 16.9797, lng: 112.2711, type: "dao", rank: 2 },
  { name: "Đảo Bắc", lat: 16.9639, lng: 112.3094, type: "dao", rank: 2 },
  { name: "Đảo Trung", lat: 16.955, lng: 112.3244, type: "dao", rank: 2 },
  { name: "Đảo Nam", lat: 16.9464, lng: 112.3344, type: "dao", rank: 2 },
  { name: "Đảo Đá", lat: 16.8444, lng: 112.3472, type: "dao", rank: 2 },
  { name: "Đá Bông Bay", lat: 16.0447, lng: 112.5183, type: "da", rank: 3 },
  { name: "Cồn cát Bắc", lat: 16.9378, lng: 112.3417, type: "con", rank: 3 },
  { name: "Cồn cát Nam", lat: 16.9292, lng: 112.3458, type: "con", rank: 3 },
  { name: "Cồn cát Tây", lat: 16.9775, lng: 112.2119, type: "con", rank: 3 },
  { name: "Cồn cát Trung", lat: 16.9342, lng: 112.3436, type: "con", rank: 3 },
  { name: "Hòn Tháp", lat: 16.5768, lng: 112.6424, type: "da", rank: 3 },
  { name: "Bãi Bình Sơn", lat: 16.7667, lng: 112.2167, type: "bai", rank: 3 },
  { name: "Bãi Châu Nhai", lat: 16.3333, lng: 112.4278, type: "bai", rank: 3 },
  { name: "Bãi Gò Nổi", lat: 16.8167, lng: 112.8833, type: "bai", rank: 3 },
  { name: "Bãi Ốc Tai Voi", lat: 15.7167, lng: 112.2167, type: "bai", rank: 3 },
  { name: "Bãi Quảng Nghĩa", lat: 16.3278, lng: 112.6861, type: "bai", rank: 3 },
  { name: "Bãi Thủy Tề", lat: 16.5139, lng: 112.545, type: "bai", rank: 3 },
  { name: "Đảo Hoàng Sa", lat: 16.5347, lng: 111.6083, type: "dao", rank: 1 },
  { name: "Đảo Tri Tôn", lat: 15.7833, lng: 111.2, type: "dao", rank: 1 },
  { name: "Đảo Quang Ảnh", lat: 16.4472, lng: 111.5056, type: "dao", rank: 2 },
  { name: "Đảo Quang Hòa", lat: 16.4514, lng: 111.7125, type: "dao", rank: 2 },
  { name: "Đảo Duy Mộng", lat: 16.4639, lng: 111.7417, type: "dao", rank: 2 },
  { name: "Đảo Hữu Nhật", lat: 16.5056, lng: 111.5861, type: "dao", rank: 2 },
  { name: "Đảo Bạch Quy", lat: 16.0564, lng: 111.7619, type: "dao", rank: 2 },
  { name: "Đảo Ba Ba", lat: 16.5667, lng: 111.6864, type: "dao", rank: 3 },
  { name: "Đảo Ốc Hoa", lat: 16.5747, lng: 111.6733, type: "dao", rank: 3 },
  { name: "Đá Bắc", lat: 17.0903, lng: 111.5036, type: "da", rank: 3 },
  { name: "Đá Chim Én", lat: 16.3472, lng: 112.025, type: "da", rank: 3 },
  { name: "Đá Hải Sâm", lat: 16.4622, lng: 111.5889, type: "da", rank: 3 },
  { name: "Đá Lồi", lat: 16.2311, lng: 111.6931, type: "da", rank: 3 },
  { name: "Đá Trà Tây", lat: 16.5467, lng: 111.7133, type: "da", rank: 3 },
  { name: "Bãi Đèn Pha", lat: 16.5333, lng: 111.6, type: "bai", rank: 3 },
  { name: "Bãi Ngự Bình", lat: 16.4583, lng: 111.65, type: "bai", rank: 3 },
  { name: "Bãi Xà Cừ", lat: 16.5806, lng: 111.7083, type: "bai", rank: 3 },
];

// ── TRƯỜNG SA (group truong-sa, admin CỨNG "tỉnh Khánh Hòa") ───────────────
const TRUONG_SA = [
  { name: "Đảo Trường Sa", lat: 8.6447, lng: 111.92, type: "dao", rank: 1 },
  { name: "Đảo Song Tử Tây", lat: 11.4294, lng: 114.3314, type: "dao", rank: 1 },
  { name: "Đảo Nam Yết", lat: 10.1794, lng: 114.3667, type: "dao", rank: 1 },
  { name: "Đảo Sinh Tồn", lat: 9.8853, lng: 114.3297, type: "dao", rank: 1 },
  { name: "Đảo Sơn Ca", lat: 10.375, lng: 114.48, type: "dao", rank: 1 },
  { name: "Đảo Sinh Tồn Đông", lat: 9.9025, lng: 114.5642, type: "dao", rank: 1 },
  { name: "Đảo An Bang", lat: 7.8919, lng: 112.9214, type: "dao", rank: 1 },
  { name: "Đảo Phan Vinh", lat: 8.9753, lng: 113.7086, type: "dao", rank: 1 },
  { name: "Đảo Trường Sa Đông", lat: 8.9311, lng: 112.3531, type: "dao", rank: 1 },
  { name: "Đá Tây", lat: 8.8589, lng: 112.225, type: "da", rank: 2 },
  { name: "Đá Lát", lat: 8.6667, lng: 111.6758, type: "da", rank: 2 },
  { name: "Đá Đông", lat: 8.8283, lng: 112.5967, type: "da", rank: 2 },
  { name: "Đá Lớn", lat: 10.0617, lng: 113.8517, type: "da", rank: 2 },
  { name: "Đá Nam", lat: 11.3872, lng: 114.2986, type: "da", rank: 2 },
  { name: "Đá Thị", lat: 10.4103, lng: 114.5872, type: "da", rank: 2 },
  { name: "Đá Núi Le", lat: 8.71, lng: 114.185, type: "da", rank: 2 },
  { name: "Đá Tốc Tan", lat: 8.8117, lng: 113.9833, type: "da", rank: 2 },
  { name: "Đá Tiên Nữ", lat: 8.855, lng: 114.655, type: "da", rank: 2 },
  { name: "Đá Cô Lin", lat: 9.7739, lng: 114.2556, type: "da", rank: 2 },
  { name: "Đá Len Đao", lat: 9.7794, lng: 114.37, type: "da", rank: 2 },
  { name: "Bãi Thuyền Chài", lat: 8.1667, lng: 113.3, type: "bai", rank: 2 },
  { name: "Đá Chữ Thập", lat: 9.5472, lng: 112.8894, type: "da", rank: 2 },
  { name: "Đá Gạc Ma", lat: 9.715, lng: 114.2875, type: "da", rank: 2 },
  { name: "Đá Xu Bi", lat: 10.9236, lng: 114.0847, type: "da", rank: 2 },
  { name: "Đá Vành Khăn", lat: 9.9028, lng: 115.5364, type: "da", rank: 2 },
];

// ── gộp + gắn group/admin ──────────────────────────────────────────────────
const ISLANDS = [
  ...VEN_BO.map((d) => ({ ...d, group: "ven-bo" })),
  ...HOANG_SA.map((d) => ({ ...d, group: "hoang-sa", admin: "TP Đà Nẵng" })),
  ...TRUONG_SA.map((d) => ({ ...d, group: "truong-sa", admin: "tỉnh Khánh Hòa" })),
];

// ── CỔNG TỰ KIỂM CHỦ QUYỀN — không cho lọt ký tự Hán/CJK ────────────────────
// Dải CJK cơ bản + mở rộng + Kangxi + ký hiệu CJK. Có một ký tự là NÉM.
const CJK = /[⺀-⻿　-〿㐀-䶿一-鿿豈-﫿]/;
const dirty = ISLANDS.filter((d) => CJK.test(d.name));
if (dirty.length) {
  throw new Error(
    `CHẶN: ${dirty.length} tên còn ký tự Hán/CJK — ${dirty
      .map((d) => d.name)
      .join(", ")}`,
  );
}

// toạ độ phải nằm trong khung biển VN (bắt lỗi transcribe DMS→decimal)
const outOfRange = ISLANDS.filter(
  (d) => d.lat < 4 || d.lat > 24 || d.lng < 102 || d.lng > 118,
);
if (outOfRange.length) {
  throw new Error(
    `CHẶN: toạ độ ngoài khung VN — ${outOfRange
      .map((d) => `${d.name} [${d.lng},${d.lat}]`)
      .join(", ")}`,
  );
}

const features = ISLANDS.map((d) => ({
  type: "Feature",
  properties: {
    name: d.name,
    type: d.type,
    group: d.group,
    admin: d.admin,
    rank: d.rank,
  },
  geometry: { type: "Point", coordinates: [d.lng, d.lat] },
}));

mkdirSync("public/data", { recursive: true });
const out = { type: "FeatureCollection", features };
writeFileSync("public/data/vn-islands.v1.json", JSON.stringify(out));
const byGroup = ISLANDS.reduce((m, d) => ((m[d.group] = (m[d.group] || 0) + 1), m), {});
console.log(
  `OK: public/data/vn-islands.v1.json — ${features.length} đảo`,
  byGroup,
  `${Math.round(JSON.stringify(out).length / 1024)} KB`,
);
