import type { Wholesaler } from "./types";

// BỔ SUNG MIỀN TRUNG/NAM TRUNG BỘ — lấp các xã/cảng mà lượt đầu còn mỏng.
// Dữ liệu THẬT lấy từ đăng ký kinh doanh (ĐKKD) công khai + báo địa phương.
// KHÔNG bịa SĐT/địa chỉ. Hầu hết các trang danh bạ (masothue, tratencongty)
// hiển thị SĐT dưới dạng HÌNH ẢNH nên chỉ ghi được tên + địa chỉ ĐKKD; chỉ điền
// phone khi nguồn ghi rõ dạng text. Mỗi mục là THAM KHẢO — GỌI XÁC MINH trước khi
// giao dịch (vựa hay đổi số/đóng cửa).
//
// TÊN TỈNH SAU SÁP NHẬP 1/7/2025 (ghi tên cũ + xã/cảng trong note):
//   - Quảng Ngãi  = Quảng Ngãi + Kon Tum (cũ) → Sa Huỳnh/Đức Phổ, Sa Kỳ/Tịnh Kỳ vẫn thuộc Quảng Ngãi
//   - Khánh Hòa   = Khánh Hòa + Ninh Thuận (cũ) → Cà Ná, Đông Hải/Phan Rang nay thuộc Khánh Hòa
//   - Lâm Đồng    = Lâm Đồng + Bình Thuận + Đắk Nông (cũ) → La Gi (Phước Hội, Tân Hải) nay thuộc Lâm Đồng
//
// NGUỒN:
//   - https://www.tratencongty.com/tinh-quang-ngai/thi-xa-duc-pho/
//   - https://www.tratencongty.com/tinh-ninh-thuan/huyen-thuan-nam/xa-ca-na/
//   - https://www.tratencongty.com/tinh-ninh-thuan/thanh-pho-phan-rang-thap-cham/phuong-dong-hai/
//   - https://www.tratencongty.com/tinh-binh-thuan/thi-xa-la-gi/xa-tan-hai/
//   - https://www.tratencongty.com/company/103cea5c7-cong-ty-tnhh-che-bien-hai-san-phu-tan/
//   - https://nuocmamtrungnu.com/  (nước mắm Cà Ná)
//   - https://www.facebook.com/RFAVietnam/posts/... (cảng cá Tịnh Kỳ — đầu nậu)

export const WHOLESALERS_BS_TRUNG: Wholesaler[] = [
  // ===== QUẢNG NGÃI — ĐỨC PHỔ / SA HUỲNH (cảng cá Sa Huỳnh, Phổ Thạnh) =====
  {
    id: "bst-qng-vanphat",
    name: "Công ty TNHH MTV Nông Lâm Thủy Sản Vạn Phát",
    kind: "co-so-thu-mua",
    province: "Quảng Ngãi",
    address: "Xóm 1, thôn Tân Diêm, xã Phổ Thạnh, TX. Đức Phổ, Quảng Ngãi",
    species: ["cá", "hải sản"],
    source: "https://www.tratencongty.com/tinh-quang-ngai/thi-xa-duc-pho/",
    note: "Tham khảo, cần xác minh. Khu vực Sa Huỳnh (xã Phổ Thạnh cũ), gần cảng cá Sa Huỳnh. SĐT trên danh bạ ở dạng ảnh.",
  },
  {
    id: "bst-qng-htxphothanh",
    name: "HTX Dịch vụ và Khai thác Hải sản Xa bờ xã Phổ Thạnh",
    kind: "co-so-thu-mua",
    province: "Quảng Ngãi",
    address: "Xã Phổ Thạnh, TX. Đức Phổ, Quảng Ngãi",
    species: ["hải sản", "cá"],
    source: "https://www.tratencongty.com/tinh-quang-ngai/thi-xa-duc-pho/",
    note: "Tham khảo, cần xác minh. HTX dịch vụ hậu cần/khai thác tại Sa Huỳnh; người đại diện Phan Hiển. SĐT chưa công khai dạng text.",
  },
  {
    id: "bst-qng-diepchieu",
    name: "Công ty TNHH MTV Thủy sản Diệp Chiêu",
    kind: "co-so-thu-mua",
    province: "Quảng Ngãi",
    address: "Tổ dân phố Du Quang, phường Phổ Quang, TX. Đức Phổ, Quảng Ngãi",
    species: ["thủy sản"],
    source: "https://www.tratencongty.com/tinh-quang-ngai/thi-xa-duc-pho/",
    note: "Tham khảo, cần xác minh. Đức Phổ (vùng cửa biển Mỹ Á/Sa Huỳnh); người đại diện Lê Ngọc Diệp.",
  },

  // ===== QUẢNG NGÃI — TỊNH KỲ (cảng cá Tịnh Kỳ, gần Sa Kỳ) =====
  {
    id: "bst-qng-tinhky-noioi",
    name: "Vựa thu mua cá Nguyễn Thị Ơi (đầu nậu cảng Tịnh Kỳ)",
    kind: "nau-vua",
    province: "Quảng Ngãi",
    address: "Cảng cá Tịnh Kỳ, xã Tịnh Kỳ, TP. Quảng Ngãi",
    species: ["cá cơm"],
    source: "https://danviet.vn/ban-hai-san-cho-dau-nau-phai-chiu-nhieu-he-luy-tu-luat-rieng-7777926731.htm",
    note: "Tham khảo, cần xác minh. Một trong những chủ vựa thu mua cá lớn tại cảng Tịnh Kỳ (gần cảng Sa Kỳ); chủ yếu mua cá cơm muối làm mắm. Tên nêu trên báo, SĐT chưa công khai.",
  },

  // ===== LÂM ĐỒNG (Bình Thuận cũ) — LA GI: PHƯỚC HỘI =====
  {
    id: "bst-lgi-phutan",
    name: "Công ty TNHH Chế biến Hải sản Phú Tân (FUTACO)",
    kind: "co-so-thu-mua",
    province: "Lâm Đồng",
    address: "Đường Đinh Bộ Lĩnh, KP 8, P. Phước Hội, TX. La Gi, tỉnh Bình Thuận (cũ)",
    species: ["hải sản", "cá", "thủy sản chế biến"],
    source: "https://www.tratencongty.com/company/103cea5c7-cong-ty-tnhh-che-bien-hai-san-phu-tan/",
    note: "Tham khảo, cần xác minh. La Gi nay thuộc Lâm Đồng. Ngành C1020 chế biến/bảo quản thủy sản, hoạt động từ 1999; người đại diện Nguyễn Anh Dũng. SĐT trên danh bạ ở dạng ảnh.",
  },

  // ===== LÂM ĐỒNG (Bình Thuận cũ) — LA GI: TÂN HẢI =====
  {
    id: "bst-lgi-lagisea",
    name: "Công ty TNHH Sản xuất Thương mại LAGISEA",
    kind: "co-so-thu-mua",
    province: "Lâm Đồng",
    address: "73 Lê Thánh Tôn, xã Tân Hải, TX. La Gi, tỉnh Bình Thuận (cũ)",
    species: ["hải sản"],
    source: "https://www.tratencongty.com/tinh-binh-thuan/thi-xa-la-gi/xa-tan-hai/",
    note: "Tham khảo, cần xác minh. MST 0300644863; người đại diện Nguyễn Đỗ Minh Trí. La Gi nay thuộc Lâm Đồng.",
  },
  {
    id: "bst-lgi-hungthanh",
    name: "Công ty TNHH Hải sản Hưng Thành",
    kind: "co-so-thu-mua",
    province: "Lâm Đồng",
    address: "442A Tôn Đức Thắng, xã Tân Phước, TX. La Gi, tỉnh Bình Thuận (cũ)",
    species: ["hải sản"],
    source: "https://www.tratencongty.com/company/103dd1b55-cong-ty-tnhh-hai-san-hung-thanh/",
    note: "Tham khảo, cần xác minh. Vùng La Gi (Tân Hải/Tân Phước), nay thuộc Lâm Đồng. Hoạt động từ 2019.",
  },

  // ===== KHÁNH HÒA (Ninh Thuận cũ) — CÀ NÁ (cảng cá Cà Ná) =====
  {
    id: "bst-cana-longhung",
    name: "Công ty TNHH Chế biến Thủy sản Long Hưng",
    kind: "co-so-thu-mua",
    province: "Khánh Hòa",
    address: "Thôn Lạc Sơn 1, xã Cà Ná, H. Thuận Nam, tỉnh Ninh Thuận (cũ)",
    species: ["cá", "thủy sản chế biến"],
    source: "https://www.tratencongty.com/tinh-ninh-thuan/huyen-thuan-nam/xa-ca-na/",
    note: "Tham khảo, cần xác minh. Cà Ná nay thuộc Khánh Hòa; người đại diện Võ Thị Tú Oanh.",
  },
  {
    id: "bst-cana-hongtham",
    name: "Công ty TNHH Hải sản Hồng Thắm Ninh Thuận",
    kind: "co-so-thu-mua",
    province: "Khánh Hòa",
    address: "Thôn Lạc Sơn 2, xã Cà Ná, H. Thuận Nam, tỉnh Ninh Thuận (cũ)",
    species: ["hải sản", "cá"],
    source: "https://www.tratencongty.com/tinh-ninh-thuan/huyen-thuan-nam/xa-ca-na/",
    note: "Tham khảo, cần xác minh. Cà Ná nay thuộc Khánh Hòa; người đại diện Nguyễn Thị Hồng Thắm.",
  },
  {
    id: "bst-cana-htxocop",
    name: "HTX Dịch vụ Nông nghiệp Làng nghề Nước mắm Cà Ná OCOP",
    kind: "co-so-thu-mua",
    province: "Khánh Hòa",
    address: "AH1, thôn Lạc Sơn 2, xã Cà Ná, H. Thuận Nam, tỉnh Ninh Thuận (cũ)",
    species: ["cá cơm", "nước mắm"],
    source: "https://www.tratencongty.com/tinh-ninh-thuan/huyen-thuan-nam/xa-ca-na/",
    note: "Tham khảo, cần xác minh. Thu mua cá cơm làm nước mắm; người đại diện Trịnh Nguyễn Đoàn. Cà Ná nay thuộc Khánh Hòa.",
  },
  {
    id: "bst-cana-thuanhung",
    name: "Cơ sở/Nước mắm Thuận Hưng — xưởng Cà Ná",
    kind: "co-so-thu-mua",
    province: "Khánh Hòa",
    address: "Thôn Lạc Nghiệp, xã Cà Ná, H. Thuận Nam, tỉnh Ninh Thuận (cũ)",
    phone: "0911301828",
    species: ["cá cơm", "nước mắm"],
    source: "https://nuocmamtrungnu.com/nuoc-mam-ca-na-chi-ca-com-tuoi-va-muoi-bien-tu-nhien/",
    note: "Tham khảo, cần xác minh. Xưởng chế biến cá cơm/nước mắm tại Cà Ná (nay thuộc Khánh Hòa). SĐT theo trang giới thiệu; còn số bàn 028 38767358.",
  },

  // ===== KHÁNH HÒA (Ninh Thuận cũ) — ĐÔNG HẢI / PHAN RANG (cảng cá Đông Hải) =====
  {
    id: "bst-dh-donghai",
    name: "Công ty TNHH MTV Chế biến Thủy sản Đông Hải",
    kind: "co-so-thu-mua",
    province: "Khánh Hòa",
    address: "Cảng cá Đông Hải, P. Đông Hải, TP. Phan Rang - Tháp Chàm, tỉnh Ninh Thuận (cũ)",
    species: ["cá", "thủy sản"],
    source: "https://www.tratencongty.com/tinh-ninh-thuan/thanh-pho-phan-rang-thap-cham/phuong-dong-hai/",
    note: "Tham khảo, cần xác minh. Ngay tại cảng cá Đông Hải; người đại diện Huỳnh Hữu Lộc. Phan Rang nay thuộc Khánh Hòa.",
  },
  {
    id: "bst-dh-quynhquyen",
    name: "Doanh nghiệp Tư nhân Sản xuất và Thương mại Quỳnh Quyên",
    kind: "co-so-thu-mua",
    province: "Khánh Hòa",
    address: "Cảng cá Đông Hải, P. Đông Hải, TP. Phan Rang - Tháp Chàm, tỉnh Ninh Thuận (cũ)",
    species: ["cá", "thủy sản"],
    source: "https://www.tratencongty.com/tinh-ninh-thuan/thanh-pho-phan-rang-thap-cham/phuong-dong-hai/",
    note: "Tham khảo, cần xác minh. Tại cảng cá Đông Hải; người đại diện Nguyễn Văn Tuấn. Phan Rang nay thuộc Khánh Hòa.",
  },
  {
    id: "bst-dh-ngochoang",
    name: "Công ty TNHH SX TM DV Thủy Hải sản Ngọc Hoàng",
    kind: "co-so-thu-mua",
    province: "Khánh Hòa",
    address: "Số 30/3 Bạch Đằng, KP 4, P. Đông Hải, TP. Phan Rang - Tháp Chàm, tỉnh Ninh Thuận (cũ)",
    species: ["hải sản", "cá"],
    source: "https://www.tratencongty.com/tinh-ninh-thuan/thanh-pho-phan-rang-thap-cham/phuong-dong-hai/",
    note: "Tham khảo, cần xác minh. Người đại diện Mã Thái Hùng. Phan Rang nay thuộc Khánh Hòa.",
  },
  {
    id: "bst-dh-thanhphat",
    name: "Công ty TNHH SX Chế biến Thủy Hải sản và Thương mại Thanh Phát",
    kind: "co-so-thu-mua",
    province: "Khánh Hòa",
    address: "Số 30/3 Bạch Đằng, KP 4, P. Đông Hải, TP. Phan Rang - Tháp Chàm, tỉnh Ninh Thuận (cũ)",
    species: ["hải sản", "cá"],
    source: "https://www.tratencongty.com/tinh-ninh-thuan/thanh-pho-phan-rang-thap-cham/phuong-dong-hai/",
    note: "Tham khảo, cần xác minh. Người đại diện Vũ Quang Viên. Phan Rang nay thuộc Khánh Hòa.",
  },
  {
    id: "bst-dh-giakhanh",
    name: "Công ty TNHH Hải sản Khô Gia Khanh",
    kind: "co-so-thu-mua",
    province: "Khánh Hòa",
    address: "96/11/2 KP 10, đường Tân Thành, P. Đông Hải, TP. Phan Rang - Tháp Chàm, tỉnh Ninh Thuận (cũ)",
    species: ["hải sản khô", "cá"],
    source: "https://www.tratencongty.com/tinh-ninh-thuan/thanh-pho-phan-rang-thap-cham/phuong-dong-hai/",
    note: "Tham khảo, cần xác minh. Hải sản khô; người đại diện Nguyễn Gia Khanh. Phan Rang nay thuộc Khánh Hòa.",
  },
];
