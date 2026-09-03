// Sinh LỚP ĐỊA DANH NGẦM (đối tượng ngầm dưới đáy biển) cho Trục 1 — chạy MỘT
// LẦN (không cần mạng — nguồn đã chép vào chính file này):
//   node scripts/generate-dia-danh-ngam.mjs
//
// Đầu ra: public/data/dia-danh-ngam.v1.json — bảng tra loại + mảng số.
//
// ── VÌ SAO CÓ FILE NÀY ─────────────────────────────────────────────────────
// Lỗ hạng mục #8 của hải đồ (tên bãi/đá/rạn): trước đây chỉ có 13 tên, TOÀN
// Trường Sa, 0 tên ven bờ. Một bản đồ tham khảo (Leaflet) hiển thị hàng trăm
// ĐỊA DANH NGẦM tiếng Việt — núi ngầm, đồi ngầm, hố ngầm, thung lũng ngầm,
// vách đứng ngầm, bãi ven bờ ngầm — mà hải đồ mình chưa có. Truy nguồn: chúng
// đến TỪ MỘT danh mục nhà nước có hệ thống, KHÔNG phải tên tự chế.
//
// ── NGUỒN CHÍNH THỐNG ──────────────────────────────────────────────────────
// Thông tư 33/2024/TT-BTNMT (Bộ Tài nguyên và Môi trường, 15/12/2024) —
// "Danh mục địa danh các đảo, đá, bãi cạn, bãi ngầm và một số đối tượng địa lý
// khác trên vùng biển Việt Nam", MỤC III: "Đối tượng ngầm dưới đáy biển".
// Bảng gốc có cột: TT · Tên địa danh · Tỉnh/TP trực thuộc TW · Toạ độ VN-2000
// (Vĩ độ, Kinh độ — Độ Phút Giây). Mục III (184 đối tượng) KHÔNG có cột tỉnh
// vì đây là thực thể ngoài khơi sâu, ngoài vùng nước hành chính của tỉnh nào.
// Bản PDF tải 2026-09-03 từ Cổng thông tin Bộ:
//   https://mae.gov.vn/noidung/Lists/VBQPPL/Attachments/514/1_DanhMuc_TT_DiaDanh_BanHanh.pdf
// Toàn văn Thông tư: thuvienphapluat.vn/van-ban/.../Thong-tu-33-2024-TT-BTNMT-...
//
// ── VÌ SAO CHÉP NGUỒN VÀO ĐÂY, KHÔNG TẢI LÚC BUILD ─────────────────────────
// (1) Đây là danh mục nhà nước ĐÃ ĐÓNG (ban hành 1 lần) — không phải nguồn
//     sống cần làm mới; sinh lại là hành động CÓ CHỦ Ý (CLAUDE.md §chống phình,
//     quy tắc 3), không phải phản xạ mỗi lần build.
// (2) PDF gốc 4,3 MB, dùng font nhúng không map Unicode chuẩn → chỉ đọc đúng
//     tiếng Việt qua pypdf, KHÔNG qua pdftotext (mất dấu). Chép NGUYÊN VĂN 184
//     dòng đã kiểm vào đây để tái lập không cần PDF, không cần Python, không
//     thêm dep. Đây là "authored source"; JSON là "generated".
// (3) Điều 15 Luật SHTT loại "văn bản hành chính" và "số liệu" khỏi bảo hộ —
//     đây là địa danh nhà nước công bố công khai, KHÔNG viết câu dè chừng.
//
// ── LƯU Ý VỊ TRÍ (đã kiểm) ─────────────────────────────────────────────────
// Các đối tượng đặt tên theo XÃ/PHƯỜNG ven bờ, NHƯNG nằm SÂU ngoài khơi
// (6,8–16,2°N; 109,5–114,5°E), KHÔNG nằm ngay ngoài khơi xã cùng tên. Ví dụ
// "Núi ngầm Vạn Giã" ở 9,35°N còn xã Vạn Giã (Khánh Hoà) ở ~12,7°N — cách
// ~370 km về nam. Vì thế phép kiểm "đối chiếu vĩ độ với xã cùng tên" KHÔNG
// dùng được ở mục III; toạ độ lấy NGUYÊN từ nguồn, đã kiểm 100% lọt khung biển
// VN và trùng khớp tên với bản đồ tham khảo.

import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "public", "data", "dia-danh-ngam.v1.json");

// Khung biển VN — GIỮ ĐỒNG BỘ với KHUNG_BIEN_VN trong src/lib/den-bien.ts.
const KHUNG = { s: 4, w: 102, n: 24, e: 118 };

// Dải ký tự CJK — copy rút gọn từ scripts/audit-names.mjs để tự kiểm lúc sinh.
const CJK =
  /[⺀-⿿　-〿぀-ヿ㄀-ㄯㆠ-ㆿ㈀-㏿㐀-䶿一-鿿豈-﫿︰-﹏＀-｠￠-￦]/;

// ── BẢNG LOẠI ──────────────────────────────────────────────────────────────
// Mã loại (khớp DiaDanhNgamLoai trong src/lib/dia-danh-ngam.ts). Thứ tự ở đây
// QUYẾT ĐỊNH chỉ số trong file — đừng chèn giữa, chỉ thêm cuối.
const LOAI = [
  "nui", // Núi ngầm, Mũi núi ngầm (seamount)
  "doi", // Đồi ngầm, Các đồi ngầm (knoll / hill)
  "song", // Sống núi ngầm (ridge)
  "day", // Dãy / Chuỗi núi ngầm (seamount range / chain)
  "guyot", // Núi chóp phẳng ngầm (guyot / flat-topped seamount)
  "ho", // Hố ngầm (deep / hole)
  "thunglung", // Thung lũng ngầm (valley)
  "hem", // Hẻm núi ngầm (canyon)
  "vach", // Vách đứng ngầm (escarpment)
  "doc", // Dốc ngầm (slope)
  "deo", // Đèo ngầm (gap / saddle)
  "kenh", // Kênh ngầm (channel)
  "baivenbo", // Bãi ven bờ ngầm (submerged nearshore bank)
];

// Tiền tố tên → mã loại. XẾP DÀI TRƯỚC NGẮN để "Núi chóp phẳng ngầm" không bị
// "Núi ngầm" nuốt, "Các hẻm núi ngầm" không bị "Hẻm núi ngầm" nuốt.
const PREFIX = [
  ["Núi chóp phẳng ngầm", "guyot"],
  ["Các hẻm núi ngầm", "hem"],
  ["Hẻm núi ngầm", "hem"],
  ["Sống núi ngầm", "song"],
  ["Dãy núi ngầm", "day"],
  ["Chuỗi núi ngầm", "day"],
  ["Mũi núi ngầm", "nui"],
  ["Các kênh ngầm", "kenh"],
  ["Kênh ngầm", "kenh"],
  ["Các đồi ngầm", "doi"],
  ["Đồi ngầm", "doi"],
  ["Thung lũng ngầm", "thunglung"],
  ["Vách đứng ngầm", "vach"],
  ["Bãi ven bờ ngầm", "baivenbo"],
  ["Núi ngầm", "nui"],
  ["Hố ngầm", "ho"],
  ["Dốc ngầm", "doc"],
  ["Đèo ngầm", "deo"],
];

function phanLoai(ten) {
  for (const [p, code] of PREFIX) if (ten.startsWith(p)) return code;
  return null;
}

// ── NGUỒN CHÉP NGUYÊN VĂN (TT 33/2024, Mục III) ─────────────────────────────
// Định dạng mỗi dòng: Tên|Vĩ độ (Độ Phút Giây)|Kinh độ (Độ Phút Giây)
// Vĩ độ luôn Bắc (+), Kinh độ luôn Đông (+). 184 dòng, đúng thứ tự TT trong TT.
const RAW = `
Thung lũng ngầm Bình Minh|16 13 34|110 32 35
Đồi ngầm Núi Thành|16 2 11|110 55 32
Đồi ngầm Đức Phổ|15 26 39|112 4 08
Núi ngầm Bồng Sơn|14 11 20|112 27 49
Mũi núi ngầm Bình Nam|15 47 18|110 37 21
Dốc ngầm Tam Tiến|15 33 38|110 30 26
Đồi ngầm Tam Hòa|15 31 14|111 53 29
Núi ngầm Bình Thuận|15 23 40|112 39 49
Các đồi ngầm Bình Hải|15 20 02|111 34 05
Đồi ngầm Tịnh Kỳ|15 14 11|111 2 56
Đồi ngầm Tịnh Khê|15 10 19|110 47 30
Núi ngầm Phổ Vinh|14 48 33|111 38 43
Núi ngầm Đức Minh|15 0 33|112 37 06
Hố ngầm Hoài Mỹ|14 36 11|112 31 32
Núi ngầm Hoài Châu|14 32 59|112 56 50
Đồi ngầm Hoài Hải|14 28 02|111 57 21
Các đồi ngầm Lương Sơn|14 34 20|110 2 22
Đồi ngầm Tam Quan|14 31 54|110 11 03
Đồi ngầm Mỹ Đức|14 22 02|111 26 28
Núi ngầm Hoài Đức|14 22 29|111 50 53
Núi ngầm Mỹ Thắng|14 22 48|112 45 31
Đồi ngầm Mỹ Thành|14 10 44|111 51 54
Đồi ngầm Bình Hòa|15 17 17|112 29 25
Bãi ven bờ ngầm Vĩnh Trạch|9 14 24|109 2 53
Hẻm núi ngầm Trung Bình|9 14 18|109 10 03
Bãi ven bờ ngầm Vĩnh Bình|9 9 37|109 1 01
Đồi ngầm Tân Phước|9 8 54|109 2 50
Vách đứng ngầm Nhơn Hải|13 42 40|109 53 34
Núi ngầm An Thạch|13 38 04|112 34 26
Núi ngầm Tuy Hòa|13 38 49|112 20 10
Núi ngầm Ô Loan|13 36 39|112 39 35
Núi ngầm Sông Cầu|13 34 37|111 20 34
Thung lũng ngầm Xuân Cảnh|13 22 40|111 7 09
Núi ngầm Đại Lãnh|13 21 12|112 32 17
Núi ngầm An Phú|13 4 05|111 19 04
Đồi ngầm An Chấn|13 3 17|111 5 06
Đồi ngầm Bình Ngọc|12 58 06|111 25 27
Núi ngầm Phú Đông|13 10 11|109 52 51
Đồi ngầm Phú Thạnh|12 45 31|111 22 52
Vách đứng ngầm Ninh Thủy|12 44 37|109 58 09
Các hẻm núi ngầm Ninh Vân|11 59 30|109 52 34
Sống núi ngầm Hòn Gốm|11 52 12|110 23 36
Núi ngầm Vĩnh Lương|9 32 02|112 18 57
Núi ngầm Vạn Giã|9 20 50|111 44 33
Núi ngầm Vạn Ninh|9 17 23|111 32 35
Núi ngầm Khánh Sơn|11 25 19|111 21 04
Núi ngầm Bình Ba|9 14 04|112 28 29
Núi ngầm Cam Hải|9 12 21|112 45 20
Núi ngầm Vĩnh Thọ|9 8 43|111 51 02
Các kênh ngầm Phước Dinh|11 31 30|110 0 31
Đồi ngầm Công Hải|11 10 56|111 51 56
Sống núi ngầm Ninh Hải|10 52 24|111 10 23
Núi ngầm An Hải|10 39 07|111 2 06
Đồi ngầm Thanh Hải|10 36 51|111 53 51
Các hẻm núi ngầm Phú Hài|10 25 42|109 53 32
Sống núi ngầm Núi Ông|10 4 22|110 12 58
Núi chóp phẳng ngầm Hàm Thuận|10 13 05|110 44 03
Đèo ngầm Hòn Bà|10 11 38|110 31 33
Núi ngầm Hiệp Phước|10 6 59|111 13 35
Núi ngầm La Ngà|10 0 49|109 51 14
Đồi ngầm Hồng Phong|10 0 21|111 31 31
Núi ngầm Phước Bửu|9 42 34|109 58 58
Đồi ngầm Bông Trang|9 40 27|110 24 39
Đồi ngầm Phước Thuận|9 32 01|109 43 39
Các đồi ngầm Bình Châu|9 27 16|110 55 47
Núi ngầm Lộc An|9 17 27|110 13 15
Hẻm núi ngầm Long Mỹ|9 15 29|109 45 24
Các hẻm núi ngầm Mỹ An|14 8 46|110 6 02
Sống núi ngầm Cát Khánh|14 6 54|113 0 37
Núi ngầm Cát Thành|14 6 04|112 40 18
Các đồi ngầm Nhơn Lý|13 53 27|111 58 09
Đồi ngầm Nhơn Bình|13 52 49|110 11 21
Đồi ngầm Xuân Đài|13 24 26|112 47 48
Các đồi ngầm Xuân Phương|13 23 25|111 57 11
Hố ngầm Cát Hải|13 22 03|112 52 34
Núi ngầm An Dân|13 21 18|113 4 17
Núi ngầm An Hòa Hải|13 14 35|112 27 22
Đồi ngầm Chí Thạnh|13 10 52|111 37 32
Đồi ngầm Hòa Trị|13 5 53|111 51 39
Thung lũng ngầm An Cư|13 5 03|111 45 33
Đồi ngầm Vĩnh Phương|12 21 45|110 36 55
Núi ngầm Lộc Thọ|12 15 24|113 6 51
Núi ngầm Phước Đồng|12 7 46|111 21 29
Các đồi ngầm Suối Tân|12 5 41|110 34 34
Núi ngầm Cam Tân|12 4 24|112 33 41
Mũi núi ngầm Cam Hòa|12 2 32|111 43 59
Đồi ngầm Cam Bình|11 47 16|111 5 23
Đồi ngầm Cam Lập|11 55 18|111 5 35
Đồi ngầm Cam Linh|11 42 09|111 20 53
Đồi ngầm An Hải|11 32 18|112 44 42
Đồi ngầm Phước Nam|11 28 53|112 12 39
Đồi ngầm Phước Diêm|11 18 26|110 14 28
Đồi ngầm Phước Thể|11 14 53|111 32 00
Mũi núi ngầm Bình Tân|11 11 41|110 57 37
Đồi ngầm Hòa Thắng|11 3 49|110 43 43
Sống núi ngầm Phú Long|11 2 34|110 54 52
Núi chóp phẳng ngầm Mũi Né|10 57 29|110 14 50
Sống núi ngầm Xuân An|10 56 46|111 30 22
Đồi ngầm Thiện Nghiệp|10 51 06|110 25 48
Đồi ngầm Bình Thạnh|10 53 14|110 39 46
Thung lũng ngầm Hàm Tiến|10 45 56|110 6 54
Đồi ngầm Ngũ Phụng|10 40 21|110 30 55
Các hẻm núi ngầm Bình Thắng|10 25 20|109 47 32
Đồi ngầm Phước Hải|10 25 23|111 46 07
Đồi ngầm Thừa Đức|10 10 02|112 14 36
Đồi ngầm Thạnh Phước|10 7 29|112 5 19
Đồi ngầm An Điền|9 56 30|111 56 23
Đồi ngầm Thạnh Phong|9 53 55|110 34 13
Đồi ngầm An Nhơn|9 53 26|110 4 24
Núi ngầm Giao Thạnh|9 53 22|112 12 48
Đồi ngầm Mỹ Long|9 48 36|110 48 34
Đồi ngầm Mỹ Hòa|9 45 59|110 13 06
Đồi ngầm Long Toàn|9 34 49|111 12 54
Đồi ngầm Vĩnh Hải|9 21 33|112 19 57
Đồi ngầm Tân Thuận|9 14 08|112 8 18
Đồi ngầm Lạc Hòa|9 18 27|110 47 06
Núi ngầm Vĩnh Hiệp|9 15 51|111 23 40
Núi ngầm Vĩnh Tân|9 16 27|112 3 08
Hố ngầm Hòa Bình|9 11 39|111 14 45
Đồi ngầm An Trạch|9 8 52|110 45 47
Các đồi ngầm Ninh Diêm|12 30 57|110 58 39
Đồi ngầm Hòa Hội|10 30 58|112 43 05
Núi ngầm Phú Tân|10 17 55|112 33 31
Đồi ngầm An Thuận|9 55 24|113 4 53
Đồi ngầm Kim Hòa|9 46 53|112 43 50
Đồi ngầm Long Vĩnh|9 40 49|112 36 38
Sống núi ngầm Dân Thành|9 40 25|113 49 22
Dãy núi ngầm Long Khánh|9 33 48|113 26 37
Đồi ngầm Định Thành|9 17 30|113 5 11
Núi ngầm Vĩnh Phước|9 14 19|112 28 48
Đồi ngầm An Phúc|9 12 13|112 45 38
Đồi ngầm Minh Diệu|9 12 01|112 51 08
Sống núi ngầm Vĩnh Thịnh|9 9 11|113 5 57
Đồi ngầm Điền Hải|9 5 28|112 40 04
Núi ngầm Tiên Du|8 53 02|111 44 22
Đồi ngầm Cam Đức|8 25 16|112 21 54
Núi ngầm Phước Tỉnh|8 54 53|109 40 51
Núi ngầm Long Hải|8 47 34|109 39 14
Núi ngầm Phước Hòa|8 44 20|110 11 06
Núi ngầm Tân Hải|8 45 02|110 49 40
Núi ngầm An Ngãi|8 43 49|111 18 50
Núi ngầm Long Sơn|7 50 03|111 5 02
Chuỗi núi ngầm Tam Phước|8 32 44|111 28 30
Đồi ngầm Đất Đỏ|8 28 53|111 13 17
Núi ngầm Phước Tân|8 15 41|110 54 45
Đồi ngầm Lý Nhơn|8 29 47|109 33 58
Đồi ngầm Gò Công|8 40 19|109 53 59
Đồi ngầm Chợ Gạo|8 7 46|110 14 19
Núi ngầm Thạnh Phú|8 24 01|110 16 31
Đồi ngầm Thới Thuận|8 23 45|110 27 18
Núi ngầm Ba Tri|8 20 02|110 4 36
Núi ngầm An Thủy|8 17 48|110 9 53
Đồi ngầm Đông Hải|8 30 16|110 38 33
Núi ngầm Duyên Hải|8 31 41|109 49 25
Núi ngầm Long Vĩnh|8 30 53|109 51 15
Đồi ngầm Vĩnh Châu|7 20 46|111 3 30
Sống núi ngầm Long Phú|7 14 54|110 32 45
Vách đứng ngầm Long Điền|7 24 02|109 53 13
Núi ngầm Gành Hào|7 17 52|109 43 57
Núi ngầm Đất Mũi|6 47 19|109 34 30
Đồi ngầm Tân Đức|9 1 45|112 12 37
Đồi ngầm Tân Tiến|8 54 17|110 12 08
Thung lũng ngầm Khánh Hải|7 51 35|110 19 41
Hố ngầm Hàng Vịnh|8 45 55|111 25 48
Đồi ngầm Đất Mới|8 42 55|110 56 27
Núi ngầm Trần Thới|8 30 03|112 2 44
Núi chóp phẳng ngầm Năm Căn|8 21 26|109 54 15
Thung lũng ngầm Việt Thắng|8 17 49|109 47 38
Đồi ngầm Rạch Chèo|8 5 19|109 45 24
Đồi ngầm Phong Điền|8 4 22|111 5 58
Đồi ngầm Phú Mỹ|7 56 15|110 20 59
Đồi ngầm Lâm Hải|7 55 40|109 50 06
Dãy núi ngầm Phú Thuận|7 49 44|110 39 37
Hẻm núi ngầm Lợi An|8 24 38|110 12 29
Đồi ngầm Tam Giang|8 48 52|114 28 48
Núi ngầm Rạch Gốc|8 45 07|113 29 26
Đồi ngầm Đông Hưng|8 37 44|112 39 22
Sống núi ngầm Viên An|8 35 59|113 51 52
Đồi ngầm Tam Giang Tây|8 29 31|114 2 56
Đồi ngầm Tân Ân|8 25 27|112 21 57
Đồi ngầm Bảo Thuận|8 17 22|112 42 20
Sống núi ngầm Khánh Hưng|8 8 56|113 40 04
Đồi ngầm Phong Lạc|7 55 35|112 8 23
Các đồi ngầm Khánh Lộc|7 39 17|112 11 46
`.trim();

// ── PHÂN TÍCH + KIỂM ───────────────────────────────────────────────────────
function dms(str) {
  const [d, m, s] = str.trim().split(/\s+/).map(Number);
  if (![d, m, s].every(Number.isFinite)) return null;
  return d + m / 60 + s / 3600;
}

const lines = RAW.split("\n")
  .map((l) => l.trim())
  .filter(Boolean);

const diaDanh = [];
const boQua = [];
const demLoai = Object.fromEntries(LOAI.map((c) => [c, 0]));

for (const line of lines) {
  const [ten, la, lo] = line.split("|");
  if (!ten || !la || !lo) {
    boQua.push([line, "thiếu cột"]);
    continue;
  }
  const t = ten.trim();
  if (CJK.test(t)) {
    boQua.push([line, "có ký tự CJK"]);
    continue;
  }
  const lat = dms(la);
  const lon = dms(lo);
  if (lat === null || lon === null) {
    boQua.push([line, "toạ độ hỏng"]);
    continue;
  }
  if (lat < KHUNG.s || lat > KHUNG.n || lon < KHUNG.w || lon > KHUNG.e) {
    boQua.push([line, `ngoài khung biển VN (${lat.toFixed(3)}, ${lon.toFixed(3)})`]);
    continue;
  }
  const code = phanLoai(t);
  if (!code) {
    boQua.push([line, "không nhận ra loại"]);
    continue;
  }
  demLoai[code]++;
  // [lon, lat, loaiIndex, ten] — lon/lat làm tròn 5 chữ số (~1 m; nguồn ~30 m).
  diaDanh.push([
    Math.round(lon * 1e5) / 1e5,
    Math.round(lat * 1e5) / 1e5,
    LOAI.indexOf(code),
    t,
  ]);
}

const out = {
  v: 1,
  vanBan: "Thông tư 33/2024/TT-BTNMT",
  nguon:
    "Bộ Tài nguyên và Môi trường — Danh mục địa danh các đảo, đá, bãi cạn, " +
    "bãi ngầm và một số đối tượng địa lý khác trên vùng biển Việt Nam, " +
    "Mục III (Đối tượng ngầm dưới đáy biển)",
  banHanh: "2024-12-15",
  datum: "VN-2000",
  layNgay: "2026-09-03",
  loai: LOAI,
  diaDanh,
};

mkdirSync(path.dirname(OUT), { recursive: true });
const json = JSON.stringify(out);
writeFileSync(OUT, json);

console.log(`ĐỊA DANH NGẦM — TT 33/2024/TT-BTNMT, Mục III`);
console.log(`đọc ${lines.length} dòng · xuất ${diaDanh.length} · bỏ ${boQua.length}`);
for (const [c, n] of Object.entries(demLoai)) if (n) console.log(`  ${c}: ${n}`);
if (boQua.length) {
  console.log("BỎ QUA:");
  for (const [l, ly] of boQua) console.log(`  [${ly}] ${l}`);
}
console.log(`đã ghi ${OUT} · ${(json.length / 1024).toFixed(1)} KB`);
