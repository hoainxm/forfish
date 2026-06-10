import type { Wholesaler } from "./types";

// BỔ SUNG GAP — vựa / cơ sở thu mua thủy sản TẠI CHỖ ở các hub Tây Nam Bộ mà
// đợt 1 còn mỏng: Cà Mau (Sông Đốc, Năm Căn, Rạch Gốc/Ngọc Hiển) và Kiên Giang
// (Tắc Cậu — Châu Thành). Ưu tiên DN/HTX/cơ sở ĐĂNG KÝ TẠI CẢNG/XÃ ở địa phương,
// KHÔNG phải đầu mối bán sỉ ở TP lớn.
//
// Tên + địa chỉ + SĐT là dữ liệu THẬT lấy từ NGUỒN CÔNG KHAI (website DN, masothue/
// thuvienphapluat, Trang Vàng, cổng tỉnh, báo địa phương). KHÔNG bịa SĐT/địa chỉ —
// thiếu thì để trống. Mọi mục là THAM KHẢO, GỌI XÁC MINH trước khi giao dịch
// (vựa/cơ sở hay đổi số, đổi chủ, đóng cửa).
//
// Địa giới: dùng tên tỉnh SAU SÁP NHẬP 2025 (Cà Mau giữ tên; Kiên Giang -> An Giang);
// tên huyện/xã/cảng cũ ghi trong note để bà con dễ tìm.
//
// CÒN TRỐNG (chưa có cơ sở tại chỗ kèm SĐT/địa chỉ kiểm chứng được công khai):
//   - Bến Tre — Bình Đại (cảng Bình Thắng) & Ba Tri (cảng/Tiệm Tôm, An Thủy):
//     báo địa phương có nêu "5 vựa tại cảng Bình Thắng" nhưng KHÔNG công khai
//     tên + SĐT từng vựa; các listing "vựa hải sản Bến Tre" đa phần ở Châu Thành /
//     TP Bến Tre (đầu mối nội tỉnh) nên không đưa vào để tránh độn.

export const WHOLESALERS_BS_NAM: Wholesaler[] = [
  // ============== Cà Mau — Sông Đốc (TT. Sông Đốc, Trần Văn Thời cũ) ==============
  {
    id: "bsn-cm-quocdat",
    name: "Công ty TNHH MTV Quốc Đạt (Quốc Đạt Seafood)",
    kind: "co-so-thu-mua",
    province: "Cà Mau",
    address: "Ấp 11, xã Sông Đốc (TT. Sông Đốc, Trần Văn Thời cũ), Cà Mau",
    phone: "0919342769",
    species: ["cá biển", "mực", "thủy sản"],
    source: "https://quocdatseafood.com/ve-chung-toi-a1.html",
    note: "tham khảo, cần xác minh. Cơ sở thu mua/chế biến tại cảng Sông Đốc, có hơn 7 tàu thu mua, ~60 tấn/ngày. Tỉnh cũ: Cà Mau (Sông Đốc, Trần Văn Thời).",
  },
  {
    id: "bsn-cm-minhphat-songdoc",
    name: "Công ty TNHH Minh Phát Cà Mau (Nhà máy bột cá Sông Đốc)",
    kind: "co-so-thu-mua",
    province: "Cà Mau",
    address: "Khóm 12, TT. Sông Đốc, Trần Văn Thời, Cà Mau",
    phone: "02903890333",
    species: ["cá biển", "cá tạp", "bột cá"],
    source: "https://www.minhphatcamau.com/",
    note: "tham khảo, cần xác minh. SĐT phụ/hotline 0913975080. Nhà máy gần cửa biển cảng cá Sông Đốc, thu mua cá làm bột cá. Tỉnh: Cà Mau.",
  },

  // ============== Cà Mau — Năm Căn (TT. Năm Căn / xã Đất Mới) ==============
  {
    id: "bsn-cm-seanamico",
    name: "Công ty CP Xuất nhập khẩu Thủy sản Năm Căn (Seanamico)",
    kind: "co-so-thu-mua",
    province: "Cà Mau",
    address: "Ấp 3, xã Đất Mới (Năm Căn cũ), Cà Mau",
    phone: "02903877146",
    species: ["tôm sú", "tôm thẻ", "tôm"],
    source: "https://seanamico.com.vn/contact.html",
    note: "tham khảo, cần xác minh. SĐT phụ 02903876223. DN thu mua/chế biến tôm tại vùng Năm Căn (mã CK SNC). Tỉnh cũ: Cà Mau (huyện Năm Căn). Trụ sở cũ ghi Khóm 3, TT. Năm Căn.",
  },

  // ============== Cà Mau — Rạch Gốc / Ngọc Hiển (làng nghề tôm khô) ==============
  {
    id: "bsn-cm-tanphatloi",
    name: "HTX Sản xuất Tôm khô Tân Phát Lợi",
    kind: "co-so-thu-mua",
    province: "Cà Mau",
    address: "Ấp Tân Lập, xã Tân Ân Tây, Ngọc Hiển (vùng Rạch Gốc), Cà Mau",
    phone: "0913622425",
    species: ["tôm khô", "tôm đất", "cá khô"],
    source: "https://tomkhotanphatloicamau.com/gioi-thieu/",
    note: "tham khảo, cần xác minh. Giám đốc Bùi Văn Chương. Cơ sở thu mua tôm tươi + chế biến tôm khô Rạch Gốc (OCOP); SĐT bán hàng Madeincamau 0813665858. Tỉnh: Cà Mau (Ngọc Hiển).",
  },

  // ============== Kiên Giang — Tắc Cậu (xã Bình An, Châu Thành; nay An Giang) ====
  {
    id: "bsn-kg-taccau",
    name: "Công ty CP Thủy sản Tắc Cậu",
    kind: "co-so-thu-mua",
    province: "An Giang",
    address: "Khu cảng cá Tắc Cậu, ấp Minh Phong, xã Bình An, Châu Thành (Kiên Giang cũ), An Giang",
    species: ["cá biển", "surimi", "chả cá"],
    source: "https://trangvangdoanhnghiep.vn/1700579810-cong-ty-co-phan-thuy-san-tac-cau-cty/",
    note: "tham khảo, cần xác minh. MST 1700579810, thuộc Tập đoàn Phú Cường. Thu mua cá tươi từ ngư dân ~50-100 tấn/ngày tại cảng Tắc Cậu; SĐT không đăng công khai. Tỉnh cũ: Kiên Giang (Châu Thành).",
  },
  {
    id: "bsn-kg-trungson-taccau",
    name: "Chi nhánh Công ty CP Chế biến Thủy sản Trung Sơn — Tắc Cậu",
    kind: "co-so-thu-mua",
    province: "An Giang",
    address: "Khu cảng cá Tắc Cậu, xã Bình An, Châu Thành (Kiên Giang cũ), An Giang",
    species: ["tôm", "thủy sản"],
    source: "https://thuvienphapluat.vn/ma-so-thue/chi-nhanh-cong-ty-co-phan-che-bien-thuy-san-trung-son-tac-cau-mst-1701608687-001.html",
    note: "tham khảo, cần xác minh. MST 1701608687-001. Chi nhánh chế biến/thu mua thủy sản tại cảng Tắc Cậu; SĐT không đăng công khai. Tỉnh cũ: Kiên Giang (Châu Thành).",
  },
];
