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
  them: "Thêm",
  xong: "Xong",
  tiep: "Tiếp",
  gui: "Gửi",
  dong: "Đóng",
  an: "Ẩn",
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
  tauToi: "Tàu tôi",
  choCa: "Chợ cá",
  vatTu: "Vật tư",
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
