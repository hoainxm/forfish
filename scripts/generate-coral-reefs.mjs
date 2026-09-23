// Sinh LỚP RẠN / ĐÁ NGẦM / BÃI CẠN có tên tiếng Việt cho Trục 1 — chạy MỘT LẦN:
//   node scripts/generate-coral-reefs.mjs
//
// Đầu ra: public/data/coral-reefs.v1.json — FeatureCollection<Point> với
//   properties: { name, type, group, admin, rank }
//     name  — tên TIẾNG VIỆT (nhãn trên bản đồ)
//     type  — ran | da | bai | con (rạn/đá/bãi cạn·ngầm/cồn)
//     group — ven-bo | hoang-sa | truong-sa | them-luc-dia
//     admin — GÁN CỨNG theo group (chủ quyền VN); ven-bo = tên tỉnh nguồn
//     rank  — 1 (lớn, hiện sớm) · 2 · 3 (nhỏ, zoom sâu) → symbol-sort-key
//
// ── NGUỒN CHÍNH THỐNG (2026-09-03) ─────────────────────────────────────────
// 13 mục curated cũ (Trường Sa + DK1, từ Wikipedia tiếng Việt) GIỮ NGUYÊN.
// PHẦN LỚN dữ liệu dưới đây khai từ:
//   Thông tư 33/2024/TT-BTNMT (Bộ Tài nguyên và Môi trường, 15/12/2024) —
//   "Danh mục địa danh các đảo, đá, bãi cạn, bãi ngầm và một số đối tượng địa
//   lý khác trên vùng biển Việt Nam". Bảng gốc: TT · Tên địa danh · Tỉnh/TP ·
//   Toạ độ VN-2000 (Vĩ độ, Kinh độ — Độ Phút Giây).
// Lấy đúng HỌ thực thể NỔI/rạn ven mặt: BÃI CẠN · BÃI ĐÁ · ĐÁ · RẠN/SAN HÔ ·
// CỒN/BÃI — từ ba mục:
//   A. KHU VỰC VEN BỜ → I. ĐỐI TƯỢNG TỰ NHIÊN   (mã "A" bên dưới)
//   B. QUẦN ĐẢO HOÀNG SA                          (mã "B")
//   C. QUẦN ĐẢO TRƯỜNG SA                         (mã "C")
// CỐ Ý CHỪA:
//   · Hòn/Đảo/Cù Lao/Cụm/Quần đảo/Bán đảo — thực thể NỔI lên được → thuộc
//     vn-islands.v1.json (nhóm khác giữ), KHÔNG lấy vào đây.
//   · Mũi/Vụng/Vũng/Cửa/Vịnh/Ghềnh/Gành/Lạch/Đầm… — không thuộc họ rạn/bãi.
//   · A.II (ĐỐI TƯỢNG NHÂN TẠO) và A.III (ĐỐI TƯỢNG NGẦM DƯỚI ĐÁY BIỂN) —
//     A.III đã thành public/data/dia-danh-ngam.v1.json (đối tượng NGẦM sâu:
//     núi/đồi/hố/thung lũng ngầm). Lớp này là NỔI/rạn ven mặt, không chồng lấn.
//
// ── PDF & GIẢI MÃ (giống pipeline dia-danh-ngam) ───────────────────────────
// PDF chính thức (144 trang, 4,3 MB), tải 2026-09-03:
//   https://mae.gov.vn/noidung/Lists/VBQPPL/Attachments/514/1_DanhMuc_TT_DiaDanh_BanHanh.pdf
// PDF dùng font nhúng không map Unicode chuẩn → pdftotext MẤT DẤU. Bóc bằng
// pypdf (giữ đúng tiếng Việt). Danh mục nhà nước ĐÃ ĐÓNG (ban hành 1 lần) nên
// CHÉP NGUYÊN các dòng đã kiểm vào chính file này (authored source) — tái lập
// KHÔNG cần PDF, KHÔNG cần Python, KHÔNG thêm dep, KHÔNG tải lúc build
// (CLAUDE.md §chống phình, quy tắc 3). Điều 15 Luật SHTT loại "văn bản hành
// chính"/"số liệu" khỏi bảo hộ — địa danh nhà nước công bố công khai.
//
// ── KHỬ TRÙNG (đã làm khi khai; dữ liệu dưới ĐÃ sạch trùng) ─────────────────
//   · So 13 mục cũ: cùng tên-lõi + cách < 1,5° ⇒ MỘT thực thể, GIỮ mục cũ, BỎ
//     bản TT33. 11 mục bị bỏ: Phúc Tần, Huyền Trân, Phúc Nguyên, Tư Chính,
//     Quế Đường, Vũng Mây (DK1 — cũ "Bãi X", TT33 "Bãi cạn X"); An Nhơn (TT33
//     "Đá An Nhơn" ~ cũ "Bãi An Nhơn"); Ga Ven, Én Đất, Ken Nan, Ba Đầu
//     (Trường Sa, trùng khít).
//     ĐÃ SỬA (Lead 2026-09-03): "Bãi Vũng Mây" nắn về toạ độ chính thức TT33
//     [7,897 / 111,607] (cũ Wikipedia [7,758 / 110,691] lệch ~103 km — SAI).
//     Các cặp DK1 khác lệch 1–11 km (chấp nhận được).
//   · Trong nội bộ TT33: trùng đúng-tên + cách < 2 km ⇒ giữ một. (0 mục.)
//   · So dia-danh-ngam.v1.json (đối tượng ngầm): 0 tên trùng.
//   · So vn-islands.v1.json (2026-09-03, review A.5 danh-gia-hai-do): 27 tên
//     có ở CẢ HAI file (Đá Lớn, Đá Nam, Bãi Thuỷ Tề…) → cùng chỗ vừa chấm navy
//     vừa chấm teal. Luật chốt THEO BẢN CHẤT: thực thể NGẦM/rạn/bãi (Đá/Bãi)
//     → CHỈ ở coral-reefs (toạ độ TT33 chính thức thắng Wikipedia); thực thể
//     NỔI lên được (đảo/hòn/CỒN CÁT nổi) → CHỈ ở vn-islands. Vì thế 2 cồn cát
//     nổi ở Hoàng Sa RÚT khỏi lớp này (GIU_O_ISLANDS bên dưới), 31 đá/bãi ngầm
//     rút khỏi vn-islands. Bảng quyết định từng cặp:
//     docs/research/ten-bai-can-2026-09.md §9. Cổng test: reefs.test.ts đếm
//     giao tên islands ∩ reefs = 0.
//
// ── NHÓM DK1 / THỀM LỤC ĐỊA nằm trong Mục A.I ──────────────────────────────
// Cụm nhà giàn DK1 (Tư Chính, Phúc Tần, Ba Kè, Vũng Mây, Ngự Bình, Kim Phụng,
// Trường Tiền…) trong TT33 xếp ở A.I dưới tỉnh "Bà Rịa - Vũng Tàu", nhưng về
// địa lý ở thềm lục địa phía Nam (~7–8°B/109,7–111,8°Đ), KHÔNG thuộc quần đảo
// Trường Sa. Tách group "them-luc-dia" bằng HỘP TOẠ ĐỘ (lat 6,5–8,75 / lon
// 109,3–112,3) để đồng bộ 6 mục DK1 cũ; ngoài hộp = "ven-bo" (admin = tên tỉnh).
//
// ── LƯU Ý HIỂN THỊ CHO LEAD ────────────────────────────────────────────────
// Lớp này nhảy từ 13 lên ~1.374 điểm (1.225 ven bờ). Layer "reef-dot" (circle)
// KHÔNG có collision → mọi chấm đều vẽ; ở mức zoom cả nước, dải ven bờ sẽ dày.
// Nhãn "reef-label" tự né nhau (text-allow-overlap:false, text-optional:true) +
// symbol-sort-key theo rank (offshore rank 2 thắng ven-bo rank 3). Khuyến nghị:
// đặt minzoom cho "reef-dot" ven bờ (vd z≥8) hoặc lọc theo rank khi zoom thấp.
//
// CỔNG TỰ KIỂM ở cuối file: quét MỌI tên, còn BẤT KỲ ký tự CJK (Hán) nào thì
// NÉM lỗi, không ghi file — để không đời nào lọt nhãn nhạy cảm.

import { writeFileSync, mkdirSync } from "node:fs";

// ── TRƯỜNG SA — 13 mục curated cũ (GIỮ NGUYÊN, group truong-sa) ─────────────
const TRUONG_SA = [
  { name: "Bãi Cỏ Mây", lat: 9.817, lng: 115.867, type: "bai", rank: 2 },
  { name: "Bãi Cỏ Rong", lat: 11.3333, lng: 116.6667, type: "bai", rank: 2 },
  { name: "Đá Ba Đầu", lat: 9.9939, lng: 114.6575, type: "da", rank: 3 },
  { name: "Đá Ga Ven", lat: 10.2072, lng: 114.2231, type: "da", rank: 3 },
  { name: "Đá Én Đất", lat: 10.35, lng: 114.7, type: "da", rank: 3 },
  { name: "Đá Ken Nan", lat: 9.9, lng: 114.467, type: "da", rank: 3 },
  { name: "Bãi An Nhơn", lat: 10.7106, lng: 114.5339, type: "con", rank: 3 },
];

// ── THỀM LỤC ĐỊA PHÍA NAM — cụm DK1, 6 mục cũ (GIỮ NGUYÊN) ──────────────────
const THEM_LUC_DIA = [
  { name: "Bãi Tư Chính", lat: 7.5292, lng: 109.7444, type: "bai", rank: 2 },
  { name: "Bãi Phúc Tần", lat: 8.15, lng: 110.6, type: "bai", rank: 2 },
  { name: "Bãi Phúc Nguyên", lat: 7.9167, lng: 109.9667, type: "bai", rank: 2 },
  { name: "Bãi Huyền Trân", lat: 8.0203, lng: 110.6308, type: "bai", rank: 2 },
  { name: "Bãi Quế Đường", lat: 7.8136, lng: 110.4733, type: "bai", rank: 2 },
  { name: "Bãi Vũng Mây", lat: 7.897, lng: 111.607, type: "bai", rank: 2 },
];

const CURATED = [
  ...TRUONG_SA.map((d) => ({ ...d, group: "truong-sa", admin: "tỉnh Khánh Hòa" })),
  ...THEM_LUC_DIA.map((d) => ({
    ...d,
    group: "them-luc-dia",
    admin: "Thềm lục địa phía Nam",
  })),
];

// ── NGUỒN CHÉP NGUYÊN VĂN (TT 33/2024, họ bãi/đá/rạn/cồn — A.I + B + C) ──────
// Mỗi dòng: Tên|Vĩ độ|Kinh độ|Mục(A|B|C)|Tỉnh nguồn. Toạ độ = thập phân đổi từ
// VN-2000 Độ-Phút-Giây trong TT33 (round(d + m/60 + s/3600, 5)). Coi VN-2000 ≈
// WGS84 ở tỉ lệ hiển thị (lệch dưới vài mét). ĐÃ khử trùng (xem đầu file).
const TT33_RAW = `
Đá Bắc|17.1|111.51333|B|Đà Nẵng
Cồn Cát Tây|16.97917|112.21|B|Đà Nẵng
Đá Trương Nghĩa|16.97667|112.26333|B|Đà Nẵng
Bãi Cát Trung|16.93556|112.34167|B|Đà Nẵng
Bãi Cát Nam|16.93111|112.34389|B|Đà Nẵng
Cồn Cát Nam|16.92417|112.34389|B|Đà Nẵng
Bãi cạn Gò Nổi|16.82222|112.88444|B|Đà Nẵng
Bãi Bình Sơn|16.77667|112.22|B|Đà Nẵng
Bãi Bình Sơn Đông|16.7475|112.26417|B|Đà Nẵng
Đá Hòn Tháp Bắc|16.59389|112.63139|B|Đà Nẵng
Bãi Xà Cừ|16.58167|111.715|B|Đà Nẵng
Đá Sơn Kỳ|16.58|111.67639|B|Đà Nẵng
Bãi Thủy Tề Bắc|16.55028|112.58972|B|Đà Nẵng
Đá Trà Tây|16.5475|111.71361|B|Đà Nẵng
Bãi Đèn Pha|16.53472|111.62611|B|Đà Nẵng
Bãi Thủy Tề|16.52472|112.54583|B|Đà Nẵng
Bãi Thủy Tề Nam lớn|16.4925|112.49694|B|Đà Nẵng
Đá Hải Sâm|16.46667|111.59167|B|Đà Nẵng
Bãi Thủy Tề Nam nhỏ|16.46306|112.47722|B|Đà Nẵng
Bãi Ngự Bình|16.45528|111.655|B|Đà Nẵng
Bãi Quảng Nghĩa Bắc|16.42028|112.63139|B|Đà Nẵng
Bãi Châu Nhai Đông|16.35222|112.53889|B|Đà Nẵng
Đá Chim Én|16.34667|112.04333|B|Đà Nẵng
Bãi Châu Nhai|16.32667|112.42333|B|Đà Nẵng
Bãi Quảng Nghĩa|16.32667|112.68333|B|Đà Nẵng
Đá Lồi|16.25|111.68333|B|Đà Nẵng
Đá Bông Bay|16.03333|112.5|B|Đà Nẵng
Bãi ngầm Ốc Tai Voi|15.73028|112.23111|B|Đà Nẵng
Đá Đồng Thanh|11.915|116.78444|C|Khánh Hòa
Bãi Đinh Ba|11.50167|114.64667|C|Khánh Hòa
Đá Bắc|11.46667|114.39333|C|Khánh Hòa
Đá Nam|11.38889|114.29667|C|Khánh Hòa
Bãi Núi Cầu|11.345|114.57056|C|Khánh Hòa
Đá An Lão|11.15167|114.79833|C|Khánh Hòa
Đá Vĩnh Hảo|11.09333|114.375|C|Khánh Hòa
Đá Vĩnh Hợp|11.08139|117.0075|C|Khánh Hòa
Bãi đá Tri Lễ Đông|11.07667|114.25694|C|Khánh Hòa
Đá Trâm Đức Bắc|11.06556|114.32111|C|Khánh Hòa
Bãi đá Tri Lễ|11.06167|114.22167|C|Khánh Hòa
Đá Trâm Đức|11.05833|114.32333|C|Khánh Hòa
Đá Hoài Ân|11.05611|114.20333|C|Khánh Hòa
Đá Trâm Đức Nam|11.05472|114.33972|C|Khánh Hòa
Bãi đá Xen Đi|11.04972|114.19056|C|Khánh Hòa
Đá Cái Vung|11.03778|114.17417|C|Khánh Hòa
Bãi Đường|11.02167|114.69667|C|Khánh Hòa
Đá Trung Lễ|10.965|116.42167|C|Khánh Hòa
Đá Xu Bi|10.91833|114.08|C|Khánh Hòa
Đá Mỏ Vịt|10.895|116.43833|C|Khánh Hòa
Đá Cá Nhám|10.88|114.92167|C|Khánh Hòa
Đá Tân Châu|10.85139|114.875|C|Khánh Hòa
Đá Hợp Kim|10.80833|116.09167|C|Khánh Hòa
Đá Gò Già|10.80389|116.85389|C|Khánh Hòa
Đá Cỏ My|10.79389|116.68861|C|Khánh Hòa
Đá An Nhơn Bắc|10.77056|114.59111|C|Khánh Hòa
Đá Ba Cờ|10.71917|116.16444|C|Khánh Hòa
Bãi Loại Ta Nam|10.70528|114.32806|C|Khánh Hòa
Đá An Nhơn Nam|10.69|114.495|C|Khánh Hòa
Đá Sa Huỳnh|10.67833|114.46|C|Khánh Hòa
Đá Khúc Giác|10.61833|116.17167|C|Khánh Hòa
Bãi Hải Yến|10.58667|116.99833|C|Khánh Hòa
Đá Chà Và|10.55111|116.93111|C|Khánh Hòa
Đá Triêm Đức|10.53667|115.78778|C|Khánh Hòa
Đá Hoa|10.53528|115.72972|C|Khánh Hòa
Đá Ninh Cơ|10.5|115.70556|C|Khánh Hòa
Đá Hội Đức|10.46528|115.72389|C|Khánh Hòa
Đá Định Tường|10.46222|115.77917|C|Khánh Hòa
Đá Núi Thị|10.41167|114.58583|C|Khánh Hòa
Đá Bàn Than|10.38722|114.41306|C|Khánh Hòa
Đá Tây Nam|10.31333|116.495|C|Khánh Hòa
Đá Lục Giang|10.25333|115.36833|C|Khánh Hòa
Đá Đền Cây Cỏ|10.23222|113.63639|C|Khánh Hòa
Đá Long Hải|10.19167|115.3|C|Khánh Hòa
Đá Lạc|10.165|114.25167|C|Khánh Hòa
Đá Phật Tự|10.125|116.14111|C|Khánh Hòa
Đá Lớn|10.06167|113.85167|C|Khánh Hòa
Đá Nhỏ|9.99861|114.0025|C|Khánh Hòa
Đá Đức Hòa|9.98|114.58833|C|Khánh Hòa
Đá Bãi Khung|9.96667|114.56167|C|Khánh Hòa
Đá Bình Sơn|9.93667|114.52|C|Khánh Hòa
Đá Tư Nghĩa Đông|9.91833|114.515|C|Khánh Hòa
Đá Tư Nghĩa|9.91361|114.49556|C|Khánh Hòa
Đá An Bình|9.90833|114.595|C|Khánh Hòa
Đá Vành Khăn|9.905|115.53833|C|Khánh Hòa
Đá Bình Khê|9.9|114.385|C|Khánh Hòa
Đá Nhạn Gia|9.89833|114.34333|C|Khánh Hòa
Đá Ken Nan Tây|9.895|114.42667|C|Khánh Hòa
Đá Bia|9.89|114.53222|C|Khánh Hòa
Đá Sơn Hà|9.88167|114.30333|C|Khánh Hòa
Đá Vị Khê|9.87|114.50833|C|Khánh Hòa
Đá Nghĩa Hành|9.855|114.27667|C|Khánh Hòa
Đá Ninh Hòa|9.85083|114.48972|C|Khánh Hòa
Đá Tam Trung|9.84028|114.27472|C|Khánh Hòa
Đá Văn Nguyên|9.835|114.455|C|Khánh Hòa
Đá Phúc Sỹ|9.79806|114.40083|C|Khánh Hòa
Đá Len Đao|9.77889|114.37111|C|Khánh Hòa
Đá Cô Lin|9.77333|114.25333|C|Khánh Hòa
Đá Gạc Ma|9.72|114.27667|C|Khánh Hòa
Đá Trà Khúc|9.69167|114.355|C|Khánh Hòa
Đá Long Điền|9.60222|116.16472|C|Khánh Hòa
Đá Chữ Thập|9.54806|112.88583|C|Khánh Hòa
Bãi ngầm Nguyệt Xương|9.53333|112.41667|C|Khánh Hòa
Đá Bồ Đề|9.52|116.35833|C|Khánh Hòa
Đá Suối Ngọc|9.38167|115.44167|C|Khánh Hòa
Đá Núi Mon|9.20833|113.6625|C|Khánh Hòa
Đá Châu Viên|8.865|112.835|C|Khánh Hòa
Bãi đá Tây|8.85833|112.21833|C|Khánh Hòa
Đá Tiên Nữ|8.855|114.655|C|Khánh Hòa
Đá Đông|8.82833|112.59667|C|Khánh Hòa
Bãi đá Tốc Tan|8.81167|113.98333|C|Khánh Hòa
Đá Núi Le|8.71|114.185|C|Khánh Hòa
Đá Lát|8.67083|111.67167|C|Khánh Hòa
Bãi ngầm Mỹ Hải|8.55|111.46667|C|Khánh Hòa
Bãi ngầm Ngũ Phụng|8.45|115.16|C|Khánh Hòa
Đá Công Đo|8.35833|115.22333|C|Khánh Hòa
Bãi đá Thuyền Chài|8.18333|113.31|C|Khánh Hòa
Đá Gia Hội|8.18194|114.70639|C|Khánh Hòa
Bãi ngầm Chim Biển|8.15|111.96667|C|Khánh Hòa
Đá Gia Phú|8.13472|114.79583|C|Khánh Hòa
Đá Sâu|8.13167|114.57306|C|Khánh Hòa
Đá Én Ca|8.10722|114.13|C|Khánh Hòa
Đá Kỳ Vân|7.99056|113.90417|C|Khánh Hòa
Bãi cạn Kiệu Ngựa|7.73833|114.265|C|Khánh Hòa
Đá Kiệu Ngựa|7.62833|113.935|C|Khánh Hòa
Đá Suối Cát|7.6225|113.80111|C|Khánh Hòa
Đá Hoa Lau|7.375|113.82778|C|Khánh Hòa
Đá Vĩnh Tường|7.18333|114.81667|C|Khánh Hòa
Đá Sác Lốt|6.94167|113.575|C|Khánh Hòa
Đá Ba Kè|7.96056|111.71778|A|Bà Rịa - Vũng Tàu
Bãi Trường Tiền|7.87639|111.74111|A|Bà Rịa - Vũng Tàu
Bãi Vọng Cảnh|7.80333|111.74444|A|Bà Rịa - Vũng Tàu
Bãi Đất|7.71389|111.75194|A|Bà Rịa - Vũng Tàu
Bãi Ngự Bình|7.67222|111.55472|A|Bà Rịa - Vũng Tàu
Bãi Kim Phụng|7.65444|111.67528|A|Bà Rịa - Vũng Tàu
Bãi Đại Nội|7.59528|111.61389|A|Bà Rịa - Vũng Tàu
Bãi Đinh|7.56806|111.55028|A|Bà Rịa - Vũng Tàu
Bãi Nam Ba Kè|7.34139|111.695|A|Bà Rịa - Vũng Tàu
Bãi ngầm Hồ Ninh|10.51|107.58028|A|Bà Rịa - Vũng Tàu
Bãi Hồ Cốc|10.49667|107.46861|A|Bà Rịa - Vũng Tàu
Bãi Hồ Tràm|10.47083|107.43639|A|Bà Rịa - Vũng Tàu
Cồn Miếu Bà|10.46417|107.02389|A|Bà Rịa - Vũng Tàu
Bãi Điệp|10.44528|107.05556|A|Bà Rịa - Vũng Tàu
Bãi Gỗ|10.43417|107.09417|A|Bà Rịa - Vũng Tàu
Bãi ngầm Mắc Lưới|10.41444|107.57|A|Bà Rịa - Vũng Tàu
Bãi Long Hải|10.4025|107.21694|A|Bà Rịa - Vũng Tàu
Bãi Phước Tỉnh|10.39944|107.18194|A|Bà Rịa - Vũng Tàu
Bãi cạn Ba Kiềm|10.39028|107.48694|A|Bà Rịa - Vũng Tàu
Bãi Sao Mai|10.38972|107.07222|A|Bà Rịa - Vũng Tàu
Bãi Hàng Dương|10.38417|107.23333|A|Bà Rịa - Vũng Tàu
Bãi Dâu|10.36806|107.05944|A|Bà Rịa - Vũng Tàu
Bãi cạn Bông Lan|10.35917|107.39389|A|Bà Rịa - Vũng Tàu
Bãi Thùy Dương|10.35639|107.10556|A|Bà Rịa - Vũng Tàu
Bãi cạn Châu Viên|10.35444|107.27583|A|Bà Rịa - Vũng Tàu
Bãi Thùy Vân|10.35056|107.10056|A|Bà Rịa - Vũng Tàu
Bãi Trước|10.34639|107.07056|A|Bà Rịa - Vũng Tàu
Bãi Sau|10.3425|107.09417|A|Bà Rịa - Vũng Tàu
Bãi Dứa|10.32778|107.07667|A|Bà Rịa - Vũng Tàu
Bãi cạn Tây Nam|10.28806|107.02667|A|Bà Rịa - Vũng Tàu
Bãi Đầm Tre|8.75111|106.65667|A|Bà Rịa - Vũng Tàu
Đá Đông Hòn Tre Nhỏ|8.73889|106.58806|A|Bà Rịa - Vũng Tàu
Bãi Canh|8.73139|106.65333|A|Bà Rịa - Vũng Tàu
Bãi Vông|8.72889|106.64|A|Bà Rịa - Vũng Tàu
Bãi Đất Dốc|8.69583|106.64722|A|Bà Rịa - Vũng Tàu
Bãi Cát Nhỏ|8.69528|106.73417|A|Bà Rịa - Vũng Tàu
Bãi Bông Hường|8.68944|106.62|A|Bà Rịa - Vũng Tàu
Bãi Cát Lớn|8.68833|106.73639|A|Bà Rịa - Vũng Tàu
Bãi Lò Vôi|8.68806|106.63417|A|Bà Rịa - Vũng Tàu
Bãi cạn Sở Muối Ngoài|8.68222|106.62194|A|Bà Rịa - Vũng Tàu
Bãi cạn Sở Muối Trong|8.6775|106.61306|A|Bà Rịa - Vũng Tàu
Bãi Bà Độp|8.6725|106.68|A|Bà Rịa - Vũng Tàu
Bãi Sạn|8.67167|106.70306|A|Bà Rịa - Vũng Tàu
Bãi Giông|8.67139|106.69028|A|Bà Rịa - Vũng Tàu
Bãi Tranh|8.66639|106.68222|A|Bà Rịa - Vũng Tàu
Bãi Dương|8.66556|106.665|A|Bà Rịa - Vũng Tàu
Bãi Xi Măng|8.665|106.70028|A|Bà Rịa - Vũng Tàu
Bãi cạn Côn Lôn|8.65222|106.57528|A|Bà Rịa - Vũng Tàu
Bãi Nhút|8.64472|106.59861|A|Bà Rịa - Vũng Tàu
Bãi Sạn Tây|8.64222|106.55222|A|Bà Rịa - Vũng Tàu
Bãi Bực Lở|11.32667|108.83889|A|Bình Thuận
Bãi Cây Cấm|11.30417|108.78056|A|Bình Thuận
Bãi cạn Cù Lao Câu|11.27944|108.86944|A|Bình Thuận
Bãi ngầm Câu Trên|11.27667|108.84111|A|Bình Thuận
Bãi ngầm Câu Trong|11.27389|108.82361|A|Bình Thuận
Đá Thủy Lôi|11.26111|108.85333|A|Bình Thuận
Bãi ngầm Câu Dưới|11.26|108.81111|A|Bình Thuận
Bãi ngầm Câu Ngoài|11.25278|108.845|A|Bình Thuận
Bãi cạn Bào Ngư|11.21806|108.86333|A|Bình Thuận
Rạng Bè|11.21111|108.88944|A|Bình Thuận
Bãi Trọ|11.19528|108.73028|A|Bình Thuận
Đá Bàn|11.18444|108.7275|A|Bình Thuận
Bãi Ngoài|11.17444|108.7|A|Bình Thuận
Bãi cạn La Gàn|11.13083|108.70833|A|Bình Thuận
Bãi ngầm Mái Dài|11.11611|108.76167|A|Bình Thuận
Bãi ngầm Phan Rí Dài|11.11333|108.61361|A|Bình Thuận
Bãi cạn Sao Biển|11.10833|108.77556|A|Bình Thuận
Bãi ngầm Mỏ Neo|11.10778|108.6775|A|Bình Thuận
Bãi ngầm Phan Rí Trong|11.10222|108.52194|A|Bình Thuận
Bãi cạn Hàm Ếch|11.09889|108.8375|A|Bình Thuận
Bãi ngầm Mái Tròn|11.07639|108.77083|A|Bình Thuận
Bãi ngầm Phan Rí Ngoài|11.06167|108.74222|A|Bình Thuận
Rạng Kẻm|11.05139|108.75833|A|Bình Thuận
Rạng Chớn Cồn|11.01806|108.76861|A|Bình Thuận
Bãi Hải Dương|10.94861|108.20306|A|Bình Thuận
Bãi Chiến Thắng|10.93389|108.16722|A|Bình Thuận
Bãi biển Đồi Dương|10.9275|108.11694|A|Bình Thuận
Bãi Lạc Đạo|10.91917|108.09222|A|Bình Thuận
Đá Rạng|10.91611|108.28028|A|Bình Thuận
Bãi ngầm Bắc Vịnh|10.86|108.245|A|Bình Thuận
Bãi ngầm Nam Vịnh|10.80333|108.09806|A|Bình Thuận
Đá Trạm|10.76944|108.02222|A|Bình Thuận
Bãi cạn Thủy Tinh|10.73778|108.01583|A|Bình Thuận
Bãi Cây Găng|10.72111|107.91194|A|Bình Thuận
Đá Găng|10.70778|107.95|A|Bình Thuận
Bãi Kê Gà|10.70556|107.97639|A|Bình Thuận
Bãi đá Văn Kê|10.69639|107.95556|A|Bình Thuận
Bãi cạn Phan Thiết|10.66472|108.31722|A|Bình Thuận
Bãi ngầm Hàm Tân 1|10.60417|107.75139|A|Bình Thuận
Bãi ngầm Hàm Tân 2|10.595|107.74083|A|Bình Thuận
Bãi ngầm Hàm Tân 3|10.58194|107.73806|A|Bình Thuận
Bãi ngầm Hàm Tân 4|10.57083|107.73944|A|Bình Thuận
Bãi ngầm Cổ Cò|10.545|107.75889|A|Bình Thuận
Bãi đá Đông|10.52806|108.95861|A|Bình Thuận
Bãi Phủ|10.5225|108.95778|A|Bình Thuận
Bãi đá Ông|10.50056|108.9525|A|Bình Thuận
Rạng Mập|10.49167|107.82972|A|Bình Thuận
Đá Trào|10.4825|108.96806|A|Bình Thuận
Bãi cạn Tiền Cổ|10.47361|107.70528|A|Bình Thuận
Cồn Hoài Hưởng|14.48444|109.09333|A|Bình Định
Bãi Nhỏ|14.4475|109.12056|A|Bình Định
Rạn Cao|14.44639|109.13056|A|Bình Định
Bãi Xép|14.43667|109.1175|A|Bình Định
Bãi Bang Bang|14.42833|109.11472|A|Bình Định
Bãi Phú Thứ|14.39556|109.12667|A|Bình Định
Bãi Bụt|14.38944|109.12222|A|Bình Định
Bãi Phú Hòa|14.38167|109.11972|A|Bình Định
Bãi ngầm Cá Hồng|14.35778|109.19444|A|Bình Định
Bãi Bàn|14.25333|109.19|A|Bình Định
Bãi cạn Đá Vách|14.245|109.19917|A|Bình Định
Đá Con Mắt|14.23333|109.20528|A|Bình Định
Đá Mũi Nhỏ|14.13222|109.22417|A|Bình Định
Bãi Cát Bồi|14.12722|109.20778|A|Bình Định
Đá Mũi Lớn|14.12694|109.21833|A|Bình Định
Bãi Sụp|14.12583|109.17944|A|Bình Định
Đá Dù Ngoài|13.96333|109.275|A|Bình Định
Đá Lố Cỏ|13.90556|109.31528|A|Bình Định
Rạn Tai Mèo|13.90139|109.34417|A|Bình Định
Đá Cỏ Rong|13.89972|109.31556|A|Bình Định
Bãi Khém|13.89889|109.29111|A|Bình Định
Rạn Mốc|13.89778|109.34639|A|Bình Định
Đá Hang Lớn|13.89472|109.29222|A|Bình Định
Đá Mồng|13.8875|109.2925|A|Bình Định
Đá Trụ Thủ|13.88611|109.29444|A|Bình Định
Bãi Ngang|13.88528|109.29583|A|Bình Định
Bãi Hang Yến|13.88472|109.30389|A|Bình Định
Bãi đá Ngựa|13.88028|109.30278|A|Bình Định
Đá Bờ Cao|13.88|109.29639|A|Bình Định
Đá Sẹo Nam|13.87889|109.30278|A|Bình Định
Đá Đủng Đỉnh|13.86556|109.29222|A|Bình Định
Bãi Phước Sơn|13.86472|109.23556|A|Bình Định
Đá Đầu Đinh|13.86|109.29333|A|Bình Định
Bãi Kỳ Co|13.85167|109.29194|A|Bình Định
Bãi Phước Hòa|13.85167|109.24611|A|Bình Định
Đá Bàn Đen|13.84917|109.29333|A|Bình Định
Bãi Lộc Trung|13.84806|109.22694|A|Bình Định
Bãi Trục Buồm|13.84222|109.29861|A|Bình Định
Bãi Nhơn Hội|13.83861|109.25194|A|Bình Định
Bãi Hang Cả|13.83722|109.29611|A|Bình Định
Đá Đầu Đen|13.82833|109.2975|A|Bình Định
Cồn Muối|13.82167|109.21639|A|Bình Định
Bãi Nhơn Bình|13.8125|109.22639|A|Bình Định
Bãi Dơi|13.81167|109.25056|A|Bình Định
Bãi Điệp|13.80639|109.27278|A|Bình Định
Cồn Cỏ Lác|13.79944|109.21917|A|Bình Định
Bãi Đống Đa|13.79917|109.22889|A|Bình Định
Bãi Rỗi|13.79583|109.2775|A|Bình Định
Cồn Đôi Trong|13.79333|109.21139|A|Bình Định
Cồn Đôi Ngoài|13.78944|109.21639|A|Bình Định
Bãi Cửa Vụng|13.77139|109.24333|A|Bình Định
Bãi Bờ Đập|13.76528|109.29056|A|Bình Định
Đá Ba Chỏm|13.76278|109.29556|A|Bình Định
Bãi Cơm|13.7625|109.27361|A|Bình Định
Rạn Xủ|13.71444|109.30083|A|Bình Định
Bãi Xép Đá|13.70139|109.22417|A|Bình Định
Rạn Tàu|13.69639|109.28694|A|Bình Định
Đá Con Cua|13.69472|109.23972|A|Bình Định
Đá Khô Cứng|13.6925|109.24139|A|Bình Định
Rạn Trạng|13.68917|109.30528|A|Bình Định
Bãi cạn Mầm Đá|13.67972|109.24611|A|Bình Định
Đá Vô Tri|13.63722|109.33833|A|Bình Định
Đá Cao Khơi|13.63306|109.35|A|Bình Định
Rạn Bãi Bắc|13.62167|109.35139|A|Bình Định
Rạn Mũi Đông|13.61|109.3625|A|Bình Định
Đá Khô Trên|13.60972|109.34806|A|Bình Định
Đá Cao|13.60806|109.34778|A|Bình Định
Đá Khô Trới|13.60389|109.36194|A|Bình Định
Bãi Gò Cát|9.08417|105.48694|A|Bạc Liêu
Bãi Thừa Đức|10.12472|106.80333|A|Bến Tre
Bãi Nghêu|10.11139|106.78667|A|Bến Tre
Bãi Kẽm|10.08056|106.77028|A|Bến Tre
Cồn Ngang Chìm|10.075|106.86389|A|Bến Tre
Bãi Thới Thuận|10.065|106.76194|A|Bến Tre
Cồn Bà Tư|10.0575|106.73944|A|Bến Tre
Cồn Thới Lợi|10.04194|106.69861|A|Bến Tre
Cồn Nhàn|10.01944|106.67083|A|Bến Tre
Bãi Bần|10.01222|106.68778|A|Bến Tre
Bãi An Thủy|9.99472|106.685|A|Bến Tre
Cồn Trâu|9.96861|106.68806|A|Bến Tre
Cồn Bà Thơ|9.96639|106.6975|A|Bến Tre
Cồn Tộ|9.95417|106.70278|A|Bến Tre
Cồn Dĩa|9.94139|106.74361|A|Bến Tre
Bãi An Điền|9.92778|106.66611|A|Bến Tre
Cồn Bình Tự|9.9225|106.75944|A|Bến Tre
Cồn Cặp|9.88778|106.74083|A|Bến Tre
Bãi Rễ Đước|9.87556|106.685|A|Bến Tre
Bãi Thạnh Hải|9.83361|106.66111|A|Bến Tre
Bãi Thạnh Phong|9.81361|106.62528|A|Bến Tre
Cồn Đâm|9.79806|106.61972|A|Bến Tre
Bãi Cổ Chiên|9.78083|106.64111|A|Bến Tre
Cồn Dược|9.73056|106.66833|A|Bến Tre
Bãi Kênh Hội|9.37556|104.82306|A|Cà Mau
Bãi Đại Dừa|9.30222|104.82194|A|Cà Mau
Bãi Sào Lưới|9.21694|104.81083|A|Cà Mau
Bãi Khánh Hải|9.10861|104.80694|A|Cà Mau
Đá Ông Đốc|9.04167|104.75083|A|Cà Mau
Bãi Đất Biển|9.00417|104.7975|A|Cà Mau
Bãi Hiệp Hải|8.9725|105.41056|A|Cà Mau
Bãi Mỹ Bình - Cái Cám|8.95667|104.79861|A|Cà Mau
Bãi Cái Cám - Công Nghiệp|8.91389|104.79722|A|Cà Mau
Cồn Lồng Đèn|8.90528|105.37056|A|Cà Mau
Bãi Công Nghiệp - Cái Đôi Vàm|8.89361|104.79444|A|Cà Mau
Đá Nhạn Trắng|8.88417|104.56639|A|Cà Mau
Bãi Cái đôi Nhỏ - Sào Lưới|8.84306|104.78139|A|Cà Mau
Bãi Sào Lưới - Gò Công|8.81361|104.7775|A|Cà Mau
Bãi Gò Công - Rạch Thùng|8.78389|104.85667|A|Cà Mau
Bãi Bồ Đề|8.74806|105.20167|A|Cà Mau
Bãi Tân Tạo|8.70639|105.15333|A|Cà Mau
Cồn Ông Trang|8.70639|104.83306|A|Cà Mau
Bãi Viên An|8.68556|104.78917|A|Cà Mau
Bãi Láng Sụp|8.68222|105.13611|A|Cà Mau
Bãi Ngọc Hiển|8.65833|104.75556|A|Cà Mau
Bãi cạn Mũi Cà Mau|8.64806|104.57278|A|Cà Mau
Bãi Vinh Hạn|8.63667|105.11028|A|Cà Mau
Bãi Nhà Phiếu|8.62028|105.05306|A|Cà Mau
Bãi Đất Mũi|8.60889|104.70667|A|Cà Mau
Bãi Rạch Tàu|8.59528|104.73083|A|Cà Mau
Bãi Dẫy|8.57139|104.79056|A|Cà Mau
Bãi Nước Sôi|8.56889|104.87694|A|Cà Mau
Bãi Khai Long|8.56278|104.82694|A|Cà Mau
Đá Lồi|8.50778|104.84|A|Cà Mau
Bãi Lớn|8.44|104.83667|A|Cà Mau
Bãi cạn Cà Mau|8.08333|103.79167|A|Cà Mau
Bãi cạn Cảnh Dương|7.30333|106.85333|A|Cà Mau
Bãi cạn Đông Sơn|7.10444|107.5825|A|Cà Mau
Cồn Lạp|18.76111|105.83194|A|Hà Tĩnh
Cồn Nồm|18.74806|105.84528|A|Hà Tĩnh
Bãi ngầm Tám Sải|18.52778|105.92889|A|Hà Tĩnh
Bãi ngầm Sáu Sải|18.51444|105.91389|A|Hà Tĩnh
Bãi Thạch Kim|18.46861|105.91444|A|Hà Tĩnh
Đá Am|18.46806|105.92806|A|Hà Tĩnh
Bãi cạn Lưỡi Liềm|18.445|105.91444|A|Hà Tĩnh
Bãi Thạch Hải|18.41472|105.96944|A|Hà Tĩnh
Bãi Thạch Trị|18.36222|106.01528|A|Hà Tĩnh
Đá Trâu Nước|18.31528|106.1675|A|Hà Tĩnh
Đá Mồng|18.31278|106.17389|A|Hà Tĩnh
Bãi Rạng Đông|18.29222|106.08056|A|Hà Tĩnh
Đá Cầu Nậy|18.27889|106.13194|A|Hà Tĩnh
Bãi Thiên Cầm|18.27528|106.1025|A|Hà Tĩnh
Bãi cạn Cẩm Lĩnh|18.275|106.13833|A|Hà Tĩnh
Đá Ngang|18.26917|106.14361|A|Hà Tĩnh
Bãi Thắng Lợi|18.25583|106.18083|A|Hà Tĩnh
Bãi Động Bún|18.24|106.19944|A|Hà Tĩnh
Bãi đá Sắc|18.22806|106.21694|A|Hà Tĩnh
Bãi Đế Cày|18.21917|106.23056|A|Hà Tĩnh
Bãi Kỳ Ninh|18.12444|106.34222|A|Hà Tĩnh
Đá Chóp Con|18.11917|106.49333|A|Hà Tĩnh
Đá Chóp Mẹ|18.11889|106.49222|A|Hà Tĩnh
Đá Ngà Voi Trong|18.11472|106.36444|A|Hà Tĩnh
Đá Ngà Voi Ngoài|18.11333|106.36806|A|Hà Tĩnh
Đá Móng Trong|18.10583|106.4675|A|Hà Tĩnh
Đá Móng Ngoài|18.10306|106.46917|A|Hà Tĩnh
Bãi Cao Vọng|18.1025|106.35194|A|Hà Tĩnh
Đá Quả Thông|18.10194|106.465|A|Hà Tĩnh
Đá Quả Bàng|18.10028|106.46444|A|Hà Tĩnh
Bãi Cồn Voi|18.00194|106.465|A|Hà Tĩnh
Bãi Kỳ Nam Trên|17.99278|106.47389|A|Hà Tĩnh
Bãi Mũi Đao|17.97694|106.48528|A|Hà Tĩnh
Đá Cá Ngựa|20.91361|106.94528|A|Hải Phòng
Bãi Nhà Mạc|20.86806|106.78444|A|Hải Phòng
Bãi Giai|20.85583|106.93889|A|Hải Phòng
Bãi Giai Lớn|20.85139|106.93694|A|Hải Phòng
Cồn Bọt Nước|20.84111|106.92472|A|Hải Phòng
Đá Quay|20.83083|107.06667|A|Hải Phòng
Bãi Đầu Chu|20.82917|106.905|A|Hải Phòng
Đá Gạc Trên|20.825|107.05778|A|Hải Phòng
Đá Gạc Dưới|20.82444|107.05833|A|Hải Phòng
Bãi Cái Viềng|20.81722|106.91222|A|Hải Phòng
Đá Ếch Con|20.81611|107.06667|A|Hải Phòng
Bãi Đình Vũ|20.80417|106.80139|A|Hải Phòng
Bãi Phù Long|20.79194|106.93528|A|Hải Phòng
Bãi Tràng Cát|20.78944|106.76444|A|Hải Phòng
Bãi Niên Hà|20.77806|106.95889|A|Hải Phòng
Đá Giác|20.77278|107.07806|A|Hải Phòng
Đá Chân Trong|20.77139|107.09194|A|Hải Phòng
Đá Chân Ngoài|20.77111|107.09306|A|Hải Phòng
Cồn Bà|20.76861|106.96028|A|Hải Phòng
Cồn Ông|20.76861|106.96|A|Hải Phòng
Bãi Tân Thành|20.76528|106.77167|A|Hải Phòng
Cồn Cát Doi|20.74444|106.94972|A|Hải Phòng
Cồn Tôm Hùm|20.74194|106.85722|A|Hải Phòng
Đá Vẹm Trong|20.74056|106.99833|A|Hải Phòng
Bãi Đầu Gỗ|20.73944|106.78389|A|Hải Phòng
Đá Vẹm Ngoài|20.73778|107.0|A|Hải Phòng
Bãi Bèo|20.72972|107.05556|A|Hải Phòng
Đá Gạch Trong|20.72806|107.02472|A|Hải Phòng
Đá Gạch Ngoài|20.72556|107.02528|A|Hải Phòng
Cồn ngầm Hòn Dút|20.72361|107.07361|A|Hải Phòng
Cồn ngầm Thoi Nhụ|20.7225|107.07083|A|Hải Phòng
Bãi Cát Cò 2|20.72056|107.05333|A|Hải Phòng
Bãi Cát Cò 1|20.71917|107.05111|A|Hải Phòng
Đá Cặp Nồi|20.71778|107.01306|A|Hải Phòng
Cồn Bè|20.7125|107.08806|A|Hải Phòng
Cồn Thủ|20.71|107.08778|A|Hải Phòng
Đá Lấp|20.70639|106.76917|A|Hải Phòng
Đá Mõm Bò|20.70639|107.02111|A|Hải Phòng
Đá Tàu Đắm|20.7025|107.07111|A|Hải Phòng
Bãi Bắc Văn Úc|20.69778|106.73472|A|Hải Phòng
Đá Đánh Cá|20.69778|107.07778|A|Hải Phòng
Đá Nến Thấp|20.69306|107.04528|A|Hải Phòng
Đá Nến Cao|20.6925|107.045|A|Hải Phòng
Đá Ba Răng|20.69056|107.02639|A|Hải Phòng
Cồn Hoa|20.68306|106.80806|A|Hải Phòng
Cồn ngầm Hòn Bia|20.66333|107.07806|A|Hải Phòng
Bãi Đông Tác|20.65833|106.72083|A|Hải Phòng
Bãi Nam Văn Úc|20.64167|106.67778|A|Hải Phòng
Đá ngầm Hòn Chắn|20.63167|107.15583|A|Hải Phòng
Đá Đen|20.62667|107.14444|A|Hải Phòng
Đá Đông Long Châu|20.62528|107.15944|A|Hải Phòng
Đá Cuối Mào|20.62333|107.13556|A|Hải Phòng
Đá Đầu Mào|20.6225|107.13333|A|Hải Phòng
Đá Nam Long Châu|20.62056|107.1575|A|Hải Phòng
Đá Ngăn Luồng|20.61917|107.13611|A|Hải Phòng
Bãi đá Bắc|20.61694|107.14444|A|Hải Phòng
Bãi Rong Biển|20.14778|107.73306|A|Hải Phòng
Bãi Triều Cát|20.12917|107.72611|A|Hải Phòng
Cồn Lúa|12.8|109.34611|A|Khánh Hòa
Bãi Nhãn|12.78694|109.32889|A|Khánh Hòa
Bãi Tuần Lễ|12.77944|109.35222|A|Khánh Hòa
Đá Thủng Thuyền|12.75778|109.31722|A|Khánh Hòa
Bãi Vạn Khánh|12.75639|109.29917|A|Khánh Hòa
Bãi cạn Hòn Trâu|12.755|109.34306|A|Khánh Hòa
Bãi Bẹ Dừa|12.72778|109.26972|A|Khánh Hòa
Đá Điệp Sơn|12.71|109.28583|A|Khánh Hòa
Bãi Hòn Ngang|12.70556|109.40111|A|Khánh Hòa
Bãi Phú Hội|12.70333|109.24583|A|Khánh Hòa
Đá Lẻ Loi|12.70333|109.2575|A|Khánh Hòa
Bãi Lúa Non|12.69194|109.36361|A|Khánh Hòa
Đá Vung Trong|12.68389|109.26722|A|Khánh Hòa
Bãi Cát Thắm|12.68306|109.41639|A|Khánh Hòa
Bãi cạn Con Nhiếm|12.68028|109.23556|A|Khánh Hòa
Bãi Cỏ Rong|12.67917|109.21778|A|Khánh Hòa
Đá Mỏ Cò|12.67778|109.34|A|Khánh Hòa
Đá Vung Ngoài|12.67611|109.25472|A|Khánh Hòa
Đá Ké|12.66861|109.38278|A|Khánh Hòa
Bãi Bồ Đề|12.65389|109.21444|A|Khánh Hòa
Bãi Xuân Tự|12.64444|109.19639|A|Khánh Hòa
Bãi cạn Tây|12.64222|109.24917|A|Khánh Hòa
Đá Gai Mít|12.64139|109.28028|A|Khánh Hòa
Đá Hòn Ông Nhỏ|12.63472|109.395|A|Khánh Hòa
Rạn Trào|12.62806|109.21028|A|Khánh Hòa
Bãi Ngoại|12.61333|109.20222|A|Khánh Hòa
Bãi Hòn Một|12.595|109.19667|A|Khánh Hòa
Đá điểm Phao Tiêu|12.5875|109.21861|A|Khánh Hòa
Đá Quả Thông|12.57917|109.44222|A|Khánh Hòa
Bãi Bàn Cào|12.56639|109.20361|A|Khánh Hòa
Đá Sư Tử|12.55833|109.43333|A|Khánh Hòa
Bãi Thang|12.48639|109.29944|A|Khánh Hòa
Bãi Trì|12.48333|109.29028|A|Khánh Hòa
Bãi cạn Nọc Giã|12.48194|109.32778|A|Khánh Hòa
Bãi đá Nọc|12.47111|109.2925|A|Khánh Hòa
Bãi cạn Bàn Cao|12.47028|109.34222|A|Khánh Hòa
Bãi Cây Tra|12.45944|109.28917|A|Khánh Hòa
Bãi cạn Bàn Giữa|12.44833|109.33556|A|Khánh Hòa
Cồn Ngao|12.44667|109.17028|A|Khánh Hòa
Bãi cạn Đèo Ngan|12.42944|109.33556|A|Khánh Hòa
Bãi Cỏ|12.41|109.32833|A|Khánh Hòa
Bãi Vũng Tàu|12.38111|109.25611|A|Khánh Hòa
Bãi đá Nhô|12.37722|109.30222|A|Khánh Hòa
Bãi cạn Đầm Vân|12.365|109.3125|A|Khánh Hòa
Cồn Dù|12.36444|109.20389|A|Khánh Hòa
Bãi cạn Cát Lợi|12.36278|109.20722|A|Khánh Hòa
Bãi Lương Sơn|12.33472|109.20667|A|Khánh Hòa
Bãi Dương|12.325|109.21389|A|Khánh Hòa
Bãi Đường Đệ|12.295|109.22194|A|Khánh Hòa
Bãi Ba Làng|12.29|109.21861|A|Khánh Hòa
Bãi cạn Cua Nước|12.28944|109.28917|A|Khánh Hòa
Đá Lưỡi Câu|12.27972|109.36944|A|Khánh Hòa
Bãi Bá Hộ|12.27917|109.2025|A|Khánh Hòa
Bãi Vĩnh Thọ|12.26806|109.20472|A|Khánh Hòa
Đá Thánh|12.26194|109.20167|A|Khánh Hòa
Bãi đá Líp|12.23667|109.23139|A|Khánh Hòa
Bãi Rạn|12.23|109.27889|A|Khánh Hòa
Bãi Trũ|12.22389|109.24667|A|Khánh Hòa
Bãi Bàng|12.22222|109.32361|A|Khánh Hòa
Bãi Đầm Già|12.21806|109.25667|A|Khánh Hòa
Bãi Tre|12.21472|109.30778|A|Khánh Hòa
Bãi cạn Lá Buồm|12.17778|109.265|A|Khánh Hòa
Đá Con Hà|12.17167|109.31167|A|Khánh Hòa
Bãi Than|12.16556|109.205|A|Khánh Hòa
Bãi Trọc|12.11694|109.17639|A|Khánh Hòa
Bãi Triều|12.09806|109.16|A|Khánh Hòa
Bãi cạn Trống Khô|12.07667|109.25167|A|Khánh Hòa
Bãi cạn Rạn Găn|12.0725|109.25639|A|Khánh Hòa
Cồn Già|12.06389|109.17694|A|Khánh Hòa
Bãi Lò Than|12.05556|109.17|A|Khánh Hòa
Bãi Bã Mía|12.03139|109.19139|A|Khánh Hòa
Bãi Cam Nghĩa|11.9775|109.1975|A|Khánh Hòa
Cồn Giữa|11.97028|109.20333|A|Khánh Hòa
Bãi Mỹ Ca|11.96083|109.21139|A|Khánh Hòa
Bãi Hòa Do|11.95333|109.18556|A|Khánh Hòa
Bãi Gai Dứa|11.94167|109.20028|A|Khánh Hòa
Bãi Dứa|11.9375|109.21083|A|Khánh Hòa
Đá Cam Phúc|11.935|109.18167|A|Khánh Hòa
Bãi cạn Ba Ngoài|11.92083|109.16444|A|Khánh Hòa
Bãi cạn Cam Ranh|11.91806|109.20639|A|Khánh Hòa
Đá Nâu|11.89944|109.16528|A|Khánh Hòa
Đá Kim Quy|11.89556|109.12861|A|Khánh Hòa
Bãi cạn Đá Bạc|11.88667|109.14611|A|Khánh Hòa
Cồn Hòa Diêm|11.88278|109.11444|A|Khánh Hòa
Bãi Chói|11.88167|109.22556|A|Khánh Hòa
Bãi Cam Thịnh|11.85806|109.11194|A|Khánh Hòa
Cồn Ba Ninh|11.85806|109.11861|A|Khánh Hòa
Đá Múc Nước|11.83722|109.14778|A|Khánh Hòa
Bãi Mỹ Thanh|11.83111|109.12139|A|Khánh Hòa
Đá Mũi Thuyền|10.4675|103.99472|A|Kiên Giang
Bãi Chao|10.45694|103.99194|A|Kiên Giang
Đá Trâu Đen|10.455|104.00917|A|Kiên Giang
Đá Trâu Trắng|10.45028|104.01778|A|Kiên Giang
Đá Bò Vàng|10.44806|104.03722|A|Kiên Giang
Bãi Thơm|10.43139|104.01583|A|Kiên Giang
Bãi Tràm Ngang|10.42472|103.96806|A|Kiên Giang
Bãi ngầm Ốc Biển|10.42417|104.08361|A|Kiên Giang
Bãi đá Dương|10.4175|104.04694|A|Kiên Giang
Bãi ngầm Vòi Voi|10.41|103.93028|A|Kiên Giang
Bãi Hàm Rồng|10.40722|103.95444|A|Kiên Giang
Bãi đá Chồng Bắc|10.39722|104.06556|A|Kiên Giang
Bãi ngầm Vích Đôi|10.39139|103.91167|A|Kiên Giang
Bãi đá Chồng Nam|10.38861|104.07528|A|Kiên Giang
Đá Khô Gành Dầu|10.38806|103.84111|A|Kiên Giang
Đá Nổi Đầu|10.38139|103.83444|A|Kiên Giang
Bãi Ao Sen|10.38111|104.46667|A|Kiên Giang
Bãi Chuồng Vích|10.37556|103.84583|A|Kiên Giang
Đá Chồng|10.37528|104.07944|A|Kiên Giang
Bãi Rạch Vẹm|10.37472|103.93611|A|Kiên Giang
Bãi Gành Dầu|10.37278|103.83639|A|Kiên Giang
Bãi Rành|10.37111|104.47944|A|Kiên Giang
Bãi Gió|10.36917|103.89028|A|Kiên Giang
Bãi cạn Pháo Đài|10.35278|104.45|A|Kiên Giang
Bãi Dài|10.33444|103.8475|A|Kiên Giang
Bãi Chà Và|10.3325|104.51861|A|Kiên Giang
Bãi ngầm Thầy Chùa|10.33167|103.81917|A|Kiên Giang
Cồn Ngang|10.32361|104.08472|A|Kiên Giang
Bãi ngầm Cá Chuồn|10.31944|104.39583|A|Kiên Giang
Bãi ngầm Rùa Biển|10.31667|103.84|A|Kiên Giang
Bãi Bổn|10.31222|104.07972|A|Kiên Giang
Đá Bánh Ít Ngoài|10.30972|104.32278|A|Kiên Giang
Đá Bánh Ít Trong|10.30778|104.32333|A|Kiên Giang
Bãi ngầm Giồng Trên|10.30472|104.3625|A|Kiên Giang
Bãi Vũng Bầu|10.30139|103.88056|A|Kiên Giang
Bãi ngầm Giồng Dưới|10.29306|104.36722|A|Kiên Giang
Bãi Trung|10.28944|103.89694|A|Kiên Giang
Bãi ngầm Tây Môn|10.28611|104.27778|A|Kiên Giang
Bãi ngầm Khí Tượng|10.28167|104.15083|A|Kiên Giang
Bãi Cửa Cạn|10.28139|103.91833|A|Kiên Giang
Bãi cạn Đá Đĩa|10.27667|104.19611|A|Kiên Giang
Bãi ngầm Giồng Lớn|10.27639|104.36389|A|Kiên Giang
Bãi ngầm Nam Môn|10.275|104.31889|A|Kiên Giang
Đá Tướng Cướp|10.25778|104.30389|A|Kiên Giang
Cồn Ba Hòn Ngắn|10.24083|104.58194|A|Kiên Giang
Cồn Ba Hòn Dài|10.24|104.58083|A|Kiên Giang
Bãi ngầm Bàn Dài|10.23917|104.2525|A|Kiên Giang
Bãi Bàu Tròn|10.23556|103.94861|A|Kiên Giang
Đá Tăm Cá|10.21139|104.065|A|Kiên Giang
Bãi Cây Sao|10.21056|104.06611|A|Kiên Giang
Bãi Bà Kèo|10.19694|103.96028|A|Kiên Giang
Bãi ngầm Heo Con|10.1875|104.50278|A|Kiên Giang
Đá Đầu Heo|10.18722|104.51694|A|Kiên Giang
Bãi ngầm Heo To|10.18472|104.46667|A|Kiên Giang
Bãi Hàm Ninh|10.18|104.05056|A|Kiên Giang
Đá Lục Giác|10.17917|104.5675|A|Kiên Giang
Đá Lông Nhím|10.16556|104.52222|A|Kiên Giang
Bãi ngầm Nhum Tây|10.14861|104.54167|A|Kiên Giang
Bãi ngầm Nhum Đông|10.14722|104.5625|A|Kiên Giang
Bãi Trường|10.14528|103.97194|A|Kiên Giang
Bãi ngầm Đầm Nhỏ|10.14056|104.48889|A|Kiên Giang
Bãi ngầm Đầm Tròn|10.13333|104.50111|A|Kiên Giang
Bãi ngầm Tổ Kiến Lớn|10.125|104.58667|A|Kiên Giang
Bãi Cây Da|10.12361|104.03611|A|Kiên Giang
Bãi ngầm Tổ Kiến Nhỏ|10.11667|104.60972|A|Kiên Giang
Đá Bạc Tây|10.11083|104.495|A|Kiên Giang
Bãi ngầm Sấu Nhỏ|10.1075|104.15861|A|Kiên Giang
Bãi ngầm Sấu Lớn|10.10167|104.06278|A|Kiên Giang
Bãi ngầm Trại Nam|10.09889|104.65833|A|Kiên Giang
Bãi đá Trải|10.0975|104.025|A|Kiên Giang
Bãi Cây Sấu|10.08639|104.02056|A|Kiên Giang
Bãi ngầm Đông Sơn Tế|10.085|104.50889|A|Kiên Giang
Bãi ngầm Nam Sơn Tế|10.08333|104.49722|A|Kiên Giang
Đá Mũi Chông|10.07972|104.68972|A|Kiên Giang
Đá Chân Vịt|10.07333|103.98611|A|Kiên Giang
Đá Cây Đuốc|10.07194|104.46806|A|Kiên Giang
Đá Gành|10.07194|104.04139|A|Kiên Giang
Bãi ngầm Sao Bắc|10.07111|104.07306|A|Kiên Giang
Bãi ngầm Yên Ngựa|10.07083|104.47833|A|Kiên Giang
Bãi ngầm Cá Ngựa|10.06583|104.22333|A|Kiên Giang
Bãi Sao|10.05333|104.035|A|Kiên Giang
Bãi Ra Đa|10.05|103.98722|A|Kiên Giang
Bãi ngầm Tiến Hóa|10.04722|104.45556|A|Kiên Giang
Bãi Đất Đỏ|10.03861|104.00028|A|Kiên Giang
Bãi Khem|10.03556|104.02889|A|Kiên Giang
Bãi ngầm Sao Nam|10.03389|104.06583|A|Kiên Giang
Bãi ngầm Minh Hòa|10.03|104.59833|A|Kiên Giang
Bãi Cây Dừa|10.01722|104.02389|A|Kiên Giang
Bãi Xép|10.01667|104.03444|A|Kiên Giang
Bãi Suối Tiên|10.01389|104.04222|A|Kiên Giang
Bãi ngầm An Thới|10.00111|104.00278|A|Kiên Giang
Bãi ngầm Ông Đội|9.99528|104.08028|A|Kiên Giang
Đá Đầu Bò|9.96667|104.33889|A|Kiên Giang
Đá Hoàng Hôn|9.96028|104.82389|A|Kiên Giang
Bãi Tây Yên|9.94889|105.05778|A|Kiên Giang
Bãi Miếu|9.9375|105.09778|A|Kiên Giang
Bãi ngầm Dong Ngang|9.93694|104.19861|A|Kiên Giang
Bãi Nam Thái|9.86306|104.96111|A|Kiên Giang
Bãi Xẻo Bần|9.83083|104.88583|A|Kiên Giang
Bãi Ông Bô|9.81944|104.64222|A|Kiên Giang
Bãi Nam Sơn|9.79917|104.62972|A|Kiên Giang
Bãi ngầm Nam Sơn|9.78056|104.62222|A|Kiên Giang
Bãi ngầm Hải Sâm Tây|9.75|104.43389|A|Kiên Giang
Bãi ngầm Cá Nhám Bắc|9.74917|104.59667|A|Kiên Giang
Đá Cán Chổi|9.7425|104.35833|A|Kiên Giang
Bãi ngầm Hải Sâm Đông|9.73889|104.47083|A|Kiên Giang
Đá Cựa Gà|9.73389|104.33667|A|Kiên Giang
Bãi ngầm Cá Nhám Giữa|9.725|104.64583|A|Kiên Giang
Bãi ngầm Đồi Mồi Trong|9.71944|104.40333|A|Kiên Giang
Bãi ngầm Đông Móc|9.71667|104.35694|A|Kiên Giang
Đá Răng Cưa|9.71583|104.37833|A|Kiên Giang
Bãi ngầm Râu Tôm|9.7125|104.37972|A|Kiên Giang
Đá Cô|9.70889|104.32861|A|Kiên Giang
Bãi ngầm Đồi Mồi Giữa|9.70833|104.44861|A|Kiên Giang
Bãi ngầm Cá Nhám Ngoài|9.70694|104.67222|A|Kiên Giang
Bãi ngầm Đồi Mồi Nam|9.69028|104.49722|A|Kiên Giang
Bãi ngầm Đá Nhám|9.67583|104.32917|A|Kiên Giang
Bãi ngầm Phù Dung|9.65556|104.47639|A|Kiên Giang
Đá Nồm Khô|9.63972|104.36417|A|Kiên Giang
Bãi Dong|9.28806|103.48417|A|Kiên Giang
Đá Đông Nhạn|9.26444|103.48806|A|Kiên Giang
Cồn Ngạn|20.24972|106.5575|A|Nam Định
Cồn Lu|20.22472|106.56972|A|Nam Định
Cồn Mờ|20.22|106.59528|A|Nam Định
Bãi tắm Quất Lâm|20.19278|106.38639|A|Nam Định
Bãi Thịnh Long|20.02972|106.2225|A|Nam Định
Bãi Gót Tràng|20.00111|106.19861|A|Nam Định
Cồn Xanh|19.91778|106.13056|A|Nam Định
Đá Củ|19.27833|105.80306|A|Nghệ An
Bãi Đồng Minh|19.27111|105.79472|A|Nghệ An
Bãi Trại|19.25944|105.77472|A|Nghệ An
Bãi Trúp|19.22861|105.76528|A|Nghệ An
Bãi Bắc Quỳnh Lưu|19.19611|105.73306|A|Nghệ An
Đá Tân Hải|19.17111|105.73444|A|Nghệ An
Bãi Nam Quỳnh Lưu|19.13917|105.73028|A|Nghệ An
Đá Đầu Rồng|19.1025|105.72861|A|Nghệ An
Bãi Cửa Quèn|19.09917|105.71139|A|Nghệ An
Bãi Đoài|19.0925|105.68028|A|Nghệ An
Bãi Quỳnh Long|19.08722|105.69528|A|Nghệ An
Đá Lộ|19.07167|105.68222|A|Nghệ An
Bãi Diễn Châu|19.05861|105.63472|A|Nghệ An
Bãi Bùng|19.00944|105.61889|A|Nghệ An
Bãi Thịnh Thành|18.97639|105.61778|A|Nghệ An
Bãi Diễn Trung|18.92417|105.6275|A|Nghệ An
Đá Câu|18.89556|105.65|A|Nghệ An
Đá Vùng Trên|18.8875|105.66472|A|Nghệ An
Đá Trẹn|18.88|105.67528|A|Nghệ An
Cồn Khơi|18.845|105.76944|A|Nghệ An
Cồn Lộng|18.83778|105.7475|A|Nghệ An
Cồn Niêu|18.83361|105.72833|A|Nghệ An
Bãi Nghi Thủy|18.82583|105.71528|A|Nghệ An
Cồn Dàn|18.82417|105.93361|A|Nghệ An
Đá Song Ngư|18.79917|105.77722|A|Nghệ An
Đá Rú Bầy|18.79306|105.98417|A|Nghệ An
Bãi ngầm Nam Ngư|18.78583|105.77167|A|Nghệ An
Bãi cạn Hải Giang|18.77306|105.76056|A|Nghệ An
Bãi Ninh Bình|19.91556|106.06222|A|Ninh Bình
Cồn Nổi|19.8725|106.07361|A|Ninh Bình
Cồn Mờ|19.84167|106.06944|A|Ninh Bình
Bãi Bình Tiên|11.80333|109.18444|A|Ninh Thuận
Đá Chà Là|11.79222|109.19472|A|Ninh Thuận
Bãi Nước Đổ|11.7775|109.20222|A|Ninh Thuận
Bãi Chuối|11.75722|109.21667|A|Ninh Thuận
Bãi Thùng|11.74917|109.22139|A|Ninh Thuận
Bãi Hỏm|11.69056|109.18778|A|Ninh Thuận
Bãi cạn Thái An|11.66556|109.17333|A|Ninh Thuận
Bãi cạn Mỹ Hòa|11.5975|109.14306|A|Ninh Thuận
Bãi Bình Sơn|11.58917|109.03889|A|Ninh Thuận
Bãi cạn Khánh Hội|11.57361|109.07056|A|Ninh Thuận
Bãi cạn Mỹ Tường|11.55306|109.10889|A|Ninh Thuận
Bãi cạn Đông Hải|11.55|109.03361|A|Ninh Thuận
Bãi cạn Vĩnh Trường|11.42917|109.01222|A|Ninh Thuận
Bãi đá Sơn Hải|11.40361|109.00889|A|Ninh Thuận
Bãi cạn Mới|11.39972|109.01889|A|Ninh Thuận
Bãi cạn Cà Ná|11.38056|109.01361|A|Ninh Thuận
Bãi đá Lố Ông|11.35583|109.01472|A|Ninh Thuận
Bãi cạn Lạc Nghiệp|11.32806|108.88944|A|Ninh Thuận
Đá Giăng Dọc|11.31139|108.91361|A|Ninh Thuận
Đá Giăng Ngang|11.31|108.92083|A|Ninh Thuận
Đá Lưỡi Mác|13.57917|109.285|A|Phú Yên
Bãi cạn Xuân Cảnh|13.53972|109.2625|A|Phú Yên
Đá Vĩnh Cửu Lợi Đông|13.52917|109.28556|A|Phú Yên
Bãi Niệm Phật|13.47944|109.25472|A|Phú Yên
Đá Phước Lý|13.47361|109.23861|A|Phú Yên
Đá Cành Cây|13.46917|109.25972|A|Phú Yên
Đá Long Hải|13.46694|109.235|A|Phú Yên
Bãi cạn Phú Mỹ|13.46333|109.2675|A|Phú Yên
Cồn Phú Mỹ|13.45889|109.27111|A|Phú Yên
Bãi Long Hải|13.45139|109.22333|A|Phú Yên
Bãi Nhất Tự|13.41861|109.22028|A|Phú Yên
Đá Tiểu|13.41306|109.26|A|Phú Yên
Đá Tổ Ong|13.37917|109.27|A|Phú Yên
Đá Tổ Quỷ|13.3525|109.31028|A|Phú Yên
Đá Bói Cá Sau|13.34194|109.29722|A|Phú Yên
Đá Bói Cá Trước|13.33667|109.29778|A|Phú Yên
Đá Quả Thông|13.27944|109.34167|A|Phú Yên
Bãi cạn Mĩ Quan|13.19111|109.31167|A|Phú Yên
Đá Xanh|13.18167|109.3125|A|Phú Yên
Bãi cạn Xơ Dừa|13.16583|109.31833|A|Phú Yên
Bãi cạn Phú Câu|13.08861|109.335|A|Phú Yên
Bãi cạn Ba Góc|12.97389|109.43667|A|Phú Yên
Bãi Vĩnh Sơn|17.95111|106.50472|A|Quảng Bình
Bãi Con|17.94806|106.505|A|Quảng Bình
Bãi Nam Sú|17.92361|106.48889|A|Quảng Bình
Bãi Quảng Phú|17.89111|106.46472|A|Quảng Bình
Bãi Mũi Vích|17.85083|106.44806|A|Quảng Bình
Bãi đá Nhảy|17.66278|106.51306|A|Quảng Bình
Bãi Đức Trạch|17.62583|106.54417|A|Quảng Bình
Bãi Bắc Dinh|17.57389|106.57194|A|Quảng Bình
Bãi Nam Dinh|17.53833|106.59556|A|Quảng Bình
Đá Hiền|17.52194|106.62028|A|Quảng Bình
Đá Hải Thành|17.49167|106.63417|A|Quảng Bình
Đá Nhật Lệ|17.48222|106.64139|A|Quảng Bình
Bãi ngầm Bảo Ninh|17.4525|106.70278|A|Quảng Bình
Đá Khô Bắc|15.97528|108.42|A|Quảng Nam
Đá Khô Nam|15.97194|108.42028|A|Quảng Nam
Bãi Bấc|15.96444|108.48667|A|Quảng Nam
Bãi Ông|15.96139|108.49694|A|Quảng Nam
Bãi Làng|15.9575|108.50528|A|Quảng Nam
Bãi Xếp|15.95139|108.50639|A|Quảng Nam
Bãi Chồng|15.94333|108.51083|A|Quảng Nam
Bãi Bìm|15.93889|108.51556|A|Quảng Nam
Bãi Hương|15.9325|108.52472|A|Quảng Nam
Bãi Tra|15.92861|108.52778|A|Quảng Nam
Bãi Nần|15.92583|108.53|A|Quảng Nam
Bãi ngầm Võng Trong|15.91944|108.45056|A|Quảng Nam
Bãi ngầm Võng Ngoài|15.91528|108.47917|A|Quảng Nam
Rạn Mành|15.90111|108.51944|A|Quảng Nam
Bãi ngầm Đáy Lớn|15.8875|108.45389|A|Quảng Nam
Bãi ngầm Đáy Nhỏ|15.87278|108.46389|A|Quảng Nam
Bãi Nồm|15.51556|108.66167|A|Quảng Nam
Bãi Đá Giăng|15.51111|108.67|A|Quảng Nam
Bãi Dứa|15.49778|108.68972|A|Quảng Nam
Đá Ngang|15.49528|108.67944|A|Quảng Nam
Cồn Đầu Tôm|15.49306|108.63639|A|Quảng Nam
Cồn Nhà Chùa|15.49111|108.62778|A|Quảng Nam
Cồn Thôn 4|15.48917|108.6525|A|Quảng Nam
Cồn Thấp|15.48833|108.64389|A|Quảng Nam
Đá Mắt Mèo|15.48806|108.68944|A|Quảng Nam
Cồn Tam Hòa|15.48472|108.61667|A|Quảng Nam
Cồn Giữa|15.48056|108.64222|A|Quảng Nam
Đá Răng Bừa|15.47667|108.69306|A|Quảng Nam
Bãi Bà Tình|15.47222|108.69556|A|Quảng Nam
Đá Tiền|15.46056|108.70306|A|Quảng Nam
Bãi Bàng|15.46028|108.69944|A|Quảng Nam
Đá Hậu|15.45917|108.70056|A|Quảng Nam
Đá Rạng|15.44889|108.69806|A|Quảng Nam
Cồn Lớn|15.44111|108.66361|A|Quảng Nam
Bãi cạn Tam Quang|15.47639|108.76944|A|Quảng Ngãi
Bãi ngầm Tây Bắc|15.45278|109.06111|A|Quảng Ngãi
Bãi Sau|15.43306|109.07889|A|Quảng Ngãi
Bãi Mam Cồn|15.42833|109.07444|A|Quảng Ngãi
Bãi Mam Đụn|15.4275|109.08361|A|Quảng Ngãi
Rạn ngầm Chà Đỏ|15.4275|108.79528|A|Quảng Ngãi
Bãi Bến Trước|15.42667|109.07917|A|Quảng Ngãi
Đá Kinh Trào|15.42639|108.79722|A|Quảng Ngãi
Đá Cúng Cháo|15.42222|108.8|A|Quảng Ngãi
Bãi Ngao|15.42167|108.79861|A|Quảng Ngãi
Đá Xao Cao|15.42083|108.79167|A|Quảng Ngãi
Đá Nhọn|15.42028|108.82361|A|Quảng Ngãi
Đá Hàn|15.41833|108.8025|A|Quảng Ngãi
Bãi Hòn Cóc|15.41361|108.81083|A|Quảng Ngãi
Bãi cạn Năm Châm|15.40833|108.90556|A|Quảng Ngãi
Đá Mổng|15.40667|108.82333|A|Quảng Ngãi
Đá Hàn Đông|15.40278|108.82444|A|Quảng Ngãi
Bãi Hòn Kẻ|15.39639|108.83|A|Quảng Ngãi
Đá Kình Mành|15.39417|108.77139|A|Quảng Ngãi
Bãi Lắng|15.39361|108.79333|A|Quảng Ngãi
Đá Đôi|15.39361|108.77167|A|Quảng Ngãi
Đá Hai|15.3925|109.10583|A|Quảng Ngãi
Bãi Khe Hai|15.39222|108.75139|A|Quảng Ngãi
Đá Bàng|15.39222|108.77056|A|Quảng Ngãi
Đá Lụi 3|15.39111|108.775|A|Quảng Ngãi
Bãi Bé|15.39028|109.1325|A|Quảng Ngãi
Đá Ong 2|15.38972|108.77|A|Quảng Ngãi
Đá Ong 1|15.38889|108.77028|A|Quảng Ngãi
Bãi Giót Trên|15.38861|109.09139|A|Quảng Ngãi
Đá Đầu Mỏm|15.38389|108.82694|A|Quảng Ngãi
Bãi Mù Cu|15.38306|109.14194|A|Quảng Ngãi
Cồn Lăng|15.38139|109.14306|A|Quảng Ngãi
Bãi Bến Đình|15.37556|109.13056|A|Quảng Ngãi
Bãi Giót Dưới|15.37278|109.14778|A|Quảng Ngãi
Bãi Meo Đá|15.36917|109.12083|A|Quảng Ngãi
Bãi Ngang Việt Thanh|15.35528|108.84389|A|Quảng Ngãi
Đá Bàn Than|15.35028|108.85194|A|Quảng Ngãi
Bãi Nước Nhĩ|15.34889|108.85861|A|Quảng Ngãi
Bãi Mỏm Lăng|15.33083|108.88111|A|Quảng Ngãi
Rạn Gò Chùa|15.32111|108.88639|A|Quảng Ngãi
Bãi Hòn Yến|15.31222|108.87417|A|Quảng Ngãi
Bãi cạn Lý Sơn|15.30139|109.13306|A|Quảng Ngãi
Bãi Chà Là|15.2925|108.87278|A|Quảng Ngãi
Bãi An Sen|15.26778|108.89083|A|Quảng Ngãi
Bãi Trố Cổ Dù|15.25472|108.92917|A|Quảng Ngãi
Đá Khô|15.25389|108.94083|A|Quảng Ngãi
Đá Ngàn|15.24917|108.93833|A|Quảng Ngãi
Bãi đám Nhiếm|15.23417|108.94056|A|Quảng Ngãi
Đá Hang Én|15.23194|108.93972|A|Quảng Ngãi
Bãi Lá Ngãi|15.21972|108.93472|A|Quảng Ngãi
Bãi ngầm Sa Kỳ|15.20833|108.94167|A|Quảng Ngãi
Đá Bàn 1|15.20583|108.9225|A|Quảng Ngãi
Đá Bàn 2|15.20528|108.92306|A|Quảng Ngãi
Đá Bàn 3|15.20361|108.92167|A|Quảng Ngãi
Bãi Rạng|15.20083|108.91556|A|Quảng Ngãi
Bãi ngầm Mỹ Lai|15.18694|108.91111|A|Quảng Ngãi
Đá Rạng|15.09806|108.91|A|Quảng Ngãi
Đá Đạn|15.09472|108.90472|A|Quảng Ngãi
Bãi ngầm Tân Mỹ|15.08611|108.91111|A|Quảng Ngãi
Bãi Xếp|14.83028|109.0|A|Quảng Ngãi
Đá Nhồng|14.80694|109.01139|A|Quảng Ngãi
Cồn Thạch By|14.67056|109.07111|A|Quảng Ngãi
Bãi Hang Dơi|14.66722|109.07889|A|Quảng Ngãi
Bãi Rạng Phổ Thạnh|14.66389|109.06639|A|Quảng Ngãi
Rạn Đá Bia|14.63972|109.06694|A|Quảng Ngãi
Đá Lố|14.60639|109.07222|A|Quảng Ngãi
Bãi cạn Kim Bông|14.59917|109.0825|A|Quảng Ngãi
Bãi Hòn Én|14.58111|109.08056|A|Quảng Ngãi
Bãi Tục Lãm|21.54167|108.03944|A|Quảng Ninh
Cồn Dậu Gót|21.50611|108.06611|A|Quảng Ninh
Bãi Mười|21.48833|107.87806|A|Quảng Ninh
Cồn Màng|21.48472|108.07889|A|Quảng Ninh
Bãi Cầu Khe Rát|21.47167|107.86806|A|Quảng Ninh
Bãi Hà Tây Cong|21.47111|107.83167|A|Quảng Ninh
Bãi Quảng Minh|21.45417|107.79361|A|Quảng Ninh
Bãi Cầu Voi|21.44167|107.89722|A|Quảng Ninh
Bãi Ma Ham|21.43778|107.82167|A|Quảng Ninh
Bãi Cạn|21.4375|107.80833|A|Quảng Ninh
Cồn Ngọc|21.42889|107.96111|A|Quảng Ninh
Bãi Hà Cối|21.42833|107.77778|A|Quảng Ninh
Cồn Tre|21.41861|107.90306|A|Quảng Ninh
Bãi Đai|21.41639|107.93056|A|Quảng Ninh
Bãi Quảng Điền|21.41583|107.76139|A|Quảng Ninh
Cồn Tổ Sơn|21.41472|107.83389|A|Quảng Ninh
Bãi Bắc Đầu Tán|21.41389|107.97917|A|Quảng Ninh
Bãi Bắc Vĩnh Thực|21.40333|107.88167|A|Quảng Ninh
Đá Trạm 5|21.3975|107.78889|A|Quảng Ninh
Cồn Vạn Gia|21.39611|107.93194|A|Quảng Ninh
Bãi Bắc Cái Đước|21.39361|107.73389|A|Quảng Ninh
Bãi Nam Cái Đước|21.39056|107.72778|A|Quảng Ninh
Đá Trạm 1|21.39056|107.76639|A|Quảng Ninh
Đá Trạm 3|21.38861|107.76083|A|Quảng Ninh
Đá Trạm 2|21.38833|107.76139|A|Quảng Ninh
Đá Trạm 4|21.38694|107.75194|A|Quảng Ninh
Bãi Đại Hoàng|21.38611|107.71583|A|Quảng Ninh
Cồn Đước|21.38528|107.73417|A|Quảng Ninh
Bãi Cái Lò|21.375|107.70833|A|Quảng Ninh
Cồn Bắc Miều|21.37333|107.74694|A|Quảng Ninh
Bãi Mát|21.37167|107.96333|A|Quảng Ninh
Bãi Thoi Chú|21.36694|107.69167|A|Quảng Ninh
Cồn Thoi Ngoài 2|21.36611|107.71389|A|Quảng Ninh
Cồn Thoi Chú Trên|21.36111|107.69528|A|Quảng Ninh
Cồn Thoi Chú Dưới|21.35972|107.695|A|Quảng Ninh
Cồn Thoi Chú Trong|21.35861|107.68667|A|Quảng Ninh
Cồn Thoi Ngoài 1|21.35861|107.70694|A|Quảng Ninh
Bãi Đường Hoa|21.35833|107.675|A|Quảng Ninh
Cồn Tây Đầu Gỗ|21.35306|107.68639|A|Quảng Ninh
Cồn Lim Bắc|21.34667|107.67222|A|Quảng Ninh
Cồn Cốc|21.34472|107.72972|A|Quảng Ninh
Bãi Lim|21.34167|107.65833|A|Quảng Ninh
Cồn Lim Giữa|21.34056|107.67083|A|Quảng Ninh
Cồn Đông Cái Khiên|21.33833|107.70306|A|Quảng Ninh
Cồn Lim Ngoài|21.33472|107.66861|A|Quảng Ninh
Cồn Cái Chiên|21.33|107.73472|A|Quảng Ninh
Cồn Me Độc Trong|21.32917|107.6875|A|Quảng Ninh
Cồn Me Độc|21.32722|107.68556|A|Quảng Ninh
Đá Cái Bí 1|21.32667|107.7825|A|Quảng Ninh
Đá Dều 2|21.32306|107.80833|A|Quảng Ninh
Cồn Me Độc Ngoài|21.32167|107.69083|A|Quảng Ninh
Đá Dều 1|21.32028|107.80944|A|Quảng Ninh
Đá Cái Bí 2|21.31917|107.77194|A|Quảng Ninh
Đá Bắc Rú|21.31833|107.80556|A|Quảng Ninh
Cồn Vụng|21.31611|107.66306|A|Quảng Ninh
Bãi Kim Lợn|21.30528|107.6225|A|Quảng Ninh
Cồn Mùi|21.30361|107.64389|A|Quảng Ninh
Bãi Chùa Sâu|21.30278|107.55917|A|Quảng Ninh
Đá Đầu Thoi|21.29972|107.79056|A|Quảng Ninh
Cồn Hà Lớn|21.29444|107.62833|A|Quảng Ninh
Đá Giữa Thoi|21.29444|107.7525|A|Quảng Ninh
Cồn Hà Nhỏ|21.29222|107.62861|A|Quảng Ninh
Cồn Cò Ỉa|21.29111|107.61222|A|Quảng Ninh
Cồn Thoi Dại|21.29111|107.6025|A|Quảng Ninh
Đá Ba Bái Trên|21.29111|108.06639|A|Quảng Ninh
Cồn Nhà Thờ|21.29056|107.58944|A|Quảng Ninh
Đá Ba Bái Giữa|21.28917|108.06333|A|Quảng Ninh
Đá Sò|21.28917|107.71694|A|Quảng Ninh
Đá Sú 1|21.28778|107.45917|A|Quảng Ninh
Đá Ba Bái Dưới|21.28694|108.06611|A|Quảng Ninh
Cồn Sú Trên|21.28639|107.45722|A|Quảng Ninh
Đá Sú 2|21.28639|107.46|A|Quảng Ninh
Cồn Hai Thoi 1|21.28611|107.48639|A|Quảng Ninh
Bãi Đuôi Ổ Gà|21.28583|107.475|A|Quảng Ninh
Cồn Sú Giữa|21.28528|107.45694|A|Quảng Ninh
Cồn Sú Dưới|21.28444|107.45556|A|Quảng Ninh
Bãi Nhà Thờ|21.28361|107.59167|A|Quảng Ninh
Đá Sú 3|21.28278|107.455|A|Quảng Ninh
Cồn Chùa|21.2825|107.45028|A|Quảng Ninh
Cồn Đèn|21.28194|107.46028|A|Quảng Ninh
Đá Sú 4|21.28194|107.45806|A|Quảng Ninh
Bãi Chi Lăng|21.28056|107.51444|A|Quảng Ninh
Cồn Hai Thoi 2|21.28056|107.49472|A|Quảng Ninh
Cồn Đen Nhỏ|21.28056|107.46278|A|Quảng Ninh
Đá Đen 1|21.27972|107.46444|A|Quảng Ninh
Cồn Ba Rèm Đông|21.27944|107.69833|A|Quảng Ninh
Cồn Bánh Lái|21.27917|107.44667|A|Quảng Ninh
Cồn Hai Thoi 3|21.27917|107.49361|A|Quảng Ninh
Đá Đen 2|21.27917|107.46361|A|Quảng Ninh
Cồn Cây Bắc|21.27861|107.44861|A|Quảng Ninh
Cồn Hai Thoi 5|21.27861|107.49556|A|Quảng Ninh
Cồn Hai Thoi 4|21.27833|107.49444|A|Quảng Ninh
Cồn Hải Lạng 1|21.27778|107.39639|A|Quảng Ninh
Đá Cặp Cống 1|21.27722|107.45667|A|Quảng Ninh
Cồn Hải Lạng 2|21.27694|107.40194|A|Quảng Ninh
Cồn Cây Con|21.27472|107.44889|A|Quảng Ninh
Cồn Hải Lạng Nhỏ|21.27472|107.40306|A|Quảng Ninh
Đá Cặp Cống 2|21.27389|107.45278|A|Quảng Ninh
Cồn Cây Nam|21.27333|107.44972|A|Quảng Ninh
Cồn Hải Lạng 3|21.27167|107.40528|A|Quảng Ninh
Đá Hứa|21.26972|107.63278|A|Quảng Ninh
Đá Tài Con|21.26944|107.45056|A|Quảng Ninh
Cồn Hải Lạng 4|21.26889|107.40222|A|Quảng Ninh
Cồn Hải Lạng 5|21.26694|107.39778|A|Quảng Ninh
Cồn Ba Rèm Giữa|21.26639|107.67972|A|Quảng Ninh
Cồn Hải Lạng 6|21.26444|107.40083|A|Quảng Ninh
Cồn Ba Rèm Nam|21.26417|107.67667|A|Quảng Ninh
Cồn Bắc Cá Cạn|21.26306|107.45167|A|Quảng Ninh
Cồn Bằng|21.2625|107.64972|A|Quảng Ninh
Cồn Đồng Rui 1|21.26028|107.4075|A|Quảng Ninh
Bãi ngầm Vạn Vược|21.25917|107.59972|A|Quảng Ninh
Đá BắcTằng Cá|21.25722|107.44889|A|Quảng Ninh
Cồn Tằng Cá|21.25583|107.44667|A|Quảng Ninh
Cồn Cá Sâu|21.25194|107.45167|A|Quảng Ninh
Đá Nam Tằng Cá|21.25139|107.44917|A|Quảng Ninh
Bãi Tam Giác|21.24861|107.57139|A|Quảng Ninh
Cồn Đá Xếp Cao|21.24528|107.97667|A|Quảng Ninh
Đá Dập Dềnh|21.245|107.98528|A|Quảng Ninh
Cồn Tây Cả|21.24472|107.51917|A|Quảng Ninh
Đá Thước Thợ|21.24167|107.55389|A|Quảng Ninh
Cồn Thạch 1|21.23861|107.58583|A|Quảng Ninh
Đá Tăng Ca|21.23806|107.98806|A|Quảng Ninh
Cồn Thạch 2|21.23722|107.58583|A|Quảng Ninh
Cồn Dơi Bay|21.23583|107.61556|A|Quảng Ninh
Bãi Chương Cả Ngầm|21.23556|107.5675|A|Quảng Ninh
Cồn Đá Xếp Thấp|21.23528|107.97889|A|Quảng Ninh
Cồn Bắc Vẹm|21.23389|107.61833|A|Quảng Ninh
Bãi Cá Giữa|21.23167|107.77444|A|Quảng Ninh
Đá Trùng Roi|21.23139|107.98167|A|Quảng Ninh
Cồn Thoi Dây 1|21.23111|107.5875|A|Quảng Ninh
Cồn Thoi Dây 2|21.23111|107.58861|A|Quảng Ninh
Bãi Thoi Dây|21.23056|107.58056|A|Quảng Ninh
Cồn Hai Ngả|21.22917|107.51833|A|Quảng Ninh
Bãi Vẹm Ngầm|21.2275|107.61528|A|Quảng Ninh
Cồn Gốc|21.22111|107.52528|A|Quảng Ninh
Cồn Hột Thị|21.21417|107.53056|A|Quảng Ninh
Cồn Lá Con|21.20306|107.55333|A|Quảng Ninh
Bãi Vạn Hoa|21.20278|107.60833|A|Quảng Ninh
Bãi cạn Lớn|21.20083|107.69722|A|Quảng Ninh
Bãi Nhỏ Bảy Sao|21.20056|107.75111|A|Quảng Ninh
Đá Tây Bồ Cát|21.19556|108.00056|A|Quảng Ninh
Bãi Ba Chẽ|21.19|107.4025|A|Quảng Ninh
Cồn Chín|21.17944|107.61556|A|Quảng Ninh
Cồn Đò Trên|21.15778|107.38833|A|Quảng Ninh
Cồn Đò Dưới|21.15444|107.38722|A|Quảng Ninh
Cồn Hà Nứa Trong|21.15|107.41556|A|Quảng Ninh
Cồn Đầu Thoi|21.14972|107.54944|A|Quảng Ninh
Cồn Ếch Nhảy|21.14972|107.38917|A|Quảng Ninh
Cồn Roi Ngầm|21.14778|107.38639|A|Quảng Ninh
Cồn Vó Ngựa|21.14694|107.84278|A|Quảng Ninh
Đá Móng Ngựa|21.14639|107.84194|A|Quảng Ninh
Cồn Hà Nứa Ngoài|21.14028|107.4175|A|Quảng Ninh
Cồn Mắc Cạn|21.13778|107.40694|A|Quảng Ninh
Cồn Que Khô|21.13722|107.39167|A|Quảng Ninh
Cồn Dây Khoai|21.13583|107.85111|A|Quảng Ninh
Cồn Sậu|21.13389|107.66167|A|Quảng Ninh
Cồn Vịt Con|21.13389|107.39278|A|Quảng Ninh
Cồn Rễ Khoai|21.13361|107.85472|A|Quảng Ninh
Cồn Sao Nhỏ|21.13056|107.78972|A|Quảng Ninh
Cồn Tôm|21.12944|107.40944|A|Quảng Ninh
Đá Sao Đêm|21.1275|107.79778|A|Quảng Ninh
Cồn Hạt Lựu Trên|21.12556|107.40278|A|Quảng Ninh
Cồn Lá Tre|21.125|107.39167|A|Quảng Ninh
Cồn Trứng Nhện|21.12417|107.38889|A|Quảng Ninh
Cồn Hạt Lựu Giữa|21.1225|107.40111|A|Quảng Ninh
Cồn Giọt Nước|21.12222|107.40472|A|Quảng Ninh
Cồn Hạt Lựu Dưới|21.12083|107.39944|A|Quảng Ninh
Đá Con Trống|21.11861|107.54722|A|Quảng Ninh
Cồn Chân Thang|21.1175|107.38139|A|Quảng Ninh
Cồn Sâu Đo|21.11472|107.38361|A|Quảng Ninh
Đá Ghềnh Ngang|21.11444|107.81|A|Quảng Ninh
Cồn Thoi 1|21.11306|107.38861|A|Quảng Ninh
Cồn Thoi 3|21.11306|107.3925|A|Quảng Ninh
Cồn Thoi 2|21.1125|107.39139|A|Quảng Ninh
Cồn Voi 1|21.11056|107.39222|A|Quảng Ninh
Cồn Voi 2|21.11028|107.39306|A|Quảng Ninh
Cồn Thang Trên|21.10972|107.38278|A|Quảng Ninh
Cồn Voi 3|21.10944|107.39278|A|Quảng Ninh
Cồn Thang Dưới|21.10778|107.38194|A|Quảng Ninh
Cồn Khấu Đuôi|21.10583|107.39667|A|Quảng Ninh
Đá Ngầm Nam|21.10278|107.69028|A|Quảng Ninh
Cồn Đuôi Bò|21.10222|107.39417|A|Quảng Ninh
Cồn Cây Thang|21.09722|107.37111|A|Quảng Ninh
Đá Non Nước|21.09528|107.84417|A|Quảng Ninh
Cồn Non Đèn|21.09222|107.50417|A|Quảng Ninh
Đá Đông Phất Cờ|21.09111|107.49583|A|Quảng Ninh
Cồn Gạc Tròn|21.08139|107.3675|A|Quảng Ninh
Đá Thoải|21.07833|107.75472|A|Quảng Ninh
Cồn Chân Kiềng|21.0775|107.82972|A|Quảng Ninh
Cồn Diều|21.07667|107.45306|A|Quảng Ninh
Cồn Miếu|21.07528|107.35667|A|Quảng Ninh
Cồn Bánh|21.06972|107.36833|A|Quảng Ninh
Cồn Cuốn Buồm|21.06472|107.47806|A|Quảng Ninh
Cồn Giữa Đập|21.06472|107.37806|A|Quảng Ninh
Bãi Tây Bắc|21.06417|107.72194|A|Quảng Ninh
Bãi Chân Miếu|21.06306|107.50722|A|Quảng Ninh
Đá Bắc Ba Đỉnh|21.06278|107.86444|A|Quảng Ninh
Cồn Buộm Thấp|21.0625|107.37611|A|Quảng Ninh
Cồn Bắc Sẹo Trâu|21.06167|107.49306|A|Quảng Ninh
Cồn Buộm Cao|21.06139|107.37611|A|Quảng Ninh
Bãi Dù Đá|21.06056|107.66083|A|Quảng Ninh
Đá Chuột Nhắt 2|21.06028|107.83667|A|Quảng Ninh
Cồn Kén Tằm|21.05944|107.36583|A|Quảng Ninh
Đá Nanh Lợn|21.0575|107.54361|A|Quảng Ninh
Đá Chuột Nhắt 1|21.05583|107.83889|A|Quảng Ninh
Đá Ngầm Sâu|21.05444|107.73833|A|Quảng Ninh
Đá Nam Ba Đỉnh|21.05389|107.86444|A|Quảng Ninh
Đá Chân Hương|21.05306|107.85444|A|Quảng Ninh
Cồn Ba Đỉnh Con|21.0525|107.85611|A|Quảng Ninh
Đá Xấu Hổ|21.05194|107.70722|A|Quảng Ninh
Cồn Chân Miếu|21.05167|107.86111|A|Quảng Ninh
Cồn Hang Chuột|21.05028|107.84528|A|Quảng Ninh
Đá Sư Tử Con|21.05|107.765|A|Quảng Ninh
Bãi Thủy Sản|21.04889|107.40639|A|Quảng Ninh
Đá Rỉ Nước|21.04611|107.70417|A|Quảng Ninh
Cồn Đuôi Chép|21.045|107.75139|A|Quảng Ninh
Cồn Tai Khỉ|21.04444|107.82972|A|Quảng Ninh
Cồn Chuẩn 1|21.03944|107.37944|A|Quảng Ninh
Đá Đuôi Sao Chổi|21.03944|107.74694|A|Quảng Ninh
Cồn Chuẩn 2|21.035|107.37667|A|Quảng Ninh
Đá Tây Cổ Chầy|21.02944|107.4775|A|Quảng Ninh
Đá Quả Thông Già|21.02|107.75333|A|Quảng Ninh
Cồn Bắc Soi Đán|21.01972|107.45444|A|Quảng Ninh
Cồn Gạc Hươu|21.01778|107.7575|A|Quảng Ninh
Cồn Mồi Chim|21.01417|107.44167|A|Quảng Ninh
Cồn Bắc Hải|21.01389|107.44056|A|Quảng Ninh
Cồn Tây Hải|21.01167|107.43889|A|Quảng Ninh
Bãi Hồng Vân|21.01083|107.76389|A|Quảng Ninh
Đá Pháo Đài|21.00306|107.79194|A|Quảng Ninh
Bãi Hồng Vàn|20.99528|107.77528|A|Quảng Ninh
Cồn Lẻ|20.99|107.42778|A|Quảng Ninh
Cồn Ghềnh Táu|20.98361|107.03861|A|Quảng Ninh
Cồn Cua|20.9775|107.07083|A|Quảng Ninh
Cồn Tua Rua|20.97556|107.45444|A|Quảng Ninh
Đá Đánh Sói|20.9725|107.79417|A|Quảng Ninh
Cồn Bè Trong|20.97083|107.06889|A|Quảng Ninh
Đá Trụi|20.96472|107.55111|A|Quảng Ninh
Cồn Chó|20.95778|107.235|A|Quảng Ninh
Bãi Bắc Cảnh Cước|20.95417|107.54111|A|Quảng Ninh
Đá Đáy Giếng|20.95306|107.24278|A|Quảng Ninh
Đá Miệng Giếng|20.9525|107.24639|A|Quảng Ninh
Đá Bạc|20.95111|107.52722|A|Quảng Ninh
Đá Đinh Nhọn|20.95056|107.23083|A|Quảng Ninh
Cồn Trụi Con|20.94278|106.97833|A|Quảng Ninh
Đá Kèo|20.9425|106.98222|A|Quảng Ninh
Cồn Mặt Ngựa|20.93944|107.52111|A|Quảng Ninh
Cồn Tráp|20.93833|107.20139|A|Quảng Ninh
Cồn Đường|20.92944|107.13028|A|Quảng Ninh
Bãi Tuần Châu|20.9275|106.99028|A|Quảng Ninh
Cồn Đầm|20.92694|107.52|A|Quảng Ninh
Cồn Cửa Miếu|20.92611|106.99278|A|Quảng Ninh
Cồn Sàng|20.92611|107.52194|A|Quảng Ninh
Cồn Thếch Ngoài|20.92528|107.55111|A|Quảng Ninh
Cồn Thếch Trong|20.92528|107.54694|A|Quảng Ninh
Cồn Lá Thông Ngoài|20.92333|106.99833|A|Quảng Ninh
Cồn Lá Thông Trong|20.92333|106.99278|A|Quảng Ninh
Đá Ngăn|20.92278|107.10944|A|Quảng Ninh
Cồn Cây Mắm|20.9225|107.51306|A|Quảng Ninh
Đá Hai Giá|20.92222|107.08806|A|Quảng Ninh
Cồn Muỗi|20.92083|107.38222|A|Quảng Ninh
Cồn Đầu Soi Mui|20.91917|107.37611|A|Quảng Ninh
Cồn Đầu Đá|20.91667|106.95278|A|Quảng Ninh
Cồn Sơn Hào|20.91389|107.53778|A|Quảng Ninh
Đá Vảy Sừng|20.91278|107.15333|A|Quảng Ninh
Bãi Chân Rồng|20.90833|106.925|A|Quảng Ninh
Đá Cát Ngoài|20.89889|107.17611|A|Quảng Ninh
Đá Mỏm Tây|20.89556|107.47861|A|Quảng Ninh
Đá Mỏm Đông|20.89556|107.48111|A|Quảng Ninh
Cồn Trụ Cửa|20.89306|106.99417|A|Quảng Ninh
Đá Dom Đông|20.89306|107.13|A|Quảng Ninh
Đá Đầu Dom|20.89306|107.11611|A|Quảng Ninh
Đá Măng Nứa|20.89028|106.94722|A|Quảng Ninh
Cồn Cái Bè|20.88972|106.95833|A|Quảng Ninh
Cồn Luồng Nứa|20.88806|107.16944|A|Quảng Ninh
Đá Chân Tháp|20.88778|107.10417|A|Quảng Ninh
Bãi Dã Tràng|20.88611|106.89167|A|Quảng Ninh
Đá Chông Bé|20.88194|106.93861|A|Quảng Ninh
Đá Cỏ Cống|20.88167|107.16639|A|Quảng Ninh
Bãi Tây Quan Lạn|20.88139|107.46722|A|Quảng Ninh
Cồn Cò|20.87972|107.40111|A|Quảng Ninh
Đá Bắc Cặp Dè|20.87861|107.13194|A|Quảng Ninh
Đá Nam Cặp Dè|20.87472|107.13028|A|Quảng Ninh
Cồn Cái Đe|20.8725|107.39361|A|Quảng Ninh
Bãi Vỏ Sò|20.87222|106.93056|A|Quảng Ninh
Đá Soi Tràng|20.87083|107.1525|A|Quảng Ninh
Đá Cây Song|20.87028|107.21972|A|Quảng Ninh
Đá Bảy Giếng|20.86667|107.1375|A|Quảng Ninh
Cồn Đạp|20.86472|107.44667|A|Quảng Ninh
Cồn Đầm|20.86444|107.43722|A|Quảng Ninh
Đá Tổ Cát|20.86417|107.095|A|Quảng Ninh
Cồn Vạy Ngoài|20.86389|107.24583|A|Quảng Ninh
Cồn Vạy Trong|20.86361|107.24556|A|Quảng Ninh
Cồn Vĩ Lái|20.86111|107.33167|A|Quảng Ninh
Cồn Đuôi|20.86028|107.43944|A|Quảng Ninh
Đá Nam Tổ Cát|20.86|107.09667|A|Quảng Ninh
Cồn Rùa|20.855|107.27639|A|Quảng Ninh
Đá Đại Thành|20.85417|107.05583|A|Quảng Ninh
Đá Tây Vân Đồn|20.85361|107.40611|A|Quảng Ninh
Bãi Nhện Nước|20.85333|106.91389|A|Quảng Ninh
Cồn Trinh|20.85333|107.15333|A|Quảng Ninh
Đá Mực|20.84889|107.30583|A|Quảng Ninh
Đá Lông Nhím|20.8475|107.08361|A|Quảng Ninh
Cồn Trâu Nằm|20.84417|107.20139|A|Quảng Ninh
Đá Mắm Cáy|20.8425|107.21|A|Quảng Ninh
Đá Hang Vầm|20.84111|107.10556|A|Quảng Ninh
Bãi Nam Quan Lạn|20.83639|107.45778|A|Quảng Ninh
Cồn Bè Cửa Áng|20.83583|107.18|A|Quảng Ninh
Đá Cạnh Sắc|20.835|107.1975|A|Quảng Ninh
Cồn Đá Đổ|20.83306|107.20306|A|Quảng Ninh
Đá Chèn Pháo|20.83028|107.13944|A|Quảng Ninh
Đá Mắt Quỷ|20.82917|107.10083|A|Quảng Ninh
Đá Mực Ống|20.82667|107.18861|A|Quảng Ninh
Đá Vụng Hối|20.82611|107.16333|A|Quảng Ninh
Cồn Đầu Sào|20.81778|107.17889|A|Quảng Ninh
Cồn Răng Đá|20.81694|107.19972|A|Quảng Ninh
Cồn Cục Chì|20.81639|107.17778|A|Quảng Ninh
Đá Sao Chổi|20.81194|107.17778|A|Quảng Ninh
Đá Ngọc Bích|20.81111|107.11278|A|Quảng Ninh
Cồn Đầu Vụng Mồng|20.79972|107.38333|A|Quảng Ninh
Đá Văn Tế|20.79944|107.21167|A|Quảng Ninh
Đá Loa Trên|20.79778|107.24361|A|Quảng Ninh
Đá Loa Dưới|20.79667|107.24556|A|Quảng Ninh
Đá Tổ Các|20.79417|107.13556|A|Quảng Ninh
Đá Nam Gác Đá|20.79222|107.48139|A|Quảng Ninh
Cồn Rêu|20.79194|107.37306|A|Quảng Ninh
Cồn Đồng Hồ|20.78167|107.48417|A|Quảng Ninh
Đá Cây Nến|20.78083|107.11417|A|Quảng Ninh
Cồn Chìm|20.77139|107.15611|A|Quảng Ninh
Bãi đá Ca Nô|20.76472|107.15639|A|Quảng Ninh
Cồn Vỏ Sò Trên|20.73444|107.45833|A|Quảng Ninh
Cồn Vỏ Sò Giữa|20.73278|107.45667|A|Quảng Ninh
Cồn Vỏ Sò Dưới|20.72917|107.45556|A|Quảng Ninh
Cồn Răng Lược|20.71167|107.34|A|Quảng Ninh
Cồn Ngoài|20.68944|107.34472|A|Quảng Ninh
Bãi ngầm Ba Bảy|17.36667|107.42111|A|Quảng Trị
Rạn Lẽ Khơi|17.35944|107.39306|A|Quảng Trị
Rạn Sy|17.22444|107.34444|A|Quảng Trị
Bãi Hòn Nổi|17.20528|107.34528|A|Quảng Trị
Bãi Liêm|17.19611|107.01083|A|Quảng Trị
Bãi đá Đen|17.16667|107.33972|A|Quảng Trị
Bãi Z7|17.15778|107.32944|A|Quảng Trị
Rạn Khe Làng|17.15556|107.03333|A|Quảng Trị
Rạn Mạ|17.14278|107.07722|A|Quảng Trị
Bãi Dài|17.14222|107.02361|A|Quảng Trị
Rạn Tân Hòa|17.13333|107.08611|A|Quảng Trị
Rạn Ba Gò|17.12417|107.34806|A|Quảng Trị
Bãi Vĩnh Thái|17.11472|107.07056|A|Quảng Trị
Bãi đá Trâu Nẹp|17.10667|107.09889|A|Quảng Trị
Rạn Bờm Di|17.09972|107.30778|A|Quảng Trị
Bãi Hàm Rồng|17.095|107.105|A|Quảng Trị
Rạn Bịt|17.09306|107.11556|A|Quảng Trị
Rạn Trong Đảo|17.08972|107.29944|A|Quảng Trị
Rạn Lay|17.08333|107.11694|A|Quảng Trị
Bãi Vịnh Mốc|17.08083|107.11472|A|Quảng Trị
Rạn Đuồi|17.08056|107.11722|A|Quảng Trị
Rạn Bang|17.07472|107.11778|A|Quảng Trị
Rạn Lò Vôi|17.06444|107.11472|A|Quảng Trị
Rạn Bò Nằm Dị|17.05472|107.28889|A|Quảng Trị
Rạn Mồ Côi|17.04639|107.11722|A|Quảng Trị
Rạn Trốc Sy|17.04194|107.11667|A|Quảng Trị
Rạn Cửa|17.03972|107.11389|A|Quảng Trị
Rạn Ông Nỡ|17.02111|107.36528|A|Quảng Trị
Bãi Gio Linh|17.00861|107.11333|A|Quảng Trị
Rạn 19|16.99944|107.30333|A|Quảng Trị
Rạn Bò Nằm Tre|16.99861|107.18306|A|Quảng Trị
Rạn Ngâm|16.99694|107.21083|A|Quảng Trị
Rạn Chùa|16.93333|107.52583|A|Quảng Trị
Bãi Cửa Việt|16.90361|107.18889|A|Quảng Trị
Bãi Quảng Trị|16.90139|107.31694|A|Quảng Trị
Bãi Triệu Phong|16.84417|107.26111|A|Quảng Trị
Bãi Hải Lăng|16.77778|107.33944|A|Quảng Trị
Bãi Đuôi Cồn Dung|9.50861|106.28722|A|Sóc Trăng
Bãi Hội Đình|9.44944|106.20583|A|Sóc Trăng
Cồn Bửng 1|9.39028|106.26972|A|Sóc Trăng
Bãi Huỳnh Kỳ|9.38389|106.19472|A|Sóc Trăng
Cồn Trâu|9.38|106.25889|A|Sóc Trăng
Cồn Bửng 2|9.37833|106.26889|A|Sóc Trăng
Cồn 15|9.37361|106.25139|A|Sóc Trăng
Cồn Hồ Bể|9.35472|106.22|A|Sóc Trăng
Cồn Trà Sết|9.34306|106.13306|A|Sóc Trăng
Bãi Hồ Bể|9.34167|106.135|A|Sóc Trăng
Bãi cạn Nam Mỹ Thanh|9.33056|106.23444|A|Sóc Trăng
Bãi Vĩnh Châu|9.29556|105.97806|A|Sóc Trăng
Bãi Hàng Cồn|10.46583|106.95194|A|TP.Hồ Chí Minh
Bãi Tàu Chìm|10.46472|106.97556|A|TP.Hồ Chí Minh
Cồn Phong Thạnh|10.42|106.96278|A|TP.Hồ Chí Minh
Cồn Cá Nâu|10.40444|106.98556|A|TP.Hồ Chí Minh
Cồn Hàng Cạn|10.39694|107.01556|A|TP.Hồ Chí Minh
Bãi Cát Lái|10.39222|106.85083|A|TP.Hồ Chí Minh
Cồn Hàng Mới|10.38722|107.01444|A|TP.Hồ Chí Minh
Bãi Cần Giờ|10.38222|106.93472|A|TP.Hồ Chí Minh
Cồn Xích Hậu|10.36333|106.87139|A|TP.Hồ Chí Minh
Cồn Đồng Hòa|10.35139|106.89889|A|TP.Hồ Chí Minh
Cồn Khe Lương|10.33222|106.94472|A|TP.Hồ Chí Minh
Cồn Tây Xương|10.33083|106.98194|A|TP.Hồ Chí Minh
Cồn Ngựa|10.32778|106.97194|A|TP.Hồ Chí Minh
Bãi Thần Phù|19.95278|106.01361|A|Thanh Hóa
Bãi Đa Lộc|19.945|105.99417|A|Thanh Hóa
Bãi Hải Lộc|19.91083|105.95444|A|Thanh Hóa
Bãi Hoằng Hóa|19.84028|105.93417|A|Thanh Hóa
Cồn Sịnh|19.78889|105.93944|A|Thanh Hóa
Bãi Sầm Sơn|19.75417|105.91111|A|Thanh Hóa
Bãi Quảng Xương|19.65778|105.83417|A|Thanh Hóa
Bãi Bắc Tĩnh Gia|19.54194|105.80889|A|Thanh Hóa
Bãi Nam Tĩnh Gia|19.46444|105.80611|A|Thanh Hóa
Bãi Hải Thanh|19.42167|105.79389|A|Thanh Hóa
Bãi Nam Bạng|19.37278|105.78639|A|Thanh Hóa
Đá Nam Hộp|19.35194|105.87639|A|Thanh Hóa
Bãi Hải Thượng|19.33778|105.80333|A|Thanh Hóa
Bãi Biện Sơn|19.32083|105.82361|A|Thanh Hóa
Bãi Ngầm Sập Dưới|19.31278|105.89694|A|Thanh Hóa
Rạn Lố Vì|19.30083|105.82972|A|Thanh Hóa
Bãi Răng Cưa|19.29|105.80556|A|Thanh Hóa
Bãi Bắc Diêm Hộ|20.58944|106.61944|A|Thái Bình
Bãi Nam Diêm Hộ|20.52556|106.57778|A|Thái Bình
Cồn Đen|20.48|106.6025|A|Thái Bình
Cồn Đồng Bào|20.43417|106.61333|A|Thái Bình
Bãi Đông Long|20.43083|106.60556|A|Thái Bình
Cồn Đồng Châu|20.40667|106.59583|A|Thái Bình
Cồn Thủ|20.35139|106.61778|A|Thái Bình
Bãi Nam Thịnh|20.3475|106.58083|A|Thái Bình
Cồn Vành|20.27278|106.60194|A|Thái Bình
Bãi Phong Điền|16.70333|107.44028|A|Thừa Thiên Huế
Bãi Khe Xanh|16.62722|107.53861|A|Thừa Thiên Huế
Bãi Bạch Sa|16.62389|107.51528|A|Thừa Thiên Huế
Bãi ngầm Phú Vang Trên|16.61833|107.655|A|Thừa Thiên Huế
Bãi ngầm Phú Vang Ngoài|16.60833|107.72222|A|Thừa Thiên Huế
Bãi Tân Lập|16.6025|107.52111|A|Thừa Thiên Huế
Bãi ngầm Phú Vang Dưới|16.59722|107.70278|A|Thừa Thiên Huế
Bãi Thuận An|16.56333|107.65083|A|Thừa Thiên Huế
Cồn Tè|16.55528|107.61694|A|Thừa Thiên Huế
Bãi ngầm Tàu Đắm|16.54972|107.83667|A|Thừa Thiên Huế
Cồn Xứ Đình Trên|16.54528|107.66083|A|Thừa Thiên Huế
Cồn Hợp Châu|16.54389|107.64861|A|Thừa Thiên Huế
Cồn Mộ Vò Vọ|16.53806|107.64778|A|Thừa Thiên Huế
Bãi Sáo|16.53667|107.69444|A|Thừa Thiên Huế
Cồn Mã Một|16.53|107.65167|A|Thừa Thiên Huế
Bãi ngầm Phú Diên|16.52222|107.80556|A|Thừa Thiên Huế
Bãi Vinh Thanh|16.45333|107.8025|A|Thừa Thiên Huế
Cồn Tơi|16.39389|107.81167|A|Thừa Thiên Huế
Cồn Tơi Nhỏ|16.39361|107.80778|A|Thừa Thiên Huế
Cồn Dong|16.38333|107.81583|A|Thừa Thiên Huế
Cồn Trại|16.3825|107.81944|A|Thừa Thiên Huế
Bãi Đông Dương|16.37306|107.89528|A|Thừa Thiên Huế
Cồn Trui|16.36639|107.83472|A|Thừa Thiên Huế
Bãi Hàm Rồng|16.36306|107.90972|A|Thừa Thiên Huế
Cồn Lăng|16.34639|107.83722|A|Thừa Thiên Huế
Cồn Mồ Côi|16.34472|107.84694|A|Thừa Thiên Huế
Bãi Xép|16.34417|107.95|A|Thừa Thiên Huế
Bãi Bàn|16.31611|108.01083|A|Thừa Thiên Huế
Bãi Cảnh Dương|16.31583|107.98806|A|Thừa Thiên Huế
Đá Dầm|16.30028|107.81111|A|Thừa Thiên Huế
Đá Bạc|16.295|107.83028|A|Thừa Thiên Huế
Bãi Lăng Cô|16.24306|108.08083|A|Thừa Thiên Huế
Bãi Hói Mít|16.23028|108.04528|A|Thừa Thiên Huế
Bãi Hói Dừa|16.22389|108.0625|A|Thừa Thiên Huế
Bãi Chuối|16.21611|108.13556|A|Thừa Thiên Huế
Bãi Cả|16.21472|108.11917|A|Thừa Thiên Huế
Đá Lang|16.21278|108.19|A|Thừa Thiên Huế
Cồn Ông Mão|10.28333|106.79444|A|Tiền Giang
Cồn Vạn Liễu|10.25833|106.79611|A|Tiền Giang
Cồn Cống|10.21917|106.77|A|Tiền Giang
Cồn Ngang|10.21444|106.79111|A|Tiền Giang
Cồn Vượt|10.17306|106.805|A|Tiền Giang
Bãi Giữa|10.15861|106.85528|A|Tiền Giang
Bãi Cây Mắm|9.83167|106.54222|A|Trà Vinh
Cồn Nạng|9.79639|106.53389|A|Trà Vinh
Bãi Mỹ Long|9.78194|106.55|A|Trà Vinh
Bãi Bến Đáy|9.77389|106.5225|A|Trà Vinh
Cồn Vượt|9.71389|106.61583|A|Trà Vinh
Bãi Hiệp Thạnh|9.71278|106.575|A|Trà Vinh
Bãi Nhà Mát|9.67111|106.57889|A|Trà Vinh
Bãi Ba Động|9.60389|106.55028|A|Trà Vinh
Bãi Động Cao|9.53889|106.42056|A|Trà Vinh
Cồn Lợi|9.53444|106.40389|A|Trà Vinh
Bãi Cồn Lợi|9.50306|106.40222|A|Trà Vinh
Cồn Châu|9.48389|106.43333|A|Trà Vinh
Rạn Chòm Đá|9.47361|106.42722|A|Trà Vinh
Cồn Giăng|9.44194|106.43889|A|Trà Vinh
Đá Hú|16.21528|108.19667|A|Đà Nẵng
Bãi Nhà|16.21361|108.20583|A|Đà Nẵng
Bãi Hố Trầu|16.20639|108.19222|A|Đà Nẵng
Bãi đá Chông|16.20056|108.18|A|Đà Nẵng
Bãi đá Vôi|16.2|108.18583|A|Đà Nẵng
Đá Bổ|16.19556|108.17333|A|Đà Nẵng
Đá Bàn|16.19306|108.1675|A|Đà Nẵng
Bãi Mờ Đa|16.1925|108.16167|A|Đà Nẵng
Bãi ngầm Sơn Chà|16.19167|108.23944|A|Đà Nẵng
Đá Sủng Tách|16.18667|108.15833|A|Đà Nẵng
Đá Sủng Cũi|16.1775|108.15278|A|Đà Nẵng
Bãi San|16.16806|108.14917|A|Đà Nẵng
Đá Bà|16.15778|108.24167|A|Đà Nẵng
Đá Bia|16.14444|108.13722|A|Đà Nẵng
Bãi Xếp|16.14306|108.22694|A|Đà Nẵng
Bãi Tay Gấu|16.14111|108.26806|A|Đà Nẵng
Đá Đen Đầu|16.13778|108.22278|A|Đà Nẵng
Bãi đá Bắc|16.13333|108.30556|A|Đà Nẵng
Bãi Tiên Sa|16.12583|108.21778|A|Đà Nẵng
Bãi Lở|16.1175|108.32889|A|Đà Nẵng
Bãi ngầm Liên Chiểu|16.10611|108.15333|A|Đà Nẵng
Bãi Trẹm|16.10583|108.28889|A|Đà Nẵng
Bãi cạn Hải Châu|16.10278|108.21722|A|Đà Nẵng
Cồn Ma|16.1025|108.2225|A|Đà Nẵng
Bãi Cây Bàng|16.10083|108.30944|A|Đà Nẵng
Bãi Bụt Lớn|16.1|108.28028|A|Đà Nẵng
Bãi Sơn Trà|16.09944|108.23722|A|Đà Nẵng
Bãi Nồm|16.09861|108.29944|A|Đà Nẵng
Bãi Bụt Nhỏ|16.09806|108.26917|A|Đà Nẵng
Đá Hòn|16.09667|108.30278|A|Đà Nẵng
Bãi Đa Phước|16.09306|108.21028|A|Đà Nẵng
Bãi Ngang Nam Ô|16.09111|108.15167|A|Đà Nẵng
Bãi cạn Sụp|16.08972|108.26056|A|Đà Nẵng
Bãi Thanh Bình|16.08028|108.20556|A|Đà Nẵng
`.trim();

// admin GÁN CỨNG theo group (chủ quyền VN) — khớp EXPECTED_REEF_ADMIN (reefs.ts)
const ADMIN = {
  "hoang-sa": "TP Đà Nẵng",
  "truong-sa": "tỉnh Khánh Hòa",
  "them-luc-dia": "Thềm lục địa phía Nam",
};

// type theo TIỀN TỐ tên
function reefType(name) {
  if (name.startsWith("Rạn") || name.startsWith("San hô")) return "ran";
  if (name.startsWith("Đá")) return "da";
  if (name.startsWith("Bãi")) return "bai";
  if (name.startsWith("Cồn")) return "con";
  return null;
}

// group theo mục nguồn + HỘP DK1 (thềm lục địa nằm lẫn trong A.I)
function reefGroup(sec, lat, lon) {
  if (sec === "B") return "hoang-sa";
  if (sec === "C") return "truong-sa";
  if (lat >= 6.5 && lat <= 8.75 && lon >= 109.3 && lon <= 112.3)
    return "them-luc-dia";
  return "ven-bo";
}

const parsed = [];
const boQua = [];
for (const line of TT33_RAW.split("\n").map((l) => l.trim()).filter(Boolean)) {
  const [name, la, lo, sec, prov] = line.split("|");
  const nm = (name || "").trim();
  const lat = Number(la);
  const lng = Number(lo);
  const type = reefType(nm);
  if (!nm || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    boQua.push([line, "thiếu tên/toạ độ"]);
    continue;
  }
  if (!type) {
    boQua.push([line, "không nhận ra họ (đá/bãi/rạn/cồn)"]);
    continue;
  }
  const group = reefGroup(sec, lat, lng);
  parsed.push({
    name: nm,
    type,
    lat,
    lng,
    group,
    admin: ADMIN[group] || (prov ? prov.trim() : "Ven bờ"),
    rank: group === "ven-bo" ? 3 : 2,
  });
}

// ── THỰC THỂ NỔI đã có ở vn-islands.v1.json — KHÔNG lấy vào lớp rạn ─────────
// Cồn cát = doi cát nổi trên mặt nước quanh năm (bà con lên được) → theo luật
// "nổi → islands", dù TT33 liệt kê. Dòng nguồn trong TT33_RAW GIỮ NGUYÊN (chép
// nguyên văn, truy nguồn), chỉ lọc ở đây. "Bãi Cát Trung"/"Bãi Cát Nam" (bãi,
// ngầm) là thực thể KHÁC bên cạnh cồn → vẫn giữ trong lớp này.
const GIU_O_ISLANDS = new Set(["Cồn Cát Tây", "Cồn Cát Nam"]);
const REEFS = [...CURATED, ...parsed].filter((d) => !GIU_O_ISLANDS.has(d.name));
console.log(
  `rút sang vn-islands (cồn cát nổi): ${GIU_O_ISLANDS.size} — ${[...GIU_O_ISLANDS].join(", ")}`,
);

// ── CỔNG TỰ KIỂM CHỦ QUYỀN — không cho lọt ký tự Hán/CJK ────────────────────
const CJK =
  /[⺀-⿿　-〿぀-ヿ㄀-ㄯㆠ-ㆿ㈀-㏿㐀-䶿一-鿿豈-﫿︰-﹏＀-｠￠-￦]/;
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
const byType = REEFS.reduce(
  (m, d) => ((m[d.type] = (m[d.type] || 0) + 1), m),
  {},
);
console.log(
  `OK: public/data/coral-reefs.v1.json — ${features.length} rạn/đá/bãi/cồn`,
  "\n  theo group:",
  byGroup,
  "\n  theo type:",
  byType,
  `\n  ${Math.round(JSON.stringify(out).length / 1024)} KB`,
);
if (boQua.length) {
  console.log(`BỎ QUA ${boQua.length} dòng:`);
  for (const [l, ly] of boQua) console.log(`  [${ly}] ${l}`);
}
