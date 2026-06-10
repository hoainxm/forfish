// Kênh bán buôn thủy sản + chợ đầu mối lớn — THAM KHẢO từ nguồn công khai (URL trong header).
// Nguồn chính (truy cập 2026-06-10):
//   - Chợ Bình Điền (TP.HCM): http://www.binhdienmarket.com.vn ; https://vi.wikipedia.org/wiki/Chợ_đầu_mối_Bình_Điền
//   - Chợ đầu mối NSTP Hóc Môn: https://vi.wikipedia.org/wiki/Chợ_đầu_mối_nông_sản_thực_phẩm_Hóc_Môn
//   - Chợ đầu mối thủy sản Thọ Quang (Đà Nẵng): https://tepbac.com/tin-tuc/full/da-nang-dau-gia-mua-ban-tai-cho-dau-moi-thuy-san-tho-quang-26061.html
//   - Chợ cá Yên Sở (Hà Nội): https://kinhdoanh.ahamove.com/cho-yen-so
//   - Chợ hải sản Hòn Gai / chợ cá sớm Hạ Long: https://cafef.vn/cho-ca-khong-ngu-duy-nhat-o-vinh-ha-long-188241028144615798.chn
//   - Kênh bán / ép giá nậu vựa: https://danviet.vn/ban-hai-san-cho-dau-nau-phai-chiu-nhieu-he-luy-tu-luat-rieng-7777926731.htm ;
//     https://vtv.vn/kinh-te/le-thuoc-nau-vua-ngu-dan-bi-ep-gia-theo-nhieu-dang-thuc-20160405105657586.htm
//   - Bán online/livestream: https://tienphong.vn/khi-ngu-dan-xai-40-post1316758.tpo ;
//     https://thesaigontimes.vn/livestream-ban-hang-tuoi-song-mo-rong-thi-truong-di-kem-thach-thuc/
//   - Truy xuất nguồn gốc bán nhà máy/HTX: https://baoquangngai.vn/kinh-te/bien-kinh-te-bien/202308/truy-xuat-nguon-goc-thuy-san-khai-thac-con-nhieu-kho-khan-3bc1af9/
//
// KEY HONESTY POINT: Tên/địa chỉ TỪNG nậu vựa, đầu nậu, vựa cá cá nhân KHÔNG có trong cơ sở
// dữ liệu công khai nào — đây là tri thức ĐỊA PHƯƠNG. KHÔNG bịa tên. Lớp này phải đến từ
// mạng đại lý SDVICO + để bà con tự thêm "mối quen" (xem interface SavedBuyer bên dưới).
// Mọi mục dưới đây là THAM KHẢO, cần rà lại địa chỉ/giờ trước khi ghim chính xác lên bản đồ.
// (ngày 2026-06-10)

export interface SellChannel {
  id: string;
  name: string;
  pros: string[];
  cons: string[];
  bestFor?: string;
}

export interface WholesaleMarket {
  id: string;
  name: string;
  province?: string;
  address?: string;
  species?: string[];
  hours?: string;       // giờ họp chợ (tham khảo)
  note?: string;
}

// Người mua do chính bà con tự lưu (mối quen tại cảng) — KHÔNG phải dữ liệu công khai.
// App nên lưu local + đồng bộ riêng tư cho từng tàu; đây là cách lấp lớp "nậu vựa cá nhân".
export interface SavedBuyer {
  id: string;
  name: string;          // tên mối quen, do người dùng nhập
  type: "nau-vua" | "vua-dai-ly" | "nha-may" | "htx" | "khach-le" | "khac";
  port?: string;         // cảng/bến hay gặp
  phone?: string;
  species?: string[];    // loài hay mua
  note?: string;         // ghi chú: giá thường, có ứng tổn không, mức trừ hao...
}

export const SELL_CHANNELS: SellChannel[] = [
  {
    id: "nau-vua-tai-cang",
    name: "Nậu vựa / đầu nậu tại cảng",
    pros: [
      "Tiền mặt ngay khi cập bến, không phải chờ",
      "Mua hết cả mẻ, mọi loại/cỡ — không phải tự phân loại tìm khách",
      "Ứng trước 'tổn' (dầu, đá, lương thực) và cho vay sửa tàu, không cần thế chấp",
      "Không cần giấy tờ, không cần truy xuất nguồn gốc",
    ],
    cons: [
      "Giá bị ép thấp hơn thị trường, thường 2.000–4.000 đ/kg (Dân Việt)",
      "Ép cân: tăng mức 'trừ hao' (có giai đoạn từ 300kg lên 600–700kg/chuyến)",
      "Nợ ứng tổn buộc phải bán toàn bộ cá cho đúng nậu đó — 'luật riêng', mất quyền chọn người mua",
      "Các nậu thường bắt tay thống nhất giá, ngư dân không mang ra chợ tự bán được",
    ],
    bestFor: "Tàu đang nợ tổn của nậu, cần tiền mặt gấp, không có điều kiện bảo quản/vận chuyển",
  },
  {
    id: "vua-dai-ly-thu-mua",
    name: "Vựa / đại lý thu mua (không ràng nợ)",
    pros: [
      "Trả tiền nhanh, thường nhỉnh hơn nậu ràng nợ nếu mình không vay của họ",
      "Có thể so giá giữa nhiều vựa để mặc cả",
      "Vựa lớn có kho lạnh, gom hàng đi chợ đầu mối / bán nhà máy",
    ],
    cons: [
      "Vẫn là trung gian, ăn chênh lệch; giá thấp hơn bán thẳng chợ/nhà máy",
      "Vựa quen có thể ép cân/ép loại nếu mình không kiểm tra",
      "Vẫn cần bán nhanh trong ngày, ít quyền giữ hàng chờ giá",
    ],
    bestFor: "Tàu không nợ ai, muốn lấy tiền nhanh nhưng vẫn so được vài giá",
  },
  {
    id: "cho-dau-moi-thuy-san",
    name: "Chợ đầu mối thủy sản",
    pros: [
      "Giá sát thị trường, nhiều người mua cạnh tranh — bán được cao hơn bán tại cảng",
      "Có chợ tổ chức đấu giá (vd. Thọ Quang) giúp giá minh bạch hơn",
      "Bán được nhiều loại/cỡ cho nhiều bạn hàng khác nhau",
    ],
    cons: [
      "Phải tự vận chuyển, ướp đá giữ tươi, chịu hao hụt đường đi",
      "Mất phí chợ/bến bãi, công bốc xếp, công người đi chợ",
      "Cần biết giá trước và có mối bạn hàng ở chợ; không thì vẫn bị ép",
      "Họp ban đêm/rạng sáng — phải canh giờ, hợp với người nhà ở bờ đi bán hộ",
    ],
    bestFor: "Tàu gần chợ đầu mối, sản lượng khá, có người nhà chở hàng đi bán",
  },
  {
    id: "ban-thang-nha-may-htx",
    name: "Bán thẳng nhà máy chế biến / HTX",
    pros: [
      "Giá tốt nhất cho hàng đạt chuẩn (xuất khẩu trả cao hơn nội địa)",
      "HTX hậu cần nghề cá có thể mua ngay trên biển, cấp dầu/đá để bám biển dài ngày",
      "Hợp đồng bao tiêu ổn định nếu liên kết chuỗi đàng hoàng",
    ],
    cons: [
      "BẮT BUỘC giấy tờ truy xuất: nhật ký khai thác, xác nhận/chứng nhận nguồn gốc (eCDT/IUU)",
      "Yêu cầu chất lượng & phân cỡ cao; hàng dập, bảo quản kém bị loại hoặc hạ giá",
      "Thường mua số lượng lớn, loài cụ thể — tàu nhỏ lẻ khó đạt lô",
      "Liên kết còn yếu; có nơi ngư dân phá kèo bán cho nậu khi nậu trả cao hơn → nhà máy ngại ký",
    ],
    bestFor: "Tàu khơi sản lượng lớn, làm tốt giấy tờ eCDT, loài có giá xuất khẩu (cá ngừ, mực, tôm)",
  },
  {
    id: "ban-le-online",
    name: "Bán lẻ / online (Zalo, livestream, chợ địa phương)",
    pros: [
      "Giá cao nhất/kg vì bỏ hết trung gian, bán thẳng người ăn",
      "Khách thấy cá tươi qua livestream, chốt đơn trước cả khi tàu về — 'không lo ế'",
      "Chủ động giá, xây được khách quen nhiều tỉnh",
    ],
    cons: [
      "Tốn công đóng gói, giao hàng, chăm khách — cần người trẻ trong nhà làm",
      "Chỉ bán được lượng nhỏ, không tiêu thụ hết mẻ lớn",
      "Cần có sóng/điện thoại tốt; rủi ro hàng hỏng khi giao xa",
      "Có thể phát sinh nghĩa vụ thuế hộ kinh doanh nếu bán đều đặn",
    ],
    bestFor: "Hàng tươi/đặc sản giá trị cao, lượng vừa, có con/vợ rành điện thoại bán hộ",
  },
];

export const WHOLESALE_MARKETS: WholesaleMarket[] = [
  {
    id: "binh-dien",
    name: "Chợ đầu mối Bình Điền",
    province: "Thành phố Hồ Chí Minh",
    address: "Đại lộ Nguyễn Văn Linh, khu phố 6, phường 7, Quận 8, TP.HCM",
    species: ["tôm sú", "tôm hùm", "cua", "cá basa", "cá lóc", "cá tra", "mực", "nghêu sò", "cá biển"],
    hours: "Nhà lồng thủy hải sản tươi sống họp về đêm tới sáng (đông nhất ~22h–3h); ĐT BQL 028.3759.0001",
    note: "Chợ đầu mối thủy sản lớn nhất phía Nam, ~700 tấn thủy sản tươi/đêm-ngày (tham khảo)",
  },
  {
    id: "hoc-mon",
    name: "Chợ đầu mối nông sản thực phẩm Hóc Môn",
    province: "Thành phố Hồ Chí Minh",
    address: "14/7A Nguyễn Thị Sóc, xã Xuân Thới Đông, huyện Hóc Môn, TP.HCM",
    species: ["thủy hải sản", "rau củ", "thịt heo", "trái cây"],
    hours: "Giao dịch chính 22h–6h sáng; có khu thủy hải sản riêng",
    note: "Chợ đa ngành, thủy hải sản là một khu trong chợ (tham khảo)",
  },
  {
    id: "tho-quang",
    name: "Chợ đầu mối thủy sản Thọ Quang",
    province: "Thành phố Đà Nẵng",
    address: "Số 20 đường Vân Đồn, P. Nại Hiên Đông, Q. Sơn Trà, Đà Nẵng (cạnh âu thuyền/cảng cá Thọ Quang)",
    species: ["cá thu", "cá ngừ chù", "cá hố", "cá dìa", "cá chim", "cá bớp", "cá mú", "cá đối", "mực", "bạch tuộc", "tôm"],
    hours: "Sôi động từ ~1–2h sáng (tàu cập), thương lái mua 4–5h sáng; tiêu thụ ~70–100 tấn/ngày",
    note: "Chợ cá đầu mối lớn nhất miền Trung; có thí điểm đấu giá mua bán (tham khảo)",
  },
  {
    id: "yen-so",
    name: "Chợ cá Yên Sở (chợ cá làng Sở Thượng)",
    province: "Hà Nội",
    address: "Số 96 đường Đỗ Mười, phường Yên Sở, quận Hoàng Mai, Hà Nội",
    species: ["cá nước ngọt", "cá biển", "thủy sản các loại"],
    hours: "Họp đêm về rạng sáng; ~150 tấn cá/ngày",
    note: "Chợ đầu mối thủy sản lớn nhất miền Bắc (tham khảo)",
  },
  {
    id: "long-bien",
    name: "Chợ Long Biên",
    province: "Hà Nội",
    address: "Khu vực cầu Long Biên, quận Ba Đình (cũ), Hà Nội",
    species: ["thủy hải sản", "nông sản", "trái cây"],
    hours: "Họp đêm về sáng",
    note: "Đầu mối nông sản–thủy hải sản từ các tỉnh về Hà Nội (tham khảo)",
  },
  {
    id: "hon-gai",
    name: "Chợ hải sản Hòn Gai (chợ cá sớm Hạ Long)",
    province: "Quảng Ninh",
    address: "Khu bến cá Hòn Gai; đã chuyển về phường Cao Xanh, TP. Hạ Long (từ 9/2020)",
    species: ["cá biển", "mực", "tôm", "ghẹ", "hải sản vịnh Hạ Long"],
    hours: "Chợ cá sớm, họp sáng sớm khi tàu về sau đêm đánh bắt",
    note: "Chợ cá đầu mối bình dân của Hạ Long, giá sát tàu vì ít trung gian (tham khảo)",
  },
  {
    id: "dbscl-ca-mau",
    name: "Cụm chợ/vựa thủy sản ĐBSCL (Cà Mau)",
    province: "Cà Mau",
    address: "Các đầu mối: cảng cá Cà Mau, chợ Sông Đốc (Trần Văn Thời), Năm Căn, Rạch Gốc, Cái Đôi Vàm",
    species: ["tôm", "cua Cà Mau", "cá biển", "mực", "ốc nghêu sò"],
    hours: "Theo con nước/tàu về; mua nhiều lúc sáng sớm",
    note: "Không phải một chợ tập trung mà là mạng vựa/đại lý + cảng; tên từng vựa là mối quen địa phương, không có CSDL công khai (tham khảo)",
  },
];
