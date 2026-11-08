// ĐỀ XUẤT LỘ TRÌNH CHUYẾN BIỂN — kiểu dữ liệu chung (hợp đồng giữa thuật toán `lo-trinh/plan.ts`
// và màn hình `/lo-trinh`). Oracle hành vi: docs/app-map/09-ba-spec-lo-trinh-chuyen-bien.md
// §3 (pipeline B0–B3, B5), §4 (form + output), §5 (ràng buộc trung thực), §5c (lưu + so vị trí).
// MVP = Phase 1 của §6: chưa GRASP, chưa re-plan giữa chuyến, chưa mask giờ theo nghề/con trăng.

/** Nghề — §4. MVP tune cho câu cá ngừ; nghề khác dùng mẫu tham số tạm. */
export type Nghe = "cau-ngu" | "luoi-vay" | "luoi-re" | "chup-muc";

export interface DiemCoTen {
  lat: number;
  lon: number;
  /** tên đời thường: "Cảng Quy Nhơn", "Chà ông Tư"… */
  ten: string;
}

/** Thông số tàu dùng để tính — lấy từ hồ sơ tàu `forfish.boat.v1` (BoatProfile), sửa được tại chỗ. */
export interface TauTinh {
  speedKn: number;
  litersPerHour: number;
  /** két dầu (lít); null = chưa khai ⇒ không cảnh báo thiếu dầu, chỉ báo tổng lít */
  fuelTankL: number | null;
}

/** Ô cá đầu vào — cùng hình `FishCell` của fish-predict (lat, lon, điểm 0–100). */
export interface OCa {
  lat: number;
  lon: number;
  s: number;
  /** loài cho điểm `s` (tên ngắn) — có khi chấm theo nghề */
  loai?: string;
}

/** Tin bão rút gọn cho cổng bão 0–5 ngày (§5b): tâm + bán kính ảnh hưởng (km) + các điểm dự báo. */
export interface BaoRutGon {
  ten: string;
  /**
   * `at` (tuỳ chọn, epoch ms — như `TrackPoint.at` của bản tin NCHMF): mốc giờ bão ở điểm đó.
   * Có `at` và rơi SAU 5 ngày đầu chuyến ⇒ không chặn (cửa sổ 0–5 ngày, §5b). Không có `at`
   * (GDACS không cho mốc giờ) ⇒ coi như bão có mặt suốt cửa sổ — thà báo thừa.
   */
  diem: { lat: number; lon: number; at?: number }[];
}

export interface LoTrinhInput {
  /** cảng xuất bến = cảng về */
  cang: DiemCoTen;
  /** ngày xuất bến, YYYY-MM-DD (giờ VN) */
  ngayDi: string;
  /** đi mấy ngày; tính tối đa 16 (trần dữ liệu) — khai hơn thì tính 16 ngày đầu + ghi chú */
  soNgay: number;
  nghe: Nghe;
  tau: TauTinh;
  /** 0–5 điểm quen/chà bà con muốn ghé (hạt nhân tuyến — §4) */
  diemQuen: DiemCoTen[];
  /**
   * Điểm cá của ô theo NGÀY THỨ d của chuyến (0 = ngày xuất bến). Màn hình dựng hàm này từ bản
   * đồ cá đã lọc trong vùng (`locBanDoCaTrongVung`) + pha mùa vụ (`blendFishCells`, `fishLeadDays`).
   * Thuật toán KHÔNG tự tải gì — thuần, test được.
   */
  caTheoNgay: (d: number) => readonly OCa[];
  /** tin bão hiện có; null = CHƯA kiểm được tin bão (phải nói ra, không im — luật stormGateForRoute) */
  bao: BaoRutGon[] | null;
  /**
   * Sóng cao nhất (m) + gió mạnh nhất (km/h) NGÀY THỨ d của chuyến tại một chỗ — từ lưới gió sóng đủ vùng
   * (`forecast-grid`, có bản lưu offline). Vắng / null / trả null ⇒ chưa có dự báo: hệ số biển = 1 và thuật
   * toán GHI CHÚ "chưa né ngày biển động" (lo-trinh/he-so.ts).
   */
  bienTheoNgay?: ((lat: number, lon: number, d: number) => { songM: number | null; gioKmh: number | null } | null) | null;
}

/** Các yếu tố của MỘT ngày đánh ở một vùng — đưa ra cho bà con thấy máy chấm bằng gì (he-so.ts). */
export interface YeuToNgay {
  /** ngày thứ mấy của chuyến (từ 1) */
  ngay: number;
  /** điểm cá theo nghề 0–100 (làm tròn) */
  ca: number;
  /** độ rọi trăng 0–100 % (0 = trăng non, 100 = rằm) */
  trang: number;
  /** sóng cao nhất ngày (m), null = chưa có dự báo */
  songM: number | null;
  /** gió mạnh nhất ngày (km/h), null = chưa có dự báo */
  gioKmh: number | null;
  /** hệ số tổng trăng × biển (0–1, 2 số lẻ) — điểm ngày = cá × hệ số */
  heSo: number;
}

export type LoaiChang = "chay" | "danh" | "ve";

/** Một dòng lịch chuyến theo ngày — §4 "mỗi ngày 1 dòng". */
export interface DongLich {
  /** ngày bắt đầu/kết thúc của dòng, đếm từ 1 (ngày xuất bến = ngày 1) */
  tuNgay: number;
  denNgay: number;
  loai: LoaiChang;
  /** vùng đánh liên quan (với "danh" và "chay" tới vùng) */
  vungId?: string;
  /** câu đời thường, vd "Chạy ra vùng 1 (khoảng 36 giờ)" — không hứa cá, không phần trăm */
  cau: string;
}

export interface VungDanh {
  id: string;
  /** "Vùng 1", "Vùng 2"… theo thứ tự ghé */
  ten: string;
  lat: number;
  lon: number;
  /** điểm cao nhất trong vùng (0–100) — UI chỉ đổi ra thang Được/Khá/Tốt, không in số */
  dinh: number;
  /** số ngày đánh ở vùng này */
  soNgayDanh: number;
  /** là điểm quen bà con nhập (không phải vùng app gợi ý) */
  laDiemQuen?: boolean;
  /** loài chính của vùng theo nghề (tên ngắn, vd "ngừ vây vàng") — vắng ở điểm quen / lộ trình lưu cũ */
  loai?: string;
  /** yếu tố từng ngày đánh ở vùng này — vắng ở lộ trình lưu cũ */
  yeuTo?: YeuToNgay[];
}

export interface LoTrinhKetQua {
  /** đi theo thứ tự: cảng → vùng… → cảng */
  vung: VungDanh[];
  lich: DongLich[];
  /** các mốc theo thứ tự (cảng, vùng/điểm quen…, cảng) — để vẽ và để nạp vào dẫn đường nhiều chặng */
  moc: (DiemCoTen & { loai: "cang" | "vung" | "diem-quen" })[];
  /** ước tính, đã làm tròn — "khoảng" */
  haiLy: number;
  litDau: number;
  /** tổng lít × 1,3 (dự phòng) vượt két ⇒ true */
  thieuDau: boolean;
  /** ngày nên quay về (YYYY-MM-DD) — mặc định theo nghề (§4) */
  ngayNenVe: string;
  /** số ngày thực tính (≤16) */
  soNgayTinh: number;
  /** có bão trong cửa sổ 0–5 ngày đè lên tuyến ⇒ KHÔNG đưa lộ trình, chỉ câu này (§4 "thay cho lộ trình") */
  chanBao: string | null;
  /** câu ghi chú trung thực: chưa kiểm được bão, chỉ tính 16 ngày đầu, tốc độ mặc định… */
  ghiChu: string[];
}

/** Bản ghi lộ trình đã lưu — khoá `forfish.routes.v1` (§5c), gắn tàu, kèm tuổi dữ liệu lúc tính. */
export interface LoTrinhDaLuu {
  id: string;
  ten: string;
  boatId: string | null;
  taoLuc: string; // ISO
  /** tuổi dữ liệu lúc tính — mở lại phải nói thật "tính từ bản đồ cá N ngày trước" */
  tuoiDuLieu: { ca: string | null; bao: string | null };
  input: Omit<LoTrinhInput, "caTheoNgay" | "bao" | "bienTheoNgay">;
  ketQua: LoTrinhKetQua;
}
