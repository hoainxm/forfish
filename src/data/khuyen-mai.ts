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
  /** Một câu bản này KHÁC bản kia chỗ nào — hiện dưới chip khi đang chọn (anh Long 31/10: "phải phân biệt 2 loại này"). */
  khac?: string;
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
  /** Hỏi–đáp ngắn hiện dưới video (bà con hỏi TRƯỚC khi đăng ký — anh Long 31/10). Trong bundle ⇒ mất sóng vẫn đọc. */
  hoiDap?: { hoi: string; dap: string }[];
  /** Dòng giá trên thẻ ghi "Từ …" (nhiều bản / nhiều cấu hình). */
  giaTu?: boolean;
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
    { id: "co", nhan: "Bản cơ", ten: "bản cơ SF50", gia: 7_900_000, khac: "Không cần điện: dầu tự chảy qua lọc. Hợp tàu có két dầu đặt cao hơn máy." },
    { id: "dien", nhan: "Bản điện", ten: "bản điện SF300B", gia: 9_900_000, khac: "Có bơm 12V đẩy dầu, lọc nhanh cỡ 300 lít một giờ, đuổi bọt gió. Hợp tàu có két dưới hầm, đường ống dài." },
    { id: "tui", nhan: "Túi lọc", ten: "túi lọc dầu", gia: 190_000, khac: "Túi lọc thay cho máy đang dùng. Dầu chảy chậm lại là tới lúc thay." },
  ],
  giaTu: true,
  // Clip 65 s dựng 31/10 trên GPU (~/loc-dau-video/dung.py): cảnh thật từ bản tin SDVICO trong nhóm Zalo + giọng Sen Biển.
  video: { src: "/sdvico/loc-dau.mp4", poster: "/sdvico/loc-dau-poster.jpg", giay: 65 },
  // Anh Long 31/10: "khách đăng ký tư vấn thì chuyển qua nhóm Zalo Triển khai kinh doanh (trực ở gpu) tương tự của Quân".
  guiToi: "Triển Khai Kinh Doanh",
  // Mục 8 kịch bản tư vấn (docs/specs/kich-ban-tu-van-loc-dau.md, team agent 31/10, đã qua kiểm duyệt nội dung).
  hoiDap: [
    { hoi: "Máy lọc dầu giá bao nhiêu?", dap: "Có hai bản. Bản không điện 7 triệu 9, dầu tự chảy. Bản có bơm 9 triệu 9, bơm 12V, lọc cỡ 300 lít một tiếng. Kỹ thuật SDVICO tới tận tàu lắp. Bà con bấm Đăng ký để nhân viên SDVICO gọi tư vấn." },
    { hoi: "Hai bản khác nhau chỗ nào?", dap: "Bản không điện để dầu tự chảy qua lọc, hợp với tàu có két dầu đặt trên cao. Bản có bơm đẩy dầu mạnh và đuổi bọt gió, hợp với tàu có két dưới hầm hoặc cần lọc nhanh. Phần lọc giống nhau: bồn inox, túi lọc thay được, van xả khí, van xả cặn, có tách nước. Kỹ thuật xuống coi tàu rồi mới chốt bản." },
    { hoi: "Lắp lọc có đỡ tốn dầu không?", dap: "Theo tài liệu sản phẩm, máy có thể giúp giảm hao dầu khoảng 5–10%. Con số này chưa có đơn vị độc lập đo, thực tế tùy máy, tùy tàu. Máy được làm để tách nước và cặn trước khi dầu vào kim phun, bơm cao áp." },
    { hoi: "Có đáng tiền không?", dap: "Bà con nhẩm lại năm rồi máy làm mất mấy ngày biển, sửa kim, sửa bơm hết bao nhiêu. Máy lọc giúp phòng hư do nước và cặn trong dầu, nhưng không bảo đảm máy không hư. Bấm Đăng ký để nhân viên SDVICO tư vấn đúng tàu mình." },
    { hoi: "Sửa kim, sửa bơm hết bao nhiêu? Túi lọc bao lâu thay?", dap: "Sửa kim, sửa bơm thường tốn 60 tới 100 triệu một lần, tùy máy. Túi lọc cỡ 190–250 nghìn một túi, dầu chảy chậm lại là tới lúc thay. Lúc lắp, kỹ thuật dặn cụ thể theo tàu." },
    { hoi: "Ai lắp, bảo hành sao?", dap: "Kỹ thuật SDVICO tới tận tàu lắp và chạy thử. Bảo hành 12 tháng. Máy cỡ 52 x 20 x 50 cm, nặng 15 kg. SDVICO đã bán hơn 200 bộ, đã lắp ở các nơi như Phú Quý, Phan Thiết, La Gi, Quảng Ngãi, Nghệ An. Đội tàu Phú Quý phản hồi lọc dầu tốt (theo bản tin SDVICO)." },
    { hoi: "Máy khói đen, yếu máy, lắp lọc có hết không?", dap: "Bà con cho thợ coi lọc gió, tải và kim phun trước. Khói đen có thể do chở nặng, lọc gió nghẹt hay kim phun đã mòn, chưa chắc do dầu. Nếu lọc tinh mới thay mà đã nghẹt thì dầu bẩn, lúc đó máy lọc mới giúp được. Máy lọc để phòng, không chữa máy đã hư." },
    { hoi: "Khói xanh, khói trắng?", dap: "Khói xanh có thể do máy cháy nhớt, bà con cho thợ kiểm xéc măng, turbo. Máy lọc không chữa được bệnh này. Khói trắng mà két nước làm mát cứ hụt thì cũng phải kiểm máy. Khói trắng có mùi dầu sống khi máy đã nóng thì có thể do nước trong dầu, bà con xả đáy két coi có nước không." },
    { hoi: "Máy tắt khi sóng lớn, khó nổ?", dap: "Bà con xả đáy két coi có nước, có cặn không, coi lọc tinh có nghẹt không. Khó nổ, phải xả gió hoài thì tìm chỗ hở ở ống, khớp nối, gioăng cốc lọc trước. Nếu đúng là do nước, cặn trong dầu thì máy lọc giúp được." },
  ],
  qtyMax: 10,
  hetHan: null,
};

// MÁY LỌC NƯỚC BIỂN — anh Long 31/10: "tổ chức 1 luồng tương tự cho máy lọc nước". Giá theo bảng giá bán lẻ SDVICO (đã gồm
// VAT): cơ từ 38tr, điện từ 49,5tr. Thông số theo `sdvico-showcase` (may-loc-nuoc-bien-sea, tài liệu SDVICO 24/9).
export const KM_LOC_NUOC: KhuyenMai = {
  id: "loc-nuoc-bien",
  ten: "Máy lọc nước biển SEA",
  tenPhieu: "QC Máy lọc nước biển SEA (cơ / điện)",
  giaThiTruong: null,
  giaApp: 38_000_000,
  moTa: "Biến nước biển thành nước ngọt ngay trên tàu.",
  diemHay: [
    "Bản cơ từ 38.000.000đ · bản điện từ 49.500.000đ, đã gồm VAT",
    "Màng RO, cỡ 250 lít một giờ, tách 99,6% muối",
    "Kỹ thuật SDVICO lắp tận tàu, bảo hành 12 tháng cả màng RO, đầu bơm",
  ],
  image: "/sdvico/sea40.jpg",
  imgW: 760,
  imgH: 600,
  doiTuong: "Mọi khách",
  donVi: "bộ",
  bienThe: [
    { id: "co", nhan: "Bản cơ", ten: "bản cơ SD-M250 (giá từ)", gia: 38_000_000, khac: "Không có mô-tơ, không dùng điện. Giá theo cấu hình, nhân viên SDVICO báo đúng giá cho tàu mình." },
    { id: "dien", nhan: "Bản điện", ten: "bản điện SEA250 / SEA-40 (giá từ)", gia: 49_500_000, khac: "Có cụm mô-tơ 2,2 kW chạy điện tàu (220V hay 380V) kéo bơm cao áp. Giá theo công suất." },
  ],
  giaTu: true,
  // Clip 58 s dựng 31/10 trên GPU (~/loc-dau-video/dung_ln.py, giọng giong-ln/): cảnh SEA700B/SEA250 từ bản tin SDVICO.
  video: { src: "/sdvico/loc-nuoc.mp4", poster: "/sdvico/loc-nuoc-poster.jpg", giay: 58 },
  guiToi: "Triển Khai Kinh Doanh",
  hoiDap: [
    { hoi: "Máy lọc nước biển giá bao nhiêu?", dap: "Bản cơ từ 38 triệu, bản điện từ 49 triệu rưỡi, đã gồm VAT. Giá theo cấu hình, nhân viên SDVICO gọi lại báo đúng giá cho tàu mình. Kỹ thuật SDVICO tới tận tàu lắp." },
    { hoi: "Bản cơ với bản điện khác gì?", dap: "Bản cơ (SD-M250) không có mô-tơ, không dùng điện. Bản điện (SEA250, SEA-40) có cụm mô-tơ 2,2 kW chạy điện tàu 220 hay 380 vôn để kéo bơm cao áp. Phần lọc giống nhau: màng RO, lõi lọc thô, bơm cao áp, đồng hồ áp suất." },
    { hoi: "Lọc được bao nhiêu nước, uống được không?", dap: "Cỡ 250 lít một giờ, màng lọc 4040. Tách 99,6% muối, nước ra dưới 500 ppm, đạt chuẩn nước ăn uống của WHO theo tài liệu sản phẩm." },
    { hoi: "Lấy nước biển từ đâu, lắp ở đâu?", dap: "Máy lấy nước biển sạch từ bơm làm mát máy tàu. Kỹ thuật SDVICO tới tận tàu lắp và hướng dẫn. Máy cỡ 150 x 50 x 80 cm, nặng khoảng 60 kg." },
    { hoi: "Bảo hành sao?", dap: "Bảo hành 12 tháng, cả màng RO và đầu bơm. Kỹ thuật SDVICO lắp tận tàu và chạy thử." },
    { hoi: "Lõi lọc, màng lọc có phải thay không?", dap: "Lõi lọc thô thay theo độ dơ của nước, màng RO dùng lâu hơn. Lúc lắp, kỹ thuật dặn cụ thể theo tàu. Phụ tùng thay có ở SDVICO." },
  ],
  qtyMax: 3,
  hetHan: null,
};

// ẮC QUY TÀU CÁ — anh Long 31/10: "accu 4 triệu 200, dành riêng cho tàu, độc quyền bởi sdvico, có cọc bình riêng cho thiết
// bị điện tử". Thông số theo `sdvico-showcase` (ac-quy-globe-wpm-220). Anh Long "làm cả video cho accu đi" ⇒ có clip.
export const KM_AC_QUY: KhuyenMai = {
  id: "ac-quy-tau-ca",
  ten: "Ắc quy tàu cá Globe WPM-220",
  tenPhieu: "QC Ắc quy tàu cá Globe WPM-220 4.200.000đ",
  giaThiTruong: null,
  giaApp: 4_200_000,
  moTa: "Dành riêng cho tàu, có cọc bình riêng cho thiết bị điện tử.",
  // Clip 48 s dựng 31/10 trên GPU (~/loc-dau-video/dung3.py ac-quy): cảnh thiết bị điện tử trên tàu + máy + ảnh bình.
  video: { src: "/sdvico/ac-quy.mp4", poster: "/sdvico/ac-quy-poster.jpg", giay: 48 },
  diemHay: [
    "Giá 4.200.000đ một bình, đã gồm VAT — độc quyền SDVICO",
    "Có cọc bình riêng nối thiết bị điện tử: định vị, giám sát hành trình, bộ đàm",
    "12V 220Ah, dự trữ 380 phút khi máy phát ngừng sạc",
  ],
  image: "/sdvico/ac-quy.png",
  imgW: 700,
  imgH: 466,
  doiTuong: "Mọi khách",
  donVi: "bình",
  guiToi: "Triển Khai Kinh Doanh",
  hoiDap: [
    { hoi: "Ắc quy giá bao nhiêu?", dap: "4.200.000đ một bình, đã gồm VAT. Ắc quy dành riêng cho tàu, độc quyền SDVICO. Bà con bấm Đăng ký để nhân viên SDVICO gọi lại." },
    { hoi: "Cọc bình riêng để làm gì?", dap: "Bình có cọc riêng để nối thiết bị điện tử như định vị, giám sát hành trình, bộ đàm, tách khỏi cọc đề máy." },
    { hoi: "Bình mạnh cỡ nào?", dap: "12 vôn 220 Ah, dòng khởi động lạnh 1.150 A, dự trữ 380 phút khi máy phát ngừng sạc, theo nhãn của hãng." },
  ],
  qtyMax: 10,
  hetHan: null,
};

export const KHUYEN_MAI: KhuyenMai[] = [KM_SU_DINH_VI, KM_LOC_DAU, KM_LOC_NUOC, KM_AC_QUY];

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

/** CHỌN MỘT MÓN ĐỂ QUẢNG BÁ (anh Long 31/10: "tổ chức cái quảng cáo random chứ đừng hiện cả, 1 lúc xem 1 cái thôi").
 *  Bỏ món vừa hiện lần trước (`truoc`) và món đã đăng ký nếu còn món khác; `r` ∈ [0,1) (Math.random ở chỗ gọi — hàm thuần). */
export function chonMotKhuyenMai(ds: KhuyenMai[], truoc: string | null, daDangKy: ReadonlySet<string>, r: number): KhuyenMai | null {
  if (!ds.length) return null;
  const chua = ds.filter((k) => !daDangKy.has(k.id));
  const nhom = chua.length ? chua : ds;
  const khac = nhom.length > 1 ? nhom.filter((k) => k.id !== truoc) : nhom;
  return khac[Math.min(khac.length - 1, Math.floor(r * khac.length))];
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
