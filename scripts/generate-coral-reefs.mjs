// Sinh LỚP RẠN / ĐÁ NGẦM / BÃI CẠN có tên tiếng Việt cho Trục 1 — chạy MỘT LẦN:
//   node scripts/generate-coral-reefs.mjs
//
// Đầu ra: public/data/coral-reefs.v1.json — FeatureCollection<Point> với
//   properties: { name, type, group, admin, rank }
//     name  — tên TIẾNG VIỆT (nhãn trên bản đồ)
//     type  — ran | da | bai | con (rạn/đá/bãi cạn·ngầm/cồn)
//     group — truong-sa | them-luc-dia (v1; ven-bo/hoang-sa để mở)
//     admin — GÁN CỨNG theo group (chủ quyền VN)
//     rank  — 1 (lớn, hiện sớm) · 2 · 3 (nhỏ, zoom sâu) → symbol-sort-key
//
// ── NGUỒN & CHỦ QUYỀN ─────────────────────────────────────────────────────
// Dữ liệu tự soạn (curated) từ WIKIPEDIA TIẾNG VIỆT — toạ độ + tên là DỮ KIỆN,
// không vướng bản quyền. Đây là các thực thể CHÌM/NGẦM (đá ngầm, bãi cạn, bãi
// ngầm) BỔ SUNG cho vn-islands.v1.json (đảo nổi), gom vào một lớp BẬT–TẮT
// "Đá ngầm · Rạn" riêng. VÌ SAO KHÔNG lấy thẳng OpenStreetMap: ở Trường Sa &
// thềm lục địa, OSM chỉ có tên Anh/Philippines/Trung (Second Thomas Shoal,
// Vanguard Bank, Whitsun Reef, McKennan Reef…) — dùng thô là lọt nhãn sai chủ
// quyền mà app phải tránh (chủ dự án chốt). Tên Việt lấy từ Wikipedia tiếng Việt.
//
// Group `them-luc-dia` = cụm nhà giàn DK1 trên thềm lục địa phía Nam (Tư Chính,
// Vũng Mây…) — KHÔNG thuộc quần đảo Trường Sa về địa lý (~7,5–8,2°B / 109,7–
// 110,7°Đ) nên tách group riêng, admin "Thềm lục địa phía Nam".
//
// CỔNG TỰ KIỂM ở cuối file: quét toàn bộ tên, nếu còn BẤT KỲ ký tự CJK (Hán)
// nào thì NÉM lỗi, không ghi file — để không đời nào lọt nhãn nhạy cảm.

import { writeFileSync, mkdirSync } from "node:fs";

// ── TRƯỜNG SA — đá ngầm / bãi cạn (group truong-sa, admin "tỉnh Khánh Hòa") ──
const TRUONG_SA = [
  { name: "Bãi Cỏ Mây", lat: 9.817, lng: 115.867, type: "bai", rank: 2 },
  { name: "Bãi Cỏ Rong", lat: 11.3333, lng: 116.6667, type: "bai", rank: 2 },
  { name: "Đá Ba Đầu", lat: 9.9939, lng: 114.6575, type: "da", rank: 3 },
  { name: "Đá Ga Ven", lat: 10.2072, lng: 114.2231, type: "da", rank: 3 },
  { name: "Đá Én Đất", lat: 10.35, lng: 114.7, type: "da", rank: 3 },
  { name: "Đá Ken Nan", lat: 9.9, lng: 114.467, type: "da", rank: 3 },
  { name: "Bãi An Nhơn", lat: 10.7106, lng: 114.5339, type: "con", rank: 3 },
];

// ── THỀM LỤC ĐỊA PHÍA NAM — cụm DK1 (group them-luc-dia) ────────────────────
const THEM_LUC_DIA = [
  { name: "Bãi Tư Chính", lat: 7.5292, lng: 109.7444, type: "bai", rank: 2 },
  { name: "Bãi Phúc Tần", lat: 8.15, lng: 110.6, type: "bai", rank: 2 },
  { name: "Bãi Phúc Nguyên", lat: 7.9167, lng: 109.9667, type: "bai", rank: 2 },
  { name: "Bãi Huyền Trân", lat: 8.0203, lng: 110.6308, type: "bai", rank: 2 },
  { name: "Bãi Quế Đường", lat: 7.8136, lng: 110.4733, type: "bai", rank: 2 },
  { name: "Bãi Vũng Mây", lat: 7.7578, lng: 110.6908, type: "bai", rank: 2 },
];

// ── gộp + gắn group/admin ──────────────────────────────────────────────────
const REEFS = [
  ...TRUONG_SA.map((d) => ({ ...d, group: "truong-sa", admin: "tỉnh Khánh Hòa" })),
  ...THEM_LUC_DIA.map((d) => ({
    ...d,
    group: "them-luc-dia",
    admin: "Thềm lục địa phía Nam",
  })),
];

// ── CỔNG TỰ KIỂM CHỦ QUYỀN — không cho lọt ký tự Hán/CJK ────────────────────
const CJK = /[⺀-⻿　-〿㐀-䶿一-鿿豈-﫿]/;
const dirty = REEFS.filter((d) => CJK.test(d.name));
if (dirty.length) {
  throw new Error(
    `CHẶN: ${dirty.length} tên còn ký tự Hán/CJK — ${dirty
      .map((d) => d.name)
      .join(", ")}`,
  );
}

// toạ độ phải nằm trong khung biển VN (bắt lỗi transcribe DMS→decimal)
const outOfRange = REEFS.filter(
  (d) => d.lat < 4 || d.lat > 24 || d.lng < 102 || d.lng > 118,
);
if (outOfRange.length) {
  throw new Error(
    `CHẶN: toạ độ ngoài khung VN — ${outOfRange
      .map((d) => `${d.name} [${d.lng},${d.lat}]`)
      .join(", ")}`,
  );
}

const features = REEFS.map((d) => ({
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
writeFileSync("public/data/coral-reefs.v1.json", JSON.stringify(out));
const byGroup = REEFS.reduce(
  (m, d) => ((m[d.group] = (m[d.group] || 0) + 1), m),
  {},
);
console.log(
  `OK: public/data/coral-reefs.v1.json — ${features.length} rạn/bãi`,
  byGroup,
  `${Math.round(JSON.stringify(out).length / 1024)} KB`,
);
