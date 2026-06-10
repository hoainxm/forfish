import type { Wholesaler } from "./types";

// Vựa / cơ sở thu mua hải sản BẮC + BẮC TRUNG BỘ — tổng hợp từ nguồn CÔNG KHAI
// (toplist.vn, mytour.vn, vinwonders.com, website doanh nghiệp, báo tỉnh).
// Tất cả là THAM KHẢO — vựa hay đổi số/đóng cửa, cần GỌI XÁC MINH trước khi giao dịch.
// KHÔNG bịa số/địa chỉ: field nào nguồn không nêu thì để trống.
//
// Nguồn chính đã dùng:
// - https://toplist.vn/top-list/dia-chi-mua-hai-san-gia-re-va-uy-tin-nhat-tai-quang-ninh-15865.htm
// - https://mytour.vn/vi/blog/bai-viet/top-8-dia-chi-mua-hai-san-chat-luong-tai-quang-ninh.html
// - https://goldencoto.vn/hai-san-quang-ninh/
// - https://toplist.vn/top-list/dia-chi-cung-cap-hai-san-tuoi-song-chat-luong-nhat-hai-phong-65695.htm
// - https://toplist.vn/top-list/dia-chi-mua-hai-san-tai-thai-binh-chat-luong-uy-tin-nhat-hien-nay-13249.htm
// - https://quyetquyenseafood.com/cau-chuyen-san-pham/
// - https://camerathanhhoa.org/shop/hai-san-sam-son/
// - https://vinascreal.com/thach-kim-seafood-processing-industrial-cluster-in-ha-tinh-province/

export const WHOLESALERS_BAC: Wholesaler[] = [
  // ===== QUẢNG NINH =====
  {
    id: "qn-hien-nhung",
    name: "Hải sản Hiền Nhung",
    kind: "vua",
    province: "Quảng Ninh",
    address: "Ki ốt 228-230 cạnh Chợ Hạ Long 1, P. Bạch Đằng, TP Hạ Long, Quảng Ninh",
    phone: "0905 568 899 / 0902 869 888 / 0913 505 871 / 0203 352 5799",
    species: ["cua", "ghẹ", "tôm", "mực", "cá"],
    source: "https://mytour.vn/vi/blog/bai-viet/top-8-dia-chi-mua-hai-san-chat-luong-tai-quang-ninh.html",
    note: "tham khảo, cần xác minh; vựa hải sản tươi sống chợ Hạ Long",
  },
  {
    id: "qn-van-don-399",
    name: "Hải sản Vân Đồn 399",
    kind: "vua",
    province: "Quảng Ninh",
    address: "399 Lý Anh Tông, TT Cái Rồng, Vân Đồn, Quảng Ninh",
    phone: "0985 286 522 / 0396 923 913",
    species: ["sá sùng", "mực", "ghẹ", "tôm", "hàu"],
    source: "https://mytour.vn/vi/blog/bai-viet/top-8-dia-chi-mua-hai-san-chat-luong-tai-quang-ninh.html",
    note: "tham khảo, cần xác minh; hải sản Vân Đồn - Quan Lạn - Cô Tô",
  },
  {
    id: "qn-vua-cai-rong",
    name: "Vựa hải sản Quảng Ninh (Cảng cá Cái Rồng)",
    kind: "vua",
    province: "Quảng Ninh",
    address: "Cảng cá Cái Rồng, TT Cái Rồng, Vân Đồn, Quảng Ninh",
    phone: "0962 945 536 / 0975 823 018",
    species: ["cá", "mực", "tôm", "ghẹ", "ngao", "tu hài"],
    source: "https://toplist.vn/top-list/dia-chi-mua-hai-san-gia-re-va-uy-tin-nhat-tai-quang-ninh-15865.htm",
    note: "tham khảo, cần xác minh; thu mua tại cảng cá Cái Rồng",
  },
  {
    id: "qn-quy-thuan",
    name: "Cửa hàng Hải sản Quý Thuận",
    kind: "co-so-thu-mua",
    province: "Quảng Ninh",
    address: "179 QL18, P. Đại Yên, TP Hạ Long, Quảng Ninh",
    phone: "0203 385 7033",
    source: "https://mytour.vn/vi/blog/bai-viet/top-8-dia-chi-mua-hai-san-chat-luong-tai-quang-ninh.html",
    note: "tham khảo, cần xác minh",
  },
  {
    id: "qn-an-du",
    name: "Hải sản An Dư",
    kind: "co-so-thu-mua",
    province: "Quảng Ninh",
    address: "149 Trần Hưng Đạo, TP Hạ Long, Quảng Ninh",
    source: "https://goldencoto.vn/hai-san-quang-ninh/",
    note: "tham khảo, cần xác minh; nguồn không nêu SĐT",
  },
  {
    id: "qn-thanh-tuan-thinh",
    name: "Hải sản Thanh Tuấn Thịnh",
    kind: "co-so-thu-mua",
    province: "Quảng Ninh",
    address: "3 Cao Sơn, TP Cẩm Phả, Quảng Ninh",
    source: "https://goldencoto.vn/hai-san-quang-ninh/",
    note: "tham khảo, cần xác minh; nguồn không nêu SĐT",
  },

  // ===== HẢI PHÒNG =====
  {
    id: "hp-hai-dang",
    name: "Siêu thị Hải sản Hải Đăng",
    kind: "co-so-thu-mua",
    province: "Hải Phòng",
    address: "19 Trần Khánh Dư, P. Ngô Quyền, Hải Phòng",
    phone: "0889 591 818",
    source: "https://toplist.vn/top-list/dia-chi-cung-cap-hai-san-tuoi-song-chat-luong-nhat-hai-phong-65695.htm",
    note: "tham khảo, cần xác minh",
  },
  {
    id: "hp-van-thin",
    name: "Hải sản Văn Thìn",
    kind: "vua",
    province: "Hải Phòng",
    address: "Số 1 Văn Cao, P. Gia Viên, Hải Phòng",
    phone: "0865 508 222 / 0865 509 222",
    species: ["cá", "tôm", "cua", "ghẹ", "mực"],
    source: "https://toplist.vn/top-list/dia-chi-cung-cap-hai-san-tuoi-song-chat-luong-nhat-hai-phong-65695.htm",
    note: "tham khảo, cần xác minh; bán buôn + bán lẻ hải sản vùng biển Hải Phòng",
  },
  {
    id: "hp-trung-kien",
    name: "Hải sản Trung Kiên",
    kind: "vua",
    province: "Hải Phòng",
    address: "82 Hoàng Thế Thiện, P. Ngô Quyền, Hải Phòng",
    phone: "0911 555 886",
    source: "https://toplist.vn/top-list/dia-chi-cung-cap-hai-san-tuoi-song-chat-luong-nhat-hai-phong-65695.htm",
    note: "tham khảo, cần xác minh; bán buôn + bán lẻ",
  },
  {
    id: "hp-vua-ca",
    name: "Vua Cá Hải Phòng",
    kind: "dai-ly",
    province: "Hải Phòng",
    address: "308-310-312 đường 208 An Đồng, P. An Hải, Hải Phòng",
    phone: "0904 456 086 / 0358 012 883",
    species: ["cá", "tôm", "cua", "mực"],
    source: "https://toplist.vn/top-list/dia-chi-cung-cap-hai-san-tuoi-song-chat-luong-nhat-hai-phong-65695.htm",
    note: "tham khảo, cần xác minh; sỉ và lẻ thủy hải sản tươi sống",
  },

  // ===== THÁI BÌNH / HƯNG YÊN =====
  // Vùng này hầu hết là CHỢ đầu mối (Diêm Điền, Nam Thịnh, Nam Thanh), ít DN
  // có đăng tên + SĐT công khai. Chỉ ghi cơ sở có TÊN riêng (không phải chợ).
  {
    id: "tb-hoa-ly",
    name: "Hải sản Hoa Ly",
    kind: "co-so-thu-mua",
    province: "Hưng Yên",
    address: "Khu 3, TT Diêm Điền, Thái Thụy, Thái Bình",
    source: "https://toplist.vn/top-list/dia-chi-mua-hai-san-tai-thai-binh-chat-luong-uy-tin-nhat-hien-nay-13249.htm",
    note: "tham khảo, cần xác minh; nguồn không nêu SĐT — gần cảng Diêm Điền",
  },
  {
    id: "tb-con-vanh",
    name: "Hải sản Cồn Vành",
    kind: "co-so-thu-mua",
    province: "Hưng Yên",
    address: "Đường 221A, Nam Trung, Tiền Hải, Thái Bình",
    source: "https://toplist.vn/top-list/dia-chi-mua-hai-san-tai-thai-binh-chat-luong-uy-tin-nhat-hien-nay-13249.htm",
    note: "tham khảo, cần xác minh; nguồn không nêu SĐT",
  },

  // ===== THANH HÓA =====
  {
    id: "th-dao-duc-cuong",
    name: "HKD Đào Đức Cường (Hải sản Sầm Sơn)",
    kind: "co-so-thu-mua",
    province: "Thanh Hóa",
    address: "SN 49 đường Dương Hòa 4, KP5, xã Thiệu Hóa, Thanh Hóa",
    phone: "0975 123 200 / 0916 343 363",
    species: ["cá", "tôm", "mực", "ghẹ"],
    source: "https://camerathanhhoa.org/shop/hai-san-sam-son/",
    note: "tham khảo, cần xác minh; cung cấp hải sản biển Sầm Sơn, giao TP Thanh Hóa",
  },

  // ===== NGHỆ AN =====
  {
    id: "na-quyet-quyen",
    name: "Hộ kinh doanh Phạm Văn Quyết (Hải sản Quyết Quyên)",
    kind: "co-so-thu-mua",
    province: "Nghệ An",
    address: "Số 144 đường Cửa Hội, khối Hải Giang 2, P. Cửa Lò, Nghệ An",
    phone: "0986 486 678",
    species: ["cá thu", "mực", "tôm"],
    source: "https://quyetquyenseafood.com/cau-chuyen-san-pham/",
    note: "tham khảo, cần xác minh; kho đông lạnh lớn vùng Cửa Hội - Cửa Lò, thu mua từ tàu, bán cho nhà hàng/khách sạn",
  },

  // ===== HÀ TĨNH =====
  // Cụm CN chế biến hải sản Thạch Kim (Lộc Hà) có ~13 kho đông thu mua từ ngư dân
  // tại cảng Cửa Sót. Báo nêu TÊN cơ sở nhưng KHÔNG có SĐT công khai.
  {
    id: "ht-lanh-quang",
    name: "Cơ sở kho đông lạnh Lành Quang",
    kind: "co-so-thu-mua",
    province: "Hà Tĩnh",
    address: "Cụm CN chế biến hải sản Thạch Kim, xã Lộc Hà (cảng cá Cửa Sót), Hà Tĩnh",
    species: ["mực", "cá", "tôm"],
    source: "https://vinascreal.com/thach-kim-seafood-processing-industrial-cluster-in-ha-tinh-province/",
    note: "tham khảo, cần xác minh; 5 kho ~100 tấn, thu mua hải sản tại cảng Cửa Sót — nguồn không nêu SĐT",
  },
  {
    id: "ht-vuong-truc",
    name: "Cơ sở kho đông lạnh Vượng Trực",
    kind: "co-so-thu-mua",
    province: "Hà Tĩnh",
    address: "Cụm CN chế biến hải sản Thạch Kim, xã Lộc Hà (cảng cá Cửa Sót), Hà Tĩnh",
    species: ["mực", "cá", "tôm"],
    source: "https://vinascreal.com/thach-kim-seafood-processing-industrial-cluster-in-ha-tinh-province/",
    note: "tham khảo, cần xác minh; 4 kho ~240 tấn, thu mua tại cảng Cửa Sót — nguồn không nêu SĐT",
  },
];
