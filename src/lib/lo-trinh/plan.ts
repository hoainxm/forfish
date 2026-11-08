// ĐỀ XUẤT LỘ TRÌNH CHUYẾN BIỂN — thuật toán Phase 1 (docs/app-map/09-ba-spec-lo-trinh-chuyen-bien.md
// §3 B0–B5, §4 mẫu chuyến theo nghề, §5 ràng buộc trung thực). B4 GRASP tất định có từ 2026-11-08. Chưa re-plan
// giữa chuyến — đó là Phase 2.
//
// THUẦN: không React, không fetch, không localStorage — màn hình đưa dữ liệu vào qua `LoTrinhInput`.
// Tất định: cùng input ⇒ cùng output (không ngẫu nhiên; mọi chỗ hoà điểm đều phá bằng chỉ số).
//
// Mô hình thời gian: giờ t tính từ lúc xuất bến (t = 0 = giờ đi bà con chọn — mặc định GIO_XUAT_BEN — giờ VN ngày đi). Đánh cá theo KHUNG ĐÁNH
// CỦA NGHỀ (KHUNG_DANH, 2026-11-08): tới chỗ ngoài khung thì neo chờ khung kế, xong khung thì chạy tiếp; một
// khung được xếp vào ngày chứa điểm giữa khung. Cào đơn kéo cả ngày đêm ⇒ khung 24 giờ bắt đầu ngay khi tới.
// Giờ chạy = hải lý / tốc độ, đường thẳng (chưa né sóng gió — đó là việc của planRoute từng chặng).

import { haversineKm, type LatLon } from "@/lib/geo";
import { distToSegmentKm, STORM_SAFE_RADIUS_KM } from "@/lib/route-storm";
import { trongVungNhanh } from "@/lib/lo-trinh/vung-nhanh";
import { heSoDay } from "@/lib/lo-trinh/day-nghe";
import { TIM_TOI_DA_GIO } from "@/lib/lo-trinh/trieu-cang";
import { tideClockText } from "@/lib/tides";
import { doRoiTrang, gioChang, gioMayBai, heSoBai, heSoBien, heSoTrang, hieuUngRam, moHinhChang } from "@/lib/lo-trinh/he-so";
import type {
  BaoRutGon,
  DongLich,
  LoTrinhInput,
  LoTrinhKetQua,
  Nghe,
  OCa,
  VungDanh,
  YeuToNgay,
} from "@/lib/lo-trinh/types";

/* ───────────────────────── Tham số mặc định (ghi lại ở 09 §3 "Phase 1 ĐÃ LÀM") ─────────── */

/** Trần dữ liệu: lưới cá/thời tiết premium tới 16 ngày (§0 chốt #1). */
export const TRAN_SO_NGAY = 16;
/** Hồ sơ tàu thiếu số dầu thì tạm dùng (§2 "20L·h"). TỐC ĐỘ không còn mặc định 7 kn: giờ chặng theo số đo đội tàu
 *  cùng nghề `a + hải lý/v` (`moHinhChang`, model-params — docs/research/vet-tau-pha-nghe-2026-11.md, 2026-11-08). */
export const DAU_GIO_MAC_DINH_L = 20;
/**
 * Lấy mẫu đoạn thẳng giữa hai mốc mỗi 2 km để kiểm có ra ngoài vùng biển VN không. Đề bài ban đầu
 * 10 km, nhưng đo với mùa vụ tháng 4 thì đoạn từ Quy Nhơn đi lên lọt qua mũi đất 13,90°B giữa hai
 * mẫu 10 km ⇒ hạ xuống 2 km, khớp mẫu độ sâu ≤2 km của planRoute (09 "Bất biến an toàn" #3).
 */
export const BUOC_MAU_KM = 2;
/** Mẫu trong bán kính này quanh HAI ĐẦU đoạn (cảng, điểm) được miễn kiểm — cảng nằm sát bờ. */
export const SAT_DAU_KM = 15;
/** Ô cá vào cụm khi điểm (trung bình các ngày chuyến) ≥ phân vị 80. */
export const PHAN_VI_CUM = 0.8;
/**
 * Bán kính một vùng đánh quanh đỉnh của nó. Loang không giới hạn thì cả dải ven bờ dính thành MỘT
 * vùng dài nghìn km, tâm rơi tận đâu (đo với mùa vụ tháng 4: cảng Cát Bà trắng tay).
 * nợ: 55 km ≈ 30 hải lý ≈ quãng một ngày thả trôi — số ước, chưa đo với nhật ký chuyến thật.
 */
export const BAN_KINH_VUNG_KM = 55;
/** Số vùng ứng viên tối đa giữ lại sau gom cụm (§1 "~15–25 vùng đánh"). */
export const TOI_DA_VUNG_UNG_VIEN = 25;
/** Tuyến ghé 1–4 vùng (§1); bà con nhập nhiều điểm quen hơn thì giữ đủ điểm quen, không thêm vùng. */
export const TOI_DA_CHO_GHE = 4;
export const TOI_DA_DIEM_QUEN = 5;
/** Ở lại một chỗ, mỗi ngày thêm giá trị ×0,9 — ép cân nhắc 2–3 vùng thay vì cắm một chỗ (§1). */
export const GIAM_THEO_NGAY = 0.9;
/** Dự phòng dầu: tổng lít × 1,3 vượt két ⇒ thiếu dầu (§3 B5). */
export const DU_PHONG_DAU = 1.3;
/** Cổng bão: xét bão ÍT NHẤT 5 ngày đầu chuyến (§6 Phase 1); chuyến dài hơn thì tới lúc về theo giờ chạy chậm P80
 *  (research vet-tau §7 B3, 2026-11-08 — bão ngày 8 trên đường về vẫn là bão). */
export const CUA_SO_BAO_NGAY = 5;
/**
 * B4 GRASP tất định (research vet-tau §7 "giữ bộ tìm tuyến, thêm GRASP 20 vòng ≤ 300 ms"): sau tham lam + 2-opt,
 * dựng lại tuyến thêm 20 lần — mỗi bước chèn chọn ngẫu nhiên trong 3 cách chèn lời nhất (hạt CỐ ĐỊNH ⇒ cùng input
 * cùng output), mỗi lần 2-opt — giữ tuyến lời nhất. Tham lam hay kẹt ở vùng to gần cảng; GRASP thử bộ vùng khác.
 */
export const GRASP_VONG = 20;
export const GRASP_RCL = 3;
const GRASP_HAT = 0x5eed2026;
/** Nghề đèn — có dầu máy phát chong đèn mỗi đêm đánh (kéo/rê không chong). */
export const NGHE_DEN: readonly Nghe[] = ["luoi-vay", "chup-muc", "cau-ngu"];

/** PRNG mulberry32 — tất định theo hạt. */
function mulberry32(a: number): () => number {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * "Ngày nên quay về" theo nghề (§4). Câu cá ngừ: về ≤7 ngày sau NGÀY ĐÁNH ĐẦU TIÊN (chuẩn
 * sashimi). Nghề khác: chuyến dài tối đa N ngày kể từ ngày xuất bến.
 * nợ: lưới vây/lưới rê/chụp mực là MẪU TẠM lấy từ bảng §4 (lưới vây 5–7, lưới rê 10–20, chụp mực
 * 5–10) — chưa tune với chủ tàu thật; nâng cấp khi có số liệu chuyến thật của từng nghề (Phase 3).
 */
export const NGAY_NEN_VE: Record<Nghe, { tinhTu: "ngay-danh-dau" | "ngay-di"; soNgay: number }> = {
  "cau-ngu": { tinhTu: "ngay-danh-dau", soNgay: 7 },
  "luoi-vay": { tinhTu: "ngay-di", soNgay: 7 },
  "luoi-re": { tinhTu: "ngay-di", soNgay: 15 },
  "chup-muc": { tinhTu: "ngay-di", soNgay: 10 },
  // cào/cào đôi: P75 ngày chuyến ≥1 ngày đo trên vết VMS 2026 (đơn 16,0 · đôi 20,6) — docs/research/vet-tau-pha-nghe-2026-11.md §10
  "luoi-keo": { tinhTu: "ngay-di", soNgay: 16 },
  "keo-doi": { tinhTu: "ngay-di", soNgay: 20 },
};

const TEN_NGHE: Record<Nghe, string> = {
  "cau-ngu": "câu cá ngừ",
  "luoi-vay": "lưới vây",
  "luoi-re": "lưới rê",
  "chup-muc": "chụp mực",
  "luoi-keo": "lưới cào",
  "keo-doi": "cào đôi",
};

/**
 * KHUNG ĐÁNH THEO NGHỀ (2026-11-08, anh Long: "mỗi nghề có cách tính riêng … lịch riêng"). Một "ngày đánh" = MỘT
 * khung bắt đầu `batDau` giờ (giờ VN), dài `dai` giờ. Tới chỗ ngoài khung thì neo chờ khung kế; xong khung thì
 * chạy sang chỗ khác ngay (giờ ngoài khung dùng để chạy, không mất ngày).
 * Nguồn: cào đôi = vết VMS (78 % giờ kéo 06–17, research vet-tau §10); cào đơn kéo cả ngày đêm (giờ kéo trải đều
 * hơn, 46 % rơi vào đêm). Câu/vây/rê/chụp = mẫu nghề §4 của 09 (tốc độ 90 phút không tách được đứng đèn với nghỉ —
 * research §0 mục 5), chưa đo.
 */
export const KHUNG_DANH: Record<Nghe, { batDau: number; dai: number; ten: string }> = {
  "cau-ngu": { batDau: 17, dai: 13, ten: "thả chiều tối, thu sáng" },
  "luoi-vay": { batDau: 18, dai: 11, ten: "đánh đêm" },
  "luoi-re": { batDau: 16, dai: 14, ten: "thả chiều, thu sáng" },
  "chup-muc": { batDau: 18, dai: 11, ten: "đánh đêm" },
  "luoi-keo": { batDau: 0, dai: 24, ten: "kéo cả ngày đêm" },
  "keo-doi": { batDau: 6, dai: 11, ten: "kéo ban ngày 6–17 giờ" },
};
/** Giờ xuất bến khi chưa chọn (lộ trình lưu cũ, input thiếu): 6 giờ sáng — giờ hay ra cửa. Form hỏi giờ từ
 *  2026-11-08 (`LoTrinhInput.gioDi`). */
export const GIO_XUAT_BEN = 6;
/** Tới chỗ khi khung đã chạy chưa quá nửa ⇒ vẫn tính khung đó (đánh muộn), quá nửa ⇒ chờ khung sau. */
const NUA_KHUNG = 0.5;

const KM_MOI_HAI_LY = 1.852;
const NGAY_MS = 86_400_000;
/** Giờ Việt Nam = UTC+7, không đổi giờ mùa hè. */
const LECH_VN_MS = 7 * 3_600_000;
const EPS = 1e-9;

export const CAU_CHAN_BAO = "Có bão gần tuyến — chưa nên đi";
export const CAU_CHUA_KIEM_BAO = "Chưa kiểm được tin bão — nghe đài duyên hải trước khi đi";

/* ───────────────────────── Ngày tháng (YYYY-MM-DD, giờ VN) ─────────────────────────── */

function chuanNgay(s: unknown): string | null {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split("-").map(Number);
  const t = Date.UTC(y, m - 1, d);
  return new Date(t).toISOString().slice(0, 10) === s ? s : null;
}

function congNgay(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) + n * NGAY_MS).toISOString().slice(0, 10);
}

/** Mốc 00:00 giờ VN của ngày `iso`, epoch ms. */
function dauNgayVN(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d) - LECH_VN_MS;
}

function homNayVN(now: Date): string {
  const t = now.getTime();
  return new Date((Number.isFinite(t) ? t : 0) + LECH_VN_MS).toISOString().slice(0, 10);
}

/* ───────────────────────── Hình học ─────────────────────────────────────────────── */

const soThat = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
const toaDoHopLe = (p: { lat: unknown; lon: unknown } | null | undefined): boolean =>
  !!p && soThat(p.lat) && soThat(p.lon) && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180;

/**
 * Đoạn thẳng a→b có nằm trong vùng biển VN được phép không: lấy mẫu mỗi 2 km; mẫu nào cách cả hai
 * đầu > 15 km mà ngoài vùng (đất liền, đảo, vùng cần chú ý quanh Hoàng Sa, biển nước ngoài) ⇒
 * đoạn không hợp lệ. Miễn hai đầu vì cảng nằm trên bờ, không bao giờ "trong vùng biển".
 * nợ: đoạn có thể lọt một mỏm đất/ranh hẹp hơn 2 km giữa hai mẫu — trần chấp nhận ở Phase 1
 * vì mỗi chặng còn qua planRoute (kiểm nghiêm 2 km) khi dẫn đường thật; nâng cấp nếu bà con gặp
 * tuyến đề xuất cắt qua đảo nhỏ.
 */
export function doanTrongVung(a: LatLon, b: LatLon): boolean {
  const km = haversineKm(a, b);
  const n = Math.max(1, Math.ceil(km / BUOC_MAU_KM));
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    const p = { lat: a.lat + (b.lat - a.lat) * t, lon: a.lon + (b.lon - a.lon) * t };
    if (haversineKm(p, a) <= SAT_DAU_KM || haversineKm(p, b) <= SAT_DAU_KM) continue;
    if (!trongVungNhanh(p.lat, p.lon)) return false;
  }
  return true;
}

/**
 * Bão gần tuyến trong cửa sổ `soGio` giờ kể từ `batDauMs` (không ngắn hơn 5 ngày): điểm bão (bỏ điểm có `at` từ cuối
 * cửa sổ trở đi) cách MỘT đoạn tuyến dưới 200 km. Trả bão gần nhất hoặc null.
 */
export function baoGanTuyen(
  bao: readonly BaoRutGon[],
  tuyen: readonly LatLon[],
  batDauMs: number,
  soGio: number = CUA_SO_BAO_NGAY * 24,
): { ten: string; km: number } | null {
  if (tuyen.length === 0) return null;
  const het = batDauMs + Math.max(CUA_SO_BAO_NGAY * 24, soThat(soGio) ? soGio : 0) * 3_600_000;
  let tot: { ten: string; km: number } | null = null;
  for (const b of bao) {
    for (const p of b?.diem ?? []) {
      if (!toaDoHopLe(p)) continue;
      if (soThat(p.at) && p.at >= het) continue;
      let km = tuyen.length === 1 ? haversineKm(p, tuyen[0]) : Infinity;
      for (let i = 0; i + 1 < tuyen.length; i++) km = Math.min(km, distToSegmentKm(p, tuyen[i], tuyen[i + 1]));
      if (km < STORM_SAFE_RADIUS_KM && (!tot || km < tot.km)) tot = { ten: b.ten, km };
    }
  }
  return tot;
}

/* ───────────────────────── B0 + B1: đọc lớp cá, gom cụm ─────────────────────────────── */

interface O {
  lat: number;
  lon: number;
  i: number;
  j: number;
  trong: boolean;
}

interface DuLieuCa {
  buoc: number;
  o: Map<number, O>;
  /** theo ngày: khoá ô → điểm (chỉ ô trong vùng) */
  ngay: Map<number, number>[];
  /** khoá ô trong vùng có ít nhất một ngày có điểm → điểm trung bình các ngày có mặt */
  tb: Map<number, number>;
  /** ngưỡng phân vị 80 của `tb` */
  nguong: number;
  /** khoá ô → loài → tổng điểm các ngày (chỉ khi ô có `loai` — chấm theo nghề) */
  loai: Map<number, Map<string, number>>;
}

const khoaO = (i: number, j: number) => (i + 5000) * 20000 + (j + 10000);

/** Bước lưới suy từ dữ liệu: hiệu vĩ độ (rồi kinh độ) liền kề hay gặp nhất; không suy được ⇒ 0,25°. */
function suyBuoc(cells: readonly OCa[]): number {
  for (const truc of ["lat", "lon"] as const) {
    const vals = new Set<number>();
    for (let k = 0; k < cells.length && k < 5000; k++) {
      const v = cells[k]?.[truc];
      if (soThat(v)) vals.add(Math.round(v * 1e4));
    }
    const s = [...vals].sort((x, y) => x - y);
    const dem = new Map<number, number>();
    for (let k = 1; k < s.length; k++) dem.set(s[k] - s[k - 1], (dem.get(s[k] - s[k - 1]) ?? 0) + 1);
    let tot = 0, soLan = 0;
    for (const [h, c] of [...dem].sort((x, y) => x[0] - y[0])) if (c > soLan) { tot = h; soLan = c; }
    const buoc = tot / 1e4;
    if (buoc >= 0.05 && buoc <= 2) return buoc;
  }
  return 0.25;
}

function docLopCa(caTheoNgay: LoTrinhInput["caTheoNgay"], D: number, heSoO?: (lat: number, lon: number) => number | null): DuLieuCa | null {
  const raw: (readonly OCa[])[] = [];
  for (let d = 0; d < D; d++) {
    let r: readonly OCa[] = [];
    try {
      const x = typeof caTheoNgay === "function" ? caTheoNgay(d) : [];
      if (Array.isArray(x)) r = x;
    } catch {
      r = []; // một ngày hỏng thì coi như ngày đó không có ô — không làm hỏng cả chuyến
    }
    raw.push(r);
  }
  const mau = raw.find((r) => r.length > 0);
  if (!mau) return null;
  const buoc = suyBuoc(mau);
  const o = new Map<number, O>();
  const ngay: Map<number, number>[] = [];
  const loai = new Map<number, Map<string, number>>();
  for (let d = 0; d < D; d++) {
    const m = new Map<number, number>();
    for (const c of raw[d]) {
      if (!c || !toaDoHopLe(c) || !soThat(c.s)) continue;
      const i = Math.round(c.lat / buoc), j = Math.round(c.lon / buoc);
      const k = khoaO(i, j);
      let x = o.get(k);
      if (!x) {
        x = { lat: c.lat, lon: c.lon, i, j, trong: trongVungNhanh(c.lat, c.lon) };
        o.set(k, x);
      }
      if (!x.trong) continue;
      // hệ số đáy theo nghề (day-nghe.ts) nhân ở MỨC Ô — vùng gom từ ô đã trừ rạn/chỗ cạn mà nghề này không đánh được
      const hd = heSoO ? heSoO(c.lat, c.lon) : null;
      const s = Math.max(0, Math.min(100, c.s)) * (hd == null ? 1 : hd);
      if (s > (m.get(k) ?? -1)) m.set(k, s);
      if (typeof c.loai === "string" && c.loai) {
        let t = loai.get(k);
        if (!t) loai.set(k, (t = new Map()));
        t.set(c.loai, (t.get(c.loai) ?? 0) + s);
      }
    }
    ngay.push(m);
  }
  const tong = new Map<number, [number, number]>();
  for (const m of ngay)
    for (const [k, s] of m) {
      const t = tong.get(k);
      if (t) { t[0] += s; t[1]++; } else tong.set(k, [s, 1]);
    }
  if (tong.size === 0) return null;
  const tb = new Map<number, number>();
  for (const k of [...tong.keys()].sort((x, y) => x - y)) {
    const [s, n] = tong.get(k)!;
    tb.set(k, s / n);
  }
  const vals = [...tb.values()].sort((x, y) => x - y);
  const nguong = vals[Math.floor(PHAN_VI_CUM * (vals.length - 1))];
  return { buoc, o, ngay, tb, nguong, loai };
}

interface Cum {
  lat: number;
  lon: number;
  prize: number;
  keys: number[];
  /** loài nặng điểm nhất trong vùng (tổng điểm theo ô × ngày); undefined khi lớp cá không mang loài */
  loai?: string;
}

/** Loài nặng điểm nhất trên một tập ô — hoà thì tên nhỏ trước (tất định). */
function loaiChinh(du: DuLieuCa, keys: readonly number[]): string | undefined {
  const tong = new Map<string, number>();
  for (const k of keys) for (const [l, v] of du.loai.get(k) ?? []) tong.set(l, (tong.get(l) ?? 0) + v);
  let tot: string | undefined, max = 0;
  for (const [l, v] of [...tong].sort((a, b) => (a[0] < b[0] ? -1 : 1))) if (v > max) { max = v; tot = l; }
  return tot;
}

/** B1: ô ≥ phân vị 80, loang 8 hướng theo bước lưới (trong bán kính quanh đỉnh) ⇒ vùng; prize = Σ điểm, tâm = trọng tâm có trọng số.
 *  Trả MỌI vùng, tốt trước — chỗ gọi tự lọc vùng đi được rồi mới cắt còn 25. */
function gomCum(du: DuLieuCa): Cum[] {
  const chon = new Set<number>();
  for (const [k, s] of du.tb) if (s >= du.nguong) chon.add(k);
  const daXet = new Set<number>();
  const cum: Cum[] = [];
  // hạt giống = ô điểm cao trước (hoà thì khoá nhỏ trước) — mỗi vùng mọc quanh một đỉnh
  const hat = [...chon].sort((x, y) => du.tb.get(y)! - du.tb.get(x)! || x - y);
  for (const k0 of hat) {
    if (daXet.has(k0)) continue;
    daXet.add(k0);
    const goc = du.o.get(k0)!;
    const hang = [k0];
    const keys: number[] = [];
    while (hang.length) {
      const k = hang.pop()!;
      keys.push(k);
      const { i, j } = du.o.get(k)!;
      for (let di = -1; di <= 1; di++)
        for (let dj = -1; dj <= 1; dj++) {
          const kk = khoaO(i + di, j + dj);
          if (!chon.has(kk) || daXet.has(kk)) continue;
          if (haversineKm(goc, du.o.get(kk)!) > BAN_KINH_VUNG_KM) continue;
          daXet.add(kk);
          hang.push(kk);
        }
    }
    keys.sort((x, y) => x - y);
    let prize = 0, sw = 0, la = 0, lo = 0, dinhK = keys[0], dinhS = -1;
    for (const k of keys) {
      const s = du.tb.get(k)!;
      const c = du.o.get(k)!;
      prize += s;
      const w = Math.max(s, EPS);
      sw += w; la += c.lat * w; lo += c.lon * w;
      if (s > dinhS) { dinhS = s; dinhK = k; }
    }
    let lat = la / sw, lon = lo / sw;
    // trọng tâm của vùng hình lưỡi liềm có thể rơi vào đảo / ra ngoài vùng ⇒ lấy ô cao điểm nhất
    if (!trongVungNhanh(lat, lon)) ({ lat, lon } = du.o.get(dinhK)!);
    cum.push({ lat, lon, prize, keys, loai: loaiChinh(du, keys) });
  }
  cum.sort((a, b) => b.prize - a.prize || a.keys[0] - b.keys[0]);
  return cum;
}

/* ───────────────────────── B2 + B3: khung tuyến, lịch theo ngày ─────────────────────── */

interface Nut {
  lat: number;
  lon: number;
  ten: string;
  quen: boolean;
  /** điểm theo ngày d (0..D-1) */
  diem: number[];
  prize: number;
  loai?: string;
  /** theo ngày d: điểm cá gốc + các hệ số — để đưa ra cho bà con (diem[d] = ca × trang × bien) */
  yeu?: { ca: number; trang: number; doRoi: number; songM: number | null; gioKmh: number | null; bien: number; bai: number | null; heSoBai: number }[];
}

interface KeHoach {
  thuTu: number[];
  /** giờ chạy từng chặng: h[0] cảng→chỗ 1 … h[k] chỗ cuối→cảng */
  h: number[];
  /** số ngày đánh ở từng chỗ */
  n: number[];
  giaTri: number;
  tongChay: number;
}

export function deXuatLoTrinh(input: LoTrinhInput, now: Date = new Date()): LoTrinhKetQua {
  const ghiChu: string[] = [];
  let ngayDi = chuanNgay(input?.ngayDi);
  if (!ngayDi) {
    ngayDi = homNayVN(now);
    ghiChu.push("Ngày xuất bến chưa đúng — tạm tính từ hôm nay.");
  }
  const nghe: Nghe = input && input.nghe in NGAY_NEN_VE ? input.nghe : "cau-ngu";
  const mau = NGAY_NEN_VE[nghe];

  const rong = (soNgayTinh: number, ngayNenVe: string = ngayDi!): LoTrinhKetQua => ({
    vung: [],
    lich: [],
    moc: [],
    haiLy: 0,
    litDau: 0,
    thieuDau: false,
    ngayNenVe,
    soNgayTinh,
    chanBao: null,
    ghiChu,
  });

  if (!soThat(input?.soNgay) || input.soNgay < 1) {
    ghiChu.push("Số ngày đi phải từ 1 ngày trở lên.");
    return rong(0);
  }
  let D = Math.floor(input.soNgay);
  if (D > TRAN_SO_NGAY) {
    ghiChu.push(`Chuyến khai ${D} ngày — app chỉ tính ${TRAN_SO_NGAY} ngày đầu (dữ liệu tới ${TRAN_SO_NGAY} ngày).`);
    D = TRAN_SO_NGAY;
  }
  // hạn về mặc định khi chưa có tuyến: câu ngừ coi như đánh từ ngày đầu
  const hanMacDinh = congNgay(ngayDi, Math.min(D, mau.tinhTu === "ngay-di" ? mau.soNgay : mau.soNgay + 1) - 1);

  const cang = input.cang;
  if (!toaDoHopLe(cang)) {
    ghiChu.push("Chưa có toạ độ cảng xuất bến.");
    return rong(D, hanMacDinh);
  }

  const tau = input.tau ?? ({} as LoTrinhInput["tau"]);
  /*  GIỜ CHẶNG = a + hải lý / v theo nghề (§3 B0, 2026-11-08): đo trên 295 015 chặng VMS — "hải lý / 7 kn" ước thiếu
      ~3 giờ mỗi chặng (sai về phía nguy hiểm). Tốc độ bà con khai là TRẦN, không thay số đo. Lập lịch theo P50; xét
      kịp về / hạn chuyến theo P80 (= P50 × p80HeSo) cho an toàn. */
  const chang = moHinhChang(nghe);
  const tocKhai = soThat(tau.speedKn) && tau.speedKn > 0 ? tau.speedKn : null;
  const tocDo = tocKhai != null ? Math.min(tocKhai, chang.vKn) : chang.vKn;
  const gioKm = (km: number) => gioChang(km, chang, tocKhai);
  /*  LỊCH THEO KHUNG ĐÁNH CỦA NGHỀ (KHUNG_DANH): t = giờ kể từ lúc xuất bến (giờ đi, giờ VN ngày đi). */
  const GIO_DI =
    soThat(input.gioDi) && input.gioDi >= 0 && input.gioDi < 24 ? Math.floor(input.gioDi) : GIO_XUAT_BEN;
  if (input.gioDi != null && GIO_DI !== input.gioDi) ghiChu.push(`Giờ đi chưa đúng — tạm tính ${GIO_XUAT_BEN} giờ sáng.`);
  const khung = KHUNG_DANH[nghe];
  const caNgay = khung.dai >= 24;
  /** giờ bắt đầu (danh nghĩa) của khung đánh đầu tiên khi tới chỗ lúc t */
  const batKhung = (t: number): number => {
    if (caNgay) return t;
    const c = (((GIO_DI + t - khung.batDau) % 24) + 24) % 24;
    return c < khung.dai * NUA_KHUNG ? t - c : t + 24 - c;
  };
  /** rời chỗ sau n khung đánh bắt đầu từ s */
  const ketKhung = (s: number, n: number): number => (caNgay ? s + 24 * n : s + 24 * (n - 1) + khung.dai);
  /** ngày (0 = ngày đi) của khung thứ j bắt đầu từ s — theo điểm giữa khung */
  const ngayKhung = (s: number, j: number): number => Math.floor((GIO_DI + s + 24 * j + Math.min(khung.dai, 24) / 2) / 24);
  /** ngày (1 = ngày đi) chứa thời điểm t; `het` = mốc kết thúc (lùi một chút để 24:00 không sang ngày sau) */
  const ngayThu = (t: number, het = false): number => Math.floor((GIO_DI + t - (het ? 1e-6 : 0)) / 24) + 1;
  /** mốc giờ (kể từ xuất bến) hết ngày thứ `ngay` (1 = ngày đi) */
  const hetNgay = (ngay: number): number => ngay * 24 - GIO_DI;
  /*  CON NƯỚC Ở CẢNG (trieu-cang.ts, Phase 1e): có luồng + mớn ⇒ ra/vào cửa chỉ khi đủ nước — giờ đi dời tới lúc đủ nước,
      về tới cửa lúc thiếu nước thì chờ ngoài cửa. Không đủ nước trong 36 giờ ⇒ cộng 36 giờ (dè dặt) + nói ra. */
  const msDi = dauNgayVN(ngayDi) + GIO_DI * 3_600_000;
  const cua = input.cuaTrieu ?? null;
  const rangBuocTrieu = !!cua?.rangBuoc;
  let cuaKhongDuNuoc = false;
  /* GRASP/2-opt mô phỏng hàng nghìn tuyến, mỗi lần dò triều tới 216 bước ⇒ nhớ theo nấc 10 phút (đúng bước dò của
     trieu-cang). Kết quả theo nấc: giờ ra cửa = max(t, giờ đủ nước sớm nhất kể từ đầu nấc) — không bao giờ sớm hơn t. */
  const nhoCua = new Map<number, number | null>();
  const quaCuaT = (t: number): number => {
    if (!rangBuocTrieu) return t;
    const nac = Math.floor(t * 6);
    let ms = nhoCua.get(nac);
    if (ms === undefined) {
      ms = cua!.quaCua(msDi + (nac / 6) * 3_600_000);
      nhoCua.set(nac, ms);
    }
    if (ms == null) { cuaKhongDuNuoc = true; return t + TIM_TOI_DA_GIO; }
    return Math.max(t, (ms - msDi) / 3_600_000);
  };
  const tRa = quaCuaT(0);
  if (!chang.doDuoc) ghiChu.push(`Chưa có số đo tàu cùng nghề trong máy — tạm tính dè dặt ${chang.vKn} hải lý/giờ.`);
  else if (tocKhai != null && tocKhai > chang.vKn + 0.05)
    ghiChu.push(`Giờ chạy tính theo tốc độ thật của tàu cùng nghề (${String(Math.round(chang.vKn * 10) / 10).replace(".", ",")} hải lý/giờ), chậm hơn số khai.`);
  let dauGio = tau.litersPerHour;
  if (!soThat(dauGio) || dauGio <= 0) {
    dauGio = DAU_GIO_MAC_DINH_L;
    ghiChu.push(`Chưa có số lít dầu mỗi giờ — tạm tính ${DAU_GIO_MAC_DINH_L} lít/giờ.`);
  }
  const ket = soThat(tau.fuelTankL) && tau.fuelTankL > 0 ? tau.fuelTankL : null;
  const den = NGHE_DEN.includes(nghe);
  const litDem = den && soThat(tau.litDem) && tau.litDem > 0 ? tau.litDem : null;
  const mayBai = gioMayBai(nghe);
  const dauMoiGio = dauGio;
  /** lít dầu của một kế hoạch: (giờ chạy × hs + giờ máy ở bãi × số khung) × lít/giờ + lít đèn × số đêm đánh.
   *  hs = 1 (P50, số báo bà con) hoặc p80HeSo (chạy chậm — xét két). */
  const litCua = (tongChay: number, soKhung: number, hs: number): number =>
    (tongChay * hs + (mayBai ?? 0) * soKhung) * dauMoiGio + (litDem ?? 0) * soKhung;
  /** Két giới hạn tuyến (research §7 B3): lít P80 × 1,3 ≤ két. Không tuyến nào vừa ⇒ tắt, vẫn đưa tuyến + cảnh báo. */
  let gioiHanKet = ket !== null;

  if (input.bao === null || !Array.isArray(input.bao)) ghiChu.push(CAU_CHUA_KIEM_BAO);

  /* B0 + B1 */
  const coDay = heSoDay(nghe, 0, 0) !== null;
  const du = docLopCa(input.caTheoNgay, D, coDay ? (la, lo) => heSoDay(nghe, la, lo) : undefined);
  if (!du) {
    ghiChu.push(
      `Bản đồ cá chưa thấy vùng nào có cá của nghề ${TEN_NGHE[nghe]} trong vùng biển Việt Nam cho những ngày này — chưa đề xuất được lộ trình.`,
    );
    return rong(D, hanMacDinh);
  }

  const nut: Nut[] = [{ lat: cang.lat, lon: cang.lon, ten: cang.ten, quen: false, diem: [], prize: 0 }];

  // điểm quen: chỉ nhận điểm trong vùng biển VN được phép (§5 #3 "hiển thị, không đề xuất")
  const quenVao = Array.isArray(input.diemQuen) ? input.diemQuen : [];
  if (quenVao.length > TOI_DA_DIEM_QUEN)
    ghiChu.push(`Chỉ tính ${TOI_DA_DIEM_QUEN} điểm quen đầu tiên.`);
  const idxQuen: number[] = [];
  for (const q of quenVao.slice(0, TOI_DA_DIEM_QUEN)) {
    const ten = typeof q?.ten === "string" && q.ten.trim() ? q.ten.trim() : "Điểm quen";
    if (!toaDoHopLe(q)) {
      ghiChu.push(`Điểm quen “${ten}” sai toạ độ — bỏ qua.`);
      continue;
    }
    if (!trongVungNhanh(q.lat, q.lon)) {
      ghiChu.push(`Điểm quen “${ten}” nằm ngoài vùng biển Việt Nam được phép đánh bắt — không đưa vào tuyến.`);
      continue;
    }
    const i = Math.round(q.lat / du.buoc), j = Math.round(q.lon / du.buoc);
    const diem: number[] = [];
    let coO = false;
    for (let d = 0; d < D; d++) {
      let s = 0;
      for (let di = -1; di <= 1; di++)
        for (let dj = -1; dj <= 1; dj++) {
          const v = du.ngay[d].get(khoaO(i + di, j + dj));
          if (v !== undefined) { coO = true; if (v > s) s = v; }
        }
      diem.push(s);
    }
    // chỗ bản đồ cá không phủ: tin kinh nghiệm thuyền trưởng — tính ngang ngưỡng "vùng tốt"
    if (!coO) diem.fill(du.nguong);
    idxQuen.push(nut.length);
    nut.push({ lat: q.lat, lon: q.lon, ten, quen: true, diem, prize: diem.reduce((a, b) => a + b, 0) });
  }

  // Giữ 25 vùng tốt nhất TRONG SỐ vùng đi thẳng từ cảng được (kịp đi-đánh 1 ngày-về, đoạn thẳng
  // trong vùng biển). Cắt 25 trước khi lọc thì cảng phía Bắc trắng tay: 25 vùng to nhất nằm phía
  // Nam, mà đường thẳng từ vịnh Bắc Bộ xuống đó cắt qua đất liền miền Trung (đo với mùa vụ tháng 4).
  // nợ: vùng chỉ tới được QUA vùng khác (không thẳng từ cảng) bị bỏ, nâng cấp khi chặng nối bằng planRoute (đi vòng bờ).
  const gioToiDa = hetNgay(mau.tinhTu === "ngay-di" ? Math.min(D, mau.soNgay) : D);
  const idxVung: number[] = [];
  for (const c of gomCum(du)) {
    if (idxVung.length >= TOI_DA_VUNG_UNG_VIEN) break;
    if (2 * gioKm(haversineKm(cang, c)) * chang.p80HeSo + Math.min(khung.dai, 24) > gioToiDa + EPS) continue;
    if (!doanTrongVung(cang, c)) continue;
    const diem: number[] = [];
    for (let d = 0; d < D; d++) {
      let s = 0;
      for (const k of c.keys) { const v = du.ngay[d].get(k); if (v !== undefined && v > s) s = v; }
      diem.push(s);
    }
    idxVung.push(nut.length);
    nut.push({ lat: c.lat, lon: c.lon, ten: "", quen: false, diem, prize: c.prize, ...(c.loai ? { loai: c.loai } : {}) });
  }

  /* HỆ SỐ NGÀY (he-so.ts): điểm ngày = cá × trăng × sóng gió. Áp TRƯỚC khi tối ưu ⇒ thuật toán tự xếp ngày
     đánh né ngày biển động / đêm sáng trăng (với nghề bị trăng ảnh hưởng), không phải chấm xong mới cảnh báo. */
  const doRoi: number[] = [];
  for (let d = 0; d < D; d++) doRoi.push(doRoiTrang(dauNgayVN(ngayDi) + d * NGAY_MS + 22 * 3_600_000)); // đêm 22 giờ
  let thieuBien = false;
  let coBai = false, thieuBai = false;
  for (let i = 1; i < nut.length; i++) {
    const x = nut[i];
    x.yeu = [];
    let tong = 0;
    for (let d = 0; d < D; d++) {
      let b: { songM: number | null; gioKmh: number | null } | null = null;
      try {
        b = typeof input.bienTheoNgay === "function" ? input.bienTheoNgay(x.lat, x.lon, d) : null;
      } catch {
        b = null; // một chỗ hỏng thì coi như chưa có dự báo chỗ đó — không làm hỏng cả chuyến
      }
      const hb = b ? heSoBien(b.songM, b.gioKmh) : null;
      if (!hb) thieuBien = true;
      const trang = heSoTrang(nghe, doRoi[d]);
      const bien = hb ? hb.heSo : 1;
      let bx: number | null = null;
      try {
        const v = typeof input.baiTheoNgay === "function" ? input.baiTheoNgay(x.lat, x.lon, d) : null;
        bx = soThat(v) ? Math.max(0, Math.min(1, v)) : null;
      } catch {
        bx = null; // một chỗ hỏng thì coi như chưa có bãi chỗ đó
      }
      if (bx == null) thieuBai = true;
      else coBai = true;
      const bai = heSoBai(bx);
      const ca = x.diem[d];
      x.yeu.push({ ca, trang, doRoi: doRoi[d], songM: b?.songM ?? null, gioKmh: b?.gioKmh ?? null, bien, bai: bx, heSoBai: bai });
      x.diem[d] = ca * trang * bien * bai;
      tong += trang * bien * bai;
    }
    x.prize *= D > 0 ? tong / D : 1;
  }
  const ram = hieuUngRam(nghe);
  ghiChu.push(
    `Cách chấm mỗi ngày đánh: điểm cá của nghề ${TEN_NGHE[nghe]} (đã gồm chỗ tàu cùng nghề hay đánh tháng này) × trăng ` +
      (ram !== 0
        ? `(sổ tàu năm qua: đêm rằm ${Math.round(Math.abs(ram) * 1000) / 10}% ${ram < 0 ? "ít" : "nhiều"} hơn đêm tối)`
        : "(chưa có số trăng trong máy — chưa tính)") +
      ` × sóng gió (biển êm giữ nguyên, động nhẹ trừ tới 40%, động mạnh bỏ ngày đó)` +
      (coBai ? ` × bãi (chỗ tàu ${TEN_NGHE[nghe]} hay đánh mùa này giữ nguyên, chỗ không ai đánh nghề này còn 25%)` : "") +
      (coDay ? ` × đáy (rạn, chỗ cạn, sát rạn trừ theo mức tàu ${TEN_NGHE[nghe]} thật sự đánh ở đó).` : "."),
  );
  if (!coDay) ghiChu.push("Chưa có số đáy biển trong máy — chưa tránh rạn, chỗ cạn theo nghề.");
  if (!coBai) ghiChu.push(`Chưa có bãi tàu ${TEN_NGHE[nghe]} trong máy — chưa tính chỗ tàu cùng nghề hay đánh.`);
  else if (thieuBai) ghiChu.push("Bãi tàu cùng nghề chỉ có cho một phần chuyến — những ngày thiếu chưa tính bãi.");
  if (thieuBien)
    ghiChu.push("Chưa có đủ dự báo sóng gió trong máy cho cả chuyến — những ngày thiếu, lộ trình chưa né được biển động.");

  const N = nut.length;
  const gio: number[][] = nut.map((a) => nut.map((b) => gioKm(haversineKm(a, b))));
  const hopLeNho = new Map<number, boolean>();
  const hopLe = (a: number, b: number): boolean => {
    const k = Math.min(a, b) * N + Math.max(a, b);
    let v = hopLeNho.get(k);
    if (v === undefined) { v = doanTrongVung(nut[a], nut[b]); hopLeNho.set(k, v); }
    return v;
  };
  const tuyenHopLe = (thuTu: number[]): boolean => {
    let prev = 0;
    for (const x of [...thuTu, 0]) { if (!hopLe(prev, x)) return false; prev = x; }
    return true;
  };

  /** Mô phỏng chuyến: giờ chạy × `hs` (1 = P50, p80HeSo = P80) ⇒ giờ bắt đầu khung đầu ở mỗi chỗ + giờ về cảng. */
  const moPhong = (h: number[], n: number[], hs: number): { s: number[]; ve: number; toiCua: number } => {
    let t = tRa;
    const s: number[] = [];
    for (let i = 0; i < n.length; i++) {
      t += h[i] * hs;
      const s0 = batKhung(t);
      s.push(s0);
      t = ketKhung(s0, n[i]);
    }
    const toiCua = t + h[n.length] * hs;
    return { s, ve: quaCuaT(toiCua), toiCua };
  };
  /** hạn về (giờ kể từ xuất bến) — câu ngừ tính từ NGÀY của khung đánh đầu */
  const hanVe = (sDau: number | undefined): number => {
    let het = hetNgay(D);
    if (sDau !== undefined) {
      if (mau.tinhTu === "ngay-danh-dau") het = Math.min(het, hetNgay(ngayKhung(sDau, 0) + mau.soNgay + 1));
      else het = Math.min(het, hetNgay(mau.soNgay));
    }
    return het;
  };
  /** kịp về: xét theo P80 (giờ chạy có thể dài hơn trung vị) — thà bớt một khung đánh hơn về trễ */
  const kip = (h: number[], n: number[]): boolean => {
    if (gioiHanKet) {
      const lit = litCua(h.reduce((a, b) => a + b, 0), n.reduce((a, b) => a + b, 0), chang.p80HeSo);
      if (lit * DU_PHONG_DAU > ket! + EPS) return false;
    }
    const p = moPhong(h, n, chang.p80HeSo);
    return p.ve <= hanVe(p.s[0]) + EPS;
  };
  const danhGia = (h: number[], n: number[], thuTu: number[]): number => {
    const { s } = moPhong(h, n, 1);
    let v = 0;
    for (let i = 0; i < n.length; i++) {
      const diem = nut[thuTu[i]].diem;
      for (let j = 0; j < n[i]; j++) v += diem[Math.min(D - 1, ngayKhung(s[i], j))] * GIAM_THEO_NGAY ** j;
    }
    return v;
  };

  /** B3: thứ tự cố định ⇒ chia khung đánh (mỗi chỗ ≥1 khung, khung dư cho chỗ lời nhất). null = không kịp. */
  const lap = (thuTu: number[]): KeHoach | null => {
    const h: number[] = [];
    let prev = 0;
    for (const x of thuTu) { h.push(gio[prev][x]); prev = x; }
    h.push(gio[prev][0]);
    const tongChay = h.reduce((a, b) => a + b, 0);
    const k = thuTu.length;
    const n = new Array<number>(k).fill(1);
    if (!kip(h, n)) return null;
    let giaTri = danhGia(h, n, thuTu);
    for (let r = 0; r < TRAN_SO_NGAY * 2; r++) {
      let tot = -1, loi = EPS;
      for (let i = 0; i < k; i++) {
        n[i]++;
        if (kip(h, n)) {
          const v = danhGia(h, n, thuTu) - giaTri;
          if (v > loi) { loi = v; tot = i; }
        }
        n[i]--;
      }
      if (tot < 0) break; // hết giờ, hoặc ở thêm không được gì (ô điểm 0) ⇒ về sớm, không nằm không giữa biển
      n[tot]++;
      giaTri += loi;
    }
    return { thuTu, h, n, giaTri, tongChay };
  };

  /** kế hoạch a hơn b: lời hơn, hoà thì chạy ít hơn */
  const hon = (a: KeHoach, b: KeHoach): boolean =>
    a.giaTri > b.giaTri + 1e-6 || (Math.abs(a.giaTri - b.giaTri) <= 1e-6 && a.tongChay < b.tongChay - 1e-6);

  /** B2c: 2-opt trên các chỗ ghé (cảng giữ hai đầu) */
  const haiOpt = (thuTu0: number[], ke0: KeHoach): { thuTu: number[]; ke: KeHoach } => {
    let thuTu = thuTu0, ke = ke0;
    for (let caiThien = true; caiThien && thuTu.length >= 2; ) {
      caiThien = false;
      for (let i = 0; i < thuTu.length - 1 && !caiThien; i++)
        for (let j = i + 1; j < thuTu.length && !caiThien; j++) {
          const moi = [...thuTu.slice(0, i), ...thuTu.slice(i, j + 1).reverse(), ...thuTu.slice(j + 1)];
          const kh = lap(moi);
          if (kh && hon(kh, ke) && tuyenHopLe(moi)) { thuTu = moi; ke = kh; caiThien = true; }
        }
    }
    return { thuTu, ke };
  };

  /** B2b: chèn vùng theo prize / giờ chạy thêm; nhận khi lịch B3 có lời hơn và đoạn mới hợp lệ. `rnd` null = tham lam
   *  (lấy cách chèn đầu tiên đạt); có `rnd` = GRASP (chọn ngẫu nhiên trong GRASP_RCL cách chèn đạt đầu tiên). */
  const xayTuyen = (goc: number[], keGoc: KeHoach, rnd: (() => number) | null) => {
    let thuTu = goc, ke = keGoc;
    const toiDaCho = Math.max(TOI_DA_CHO_GHE, goc.length);
    const can = rnd ? GRASP_RCL : 1;
    while (thuTu.length < toiDaCho) {
      const ung: { z: number; p: number; r: number }[] = [];
      for (const z of idxVung) {
        if (thuTu.includes(z)) continue;
        for (let p = 0; p <= thuTu.length; p++) {
          const a = p === 0 ? 0 : thuTu[p - 1], b = p === thuTu.length ? 0 : thuTu[p];
          const them = gio[a][z] + gio[z][b] - gio[a][b];
          ung.push({ z, p, r: nut[z].prize / Math.max(them, 0.5) });
        }
      }
      ung.sort((x, y) => y.r - x.r || x.z - y.z || x.p - y.p);
      const dat: { moi: number[]; kh: KeHoach }[] = [];
      for (const { z, p } of ung) {
        if (dat.some((d) => d.moi.includes(z))) continue; // RCL: mỗi vùng một cách chèn
        const moi = [...thuTu.slice(0, p), z, ...thuTu.slice(p)];
        const kh = lap(moi);
        if (!kh || kh.giaTri <= ke.giaTri + EPS) continue;
        const a = p === 0 ? 0 : thuTu[p - 1], b = p === thuTu.length ? 0 : thuTu[p];
        if (!hopLe(a, z) || !hopLe(z, b)) continue;
        dat.push({ moi, kh });
        if (dat.length >= can) break;
      }
      if (!dat.length) break;
      const c = dat[rnd ? Math.min(dat.length - 1, Math.floor(rnd() * dat.length)) : 0];
      thuTu = c.moi;
      ke = c.kh;
    }
    return haiOpt(thuTu, ke);
  };

  /** B2a khung điểm quen → B2b tham lam → B2c 2-opt → B4 GRASP. Ghi chú trả riêng (chạy lại khi bỏ giới hạn két). */
  const timTuyen = (): { thuTu: number[]; ke: KeHoach; ghi: string[] } => {
    const ghi: string[] = [];
    /* B2a: khung = điểm quen theo nearest-neighbor, chèn vào chỗ rẻ nhất còn hợp lệ */
    let khungQuen: number[] = [];
    {
      const con = [...idxQuen];
      let cur = 0;
      const thuTuQuen: number[] = [];
      while (con.length) {
        let bi = 0;
        for (let i = 1; i < con.length; i++) if (gio[cur][con[i]] < gio[cur][con[bi]] - EPS) bi = i;
        cur = con[bi];
        thuTuQuen.push(cur);
        con.splice(bi, 1);
      }
      for (const q of thuTuQuen) {
        let tot: number[] | null = null, totThem = Infinity, kipGio = false;
        for (let p = 0; p <= khungQuen.length; p++) {
          const moi = [...khungQuen.slice(0, p), q, ...khungQuen.slice(p)];
          if (!lap(moi)) continue;
          kipGio = true;
          if (!tuyenHopLe(moi)) continue;
          const a = p === 0 ? 0 : khungQuen[p - 1], b = p === khungQuen.length ? 0 : khungQuen[p];
          const them = gio[a][q] + gio[q][b] - gio[a][b];
          if (them < totThem - EPS) { totThem = them; tot = moi; }
        }
        if (tot) khungQuen = tot;
        else
          ghi.push(
            kipGio
              ? `Điểm quen “${nut[q].ten}”: đường thẳng tới đó vướng đất hoặc ra ngoài vùng biển — chưa đưa vào tuyến.`
              : gioiHanKet
                ? `Điểm quen “${nut[q].ten}” xa quá — không kịp đi về hoặc két dầu không đủ — chưa đưa vào tuyến.`
                : `Điểm quen “${nut[q].ten}” xa quá, không kịp đi về trong số ngày này — chưa đưa vào tuyến.`,
          );
      }
    }
    const keQuen: KeHoach = lap(khungQuen) ?? { thuTu: khungQuen, h: [0], n: [], giaTri: 0, tongChay: 0 };
    let tot = xayTuyen(khungQuen, keQuen, null);
    /* B4: GRASP tất định — chỉ thay khi lời hơn hẳn tuyến tham lam */
    if (idxVung.length > 1) {
      const rnd = mulberry32(GRASP_HAT);
      for (let v = 0; v < GRASP_VONG; v++) {
        const r = xayTuyen(khungQuen, keQuen, rnd);
        if (hon(r.ke, tot.ke)) tot = r;
      }
    }
    return { ...tot, ghi };
  };

  let tim = timTuyen();
  let vuaKet = gioiHanKet;
  if (gioiHanKet && tim.thuTu.length === 0) {
    // két nhỏ tới mức không vùng nào vừa ⇒ vẫn đưa tuyến tốt nhất, cảnh báo thiếu dầu (không im lặng trắng tay)
    gioiHanKet = false;
    vuaKet = false;
    tim = timTuyen();
  }
  gioiHanKet = false;
  ghiChu.push(...tim.ghi);
  const thuTu = tim.thuTu;
  const ke = tim.ke;

  if (thuTu.length === 0) {
    ghiChu.push("Không có vùng cá nào trong vùng biển Việt Nam kịp đi về trong số ngày này.");
    return rong(D, hanMacDinh);
  }

  /* B5a: cổng bão — trước khi dựng lịch; có bão gần tuyến thì KHÔNG đưa lộ trình (§4) */
  const duong: LatLon[] = [nut[0], ...thuTu.map((x) => nut[x]), nut[0]];
  const mp = moPhong(ke.h, ke.n, 1);
  const ngayVe = congNgay(ngayDi, ngayThu(mp.ve, true) - 1);
  if (Array.isArray(input.bao) && input.bao.length > 0) {
    // cửa sổ = max(5 ngày, tới lúc về nếu chạy chậm P80), tính từ 0 giờ ngày đi
    const soGio = Math.max(CUA_SO_BAO_NGAY * 24, GIO_DI + moPhong(ke.h, ke.n, chang.p80HeSo).ve);
    const gan = baoGanTuyen(input.bao, duong, dauNgayVN(ngayDi), soGio);
    if (gan) {
      ghiChu.push(`Bão ${gan.ten} cách tuyến khoảng ${Math.round(gan.km / 10) * 10} km trong ${Math.ceil(soGio / 24 - EPS)} ngày tới.`);
      return { ...rong(D, ngayVe), chanBao: CAU_CHAN_BAO };
    }
  }

  /* Dựng kết quả */
  let soVung = 0;
  const tenCho = new Map<number, { ten: string; trongCau: string; id: string }>();
  for (const x of thuTu) {
    if (nut[x].quen) tenCho.set(x, { ten: nut[x].ten, trongCau: nut[x].ten, id: `quen-${idxQuen.indexOf(x) + 1}` });
    else {
      soVung++;
      tenCho.set(x, { ten: `Vùng ${soVung}`, trongCau: `vùng ${soVung}`, id: `vung-${soVung}` });
    }
  }
  const nhanNgay = (a: number, b: number) => (a === b ? `Ngày ${a}` : `Ngày ${a}–${b}`);
  /** P50–P80 của một chặng (§3 B5 "khoảng P50–P80 giờ"). */
  const nhanGio = (h: number) => {
    if (h < 1) return "chưa tới 1 giờ";
    const lo = Math.round(h);
    const hi = Math.round(h * chang.p80HeSo);
    return hi > lo ? `khoảng ${lo}–${hi} giờ` : `khoảng ${lo} giờ`;
  };
  const lich: DongLich[] = [];
  const vung: VungDanh[] = [];
  let t = tRa;
  const gioDong = (tt: number) => tideClockText(msDi + tt * 3_600_000);
  for (let i = 0; i < thuTu.length; i++) {
    const x = thuTu[i];
    const ten = tenCho.get(x)!;
    const t1 = t + ke.h[i];
    const s0 = mp.s[i];
    const tu = ngayThu(t);
    const den = Math.max(tu, ngayThu(t1, true));
    // tới ngoài khung đánh ⇒ neo chờ — nói giờ bắt đầu khung để bà con không tưởng app tính sai
    const choGio = s0 - t1;
    lich.push({
      tuNgay: tu,
      denNgay: den,
      loai: "chay",
      vungId: ten.id,
      cau:
        `${nhanNgay(tu, den)}: ${i === 0 ? (tRa >= 0.5 ? `chờ nước, ra cửa lúc ${gioDong(tRa)}, chạy ra` : "chạy ra") : "sang"} ${ten.trongCau}, ${nhanGio(ke.h[i])}` +
        (choGio >= 1 ? `, neo chờ tới ${khung.batDau} giờ` : ""),
    });
    const tuDanh = ngayKhung(s0, 0) + 1;
    const denDanh = Math.max(tuDanh, ngayKhung(s0, ke.n[i] - 1) + 1);
    lich.push({
      tuNgay: tuDanh,
      denNgay: denDanh,
      loai: "danh",
      vungId: ten.id,
      cau: `${nhanNgay(tuDanh, denDanh)}: đánh ở ${ten.trongCau}, ${khung.ten}`,
    });
    let dinh = 0;
    const yeuTo: YeuToNgay[] = [];
    for (let j = 0; j < ke.n[i]; j++) {
      const d = Math.min(D - 1, ngayKhung(s0, j));
      dinh = Math.max(dinh, nut[x].diem[d]);
      const y = nut[x].yeu?.[d];
      if (y) {
        const songM = y.songM == null ? null : Math.round(y.songM * 10) / 10;
        yeuTo.push({
          ngay: d + 1,
          ca: Math.round(y.ca),
          trang: Math.round(y.doRoi * 100),
          songM,
          gioKmh: y.gioKmh == null ? null : Math.round(y.gioKmh),
          bai: y.bai == null ? null : Math.round(y.bai * 100),
          heSo: Math.round(y.trang * y.bien * y.heSoBai * 100) / 100,
        });
        if (y.bien < 0.6)
          ghiChu.push(
            `Ngày ${d + 1} ở ${ten.trongCau}: biển động${songM != null ? ` (sóng tới ${String(songM).replace(".", ",")} m)` : ""} — thuyền trưởng cân nhắc.`,
          );
      }
    }
    vung.push({
      id: ten.id,
      ten: ten.ten,
      lat: nut[x].lat,
      lon: nut[x].lon,
      dinh: Math.round(dinh),
      soNgayDanh: ke.n[i],
      ...(nut[x].quen ? { laDiemQuen: true } : {}),
      ...(nut[x].loai ? { loai: nut[x].loai } : {}),
      ...(yeuTo.length ? { yeuTo } : {}),
    });
    t = ketKhung(s0, ke.n[i]);
  }
  {
    const hVe = ke.h[thuTu.length];
    const tu = ngayThu(t);
    const choVao = mp.ve - mp.toiCua;
    const den = Math.max(tu, ngayThu(mp.ve, true));
    lich.push({
      tuNgay: tu,
      denNgay: den,
      loai: "ve",
      cau: `${nhanNgay(tu, den)}: về ${cang.ten}, ${nhanGio(hVe)}` + (choVao >= 0.5 ? `, chờ nước lên tới ${gioDong(mp.ve)} mới vào cửa` : ""),
    });
  }
  // con nước: nói đang dùng mức nào (ràng buộc / chỉ báo / chưa có)
  {
    const tram = cua ? `trạm ${cua.tenTram}${cua.uocTinh ? ", con nước ước tính — giờ có thể lệch" : ""}` : "";
    if (!cua) ghiChu.push(`Chưa tính con nước ở ${cang.ten} — chưa có trạm con nước gần cảng trong máy.`);
    else if (rangBuocTrieu) {
      ghiChu.push(
        `Giờ ra/vào cửa theo con nước (${tram}): luồng ${cua.luong!.ten} sâu ${String(cua.luong!.sauM).replace(".", ",")} m, tàu cần ${String(cua.canM).replace(".", ",")} m nước.`,
      );
      if (cuaKhongDuNuoc) ghiChu.push("Có lúc cửa không đủ nước cho mớn tàu cả 36 giờ — app đã cộng thêm 36 giờ chờ; kiểm lại mớn tàu và độ sâu luồng.");
    } else {
      const nlDi = cua.nuocLon(msDi);
      const nlVe = cua.nuocLon(msDi + mp.toiCua * 3_600_000 - 6 * 3_600_000);
      ghiChu.push(
        `Con nước ở ${cang.ten} (${tram}): nước lớn ngày đi lúc ${nlDi ? tideClockText(nlDi.ms) : "?"}, lúc về khoảng ${nlVe ? tideClockText(nlVe.ms) : "?"}` +
          (cua.luong ? " — khai mớn tàu để app tính giờ ra/vào cửa." : " — chưa có độ sâu luồng cửa, cửa cạn thì canh giờ nước lớn."),
      );
    }
  }

  const moc: LoTrinhKetQua["moc"] = [
    { lat: cang.lat, lon: cang.lon, ten: cang.ten, loai: "cang" },
    ...thuTu.map((x) => ({
      lat: nut[x].lat,
      lon: nut[x].lon,
      ten: tenCho.get(x)!.ten,
      loai: (nut[x].quen ? "diem-quen" : "vung") as "diem-quen" | "vung",
    })),
    { lat: cang.lat, lon: cang.lon, ten: cang.ten, loai: "cang" },
  ];

  // hải lý = tổng quãng thẳng các chặng (không suy từ giờ — giờ có phần cố định `a`)
  let haiLyRaw = 0;
  {
    let prev = 0;
    for (const x of [...thuTu, 0]) { haiLyRaw += haversineKm(nut[prev], nut[x]) / KM_MOI_HAI_LY; prev = x; }
  }
  // dầu: (giờ chạy P50 — gồm phần cố định `a` mỗi chặng, dè dặt — + giờ máy chạy ở bãi × số khung đánh) × lít/giờ
  // + dầu chong đèn × số đêm đánh (nghề đèn, khi bà con khai). Giờ máy ở bãi = số đo đội tàu cùng nghề.
  // Xét két bằng giờ chạy P80 (chạy chậm) × 1,3 — số báo bà con là P50.
  const soKhung = ke.n.reduce((a, b) => a + b, 0);
  const litRaw = litCua(ke.tongChay, soKhung, 1);
  const litP80 = litCua(ke.tongChay, soKhung, chang.p80HeSo);
  const so1 = (v: number) => String(Math.round(v * 10) / 10).replace(".", ",");
  const denDau = !den
    ? ""
    : litDem != null
      ? `, + dầu chong đèn ${so1(litDem)} lít × ${soKhung} đêm`
      : ", chưa tính dầu máy phát chong đèn (khai số lít mỗi đêm để tính)";
  ghiChu.push(
    mayBai == null
      ? `Lít dầu chỉ tính giờ chạy máy — chưa có số giờ máy lúc đánh của nghề này trong máy${denDau}.`
      : `Lít dầu = giờ chạy + giờ máy lúc đánh (tàu ${TEN_NGHE[nghe]} chạy máy khoảng ${so1(mayBai)} giờ mỗi ngày ở bãi)${denDau}.`,
  );
  if (ket !== null && vuaKet)
    ghiChu.push(`Tuyến đã chọn vừa két ${Math.round(ket)} lít kể cả khi chạy chậm, còn dư 30% cho gió ngược.`);
  if (mau.tinhTu === "ngay-danh-dau")
    ghiChu.push(`Câu cá ngừ: nên về cảng trong ${mau.soNgay} ngày kể từ ngày đánh đầu để cá còn tươi.`);
  else if (mau.soNgay < D)
    ghiChu.push(`Theo mẫu chuyến ${TEN_NGHE[nghe]}: nên về trong ${mau.soNgay} ngày — thuyền trưởng quyết.`);

  return {
    vung,
    lich,
    moc,
    haiLy: Math.round(haiLyRaw),
    litDau: litRaw < 10 ? Math.round(litRaw) : Math.round(litRaw / 10) * 10,
    thieuDau: ket !== null && litP80 * DU_PHONG_DAU > ket + EPS,
    ngayNenVe: ngayVe,
    soNgayTinh: D,
    chanBao: null,
    ghiChu,
  };
}

