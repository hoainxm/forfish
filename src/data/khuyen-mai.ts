// KHUYẾN MÃI SDVICO — danh mục ưu đãi bán qua app (thuần, có test, không mạng).
//
// Anh Long 2026-10-26 (tin Zalo của Quân — "Vss Quân Bình Định"): "Đăng giúp em khuyến mãi sứ định vị giá bán thị trường
// 500k mua app khuyến mãi 200k, cho tất cả các kh cũ và mới (sứ dùng được cho tất cả các loại máy định vị)". Khách bấm
// SỬA 2026-10-27 (anh Long: "giảm 200k còn 300k chứ ko phải còn 200k"): giá app = 300.000đ (500k − 200k). Khách bấm
// Đăng ký ⇒ phiếu `sdvico_khach_hoi` (nguon san-pham, san_pham = `tenPhieu`) ⇒ AI Assistant nhắn Zalo cho Quân xử lý.
//
// Vì sao KHÔNG phải món trên Chợ vật tư: chợ là sàn nhiều đại lý, đơn phải có shop + tồn kho + giao hàng; ưu đãi này
// Quân tự giao, không cần giỏ/thanh toán. Vì sao không vào `sdvico-showcase`: showcase cố ý không có giá (tài liệu SDVICO),
// còn giá chính là điểm nhấn của khuyến mãi. Danh mục nhỏ, nằm trong bundle (không cần mạng để thấy ưu đãi khi mất sóng).

export interface BienThe {
  id: string;
  /** Chữ trên chip (≤2 chữ, vd "Bản cơ"). */
  nhan: string;
  /** Tên đầy đủ ghi vào phiếu cho KD đọc (vd "bản cơ SF50"). */
  ten: string;
  gia: number;
}

export interface KhuyenMai {
  id: string;
  /** Tên món hiện trên thẻ (ngắn). */
  ten: string;
  /** Tên ghi vào phiếu `san_pham` (≤120) — AI Assistant / Quân đọc là biết ngay ưu đãi nào. */
  tenPhieu: string;
  /** Giá thị trường (đồng) — gạch ngang trên thẻ. null = thẻ quảng bá giá thường, không gạch giá (lọc dầu 2026-10-31). */
  giaThiTruong: number | null;
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
  /** Đơn vị hiện trên thẻ/ngăn ("cái", "bộ"). Lời nhắn phiếu vẫn ghi "cái" (soLuongTuLoiNhan đọc theo đó). */
  donVi: string;
  /** Các bản để bà con chọn (giá riêng từng bản). Có ⇒ thẻ ghi "Từ <giá thấp nhất>", ngăn Đăng ký có chip chọn bản,
   *  lời nhắn phiếu ghi bản đã chọn + giá. `giaApp` = giá bản rẻ nhất (khớp chữ "Từ"). */
  bienThe?: BienThe[];
  /** Clip giới thiệu (tuỳ chọn): bấm ảnh thẻ là mở xem. `poster` hiện khi chưa tải/mất sóng. */
  video?: { src: string; poster: string; giay: number };
  /** Chat Zalo nhận phiếu (tuỳ chọn) — trống = chat mặc định của AI Assistant (`phieu_khach.gui_toi`, Quân). AI Assistant
   *  CHỈ nghe theo nếu tên nằm trong `phieu_khach.gui_them` của nó (máy chủ SDFish không tự chọn được chat bất kỳ). */
  guiToi?: string;
  /** Số lượng tối đa một lần đăng ký (chống gõ nhầm 200). */
  qtyMax: number;
  /** Hết hạn (ISO ngày, null = chưa định) — card tự ẩn sau ngày này. */
  hetHan: string | null;
}

export const KM_SU_DINH_VI: KhuyenMai = {
  id: "su-dinh-vi-gps",
  ten: "Sứ định vị GPS",
  tenPhieu: "KM Sứ định vị GPS 300k (giảm 200k)",
  giaThiTruong: 500_000,
  giaApp: 300_000,
  moTa: "Sứ (ăng-ten) GPS kèm dây, lắp được cho mọi loại máy định vị.",
  diemHay: [
    "Giá thị trường 500.000đ — mua qua app giảm 200.000đ, còn 300.000đ",
    "Dùng được cho tất cả các loại máy định vị",
    "Khách cũ hay khách mới đều được hưởng",
  ],
  image: "/sdvico/su-dinh-vi.jpg",
  imgW: 541,
  imgH: 720,
  doiTuong: "Mọi khách cũ và mới",
  donVi: "cái",
  qtyMax: 10,
  // Assumption: Quân chưa nêu ngày kết thúc ⇒ chạy tới khi anh Long/Quân bảo gỡ (sửa dòng này).
  hetHan: null,
};

// Anh Long 2026-10-31: "kiểm tra info giá của lọc dầu trong sdwork rồi cho chạy cái quảng cáo cạnh cái sứ anten". SDWork không có
// giá niêm yết (bảng products không cột giá) ⇒ anh hỏi Tiến KD trên Zalo, Tiến báo "cơ: 7,9tr, điện: 9,9tr" (31/10 08:26).
// Bản cơ = SF50 (dầu tự chảy), bản điện = SF300B (bơm 12 V). Giá thường, KHÔNG giảm ⇒ giaThiTruong null (thẻ không gạch giá).
// Ảnh + mô tả theo `sdvico-showcase` (may-loc-dau-diesel-sf).
export const KM_LOC_DAU: KhuyenMai = {
  id: "loc-dau-sf",
  ten: "Máy lọc dầu SF50 / SF300B",
  tenPhieu: "QC Máy lọc dầu diesel SF50 / SF300B",
  giaThiTruong: null,
  giaApp: 7_900_000,
  moTa: "Lọc cặn và tách nước khỏi dầu, giữ kim phun luôn sạch.",
  diemHay: [
    "Bản cơ SF50 7.900.000đ · bản điện SF300B 9.900.000đ",
    "Lọc 1–10 micron, tách nước, kỹ thuật SDVICO lắp tận tàu",
    "Vỏ inox 304 chịu muối biển, bảo hành 12 tháng",
  ],
  image: "/sdvico/loc-dau.jpg",
  imgW: 760,
  imgH: 600,
  doiTuong: "Mọi khách cũ và mới",
  donVi: "bộ",
  bienThe: [
    { id: "co", nhan: "Bản cơ", ten: "bản cơ SF50", gia: 7_900_000 },
    { id: "dien", nhan: "Bản điện", ten: "bản điện SF300B", gia: 9_900_000 },
  ],
  // Clip 65 s dựng 31/10 trên GPU (~/loc-dau-video/dung.py): cảnh thật từ bản tin SDVICO trong nhóm Zalo + giọng Sen Biển.
  video: { src: "/sdvico/loc-dau.mp4", poster: "/sdvico/loc-dau-poster.jpg", giay: 65 },
  // Anh Long 31/10: "khách đăng ký tư vấn thì chuyển qua nhóm Zalo Triển khai kinh doanh (trực ở gpu) tương tự của Quân".
  guiToi: "Triển Khai Kinh Doanh",
  qtyMax: 5,
  hetHan: null,
};

export const KHUYEN_MAI: KhuyenMai[] = [KM_SU_DINH_VI, KM_LOC_DAU];

export function timKhuyenMai(id: string): KhuyenMai | null {
  return KHUYEN_MAI.find((k) => k.id === id) ?? null;
}

/** Phiếu này có phải đăng ký khuyến mãi không — nhận theo `san_pham` (nguon vẫn là san-pham, không cần migration). */
export function khuyenMaiCuaPhieu(sanPham: string | null | undefined): KhuyenMai | null {
  if (!sanPham) return null;
  return KHUYEN_MAI.find((k) => k.tenPhieu === sanPham) ?? null;
}

/** Bản theo id; ưu đãi có bản mà id sai/thiếu ⇒ null (route trả 400). Ưu đãi không có bản ⇒ undefined (bỏ qua). */
export function timBienThe(k: KhuyenMai, id: unknown): BienThe | null | undefined {
  if (!k.bienThe?.length) return undefined;
  return k.bienThe.find((b) => b.id === id) ?? null;
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
export function loiNhanDangKy(o: { qty: number; noiNhan: string; ghiChu?: string | null; bienThe?: BienThe | null }): string {
  const parts = [`Đăng ký mua ${o.qty} cái`];
  if (o.bienThe) parts.push(`${o.bienThe.ten} ${tienVn(o.bienThe.gia)}`);
  parts.push(`nhận tại ${o.noiNhan.trim()}`);
  const g = (o.ghiChu ?? "").trim();
  if (g) parts.push(`ghi chú: ${g}`);
  return parts.join(" · ").slice(0, 500);
}

/** Đọc ngược lời nhắn thành số lượng (để tin Zalo in "Số lượng: 2"); không đọc được ⇒ null. */
export function soLuongTuLoiNhan(loiNhan: string | null | undefined): number | null {
  const m = /Đăng ký mua (\d{1,3}) cái/.exec(loiNhan ?? "");
  return m ? Number(m[1]) : null;
}
