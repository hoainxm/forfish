/*
  BẢNG NHÃN CHUẨN — một tên cho mỗi hành động lặp lại, dùng chung toàn app
  (anh Long 2026-10-19: "các quy tắc về nhãn, kích thước các kiểu, tối đa chữ 1
  nhãn là 2 chữ thôi, ko phải mở rộng theo chiều dài của chữ, đặt tên nhãn chuẩn vào").

  LUẬT (03 §Nhãn):
   · Mỗi nhãn nút / tab / chip / mục dock / tiêu đề hàng TỐI ĐA 2 CHỮ (2 tiếng).
     Ngoại lệ duy nhất: tên riêng "Sen Biển" tính là một tên.
   · Kích thước nút/tab/chip CỐ ĐỊNH theo loại (bậc trong 03 §0), không nở theo
     chữ — vì nhãn đã ≤2 chữ nên ô cố định luôn đủ.
   · Thêm hành động mới ⇒ thêm vào đây (test labels.test.ts gác ≤2 chữ), không
     đặt tên tại chỗ.
  Số đếm đi kèm (vd "Xem thêm" + "3") là SỐ, không tính là chữ — đặt ở nhãn phụ
  hoặc badge, không nối vào tên nút.
*/
export const NHAN = {
  // ghi / huỷ
  luu: "Lưu",
  huy: "Huỷ",
  sua: "Sửa",
  xoa: "Xoá",
  hienLai: "Hiện lại",
  them: "Thêm",
  xong: "Xong",
  tiep: "Tiếp",
  gui: "Gửi",
  dong: "Đóng",
  an: "Ẩn",
  duongDi: "Đường đi",
  /** menu chạm giữ 3 giây trên bản đồ — tàu đã phát AIS quanh điểm (tài khoản được xem AIS) */
  tauQuanh: "Tàu quanh",
  thuGon: "Thu gọn",
  xemThem: "Xem thêm",
  xemTruoc: "Xem trước",
  chiTiet: "Chi tiết",
  quayLai: "Quay lại",
  thuLai: "Thử lại",
  doi: "Đổi",
  chon: "Chọn",
  chep: "Chép",
  chiaSe: "Chia sẻ",
  camDang: "Cấm đăng",
  cangNha: "Cảng nhà",
  // giấy tờ tàu (2026-10-26): chụp để app đọc hạn · mở màn trình cho cán bộ
  chupGiay: "Chụp giấy",
  // màn căn góc sau khi chụp (2026-10-26)
  chupLai: "Chụp lại",
  dungAnh: "Dùng ảnh",
  xuatTrinh: "Xuất trình",
  // tài khoản
  dangNhap: "Đăng nhập",
  dangKy: "Đăng ký",
  dangXuat: "Đăng xuất",
  taiKhoan: "Tài khoản",
  capLai: "Cấp lại",
  // liên hệ / mua bán
  goi: "Gọi",
  lienHe: "Liên hệ",
  dangTin: "Đăng tin",
  // Chợ cá — menu ⋯ của tin mình (CC-03/CC-15/CC-20, 2026-10-25)
  daXong: "Đã xong",
  moLai: "Mở lại",
  dangXoa: "Đang xoá",
  themMoi: "Thêm mối",
  datHang: "Đặt hàng",
  muaLai: "Mua lại",
  baoGia: "Báo giá",
  gioHang: "Giỏ hàng",
  donHang: "Đơn hàng",
  thanhToan: "Thanh toán",
  muaDo: "Mua đồ",
  giaHan: "Gia hạn",
  // Số khác của tôi (0086) — số mua hàng SDVICO / số máy giám sát khác số đăng nhập
  themSo: "Thêm số",
  rutSo: "Rút số",
  yeuCau: "Yêu cầu",
  tim: "Tìm",
  loc: "Lọc",
  // bản đồ / Sen Biển
  mo: "Mở",
  nhap: "Nhập", // khối hạn giấy dưới bài luật Sen Biển (14 §21f): giấy chưa lưu / chưa có ngày hết hạn
  lop: "Lớp",
  viTri: "Vị trí",
  chayTau: "Chạy tàu",
  dangChay: "Đang chạy",
  loTrinh: "Lộ trình",
  dauDuong: "Dẫn đường",
  batDau: "Bắt đầu",
  dung: "Dừng",
  diem: "Điểm",
  daLuu: "Đã lưu",
  tinhDuong: "Tính đường",
  gheThem: "Ghé thêm", // chạm giữ bản đồ khi bảng Lộ trình đang mở
  veLai: "Vẽ lại", // lệch xa tuyến đang dẫn ⇒ tính lại từ chỗ tàu
  chayTiep: "Chạy tiếp", // lỡ tay bấm Dừng giữa chuyến
  ranhTay: "Rảnh tay", // gọi "Sen Biển ơi" không chạm khi đang dẫn đường
  veTau: "Về tàu",
  noi: "Nói",
  nghe: "Nghe",
  bieuDo: "Biểu đồ",
  caiDat: "Cài đặt",
  saoLuu: "Sao lưu",
  taiXuong: "Tải xuống",
  caiApp: "Cài app",
  moApp: "Mở app",
  huongDan: "Hướng dẫn",
  chinhSach: "Chính sách",
  // dock 6 mục (lib/dock-nav.ts) — chỉ icon, tên đọc qua aria-label
  trangChu: "Trang chủ",
  kairos: "Kairos",
  banDo: "Bản đồ",
  /** khay ⋯ màn bản đồ → CHẾ ĐỘ HẢI ĐỒ `/hai-do` (kiểu máy hải đồ, 2026-11-04). "Hải đồ" đã là tên nhóm lớp trong khay Lớp — tránh trùng */
  kieuMay: "Kiểu máy",
  /** chip đường an toàn = suy từ mớn tàu (chế độ hải đồ) */
  theoMon: "Theo mớn",
  /** chế độ hải đồ đợt 2 (2026-11-04): canh neo · MOB · chuông · đo */
  thaNeo: "Thả neo",
  nhoNeo: "Nhổ neo",
  daVot: "Đã vớt",
  daBiet: "Đã biết",
  datGoc: "Đặt gốc",
  /** khay ⋯ chế độ hải đồ (cột nút thông minh, 2026-11-04) */
  mauSac: "Màu",
  doDac: "Đo",
  neoTau: "Neo",
  tuyenDi: "Tuyến",
  vetTau: "Vết",
  /** khay Lớp chế độ hải đồ (đợt 3) */
  toNong: "Tô nông",
  conNuoc: "Con nước",
  tuDong: "Tự động",
  /** bảng Tuyến / Vết chế độ hải đồ (đợt 4) */
  boDiem: "Bỏ điểm",
  daoTuyen: "Đảo tuyến",
  kiemTuyen: "Kiểm tuyến",
  xuatGpx: "Xuất GPX",
  nhapGpx: "Nhập GPX",
  ghiVet: "Ghi vết",
  dungGhi: "Dừng ghi",
  taoTuyen: "Tạo tuyến",
  /** sau đợt 4 (2026-11-04): khay ⋯ → danh sách tàu AIS; chip xếp; lớp gió/sóng toàn vùng */
  cacTau: "Tàu",
  sapGap: "Sắp gặp",
  ganNhat: "Gần nhất",
  theoTen: "Tên",
  /** loại điểm người dùng trên Hải đồ (rà soát 2026-11-04) */
  diemCa: "Chỗ cá",
  diemRan: "Rạn",
  diemXac: "Xác tàu",
  diemNeo: "Chỗ neo",
  gio: "Gió",
  song: "Sóng",
  tauToi: "Tàu tôi",
  choCa: "Chợ cá",
  vatTu: "Vật tư",
  // dock theo vai (17-ba-spec-vai-tai-khoan §4.1): ô Việc làm (đi bạn) · ô Bán hàng (đại lý)
  viecLam: "Việc làm",
  banHang: "Bán hàng",
  // Việc làm (17 §6) — hai tab, nút tin tuyển / hồ sơ
  timTau: "Tìm tàu",
  timNguoi: "Tìm người",
  hoSo: "Hồ sơ",
  tuyenNguoi: "Tuyển người",
  duNguoi: "Đủ người",
  giayTo: "Giấy tờ",
  // hồ sơ vựa (17 §12.4) · đại lý (17 §12.5)
  xacMinh: "Xác minh",
  sapHet: "Sắp hết",
  khongCo: "Không có",
  // Kairos (14-ba-spec-kairos) — chân thẻ bài
  hay: "Hay",
  binhLuan: "Bình luận",
  chinhThuc: "Chính thức",
  // Kairos — tab "Chính sách" (14 §21): hai tab trên màn Kairos + nhãn nguồn nhà nước trên thẻ + liên kết file đính kèm
  dongTin: "Dòng tin",
  nhaNuoc: "Nhà nước",
  dinhKem: "Đính kèm",
  traCuu: "Tra cứu",
  coTen: "Có tên",
  ghim: "Ghim",
  dangNong: "Đang nóng",
  // Kairos — đăng bài, bình luận, chia sẻ, hồ sơ (AC07–AC15)
  dang: "Đăng",
  dangGui: "Đang gửi",
  dangTai: "Đang tải",
  dangMo: "Đang mở",
  anh: "Ảnh",
  canSong: "Cần sóng",
  dongY: "Đồng ý",
  // Pháp lý (2026-11-05): link Điều khoản sử dụng · Chính sách quyền riêng tư
  dieuKhoan: "Điều khoản",
  riengTu: "Riêng tư",
  traLoi: "Trả lời",
  dangLai: "Đăng lại",
  guiDi: "Gửi đi",
  chepLink: "Chép link",
  taiAnh: "Tải ảnh",
  baoXau: "Báo xấu",
  chan: "Chặn",
  boChan: "Bỏ chặn",
  theoDoi: "Theo dõi",
  doiTen: "Đổi tên",
  doiAnh: "Đổi ảnh",
  boAnh: "Bỏ ảnh",
  bo: "Bỏ",
  trangToi: "Trang tôi",
  // rà FB lô 2 (2026-10-25) — nhãn các khu xin thêm
  cang: "Cảng",
  toaDo: "Toạ độ",
  // Chế độ AIS (2026-10-29): nút rail, hai cách xem Bán kính / Toàn biển, chip lọc Tất cả/Tới gần/Tàu cá, nút về hải đồ
  ais: "AIS",
  banKinh: "Bán kính",
  toanBien: "Toàn biển",
  dinhVi: "Định vị",
  tatCa: "Tất cả",
  tauCa: "Tàu cá",
  toiGan: "Tới gần",
  xemTau: "Xem tàu",
  datMon: "Đặt món",
  khongXoa: "Không xoá",
  khac: "Khác",
  dangBan: "Đang bán",
  tamNghi: "Tạm nghỉ",
  choDuyet: "Chờ duyệt",
  chuaDuyet: "Chưa duyệt",
  tamKhoa: "Tạm khoá",
  // Kairos — nút bánh răng "Tuỳ chọn dòng tin" (14 §13, aria-label/title — nút chỉ icon)
  tuyChon: "Tuỳ chọn",
  // Kairos — chuông chỉ 2 loại tin: bình luận bài mình / trả lời mình (14 §16, aria-label/title — nút chỉ icon)
  thongBao: "Thông báo",
  // Kairos — nhãn bài Tài trợ, BẮT BUỘC trên mọi thẻ quảng cáo (14 §20, Luật Quảng cáo 75/2025)
  taiTro: "Tài trợ",
  // Kairos — trang cá nhân kiểu Facebook (14 §3.8, AC13 bản 2026-10-24)
  baiViet: "Bài viết",
  gioiThieu: "Giới thiệu",
  deSau: "Để sau",
  cungCang: "Cùng cảng",
  // Kairos — lưu bài mang theo + tải tin mang đi (14 §18–§19). "Lưu" / "Đã lưu" / "Để sau" dùng nhãn chung ở trên
  boLuu: "Bỏ lưu",
  tai: "Tải",
  // Kairos — khung soạn: × khi đã viết hỏi Lưu nháp · Bỏ bài · Viết tiếp; hộp gắn cảng có dòng "Không gắn" (14 §3.3)
  luuNhap: "Lưu nháp",
  boBai: "Bỏ bài",
  vietTiep: "Viết tiếp",
  khongGan: "Không gắn",
  // Mảnh dùng chung lô 2 rà FB (2026-10-25): toast "Hoàn tác", chân sheet, chợ/vật tư/Kairos
  hoanTac: "Hoàn tác",
  capNhat: "Cập nhật",
  giuMo: "Giữ mở",
  nhan: "Nhắn",
  lamBia: "Làm bìa",
  anTin: "Ẩn tin",
  chonTinh: "Chọn tỉnh",
  xemShop: "Xem shop",
  veGio: "Về giỏ",
  tienMat: "Tiền mặt",
  chuyenKhoan: "Chuyển khoản",
  // Cổng nhãn (2026-10-29, labels.test.ts quét chữ trần trong <button>/<Link>): tên cho các
  // nút trước đặt tại chỗ hoặc dài >2 chữ ("Dời hẹn giao" → Đổi hẹn, "Lấy chỗ đang xem" → Chỗ xem…)
  taiLai: "Tải lại",
  themTau: "Thêm tàu",
  coRoi: "Có rồi",
  chuaCo: "Chưa có",
  giayMoi: "Giấy mới",
  xemGiay: "Xem giấy",
  baiMoi: "Bài mới",
  xemDon: "Xem đơn",
  suaGio: "Sửa giỏ",
  muaTiep: "Mua tiếp",
  sdvico: "SDVICO",
  xemGio: "Xem giỏ",
  boHet: "Bỏ hết",
  danhGia: "Đánh giá",
  guiLai: "Gửi lại",
  themMon: "Thêm món",
  themLoai: "Thêm loại",
  xoaMon: "Xoá món",
  xoaTim: "Xoá tìm",
  hetHang: "Hết hàng",
  doiHen: "Đổi hẹn",
  nganHang: "Ngân hàng",
  chonNgay: "Chọn ngày",
  themAnh: "Thêm ảnh",
  trangWeb: "Trang web",
  nguon: "Nguồn",
  zalo: "Zalo",
  goiSdvico: "Gọi SDVICO",
  luuDiem: "Lưu điểm",
  choXem: "Chỗ xem",
  thoi: "Thôi",
  xoaHan: "Xoá hẳn",
  themDiem: "Thêm điểm",
  denDiem: "Đến điểm",
  luuDuong: "Lưu đường",
  doLai: "Đo lại",
  daNghe: "Đã nghe",
  taiGiong: "Tải giọng",
  ngheThu: "Nghe thử",
  di: "Đi",
  gan: "Gần",
  caNuoc: "Cả nước",
  xemDu: "Xem đủ",
  // Cổng nhãn qua prop (2026-10-29 đợt nốt nợ — labels.test.ts PROP_NHAN): nhãn CallButton /
  // SdvicoRequestButton / RailBtn trước đặt tại chỗ ("Gọi hỏi giá", "Đặt lịch / hỏi về kỳ này"…)
  goiShop: "Gọi shop",
  hoiGia: "Hỏi giá",
  hoiMua: "Hỏi mua",
  muaThem: "Mua thêm",
  baoHanh: "Bảo hành",
  datLich: "Đặt lịch",
  diemLuu: "Điểm lưu",
  // Đề xuất lộ trình chuyến biển `/lo-trinh` (09-ba-spec §4, 2026-10-29): lối vào ở khay ⋯ bản đồ,
  // nút tính, bốn nghề. "Tôi ở đâu" (3 chữ) dùng NHAN.viTri; "Xem bản đồ" dùng NHAN.banDo.
  chuyenBien: "Chuyến biển",
  tinh: "Tính",
  dangTinh: "Đang tính",
  cauNgu: "Câu ngừ",
  luoiVay: "Lưới vây",
  luoiRe: "Lưới rê",
  chupMuc: "Chụp mực",
  // Cào (lưới kéo đơn) + cào đôi (2026-11-08): bà con miền Nam gọi "cào", đăng kiểm ghi "lưới kéo"
  cao: "Cào",
  caoDoi: "Cào đôi",
  // Bộ chọn loài lớp Dự báo cá (2026-11-04): mở danh sách đủ loài ngoài gợi ý
  loaiKhac: "Loài khác",
  // Chip trạng thái ĐƠN SDVICO (CRM → /cho/don, ADR 0018, 2026-11-02) — 4 mã CRM đã chuẩn hoá.
  chuanBi: "Chuẩn bị",
  dangGiao: "Đang giao",
  daGiao: "Đã giao",
  daHuy: "Đã huỷ",
} as const;

/**
 * Nhãn chip Kairos theo mã chip (`lib/kairos/thoi-quen.ts` CHIPS). Bảng riêng vì "Nghề cá",
 * "Đời sống"… cũng là TÊN CHỦ ĐỀ trên thẻ bài — đọc chung một bảng, khỏi lệch.
 */
export const NHAN_CHIP_KAIROS = {
  moi: "Mới",
  "nghe-ca": "Nghề cá",
  "cang-toi": "Cảng tôi",
  "gan-toi": "Gần tôi",
  "theo-doi": "Theo dõi",
  "thoi-su": "Thời sự",
  "phap-luat": "Pháp luật",
  "doi-song": "Đời sống",
  "the-thao": "Thể thao",
  "giai-tri": "Giải trí",
  "kinh-te": "Kinh tế",
  "chinh-sach": "Chính sách",
} as const;

/** Nhãn loại tin tab Chính sách Kairos (mã ở `lib/kairos/chinh-sach.mjs` LOAI_TIN, 14 §21d) — ≤2 chữ. */
export const NHAN_LOAI_TIN = {
  dau: "Hỗ trợ 48",
  "ho-tro": "Hỗ trợ",
  "canh-bao": "Cảnh báo",
  "quy-dinh": "Quy định",
  iuu: "IUU",
  "danh-sach": "Danh sách",
} as const;

/**
 * TÊN GÓI TRẢ PHÍ hiển thị cho bà con (chốt 2026-10-29, thay chữ "Premium"/"premium" tiếng Anh).
 * Gói = dự báo cá + lớp nguồn cho bán + dẫn đường + tra cảnh báo chéo (tier.ts). 07/01 vốn gọi
 * "gói dự báo cá" ⇒ rút gọn "gói dự báo". CHỈ chữ hiển thị — mã/khoá/route vẫn `premium`.
 */
export const TEN_GOI = "gói dự báo";
export const TEN_GOI_HOA = "Gói dự báo";

export type NhanId = keyof typeof NHAN;

/** Số CHỮ (tiếng) của một nhãn — số và dấu câu không tính; "Sen Biển" đếm là 1. */
export function demChu(nhan: string): number {
  const s = nhan.replace(/Sen Biển/g, "SenBiển").replace(/[0-9.,:;!?/()·—–-]+/g, " ").trim();
  return s ? s.split(/\s+/).length : 0;
}

export const NHAN_TOI_DA_CHU = 2;

export function nhanHopLe(nhan: string): boolean {
  return demChu(nhan) <= NHAN_TOI_DA_CHU;
}
