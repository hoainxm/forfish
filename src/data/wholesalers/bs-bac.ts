import type { Wholesaler } from "./types";

// Vựa / cơ sở thu mua + chế biến thủy hải sản — BẮC TRUNG BỘ + DUYÊN HẢI ĐỒNG BẰNG
// SÔNG HỒNG (pass bổ sung, đào sâu các điểm bản đầu còn mỏng): Thanh Hóa (Sầm Sơn,
// Lạch Hới, Hậu Lộc/Hòa Lộc), Nghệ An (Cửa Lò, Quỳnh Lưu/Lạch Quèn), Hà Tĩnh
// (Thạch Kim/Cửa Sót, Kỳ Anh), Thái Bình (Diêm Điền/Thái Thụy, Tiền Hải).
//
// Phương pháp: registry-first — danh bạ ĐKKD công khai (tratencongty.com) cho tên
// DN + người đại diện + địa chỉ đăng ký; website DN + danh bạ cho SĐT. KHÔNG bịa:
// field nào nguồn không nêu thì để trống. Mã số thuế trên danh bạ hiển thị dạng ảnh
// nên KHÔNG đưa vào (tránh sai). Tất cả là THAM KHẢO — gọi xác minh trước khi giao dịch.
//
// Nguồn chính đã dùng:
// - https://www.tratencongty.com/tinh-ha-tinh/huyen-loc-ha/xa-thach-kim/
// - https://www.tratencongty.com/tinh-thanh-hoa/huyen-hau-loc/xa-hoa-loc/
// - https://www.tratencongty.com/tinh-thanh-hoa/thanh-pho-sam-son/phuong-quang-tien/
// - https://www.tratencongty.com/company/e02e8338-cong-ty-tnhh-thuy-san-sam-son/
// - https://www.tratencongty.com/tinh-ha-tinh/thi-xa-ky-anh/xa-ky-ninh/
// - https://thuysanmientrung.com/
// - https://ngheantoplist.net/am-thuc/top-5-dia-chi-ban-hai-san-kho-nghe-an-ngon-re-chat-luong

export const WHOLESALERS_BS_BAC: Wholesaler[] = [
  // ===== THANH HÓA — SẦM SƠN / LẠCH HỚI =====
  {
    id: "bsb-th-thuy-san-sam-son",
    name: "Công ty TNHH MTV Thủy sản Sầm Sơn",
    kind: "co-so-thu-mua",
    province: "Thanh Hóa",
    address:
      "Số 63 đường Nguyễn Thị Lợi, khu phố Nam Hải, P. Trung Sơn, TP Sầm Sơn, Thanh Hóa",
    species: ["cá", "mực", "tôm"],
    source: "https://www.tratencongty.com/company/e02e8338-cong-ty-tnhh-thuy-san-sam-son/",
    note: "tham khảo, cần xác minh; DN thủy sản ĐKKD tại Sầm Sơn (ĐD: Vũ Văn Bộ) — nguồn không nêu SĐT",
  },
  {
    id: "bsb-th-kien-dinh",
    name: "Công ty TNHH TM Tổng hợp Hải sản khô Kiên Định",
    kind: "co-so-thu-mua",
    province: "Thanh Hóa",
    address: "Tổ dân phố Bình Tân, P. Quảng Tiến, TP Sầm Sơn, Thanh Hóa",
    species: ["hải sản khô", "cá", "mực"],
    source: "https://www.tratencongty.com/tinh-thanh-hoa/thanh-pho-sam-son/phuong-quang-tien/",
    note: "tham khảo, cần xác minh; cơ sở chế biến/kinh doanh hải sản khô gần cảng Lạch Hới (ĐD: Lê Trung Kiên) — nguồn không nêu SĐT",
  },

  // ===== THANH HÓA — HẬU LỘC / HÒA LỘC =====
  // Cụm CN Hòa Lộc (xã Hòa Lộc, Hậu Lộc) là cụm chế biến thủy sản XK ven cửa Lạch Trường.
  {
    id: "bsb-th-xnk-hoa-loc",
    name: "Công ty CP Xuất nhập khẩu Thủy sản Hòa Lộc",
    kind: "co-so-thu-mua",
    province: "Thanh Hóa",
    address: "Cụm công nghiệp Hòa Lộc, xã Hòa Lộc, H. Hậu Lộc, Thanh Hóa",
    species: ["cá", "mực", "tôm"],
    source: "https://www.tratencongty.com/tinh-thanh-hoa/huyen-hau-loc/xa-hoa-loc/",
    note: "tham khảo, cần xác minh; chế biến + XNK thủy sản, cụm CN Hòa Lộc (ĐD: Vũ Văn Tiến) — nguồn không nêu SĐT",
  },
  {
    id: "bsb-th-xnk-tnc",
    name: "Công ty CP Xuất nhập khẩu Thủy sản TNC",
    kind: "co-so-thu-mua",
    province: "Thanh Hóa",
    address: "Cụm công nghiệp Hòa Lộc, xã Hòa Lộc, H. Hậu Lộc, Thanh Hóa",
    species: ["cá", "mực", "tôm"],
    source: "https://www.tratencongty.com/tinh-thanh-hoa/huyen-hau-loc/xa-hoa-loc/",
    note: "tham khảo, cần xác minh; chế biến + XNK thủy sản, cụm CN Hòa Lộc (ĐD: Vũ Văn Tiến) — nguồn không nêu SĐT",
  },

  // ===== NGHỆ AN — CỬA LÒ =====
  {
    id: "bsb-na-an-hoa",
    name: "Cơ sở Hải sản khô An Hòa",
    kind: "co-so-thu-mua",
    province: "Nghệ An",
    address: "30 Bình Minh, P. Nghi Thủy, TX Cửa Lò, Nghệ An",
    phone: "0366 081 801",
    species: ["hải sản khô", "cá", "mực"],
    source: "https://ngheantoplist.net/am-thuc/top-5-dia-chi-ban-hai-san-kho-nghe-an-ngon-re-chat-luong",
    note: "tham khảo, cần xác minh; cơ sở chế biến/kinh doanh hải sản khô Cửa Lò",
  },

  // ===== NGHỆ AN — QUỲNH LƯU / LẠCH QUÈN =====
  {
    id: "bsb-na-bac-mien-trung",
    name: "Công ty TNHH Thủy sản Bắc Miền Trung",
    kind: "co-so-thu-mua",
    province: "Nghệ An",
    address: "Cảng cá nhân dân Lạch Quèn, xã Quỳnh Thuận, H. Quỳnh Lưu, Nghệ An",
    phone: "0969 847 459",
    species: ["cá biển", "bột cá"],
    source: "https://thuysanmientrung.com/",
    note: "tham khảo, cần xác minh; thu mua cá biển nguyên con tại cảng Lạch Quèn để chế biến bột cá, công suất ~300 tấn/ngày",
  },

  // ===== HÀ TĨNH — THẠCH KIM / CỬA SÓT (xã Thạch Kim, Lộc Hà) =====
  // Cụm CN chế biến hải sản Thạch Kim, ven cảng cá Cửa Sót — nhiều DN/HTX thu mua,
  // chế biến, cấp đông từ tàu. Danh bạ ĐKKD nêu tên + ĐD + địa chỉ, KHÔNG có SĐT.
  {
    id: "bsb-ht-dinh-bien",
    name: "Công ty TNHH Chế biến Thủy hải sản Đình Biên",
    kind: "co-so-thu-mua",
    province: "Hà Tĩnh",
    address: "Cụm công nghiệp Thạch Kim, xã Thạch Kim (cảng cá Cửa Sót), Hà Tĩnh",
    species: ["mực", "cá", "tôm"],
    source: "https://www.tratencongty.com/tinh-ha-tinh/huyen-loc-ha/xa-thach-kim/",
    note: "tham khảo, cần xác minh; chế biến thủy hải sản cụm CN Thạch Kim (ĐD: Nguyễn Đình Biên) — nguồn không nêu SĐT",
  },
  {
    id: "bsb-ht-hoang-son",
    name: "Công ty CP Thủy sản Hoàng Sơn",
    kind: "co-so-thu-mua",
    province: "Hà Tĩnh",
    address: "Thôn Xuân Phượng, cảng cá Cửa Sót, xã Thạch Kim, Hà Tĩnh",
    species: ["mực", "cá", "tôm"],
    source: "https://www.tratencongty.com/tinh-ha-tinh/huyen-loc-ha/xa-thach-kim/",
    note: "tham khảo, cần xác minh; DN thủy sản tại cảng Cửa Sót (ĐD: Nguyễn Huy Sơn) — nguồn không nêu SĐT",
  },
  {
    id: "bsb-ht-thien-phu",
    name: "HTX Thu mua Chế biến XNK Thủy hải sản Thiên Phú",
    kind: "co-so-thu-mua",
    province: "Hà Tĩnh",
    address: "Xã Thạch Kim, H. Lộc Hà (cảng cá Cửa Sót), Hà Tĩnh",
    species: ["mực", "cá", "tôm"],
    source: "https://www.tratencongty.com/tinh-ha-tinh/huyen-loc-ha/xa-thach-kim/",
    note: "tham khảo, cần xác minh; HTX thu mua + chế biến + XNK thủy hải sản tại Thạch Kim — nguồn không nêu SĐT",
  },
  {
    id: "bsb-ht-hung-manh",
    name: "HTX Dịch vụ Hải sản đông lạnh Hùng Mạnh",
    kind: "co-so-thu-mua",
    province: "Hà Tĩnh",
    address: "Xã Thạch Kim, H. Lộc Hà (cảng cá Cửa Sót), Hà Tĩnh",
    species: ["mực", "cá", "tôm"],
    source: "https://www.tratencongty.com/tinh-ha-tinh/huyen-loc-ha/xa-thach-kim/",
    note: "tham khảo, cần xác minh; kho đông lạnh hải sản Thạch Kim (ĐD: Phùng Văn Hoà) — nguồn không nêu SĐT",
  },
  {
    id: "bsb-ht-huong-xuan",
    name: "Doanh nghiệp TN Thủy sản Hương Xuân",
    kind: "co-so-thu-mua",
    province: "Hà Tĩnh",
    address: "Thôn Long Hải, xã Thạch Kim, H. Lộc Hà, Hà Tĩnh",
    species: ["mực", "cá", "tôm"],
    source: "https://www.tratencongty.com/tinh-ha-tinh/huyen-loc-ha/xa-thach-kim/",
    note: "tham khảo, cần xác minh; DNTN thủy sản Thạch Kim (ĐD: Nguyễn Đình Bình) — nguồn không nêu SĐT",
  },

  // ===== HÀ TĨNH — KỲ ANH =====
  {
    id: "bsb-ht-thanh-phat",
    name: "Công ty TNHH Chế biến Thủy hải sản Thành Phát",
    kind: "co-so-thu-mua",
    province: "Hà Tĩnh",
    address: "Thôn Tam Hải 2, xã Kỳ Ninh, TX Kỳ Anh, Hà Tĩnh",
    species: ["cá", "mực", "tôm"],
    source: "https://www.tratencongty.com/tinh-ha-tinh/thi-xa-ky-anh/xa-ky-ninh/",
    note: "tham khảo, cần xác minh; chế biến thủy hải sản Kỳ Ninh (ĐD: Nguyễn Tiến Dũng) — nguồn không nêu SĐT",
  },
];
