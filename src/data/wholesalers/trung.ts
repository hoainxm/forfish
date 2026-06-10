import type { Wholesaler } from "./types";

// Vựa / cơ sở thu mua hải sản — MIỀN TRUNG. Dữ liệu THẬT tổng hợp từ nguồn công
// khai (Trang Vàng, web/Facebook cơ sở, báo, VASEP). KHÔNG bịa SĐT/địa chỉ.
// Mỗi mục là THAM KHẢO — bà con GỌI XÁC MINH trước khi giao dịch (vựa hay đổi
// số/đóng cửa, mùa cá ngừ giá biến động).
//
// LƯU Ý TÊN TỈNH SAU SÁP NHẬP 1/7/2025:
//   - Đà Nẵng = Đà Nẵng + Quảng Nam (cũ)
//   - Quảng Ngãi = Quảng Ngãi + Kon Tum (cũ)
//   - Gia Lai = Gia Lai + Bình Định (cũ)  → Quy Nhơn nay thuộc Gia Lai
//   - Đắk Lắk = Đắk Lắk + Phú Yên (cũ)    → Tuy Hòa nay thuộc Đắk Lắk
//   - Khánh Hòa = Khánh Hòa + Ninh Thuận (cũ)
//   - Lâm Đồng = Lâm Đồng + Bình Thuận + Đắk Nông (cũ) → Phan Thiết/La Gi nay thuộc Lâm Đồng
// Ghi tên tỉnh mới + chú thích tỉnh cũ/cảng trong note để bà con dễ tra.
// Cá ngừ đại dương là loài chủ lực vùng này — ưu tiên vựa/cơ sở thu mua cá ngừ.

export const WHOLESALERS_TRUNG: Wholesaler[] = [
  // ===== ĐÀ NẴNG (cảng Thọ Quang) — gồm Quảng Nam cũ =====
  {
    id: "trung-dn-thuanphuoc",
    name: "Công ty CP Thủy sản & Thương mại Thuận Phước",
    kind: "co-so-thu-mua",
    province: "Đà Nẵng",
    address: "2 Bùi Quốc Hưng, P. Thọ Quang, Q. Sơn Trà, Đà Nẵng",
    phone: "0236 3920920",
    species: ["tôm", "cá", "thủy sản đông lạnh"],
    source: "https://trangvangvietnam.com/tagprovince/40102060/cong-ty-che-bien-thuy-hai-san-o-tai-tp.-da-nang.html",
    note: "Tham khảo, cần xác minh. DN chế biến/XK lớn tại KCN thủy sản Thọ Quang.",
  },
  {
    id: "trung-dn-mientrung",
    name: "Công ty CP Xuất nhập khẩu Thủy sản Miền Trung (Seaprodex Đà Nẵng)",
    kind: "co-so-thu-mua",
    province: "Đà Nẵng",
    address: "Số 1 Bùi Quốc Hưng, P. Thọ Quang, Q. Sơn Trà, Đà Nẵng",
    phone: "0236 3823041",
    species: ["cá", "tôm", "thủy sản đông lạnh"],
    source: "https://trangvangvietnam.com/tagprovince/40102060/cong-ty-che-bien-thuy-hai-san-o-tai-tp.-da-nang.html",
    note: "Tham khảo, cần xác minh. DN thu mua/chế biến XK.",
  },
  {
    id: "trung-dn-thuysandanang",
    name: "Công ty CP Thủy sản Đà Nẵng (Danafish)",
    kind: "co-so-thu-mua",
    province: "Đà Nẵng",
    address: "Nại Hưng, P. Nại Hiên Đông, Q. Sơn Trà, Đà Nẵng",
    phone: "0236 3916665",
    species: ["cá", "thủy sản đông lạnh"],
    source: "https://danafish.com/",
    note: "Tham khảo, cần xác minh.",
  },
  {
    id: "trung-dn-tuanloc",
    name: "Công ty TNHH MTV Hải sản Tuấn Lộc",
    kind: "co-so-thu-mua",
    province: "Đà Nẵng",
    address: "22 Hồng Thái, Q. Liên Chiểu, Đà Nẵng",
    phone: "0236 3741956",
    species: ["hải sản"],
    source: "https://trangvangvietnam.com/tagprovince/40102060/cong-ty-che-bien-thuy-hai-san-o-tai-tp.-da-nang.html",
    note: "Tham khảo, cần xác minh.",
  },
  {
    id: "trung-dn-conhon",
    name: "Hải Sản Cô Nhơn (tươi sống)",
    kind: "vua",
    province: "Đà Nẵng",
    address: "31 Hoàng Sa, P. Thọ Quang, Q. Sơn Trà, Đà Nẵng",
    phone: "0772 449 552",
    species: ["cá", "tôm", "mực", "cua"],
    source: "https://www.top10danang.com/cang-ca-tho-quang",
    note: "Tham khảo, cần xác minh. Vựa gần cảng cá Thọ Quang.",
  },

  // ===== QUẢNG NAM (nay thuộc Đà Nẵng) =====
  {
    id: "trung-qnam-vuabien",
    name: "Hải sản tươi sống Vua Biển (Tam Kỳ)",
    kind: "vua",
    province: "Đà Nẵng",
    address: "Đường Trần Xuân Soạn, P. An Xuân, Tam Kỳ (Quảng Nam cũ)",
    phone: "0934 955 695",
    species: ["cá", "ốc", "nghêu", "sò"],
    source: "https://quangnamtoplist.com/top-5-vua-hai-san-o-quang-nam-tuoi-ngon-gia-re/",
    note: "Tham khảo, cần xác minh. Quảng Nam cũ, nay thuộc Đà Nẵng.",
  },

  // ===== QUẢNG NGÃI (Sa Kỳ, Sa Huỳnh) =====
  {
    id: "trung-qng-thanhhao",
    name: "Công ty TNHH Thủy sản Thanh Hào",
    kind: "co-so-thu-mua",
    province: "Quảng Ngãi",
    address: "Quảng Ngãi (xem masothue để biết địa chỉ chi tiết)",
    phone: "",
    species: ["thủy sản"],
    source: "https://masothue.com/3500589389-cong-ty-tnhh-thuy-san-thanh-hao",
    note: "Tham khảo, cần xác minh. MST 3500589389; chưa rõ SĐT công khai — tra masothue/gọi xác minh. Vùng Quảng Ngãi dữ liệu mỏng.",
  },
  {
    id: "trung-qng-hoathang",
    name: "Công ty TNHH Thủy sản Hòa Thắng",
    kind: "co-so-thu-mua",
    province: "Quảng Ngãi",
    address: "Quảng Ngãi (xem masothue để biết địa chỉ chi tiết)",
    phone: "",
    species: ["thủy sản"],
    source: "https://masothue.com/3500810424-cong-ty-tnhh-thuy-san-hoa-thang",
    note: "Tham khảo, cần xác minh. MST 3500810424; chưa rõ SĐT công khai — tra masothue. Vùng Quảng Ngãi dữ liệu mỏng.",
  },

  // ===== BÌNH ĐỊNH / QUY NHƠN (nay thuộc Gia Lai) — cá ngừ đại dương =====
  {
    id: "trung-bd-bidifisco",
    name: "Công ty CP Thủy sản Bình Định (BIDIFISCO)",
    kind: "co-so-thu-mua",
    province: "Gia Lai",
    address: "2D Trần Hưng Đạo, TP. Quy Nhơn (Bình Định cũ)",
    phone: "0903 510 937",
    species: ["cá ngừ đại dương", "cá kiếm", "mahi mahi", "cá ngừ vằn"],
    source: "https://trangvangvietnam.com/listings/690513/cong-ty-co-phan-thuy-san-binh-dinh-(bidifisco).html",
    note: "Tham khảo, cần xác minh. MST 4100301209. DN thu mua/XK cá ngừ lớn nhất Quy Nhơn. Tel cố định: 0256 3892004. Bình Định cũ, nay thuộc Gia Lai.",
  },
  {
    id: "trung-bd-giahung",
    name: "Hải sản Gia Hưng (cá ngừ đại dương)",
    kind: "vua",
    province: "Gia Lai",
    address: "323 Lê Thanh Nghị, P. Đống Đa, TP. Quy Nhơn (Bình Định cũ)",
    phone: "0906 442 119",
    species: ["cá ngừ đại dương", "hải sản"],
    source: "https://binhdinhtoplist.com/ca-ngu-dai-duong-binh-dinh/",
    note: "Tham khảo, cần xác minh. CS2: 15 Biên Cương, P. Ngô Mây, Quy Nhơn. Bình Định cũ, nay thuộc Gia Lai.",
  },
  {
    id: "trung-bd-syphat",
    name: "Đại lý Cá Ngừ Đại Dương Sỹ Phát",
    kind: "dai-ly",
    province: "Gia Lai",
    address: "52/2B Biên Cương, P. Ngô Mây, TP. Quy Nhơn (Bình Định cũ)",
    phone: "0911 325 958",
    species: ["cá ngừ đại dương"],
    source: "https://binhdinhtoplist.com/ca-ngu-dai-duong-binh-dinh/",
    note: "Tham khảo, cần xác minh. Bình Định cũ, nay thuộc Gia Lai.",
  },
  {
    id: "trung-bd-anhdung",
    name: "Hải sản Anh Dũng",
    kind: "vua",
    province: "Gia Lai",
    address: "216 Xuân Diệu, P. Trần Phú, TP. Quy Nhơn (Bình Định cũ)",
    phone: "0932 420 479",
    species: ["cá ngừ", "hải sản"],
    source: "https://binhdinhtoplist.com/ca-ngu-dai-duong-binh-dinh/",
    note: "Tham khảo, cần xác minh. Bình Định cũ, nay thuộc Gia Lai.",
  },

  // ===== PHÚ YÊN / TUY HÒA (nay thuộc Đắk Lắk) — cá ngừ đại dương =====
  {
    id: "trung-py-cangu",
    name: "Cá Ngừ Đại Dương Phú Yên",
    kind: "co-so-thu-mua",
    province: "Đắk Lắk",
    address: "Cảng cá Đông Tác, P. Phú Đông, TP. Tuy Hòa (Phú Yên cũ)",
    phone: "0908 348 812",
    species: ["cá ngừ đại dương"],
    source: "https://cangudaiduongphuyen.com/",
    note: "Tham khảo, cần xác minh. Tại cảng cá Đông Tác. Phú Yên cũ, nay thuộc Đắk Lắk.",
  },
  {
    id: "trung-py-hungphong",
    name: "Thủy sản Hùng Phong",
    kind: "co-so-thu-mua",
    province: "Đắk Lắk",
    address: "121 Lê Duẩn, P. 7, TP. Tuy Hòa (Phú Yên cũ)",
    phone: "098 777 9900",
    species: ["cá ngừ đại dương", "hải sản"],
    source: "https://thuysanhungphong.com/",
    note: "Tham khảo, cần xác minh. SĐT phụ: 033 929 7777. Phú Yên cũ, nay thuộc Đắk Lắk.",
  },
  {
    id: "trung-py-tuyhoafoods",
    name: "Tuy Hòa Foods (cá ngừ đại dương)",
    kind: "co-so-thu-mua",
    province: "Đắk Lắk",
    address: "Đường 3/2, TP. Tuy Hòa (Phú Yên cũ)",
    phone: "0935 46 12 99",
    species: ["cá ngừ đại dương"],
    source: "https://tuyhoafoods.vn/products/ca-ngu-dai-duong-nguyen-con/",
    note: "Tham khảo, cần xác minh. Phú Yên cũ, nay thuộc Đắk Lắk.",
  },

  // ===== KHÁNH HÒA (Hòn Rớ, Nha Trang) — gồm Ninh Thuận cũ — cá ngừ =====
  {
    id: "trung-kh-khaspexco",
    name: "Công ty CP Xuất khẩu Thủy sản Khánh Hòa (KHASPEXCO)",
    kind: "co-so-thu-mua",
    province: "Khánh Hòa",
    address: "50 Võ Thị Sáu, P. Vĩnh Trường, TP. Nha Trang, Khánh Hòa",
    phone: "0258 3881161",
    species: ["cá ngừ đại dương", "hải sản đông lạnh"],
    source: "https://vasep.com.vn/hoi-vien/thong-tin/cong-ty-cp-xk-thuy-san-khanh-hoa-217.html",
    note: "Tham khảo, cần xác minh. DN thu mua/XK. Gần khu cảng Vĩnh Trường/Hòn Rớ.",
  },
  {
    id: "trung-kh-hoanghai",
    name: "Công ty TNHH Hoàng Hải (cá ngừ đại dương tươi XK)",
    kind: "co-so-thu-mua",
    province: "Khánh Hòa",
    address: "TP. Nha Trang, Khánh Hòa",
    phone: "0258 3884337",
    species: ["cá ngừ đại dương"],
    source: "https://mytour.vn/vi/blog/bai-viet/top-10-cong-ty-thuy-hai-san-che-bien-va-kinh-doanh-tai-khanh-hoa-mytour.html",
    note: "Tham khảo, cần xác minh. Chuyên cá ngừ đại dương tươi XK đường hàng không. Địa chỉ/SĐT cần gọi xác minh.",
  },
  {
    id: "trung-kh-cangu-vn",
    name: "Công ty TNHH Cá Ngừ Việt Nam (Tuna Vietnam)",
    kind: "co-so-thu-mua",
    province: "Khánh Hòa",
    address: "KCN Suối Dầu, huyện Cam Lâm, Khánh Hòa",
    phone: "",
    species: ["cá ngừ đại dương"],
    source: "https://vnr500.vn/Thong-tin-doanh-nghiep/CONG-TY-TNHH-CA-NGU-VIET-NAM-Chart--43746-2020.html",
    note: "Tham khảo, cần xác minh. Chuyên cá ngừ; SĐT chưa rõ công khai — tra thêm/gọi xác minh.",
  },
  {
    id: "trung-kh-hoanhatrang",
    name: "Hải Sản Hòa Nha Trang (vựa cảng Hòn Rớ)",
    kind: "vua",
    province: "Khánh Hòa",
    address: "Cảng Hòn Rớ, xã Phước Đồng, TP. Nha Trang, Khánh Hòa",
    phone: "0387 899 863",
    species: ["cá", "tôm", "cua", "mực", "nghêu"],
    source: "https://www.haisanhoanhatrang.com/p/gioi-thieu-vua-hai-san-tuoi-song-hoa.html",
    note: "Tham khảo, cần xác minh. Vựa tại cảng cá Hòn Rớ.",
  },

  // ===== NINH THUẬN (Phan Rang, Cà Ná) — nay thuộc Khánh Hòa =====
  {
    id: "trung-nt-damnai",
    name: "Chợ hải sản Đầm Nại (chợ Dư Khánh) — đầu mối cá",
    kind: "vua",
    province: "Khánh Hòa",
    address: "Đường Ngô Gia Tự, TP. Phan Rang - Tháp Chàm (Ninh Thuận cũ)",
    phone: "",
    species: ["cá", "hải sản"],
    source: "https://phanrangninhthuan.vn/cho-hai-san/",
    note: "Tham khảo, cần xác minh. Chợ đầu mối gần cảng, nhiều nậu/vựa; chưa có SĐT cụ thể công khai. Ninh Thuận cũ, nay thuộc Khánh Hòa. Vùng dữ liệu mỏng.",
  },

  // ===== BÌNH THUẬN (Phan Thiết, La Gi) — nay thuộc Lâm Đồng =====
  {
    id: "trung-bt-mytam",
    name: "Vựa Hải Sản Mỹ Tâm Phan Thiết",
    kind: "vua",
    province: "Lâm Đồng",
    address: "310 Đặng Văn Lãnh, TP. Phan Thiết (Bình Thuận cũ)",
    phone: "0367 996 390",
    species: ["cá", "tôm", "mực", "cua", "ghẹ"],
    source: "https://www.haisanphanthiett.com/",
    note: "Tham khảo, cần xác minh. SĐT phụ: 0252 3500286. Bình Thuận cũ, nay thuộc Lâm Đồng.",
  },
  {
    id: "trung-bt-tuoisach",
    name: "Hải Sản Tươi Sạch Phan Thiết",
    kind: "vua",
    province: "Lâm Đồng",
    address: "29/A2 KDC-TMDV Lại An, TP. Phan Thiết (Bình Thuận cũ)",
    phone: "0919 062 231",
    species: ["cá", "mực", "tôm", "cua"],
    source: "https://haisantuoisachphanthiet.com/",
    note: "Tham khảo, cần xác minh. SĐT phụ: 0252 3699799. Bình Thuận cũ, nay thuộc Lâm Đồng.",
  },
];
