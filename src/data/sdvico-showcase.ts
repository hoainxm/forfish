// SẢN PHẨM CHÍNH SDVICO — lấy NGUYÊN VĂN từ showcase trên sdvico.vn
// (trích 2026-06-11 từ trang chủ chính thức; ảnh tải về /public/sdvico/
// vì URL asset của site là hash Vite, đổi mỗi lần site rebuild).
//
// User chốt: mục Khuyến nghị CHỈ hiện sản phẩm chính kiểu app shop —
// không đổ phụ kiện/vật tư lẻ cho rối. `line` nối về nhóm SKU CRM
// (sdvico-catalog.ts) để biết khách đang dùng dòng nào.

export const SDVICO_HOTLINE = "1900232349";
export const SDVICO_HOTLINE_DISPLAY = "1900 23 23 49";

export interface ShowcaseProduct {
  id: string;
  title: string;
  /** nhãn loại hiện trên thẻ (đúng chữ sdvico.vn) */
  category: string;
  /** id dòng theo nhóm SKU CRM — để biết "đang dùng" */
  line: string;
  desc: string;
  features: string[];
  image: string;
  imgW: number;
  imgH: number;
}

export const SDVICO_SHOWCASE: ShowcaseProduct[] = [
  {
    id: "may-loc-nuoc-bien-sea40",
    title: "Máy lọc nước biển SEA-40",
    category: "Máy lọc nước biển",
    line: "loc-nuoc",
    desc: "Máy lọc nước biển thành nước ngọt công suất 40L/h",
    features: [
      "Công nghệ RO tiên tiến",
      "Hoạt động bằng điện 220VAC/380VAC",
      "Thiết kế gọn, hợp tàu thuyền",
    ],
    image: "/sdvico/sea40.jpg",
    imgW: 760,
    imgH: 600,
  },
  {
    id: "thiet-bi-gsht-viettel-s-tracking",
    title: "Thiết bị GSHT tàu cá VIETTEL S-Tracking",
    category: "Giám sát hành trình",
    line: "giam-sat",
    desc: "Thiết bị giám sát hành trình tàu cá theo quy định, hỗ trợ định vị và truyền dữ liệu ngoài khơi",
    features: [
      "Định vị GPS chính xác",
      "Truyền dữ liệu qua di động và vệ tinh",
      "Chống nước IP67",
    ],
    image: "/sdvico/s-tracking.jpg",
    imgW: 760,
    imgH: 600,
  },
  {
    id: "thuraya-marine-star-mnb-01",
    title: "Thuraya Marine Star MNB-01",
    category: "Liên lạc vệ tinh",
    line: "dien-thoai-ve-tinh",
    desc: "Thiết bị liên lạc vệ tinh chuyên dụng cho tàu thuyền và ngành hàng hải",
    features: [
      "Gọi qua vệ tinh giữa biển",
      "Thoại ổn định, GPS tích hợp",
      "Hợp môi trường hàng hải",
    ],
    image: "/sdvico/thuraya.jpg",
    imgW: 1200,
    imgH: 800,
  },
  {
    id: "dien-thoai-ve-tinh-xt-pro",
    title: "Điện thoại vệ tinh XT-Pro",
    category: "Liên lạc vệ tinh",
    line: "dien-thoai-ve-tinh",
    desc: "Điện thoại vệ tinh di động cao cấp cho khu vực không có sóng di động",
    features: [
      "Kết nối toàn cầu",
      "Siêu bền, GPS và SOS tích hợp",
      "Hợp hoạt động ngoài khơi",
    ],
    image: "/sdvico/xt-pro.jpg",
    imgW: 480,
    imgH: 480,
  },
  {
    id: "thiet-bi-loc-dau-sf-50",
    title: "Thiết bị lọc dầu SF-50",
    category: "Thiết bị lọc dầu",
    line: "xu-ly-dau",
    desc: "Thiết bị lọc dầu công suất 50L/h, hỗ trợ tối ưu vận hành và giảm chi phí",
    features: [
      "Hiệu suất lọc cao",
      "Tiết kiệm năng lượng",
      "Giảm chi phí vận hành",
    ],
    image: "/sdvico/sf50.jpg",
    imgW: 760,
    imgH: 600,
  },
  {
    id: "pv-engine-rmi-nano-graphene",
    title: "PV ENGINE RMI Nano Graphene",
    category: "Dầu nhờn động cơ",
    line: "nhot",
    desc: "Dầu nhờn bôi trơn động cơ cao cấp với công nghệ Nano Graphene",
    features: [
      "Công nghệ Nano Graphene",
      "Giảm ma sát, tiết kiệm dầu chạy",
      "Bảo vệ động cơ khỏi hao mòn",
    ],
    image: "/sdvico/nano-graphene.jpg",
    imgW: 760,
    imgH: 600,
  },
];
