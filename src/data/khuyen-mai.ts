// KHUYẾN MÃI SDVICO — danh mục ưu đãi bán qua app (thuần, có test, không mạng).
//
// Anh Long 2026-10-26 (tin Zalo của Quân — "Vss Quân Bình Định"): "Đăng giúp em khuyến mãi sứ định vị giá bán thị trường
// 500k mua app khuyến mãi 200k, cho tất cả các kh cũ và mới (sứ dùng được cho tất cả các loại máy định vị)". Khách bấm
// Đăng ký ⇒ phiếu `sdvico_khach_hoi` (nguon san-pham, san_pham = `tenPhieu`) ⇒ AI Assistant nhắn Zalo cho Quân xử lý.
//
// Vì sao KHÔNG phải món trên Chợ vật tư: chợ là sàn nhiều đại lý, đơn phải có shop + tồn kho + giao hàng; ưu đãi này
// Quân tự giao, không cần giỏ/thanh toán. Vì sao không vào `sdvico-showcase`: showcase cố ý không có giá (tài liệu SDVICO),
// còn giá chính là điểm nhấn của khuyến mãi. Danh mục nhỏ, nằm trong bundle (không cần mạng để thấy ưu đãi khi mất sóng).

export interface KhuyenMai {
  id: string;
  /** Tên món hiện trên thẻ (ngắn). */
  ten: string;
  /** Tên ghi vào phiếu `san_pham` (≤120) — AI Assistant / Quân đọc là biết ngay ưu đãi nào. */
  tenPhieu: string;
  /** Giá thị trường (đồng) — gạch ngang trên thẻ. */
  giaThiTruong: number;
  /** Giá mua qua app (đồng). */
  giaApp: number;
  /** Một câu đời thường dưới tên. */
  moTa: string;
  /** Vài gạch đầu dòng trong ngăn đăng ký. */
  diemHay: string[];
  image: string;
  imgW: number;
  imgH: number;
  /** Ai được hưởng — chữ hiện cho bà con. */
  doiTuong: string;
  /** Số lượng tối đa một lần đăng ký (chống gõ nhầm 200). */
  qtyMax: number;
  /** Hết hạn (ISO ngày, null = chưa định) — card tự ẩn sau ngày này. */
  hetHan: string | null;
}

export const KM_SU_DINH_VI: KhuyenMai = {
  id: "su-dinh-vi-gps",
  ten: "Sứ định vị GPS",
  tenPhieu: "KM Sứ định vị GPS 200k",
  giaThiTruong: 500_000,
  giaApp: 200_000,
  moTa: "Sứ (ăng-ten) GPS kèm dây, lắp được cho mọi loại máy định vị.",
  diemHay: [
    "Giá thị trường 500.000đ — mua qua app chỉ 200.000đ",
    "Dùng được cho tất cả các loại máy định vị",
    "Khách cũ hay khách mới đều được hưởng",
  ],
  image: "/sdvico/su-dinh-vi.jpg",
  imgW: 541,
  imgH: 720,
  doiTuong: "Mọi khách cũ và mới",
  qtyMax: 10,
  // Assumption: Quân chưa nêu ngày kết thúc ⇒ chạy tới khi anh Long/Quân bảo gỡ (sửa dòng này).
  hetHan: null,
};

export const KHUYEN_MAI: KhuyenMai[] = [KM_SU_DINH_VI];

export function timKhuyenMai(id: string): KhuyenMai | null {
  return KHUYEN_MAI.find((k) => k.id === id) ?? null;
}

/** Phiếu này có phải đăng ký khuyến mãi không — nhận theo `san_pham` (nguon vẫn là san-pham, không cần migration). */
export function khuyenMaiCuaPhieu(sanPham: string | null | undefined): KhuyenMai | null {
  if (!sanPham) return null;
  return KHUYEN_MAI.find((k) => k.tenPhieu === sanPham) ?? null;
}

/** Ưu đãi còn hiệu lực hôm nay (hetHan null = còn). `today` = "YYYY-MM-DD". */
export function conHieuLuc(k: KhuyenMai, today: string): boolean {
  return !k.hetHan || today <= k.hetHan;
}

/** 200000 ⇒ "200.000đ" (chữ cho bà con, không "VND"). */
export function tienVn(n: number): string {
  return `${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}đ`;
}

/** Lời nhắn ghi vào phiếu (≤500) — Quân đọc là biết số lượng, nơi nhận, ghi chú. */
export function loiNhanDangKy(o: { qty: number; noiNhan: string; ghiChu?: string | null }): string {
  const parts = [`Đăng ký mua ${o.qty} cái`, `nhận tại ${o.noiNhan.trim()}`];
  const g = (o.ghiChu ?? "").trim();
  if (g) parts.push(`ghi chú: ${g}`);
  return parts.join(" · ").slice(0, 500);
}

/** Đọc ngược lời nhắn thành số lượng (để tin Zalo in "Số lượng: 2"); không đọc được ⇒ null. */
export function soLuongTuLoiNhan(loiNhan: string | null | undefined): number | null {
  const m = /Đăng ký mua (\d{1,3}) cái/.exec(loiNhan ?? "");
  return m ? Number(m[1]) : null;
}
