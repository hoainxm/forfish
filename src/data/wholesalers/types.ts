// Vựa / cơ sở thu mua hải sản — DOANH NGHIỆP có đăng tin công khai (Trang Vàng,
// danh bạ DN, listing Google Business, web/báo). Đây là tên + địa chỉ + SĐT THẬT
// tổng hợp từ nguồn công khai, KHÔNG bịa. Mọi mục là THAM KHẢO — gọi xác minh
// trước khi giao dịch (vựa hay đổi số/đóng cửa). Nậu cá nhân nhỏ không đăng tin
// thì bà con tự thêm ở mục "Mối quen".

export type WholesalerKind =
  | "vua"            // vựa hải sản
  | "co-so-thu-mua"  // cơ sở/doanh nghiệp thu mua
  | "dai-ly"         // đại lý thu mua
  | "nau-vua";       // nậu vựa tại cảng

export interface Wholesaler {
  id: string;
  name: string;
  kind: WholesalerKind;
  province?: string;     // tên tỉnh sau sáp nhập 2025
  address?: string;
  phone?: string;
  species?: string[];    // loài thu mua chính (nếu biết)
  source?: string;       // URL nguồn công khai
  note?: string;         // "tham khảo, cần xác minh" + chi tiết
}
