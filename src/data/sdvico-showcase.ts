// SẢN PHẨM CHÍNH SDVICO — nội dung lấy từ tài liệu chi tiết sản phẩm chính thức
// "Thong-tin-chi-tiet-san-pham-SDVICO.docx" (SDVICO cung cấp 2026-09-24).
//
// ĐÂY LÀ NGUỒN ĐƠN của danh mục: bảng Supabase `product_listings` được SEED từ
// chính mảng này (scripts/gen-product-seed.mjs → migration 0054), và cũng là
// FALLBACK tĩnh khi Supabase chưa cấu hình / mất sóng chưa có bản lưu.
// Sửa nội dung sản phẩm ⇒ sửa Ở ĐÂY rồi chạy lại script sinh seed (xem 04).
//
// `features` = 3 gạch đầu dòng NGẮN hiện trên THẺ. `detail` = nội dung ĐẦY ĐỦ
// hiện trong sheet Chi tiết (mã/phiên bản · phân loại · dành cho ai · lợi ích ·
// bảng thông số · biến thể). `group` = nhóm Cửa hàng (điện tử / cơ điện / nhu
// yếu phẩm); app để trống → gom "Khác".
//
// KHÔNG có GIÁ: tài liệu ghi rõ "không kèm giá; giá do phòng kinh doanh báo".

import type { ProductDetail } from "@/lib/product-catalog";

export const SDVICO_HOTLINE = "0939243222";
export const SDVICO_HOTLINE_DISPLAY = "0939 243 222";

export interface ShowcaseProduct {
  id: string;
  /** UUID cố định để seed upsert idempotent vào product_listings */
  uuid: string;
  title: string;
  /** nhãn loại hiện trên thẻ */
  category: string;
  /** nhóm Cửa hàng: dien_tu | co_dien | nhu_yeu_pham — app để undefined */
  group?: "dien_tu" | "co_dien" | "nhu_yeu_pham";
  /** id dòng theo nhóm SKU CRM — để biết "đang dùng" */
  line: string;
  desc: string;
  features: string[];
  detail: ProductDetail;
  image: string;
  imgW: number;
  imgH: number;
}

export const SDVICO_SHOWCASE: ShowcaseProduct[] = [
  {
    id: "may-loc-dau-diesel-sf",
    uuid: "b6e1a1a0-2222-4a22-8a22-000000000001",
    title: "Máy lọc dầu diesel SF50 / SF300B",
    category: "Máy lọc dầu diesel",
    group: "co_dien",
    line: "xu-ly-dau",
    desc: "Lọc cặn siêu nhỏ và tách nước, giữ kim phun và bơm cao áp luôn sạch",
    features: [
      "Lọc 1–10 micron, tách nước khỏi dầu",
      "Vỏ inox 304 chịu muối biển, túi lọc thay được",
      "Giảm tiêu hao nhiên liệu 5–10% (theo tài liệu SP)",
    ],
    detail: {
      models: "SF50 bản cơ, SF300B bản bơm điện",
      maker: "Sản phẩm SDVICO. Kỹ thuật SDVICO lắp tận tàu, bảo hành trực tiếp",
      forWho:
        "Tàu vỏ gỗ, vỏ sắt hay nghẹt kim phun, máy nổ không êm vì dầu lẫn nước và cặn.",
      benefits: [
        "Lọc cặn siêu nhỏ và tách nước, giữ kim phun và bơm cao áp luôn sạch.",
        "Máy nổ êm hơn, đỡ hỏng vặt, giảm tiêu hao nhiên liệu 5 tới 10% theo tài liệu sản phẩm.",
        "Vỏ inox 304 chịu muối biển, túi lọc thay được, dễ vệ sinh.",
      ],
      specs: [
        { label: "Cấu trúc", value: "Bồn inox 304 hai khối, túi lọc thay được" },
        { label: "Độ lọc", value: "1 tới 10 micron" },
        { label: "Lưu lượng", value: "Khoảng 200 lít/giờ" },
        { label: "Bơm dầu", value: "Bơm điện SF300, 12 tới 13,8 V một chiều" },
        { label: "Kích thước", value: "52 x 20 x 50 cm" },
        { label: "Khối lượng", value: "15 kg" },
        { label: "Bảo hành", value: "12 tháng" },
      ],
      variant:
        "Hai bản cùng cấu trúc (bồn inox hai khối, túi lọc, van xả khí, van xả cặn). Bản bơm điện SF300B có thêm bơm dầu để tăng áp đầu ra và tách khí trong dầu; bản cơ SF50 không có bơm, dầu tự chảy theo đường ống.",
    },
    image: "/sdvico/loc-dau.jpg",
    imgW: 760,
    imgH: 600,
  },
  {
    id: "may-loc-nuoc-bien-sea",
    uuid: "b6e1a1a0-2222-4a22-8a22-000000000002",
    title: "Máy lọc nước biển SEA-40 / SEA250",
    category: "Máy lọc nước biển",
    group: "co_dien",
    line: "loc-nuoc",
    desc: "Lọc nước biển thành nước ngọt ngay trên tàu bằng màng RO",
    features: [
      "Công suất ~250 lít/giờ, tách muối 99,6%",
      "Nước ra đạt chuẩn nước ăn uống WHO",
      "Kỹ thuật SDVICO lắp tận tàu",
    ],
    detail: {
      models: "SD-M250 bản cơ, SEA250 và SEA-40 bản điện",
      maker:
        "Sản phẩm SDVICO. Thiết kế và lắp ráp tại Việt Nam, kỹ thuật SDVICO lắp tận tàu",
      forWho:
        "Tàu đi biển dài ngày, chuyến nào cũng lo nước ngọt. Máy lọc nước biển thành nước ngọt ngay trên tàu bằng màng RO.",
      benefits: [
        "Chủ động nước ngọt uống, nấu ăn, tắm rửa suốt chuyến biển.",
        "Nước ra đạt chuẩn nước ăn uống của WHO.",
        "Lấy nước biển sạch từ bơm làm mát máy tàu, kỹ thuật SDVICO lắp và hướng dẫn.",
      ],
      specs: [
        { label: "Công suất lọc", value: "Khoảng 250 lít/giờ, màng lọc 4040" },
        { label: "Tách muối", value: "99,6%, nước ra dưới 500 ppm" },
        {
          label: "Đầu bơm cao áp",
          value: "SEA250 loại 1525 đầu đỏ; SEA-40 loại 1111 đầu đen, áp thấp hơn",
        },
        { label: "Cụm motor", value: "2,2 kW, 1 pha 220 V hoặc 3 pha 380 V" },
        { label: "Kích thước", value: "150 x 50 x 80 cm" },
        { label: "Khối lượng", value: "Khoảng 60 kg" },
        { label: "Bảo hành", value: "12 tháng, cả màng RO, đầu bơm" },
      ],
      variant:
        "Hai bản cùng cấu trúc (màng RO, lõi lọc thô, bơm cao áp, đồng hồ áp suất). Bản điện SEA250/SEA-40 có cụm motor chạy điện tàu để kéo bơm cao áp; bản cơ SD-M250 không có cụm motor, không dùng điện.",
    },
    image: "/sdvico/sea40.jpg",
    imgW: 760,
    imgH: 600,
  },
  {
    id: "gsht-viettel-s-tracking",
    uuid: "b6e1a1a0-2222-4a22-8a22-000000000003",
    title: "Giám sát hành trình Viettel S-Tracking",
    category: "Giám sát hành trình",
    group: "dien_tu",
    line: "giam-sat",
    desc: "Thiết bị giám sát hành trình tàu cá theo quy định để ra khơi hợp lệ",
    features: [
      "Định vị GPS, truyền qua di động và vệ tinh Iridium",
      "Chống nước IP67",
      "SDVICO lắp tận bến, hỗ trợ hồ sơ đăng ký",
    ],
    detail: {
      models: "MTR-V02-VNM",
      maker: "SDVICO phân phối và lắp đặt. Thiết bị và phần mềm giám sát thuộc Viettel",
      forWho:
        "Tàu cá cần thiết bị giám sát hành trình theo quy định để ra khơi hợp lệ. SDVICO lắp đặt tận bến, hỗ trợ hồ sơ đăng ký và bảo hành.",
      benefits: [
        "Định vị GPS chính xác, truyền dữ liệu qua mạng di động và vệ tinh.",
        "Chống nước chuẩn IP67, phù hợp môi trường tàu cá ngoài biển.",
        "Kết nối hạ tầng Viettel, phủ sóng tốt vùng biển Việt Nam.",
        "Bảo hành máy 12 tháng, phụ kiện 6 tháng.",
      ],
      specs: [
        { label: "Hãng sản xuất", value: "Viettel" },
        { label: "Model", value: "MTR-V02-VNM" },
        { label: "Định vị", value: "GPS" },
        { label: "Truyền dữ liệu", value: "Mạng di động và vệ tinh Iridium" },
        { label: "Chống nước", value: "IP67" },
        { label: "Bảo hành", value: "12 tháng máy, 6 tháng phụ kiện" },
      ],
    },
    image: "/sdvico/s-tracking.jpg",
    imgW: 760,
    imgH: 600,
  },
  {
    id: "gsht-vifish-24",
    uuid: "b6e1a1a0-2222-4a22-8a22-000000000004",
    title: "Giám sát hành trình Vifish.24",
    category: "Giám sát hành trình",
    group: "dien_tu",
    line: "giam-sat",
    desc: "Cảnh báo trước khi tới vùng cấm, nút khẩn cấp qua vệ tinh",
    features: [
      "Báo trước 1 hải lý khi gần vùng cấm",
      "Nút khẩn cấp gửi tín hiệu về Đài duyên hải",
      "Pin dự phòng chạy tiếp ~48 giờ khi mất điện",
    ],
    detail: {
      models: "Vifish.24, ăng ten ST 6100 kèm hộp đấu nối",
      maker:
        "SDVICO phân phối và lắp đặt. Thiết bị của Công ty TNHH MTV Thông tin điện tử Hàng hải Việt Nam (Vishipel)",
      forWho:
        "Tàu đang dùng Vifish.18 muốn nâng cấp, hoặc tàu lắp mới. Nâng cấp chỉ thay hộp đấu nối, giữ ăng ten, thi công nhanh.",
      benefits: [
        "Báo trước khi tàu tới gần vùng cấm, tránh vượt ranh giới.",
        "Nút khẩn cấp gửi tín hiệu qua vệ tinh về Đài Thông tin duyên hải.",
        "Pin dự phòng chạy tiếp khoảng 48 giờ khi tàu mất điện.",
      ],
      specs: [
        { label: "Nguồn điện", value: "9 tới 32 V một chiều" },
        { label: "Pin dự phòng", value: "Lithium-ion 5.000 mAh" },
        { label: "Ăng ten ST 6100", value: "12,6 x 12,6 x 4,9 cm, chuẩn IP67" },
        { label: "Hộp đấu nối", value: "20 x 9 x 4,5 cm, chuẩn IP66" },
        { label: "Định vị", value: "GPS, Glonass, Beidou, Galileo" },
        { label: "Truyền vị trí", value: "Qua vệ tinh Inmarsat, 2 giờ một lần" },
        { label: "Cảnh báo vùng cấm", value: "Trước 1 hải lý, còi hoặc đèn" },
        { label: "Nút khẩn cấp", value: "Có, kèm nắp bảo vệ" },
      ],
    },
    image: "/sdvico/vifish.png",
    imgW: 760,
    imgH: 600,
  },
  {
    id: "thuraya-marine-star-mnb-01",
    uuid: "b6e1a1a0-2222-4a22-8a22-000000000005",
    title: "Điện thoại vệ tinh Thuraya MarineStar",
    category: "Liên lạc vệ tinh",
    group: "dien_tu",
    line: "dien-thoai-ve-tinh",
    desc: "Gọi điện qua vệ tinh ngay trên biển, có nút SOS riêng",
    features: [
      "Gọi thoại qua vệ tinh Thuraya, ổn định",
      "Máy bàn có tay nghe, nút SOS trên máy",
      "GPS tích hợp, SDVICO lắp ăng ten và đi dây",
    ],
    detail: {
      models: "Thuraya MarineStar MNB-01, kèm ăng ten SPACE 42",
      maker:
        "SDVICO phân phối và lắp đặt. Thiết bị của Thuraya, dịch vụ vệ tinh do Thuraya cung cấp",
      forWho:
        "Tàu cá đi xa bờ, ra khỏi vùng sóng di động mà vẫn cần gọi về nhà, gọi chủ vựa hay báo tin khi gặp sự cố.",
      benefits: [
        "Gọi điện qua vệ tinh ngay trên biển, chất lượng thoại ổn định.",
        "Máy bàn có tay nghe quen tay như điện thoại ở nhà, nút SOS riêng trên máy.",
        "GPS tích hợp, thiết bị làm cho môi trường hàng hải.",
        "SDVICO lắp ăng ten, đi dây trên tàu và hướng dẫn sử dụng.",
      ],
      specs: [
        { label: "Hãng sản xuất", value: "Thuraya" },
        { label: "Kiểu máy", value: "Điện thoại bàn có tay nghe, màn hình màu" },
        { label: "Ăng ten", value: "Thuraya SPACE 42, hình chuông gắn ngoài" },
        { label: "Liên lạc", value: "Thoại qua vệ tinh Thuraya" },
        { label: "Định vị", value: "GPS tích hợp" },
        { label: "Nút khẩn cấp", value: "Nút SOS trên máy" },
        { label: "Trọn bộ", value: "Máy, ăng ten, cuộn cáp, SIM, sách hướng dẫn" },
      ],
    },
    image: "/sdvico/thuraya.jpg",
    imgW: 760,
    imgH: 600,
  },
  {
    id: "pv-engine-rmi-nano-graphene",
    uuid: "b6e1a1a0-2222-4a22-8a22-000000000006",
    title: "Dầu nhớt Nano Graphene PV Engine RMI",
    category: "Dầu nhớt động cơ",
    group: "nhu_yeu_pham",
    line: "nhot",
    desc: "Dầu nhớt Nano Graphene cho động cơ diesel máy thủy chạy dài ngày",
    features: [
      "SAE 15W-40 và 20W-50, API CI-4/SL",
      "Phụ gia Nano Graphene bảo vệ động cơ (công bố PVOIL)",
      "Kéo dài thời gian thay dầu, tiết kiệm nhiên liệu",
    ],
    detail: {
      models: "PV Engine RMI, SAE 15W-40 và 20W-50",
      maker: "Sản phẩm đồng phát triển cùng Công ty Cổ phần Dầu nhờn PVOIL",
      forWho:
        "Động cơ diesel máy thủy, kể cả máy turbo tăng áp, chạy dài ngày trong điều kiện nặng. PVOIL định vị dòng này cho tàu thuyền và máy phát điện.",
      benefits: [
        "Phụ gia Nano Graphene bảo vệ động cơ tốt hơn, theo công bố của PVOIL.",
        "Kéo dài thời gian thay dầu, tiết kiệm nhiên liệu.",
        "Hàng chính hãng, hóa đơn đầy đủ, SDVICO giao tận bến.",
      ],
      specs: [
        { label: "Cấp độ nhớt", value: "SAE 15W-40, SAE 20W-50" },
        { label: "Cấp chất lượng", value: "API CI-4/SL" },
        {
          label: "Tiêu chuẩn đạt",
          value: "ACEA E7; MB 229.1; Volvo VDS-3; Cummins CES 20078; MAN M 3275",
        },
        { label: "Đóng gói", value: "Thùng 18 lít, phuy 209 lít" },
        { label: "Bảo quản", value: "Nơi khô ráo, dưới 60 độ C" },
      ],
    },
    image: "/sdvico/nano-graphene.jpg",
    imgW: 760,
    imgH: 600,
  },
  {
    id: "phu-gia-adnano",
    uuid: "b6e1a1a0-2222-4a22-8a22-000000000007",
    title: "Phụ gia dầu diesel AdNANO",
    category: "Phụ gia nhiên liệu",
    group: "nhu_yeu_pham",
    line: "phu-gia",
    desc: "Một chai 1 lít pha được 8.000 lít dầu, cháy triệt để, bớt khói",
    features: [
      "1 lít pha được 8.000 lít dầu diesel",
      "Nhũ hóa nano, cháy triệt để, giảm muội",
      "Tiêu hao nhiên liệu giảm 5,47% (công bố NSX)",
    ],
    detail: {
      models: "AdNANO Fuel Additive For Diesel, chai 1 lít",
      maker:
        "Sản phẩm đồng phát triển cùng Phòng Thí nghiệm trọng điểm Công nghệ lọc, hóa dầu",
      forWho:
        "Tàu chạy máy diesel muốn máy bốc hơn, bớt khói, bớt muội. Chỉ cần đổ thẳng vào dầu theo tỷ lệ pha, không phải lắp thêm gì.",
      benefits: [
        "Một chai 1 lít pha được 8.000 lít dầu diesel.",
        "Nhũ hóa nano giúp dầu hóa sương tốt hơn, cháy triệt để, giảm muội động cơ.",
        "Phát triển từ đề tài khoa học cấp nhà nước mã ĐTĐL.CN-03/16.",
        "Theo nhà sản xuất công bố: tiêu hao nhiên liệu giảm 5,47%, khói giảm 5,68%.",
      ],
      specs: [
        { label: "Tỷ lệ pha", value: "1:8000 theo thể tích" },
        { label: "Công suất động cơ", value: "Tăng 2,6% (công bố NSX)" },
        { label: "Phát thải CO", value: "Giảm 9,13% (công bố NSX)" },
        { label: "Phát thải NOx", value: "Giảm 11,47% (công bố NSX)" },
        { label: "Tiêu chuẩn", value: "TCCS 04:2018/PTNTĐ" },
        { label: "Hạn dùng", value: "3 năm kể từ ngày sản xuất" },
        { label: "Dùng cho", value: "Tàu thuyền, máy phát điện, máy công trình, ô tô" },
      ],
    },
    image: "/sdvico/adnano.png",
    imgW: 760,
    imgH: 600,
  },
  {
    id: "ac-quy-globe-wpm-220",
    uuid: "b6e1a1a0-2222-4a22-8a22-000000000008",
    title: "Ắc quy tàu cá Globe WPM-220",
    category: "Ắc quy tàu cá",
    group: "co_dien",
    line: "dien-lai",
    desc: "Ắc quy 12V 220Ah nuôi thiết bị giám sát, định vị, bộ đàm suốt chuyến",
    features: [
      "12 V 220 Ah, dòng khởi động lạnh 1.150 A",
      "Dự trữ 380 phút khi máy phát ngừng sạc",
      "Chuyên dùng cho tàu thuyền và định vị GPS",
    ],
    detail: {
      models: "Globe Marine Battery WPM-220, 12 V 220 Ah",
      maker: "Sản phẩm đồng phát triển cùng Công ty TNHH Lê Long Việt Nam",
      forWho:
        "Tàu cần nguồn điện ổn định cho thiết bị giám sát hành trình, định vị, bộ đàm. Mất nguồn là thiết bị mất tín hiệu.",
      benefits: [
        "Chuyên dùng cho tàu thuyền và thiết bị định vị GPS, theo nhãn của hãng.",
        "Dung lượng 220 Ah, đủ nuôi thiết bị giám sát hành trình, đèn, bộ đàm suốt chuyến.",
        "Dòng khởi động lạnh 1.150 A, đề máy khỏe.",
        "Dự trữ 380 phút khi máy phát ngừng sạc.",
      ],
      specs: [
        { label: "Điện áp", value: "12 V" },
        { label: "Dung lượng", value: "220 Ah (20 giờ); 176 Ah (5 giờ)" },
        { label: "Dòng khởi động lạnh", value: "1.150 A ở -17,8 độ C" },
        { label: "Dự trữ", value: "380 phút ở dòng 25 A" },
        { label: "Kích thước", value: "518 x 276 x 268 mm" },
        { label: "Khối lượng", value: "Khoảng 37,2 kg" },
        { label: "Vỏ bình", value: "Nhựa PP" },
      ],
    },
    image: "/sdvico/ac-quy.png",
    imgW: 760,
    imgH: 600,
  },
  {
    id: "son-tau-bien-pv-paint",
    uuid: "b6e1a1a0-2222-4a22-8a22-000000000009",
    title: "Sơn tàu biển PV Paint",
    category: "Sơn tàu biển",
    group: "nhu_yeu_pham",
    line: "son",
    desc: "Sơn tàu cá: chống hà, chống rỉ, sơn phủ ngoài — công nghệ Chugoku (Nhật)",
    features: [
      "Sơn Graphene Coating Peraphene chống mài mòn",
      "Sơn chống hà tự mài bóng, không thiếc, đạt IMO",
      "Đủ dòng cho tàu vỏ gỗ và vỏ sắt",
    ],
    detail: {
      models: "Toàn bộ dòng sơn tàu cá PV Paint, gồm Graphene Coating Peraphene",
      maker: "Sản phẩm đồng phát triển cùng Công ty Cổ phần Sơn Dầu khí Việt Nam",
      forWho:
        "Tàu vỏ gỗ, vỏ sắt lên đà sơn lại: chống hà, chống rỉ, sơn phủ ngoài. PV Paint sản xuất theo công nghệ Chugoku Marine Paints (Nhật Bản).",
      benefits: [
        "Sơn Graphene Coating Peraphene do PV Paint tự nghiên cứu: chống mài mòn, tăng tuổi thọ công trình.",
        "Sơn chống hà tàu gỗ hiệu lực 6 tới 24 tháng; sơn alkyd bóng cao cho tàu gỗ.",
        "Sơn chống hà tự mài bóng không chứa thiếc, đạt quy định IMO, giảm tiêu hao nhiên liệu.",
      ],
      specs: [
        { label: "Hãng sản xuất", value: "PV Paint, công nghệ Chugoku (Nhật Bản)" },
        { label: "Nhãn sơn", value: "Chugoku CMP, Sơn Hải Phòng, PV Paint" },
        { label: "Sơn Peraphene", value: "Graphene Coating, màu xanh và nâu" },
        { label: "Sơn lót, chống rỉ", value: "Shop primer giàu kẽm; epoxy đa năng" },
        { label: "Sơn két ballast", value: "CMP Nova, Clean Keep" },
        { label: "Sơn chống hà", value: "Tự mài bóng, không thiếc, dừng đỗ 30 tới 45 ngày" },
        { label: "Phạm vi phân phối", value: "Toàn bộ dòng sơn cho tàu cá vỏ gỗ và vỏ sắt" },
      ],
    },
    image: "/sdvico/pv-paint.png",
    imgW: 760,
    imgH: 600,
  },
  {
    id: "app-sdfish",
    uuid: "b6e1a1a0-2222-4a22-8a22-000000000010",
    title: "Ứng dụng SDFish",
    category: "Ứng dụng cho ngư dân",
    line: "app",
    desc: "Thời tiết, đường đi, giá cá và chỗ bán ngay trên điện thoại",
    features: [
      "Ra khơi: bản đồ biển, dẫn đường, tin bão",
      "Giao dịch: giá cá theo vùng, vựa thu mua",
      "Tàu cá: giấy tờ, thiết bị đã lắp, gọi kỹ thuật",
    ],
    detail: {
      models: "SDFish, dùng trên điện thoại",
      maker: "Sản phẩm SDVICO phát triển. Trung tâm kết nối cho chủ tàu và bạn thuyền",
      forWho:
        "Chủ tàu và thuyền trưởng muốn biết thời tiết, đường đi, giá cá và chỗ bán ngay trên điện thoại, trước và trong chuyến biển.",
      benefits: [
        "Ra khơi: bản đồ biển, dẫn đường, thời tiết và tin bão, tính hải trình và dầu chạy.",
        "Giao dịch: giá cá theo vùng, biểu đồ giá cá ngừ, danh sách vựa thu mua có số gọi thẳng.",
        "Tàu cá: giấy tờ tàu, thiết bị đã lắp, gọi kỹ thuật SDVICO khi cần.",
        "Cảnh báo bão sớm ngay trang chủ để tính đường về.",
      ],
      specs: [
        { label: "Nền tảng", value: "Điện thoại, mở được bằng trình duyệt" },
        { label: "Tài khoản", value: "Đăng nhập bằng số điện thoại" },
        { label: "Bản đồ và dẫn đường", value: "Có, kèm ranh giới vùng biển" },
        { label: "Thời tiết, tin bão", value: "Có" },
        { label: "Giá cá, vựa thu mua", value: "Có, theo vùng" },
        { label: "Liên hệ", value: "0939 243 222" },
      ],
    },
    image: "/sdvico/sdfish.png",
    imgW: 760,
    imgH: 600,
  },
  {
    id: "app-ngu-dan-247",
    uuid: "b6e1a1a0-2222-4a22-8a22-000000000011",
    title: "Nhật ký khai thác điện tử Ngư dân 247",
    category: "Nhật ký khai thác điện tử",
    line: "app",
    desc: "Ghi nhật ký chuyến biển ngay trên điện thoại, không cần sóng ngoài biển",
    features: [
      "Bấm là xong: xuất bến, thả/thu lưới, cập bến",
      "Chuyển cá sang ghe tải bằng quét mã QR",
      "Không cần sóng, có sóng tự gửi lên",
    ],
    detail: {
      models: "Ứng dụng Ngư dân 247, dùng trên điện thoại",
      maker:
        "Sản phẩm SDVICO phát triển. Ghi nhật ký chuyến biển ngay trên điện thoại, có trên CH Play và App Store",
      forWho:
        "Chủ tàu và thuyền trưởng ghe lưới, ghe tải cần ghi nhật ký khai thác và thu mua mỗi chuyến biển, không muốn ghi tay.",
      benefits: [
        "Bấm là xong: xuất bến, thả lưới, thu lưới, khai sản lượng, cập bến. Tự ghi tọa độ và giờ.",
        "Ghe lưới chuyển cá sang ghe tải bằng quét mã QR, số ký sang thẳng nhật ký thu mua.",
        "Không cần sóng ngoài biển, app tự lưu, có sóng sẽ tự gửi lên.",
      ],
      specs: [
        { label: "Nền tảng", value: "Android trên CH Play, iPhone trên App Store" },
        { label: "Tài khoản", value: "Mã tàu (biển số) và mật khẩu SDVICO cấp" },
        { label: "Ghe lưới", value: "Xuất bến, thả và thu lưới, khai sản lượng, cập bến" },
        { label: "Ghe tải", value: "Nhận cá từ ghe lưới qua mã QR, danh sách thu mua" },
        { label: "Kết nối hai ghe", value: "Chung mạng WiFi của thiết bị SCONECT" },
        { label: "Hỗ trợ", value: "0254 359 6868, sdvico.vn" },
      ],
    },
    image: "",
    imgW: 760,
    imgH: 600,
  },
];
