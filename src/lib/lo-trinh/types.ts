// ĐỀ XUẤT LỘ TRÌNH CHUYẾN BIỂN — kiểu dữ liệu chung (hợp đồng giữa thuật toán `lo-trinh/plan.ts`
// và màn hình `/lo-trinh`). Oracle hành vi: docs/app-map/09-ba-spec-lo-trinh-chuyen-bien.md
// §3 (pipeline B0–B3, B5), §4 (form + output), §5 (ràng buộc trung thực), §5c (lưu + so vị trí).
// MVP = Phase 1 của §6 (+ GRASP, khung đánh theo nghề 2026-11-08) + Phase 2 (2026-11-08): tính lại giữa chuyến từ chỗ
// tàu đang đứng (`diemDau`), sóng gió theo khung đánh (ô nửa ngày), dầu tách theo pha.
import type { CuaTrieu } from "./trieu-cang";
import type { DongTrongSo } from "./offline-trong-so";

/** Nghề — §4. MVP tune cho câu cá ngừ; nghề khác dùng mẫu tham số tạm. */
/** Cào (lưới kéo đơn) và cào đôi (kéo đôi) thêm 2026-11-08 — sổ đăng kiểm gộp chung "kéo", tách bằng vết VMS
 *  (docs/research/vet-tau-pha-nghe-2026-11.md §10). */
export type Nghe = "cau-ngu" | "luoi-vay" | "luoi-re" | "chup-muc" | "luoi-keo" | "keo-doi";

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
  /**
   * Dầu máy phát chong đèn, lít MỖI ĐÊM đánh (2026-11-08, research vet-tau §7 B5) — chỉ nghề đèn (vây, chụp, câu ngừ).
   * Vắng/null = chưa khai ⇒ không cộng, ghi chú "chưa tính dầu chong đèn". Tốc độ VMS không thấy được máy phát.
   */
  litDem?: number | null;
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
  /** giờ xuất bến 0–23 (giờ VN). Vắng (lộ trình lưu trước 2026-11-08) ⇒ 6 giờ sáng (`GIO_XUAT_BEN`). */
  gioDi?: number;
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
  bienTheoNgay?: ((lat: number, lon: number, d: number, khung?: KhungGio) => { songM: number | null; gioKmh: number | null } | null) | null;
  /**
   * BÃI CỦA NGHỀ (2026-11-08): mức tàu CÙNG NGHỀ đánh ở chỗ (lat, lon) ngày thứ d, 0–1 (1 = đông nhất quanh đó, 0 =
   * không ai đánh nghề này ở đó). Màn hình dựng từ lớp mật độ tàu theo nghề (`dungBaiTheoNgay`). Hàm vắng/trả null
   * ⇒ chưa có bãi ⇒ hệ số 1 + thuật toán GHI CHÚ (he-so.ts `heSoBai`).
   */
  baiTheoNgay?: ((lat: number, lon: number, d: number) => number | null) | null;
  /**
   * CON NƯỚC Ở CẢNG (2026-11-08, `trieu-cang.ts dungCuaTrieu`): giờ qua cửa lạch + giờ nước lớn. `rangBuoc` ⇒ giờ đi/về
   * dời tới lúc đủ nước; không ràng buộc ⇒ chỉ báo nước lớn. null/vắng ⇒ thuật toán ghi chú "chưa tính con nước".
   */
  cuaTrieu?: CuaTrieu | null;
  /**
   * TÍNH LẠI GIỮA CHUYẾN (Phase 2, 09 §6): chỗ tàu ĐANG ĐỨNG (GPS) làm điểm đầu — chuyến đi từ đây, vẫn về `cang`.
   * Có `diemDau` ⇒ không qua cửa lúc đi (đã ở ngoài biển), hạn về = `soNgay` (số ngày CÒN LẠI), không dùng mẫu ngày về của
   * nghề (đã đánh mấy ngày rồi app không biết). Vắng = chuyến mới từ cảng.
   */
  diemDau?: DiemCoTen | null;
}

/** Khung giờ trong một ngày: bắt đầu `tuGio` giờ kể từ 0 giờ ngày đó (âm = từ tối hôm trước), dài `soGio` giờ. */
export interface KhungGio {
  tuGio: number;
  soGio: number;
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
  /** mức tàu cùng nghề đánh ở chỗ đó 0–100 %; null = chưa có bãi; vắng = bản lưu trước 2026-11-08 */
  bai?: number | null;
  /** hệ số tổng trăng × biển × bãi (0–1, 2 số lẻ) — điểm ngày = cá × hệ số */
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
  /** lít dầu khi chặng chạy chậm cỡ P80 (× 1,3 dự phòng) vẫn vượt két ⇒ true — thuật toán đã ưu tiên tuyến vừa két,
   *  true nghĩa là KHÔNG tuyến nào vừa két */
  thieuDau: boolean;
  /** ngày nên quay về (YYYY-MM-DD) — mặc định theo nghề (§4) */
  ngayNenVe: string;
  /** số ngày thực tính (≤16) */
  soNgayTinh: number;
  /** có bão trong cửa sổ max(5 ngày, tới lúc về P80) đè lên tuyến ⇒ KHÔNG đưa lộ trình, chỉ câu này (§4 "thay cho lộ trình") */
  chanBao: string | null;
  /** câu ghi chú trung thực: chưa kiểm được bão, chỉ tính 16 ngày đầu, tốc độ mặc định… */
  ghiChu: string[];
  /** lít dầu tách theo pha (P50, chưa làm tròn tới chục): chạy · máy lúc đánh · máy phát chong đèn. Vắng = bản lưu cũ */
  dauTheoPha?: { chay: number; danh: number; den: number };
  /** lộ trình tính lại giữa chuyến: tên chỗ xuất phát (GPS) — vắng = chuyến từ cảng */
  tuChoDung?: string;
}

/** Bản ghi lộ trình đã lưu — khoá `forfish.routes.v1` (§5c), gắn tàu, kèm tuổi dữ liệu lúc tính. */
export interface LoTrinhDaLuu {
  id: string;
  ten: string;
  boatId: string | null;
  taoLuc: string; // ISO
  /** tuổi dữ liệu lúc tính — mở lại phải nói thật "tính từ bản đồ cá N ngày trước" */
  tuoiDuLieu: { ca: string | null; bao: string | null };
  input: Omit<LoTrinhInput, "caTheoNgay" | "bao" | "bienTheoNgay" | "baiTheoNgay" | "cuaTrieu">;
  ketQua: LoTrinhKetQua;
  /** lớp dữ liệu có/thiếu LÚC TÍNH (offline-trong-so.ts) — mở lại khi mất sóng so với bây giờ; vắng = lưu trước 2026-11-08 */
  trongSo?: DongTrongSo[];
}
