/**
 * LỚP "MẬT ĐỘ TÀU DỰ KIẾN" — theo NGÀY · THÁNG · MÙA · TRĂNG (2026-10-25).
 *
 * Dữ liệu `public/data/fleet-density.v1.json`: ước lượng giờ có mặt + số tàu của từng ô 0,25° CÙNG TRỤC
 * lưới cá (số tổng theo ô, không định danh). Thuần: chọn lát (mode×khoá×nghề) → ô {lat, lon, giờ/ngày,
 * số tàu} → 3 mức theo phân vị của chính lát đó (mỗi lát tự so trong nó — ngày thưa vẫn có chỗ "đông").
 * Đây là ước tính để tham khảo, KHÔNG phải dự báo cá — chữ hiển thị không nói "có cá".
 */

import { fetchDataJson } from "@/lib/data-fetch";
import { moonPhase } from "@/lib/moon";

export const FLEET_DENSITY_PATH = "/data/fleet-density.v1.json";
/**
 * MỐC DỮ LIỆU của file đang phát (= `builtFrom.to`). ĐỔI CÙNG LÚC với file (rà Codex 2026-10-26, điểm 5):
 * file đi nhánh cache-first của service worker mà KHÔNG nằm trong vỏ, nên thay file trên máy chủ thì máy đã tải
 * giữ bản cũ tới khi bump kho vỏ. URL mang mốc (`?b=`) ⇒ bản mới = khoá cache mới, tải khi có sóng; bản cũ vẫn
 * nằm trong kho cho lúc mất sóng. Cổng: fleet-density.test (file thật) đỏ khi mốc lệch file.
 */
export const FLEET_DENSITY_BUILT = "2026-10-06";
export const fleetDensityUrl = (): string => `${FLEET_DENSITY_PATH}?b=${FLEET_DENSITY_BUILT}`;

/** Lớp đang ở giai đoạn XEM TRƯỚC NỘI BỘ: chỉ tài khoản trong danh sách này thấy nút (2026-10-25). */
export const DENSITY_PREVIEW_PHONES = ["0938635689"] as const;
export function canSeeDensity(phone: string | null | undefined): boolean {
  if (!phone) return false;
  const digits = phone.replace(/\D/g, "").replace(/^84/, "0");
  return (DENSITY_PREVIEW_PHONES as readonly string[]).includes(digits);
}

/** [i, j, giờ×10, số tàu] */
export type DensityRow = [number, number, number, number];
export type DensityMode = "day" | "month" | "season" | "moon";
export type DensityGear = "tat" | "vay" | "cau" | "re" | "keo" | "chup" | "khac";
export type DensitySeason = "nam" | "bac";

export interface FleetDensity {
  v: number;
  /** CHỈ khoảng thời gian — không số tàu, không tên kho (file ra ngoài) */
  builtFrom: { months: string[]; from: string; to: string };
  rule: { minVessels: number };
  axis: { lat0: number; lon0: number; step: number; nLat: number; nLon: number };
  gears: string[];
  /** ngày có bão/ATNĐ trên Biển Đông → tên — CHỈ dính lát Ngày; lát tháng/mùa/trăng đã bỏ các ngày này
   *  (có bão thì tàu nằm bờ, gộp vào là lệch) */
  storms?: Record<string, string[]>;
  /** số ngày có số liệu của từng khoá (đã trừ ngày bão ở tháng/mùa/trăng) — chia giờ/ngày để so được giữa các lát */
  days: Record<DensityMode, Record<string, number>>;
  /** cá vùng đó hay có theo ô: khoá "nam"/"bac" (mùa), "01".."12" (tháng trong năm), "tat" (cả năm) → "i,j" → [[tên ngắn, %kg]] top 3 */
  species?: Record<string, Record<string, [string, number][]>>;
  day: Record<string, DensityRow[]>;
  month: Record<string, Partial<Record<DensityGear, DensityRow[]>>>;
  season: Partial<Record<DensitySeason, Partial<Record<DensityGear, DensityRow[]>>>>;
  moon: Record<string, Partial<Record<DensityGear, DensityRow[]>>>;
}

export interface DensitySel {
  mode: DensityMode;
  /** "YYYY-MM-DD" | "YYYY-MM" | "nam"/"bac" | "0".."7" */
  key: string;
  /** chỉ có nghĩa với month/season/moon — day luôn gộp mọi nghề */
  gear: DensityGear;
}

export interface DensityCell {
  lat: number;
  lon: number;
  /** giờ tàu đánh bắt mỗi ngày trong ô (đã chia ngày phủ) */
  hoursPerDay: number;
  /** số tàu khác nhau đã đánh trong ô ở khoá này */
  vessels: number;
}

/** Nhãn ≤2 chữ cho chip (src/lib/labels.ts giữ tên khu; tên lát để ở đây vì chỉ lớp này dùng). */
export const DENSITY_MODES: { id: DensityMode; label: string }[] = [
  { id: "day", label: "Ngày" },
  { id: "month", label: "Tháng" },
  { id: "season", label: "Mùa" },
  { id: "moon", label: "Trăng" },
];
export const DENSITY_GEARS: { id: DensityGear; label: string }[] = [
  { id: "tat", label: "Mọi nghề" },
  { id: "vay", label: "Vây" },
  { id: "cau", label: "Câu" },
  { id: "re", label: "Rê" },
  { id: "keo", label: "Kéo" },
  { id: "chup", label: "Chụp" },
  { id: "khac", label: "Khác" },
];
export const DENSITY_SEASONS: { id: DensitySeason; label: string; sub: string }[] = [
  { id: "nam", label: "Vụ Nam", sub: "tháng 4–9" },
  { id: "bac", label: "Vụ Bắc", sub: "tháng 10–3" },
];
/** 8 pha trăng, CÙNG ranh với `moonPhase` (pha 0 = trăng non, tâm ở 0). */
export const DENSITY_MOONS: { id: string; label: string }[] = [
  { id: "0", label: "Trăng non" },
  { id: "1", label: "Đầu tháng" },
  { id: "2", label: "Thượng huyền" },
  { id: "3", label: "Gần rằm" },
  { id: "4", label: "Rằm" },
  { id: "5", label: "Sau rằm" },
  { id: "6", label: "Hạ huyền" },
  { id: "7", label: "Cuối tháng" },
];

/** Ba mức mật độ — một họ TÍM, KHÁC hẳn xanh/vàng/đỏ của lớp cá để không đọc nhầm thành "mức cá".
 *  Hex để ở đây (như FISH_LEVEL_BANDS) vì MapLibre paint không đọc được biến CSS. */
export const DENSITY_LEVELS = [
  { key: "thua", label: "Thưa", color: "#c4b5fd" },
  { key: "vua", label: "Vừa", color: "#8b5cf6" },
  { key: "dong", label: "Đông", color: "#4c1d95" },
] as const;

export const seasonOfMonth = (m: number): DensitySeason => (m >= 4 && m <= 9 ? "nam" : "bac");

/** Pha trăng 0..7 của một thời điểm — cùng ranh 1/16 với nhãn moon.ts. */
export function moonBinOf(date: Date): string {
  const { frac } = moonPhase(date);
  return String(Math.floor(((frac + 1 / 16) % 1) * 8));
}

/** Khoá mặc định cho một chế độ theo hôm nay — ngày: ngày cuối có dữ liệu; tháng: tháng cuối. */
export function defaultDensityKey(d: FleetDensity, mode: DensityMode, today: Date): string {
  if (mode === "day") return Object.keys(d.day).sort().at(-1) ?? "";
  if (mode === "month") return Object.keys(d.month).sort().at(-1) ?? "";
  if (mode === "season") return seasonOfMonth(today.getMonth() + 1);
  return moonBinOf(today);
}

/** Các khoá có dữ liệu của một chế độ, tăng dần. */
export function densityKeys(d: FleetDensity, mode: DensityMode): string[] {
  const src = mode === "day" ? d.day : mode === "month" ? d.month : mode === "season" ? d.season : d.moon;
  return Object.keys(src).sort();
}

/** Ô của một lát. Lát thiếu ⇒ [] (không bịa). */
export function densityCells(d: FleetDensity, sel: DensitySel): DensityCell[] {
  let rows: DensityRow[] | undefined;
  if (sel.mode === "day") rows = d.day[sel.key];
  else {
    const byGear = sel.mode === "month" ? d.month[sel.key] : sel.mode === "season" ? d.season[sel.key as DensitySeason] : d.moon[sel.key];
    rows = byGear?.[sel.gear];
  }
  if (!rows?.length) return [];
  const days = Math.max(1, d.days[sel.mode]?.[sel.key] ?? 1);
  const { lat0, lon0, step } = d.axis;
  return rows.map(([i, j, h10, n]) => ({
    lat: lat0 + i * step,
    lon: lon0 + j * step,
    hoursPerDay: h10 / 10 / days,
    vessels: n,
  }));
}

/**
 * Ngưỡng 3 mức theo phân vị của lát (p50 / p85 giờ/ngày, nội suy tuyến tính) — mức là "so với các ô
 * khác CÙNG lát", nên ngày thưa tàu vẫn chỉ ra được chỗ tàu tụ. Lát 1 ô hoặc mọi ô bằng nhau ⇒ không
 * có gì để so ⇒ tất cả Thưa. Trả mức 0..2 cho từng ô.
 */
export function densityLevel(cells: DensityCell[]): { thresholds: [number, number]; levelOf: (c: DensityCell) => 0 | 1 | 2 } {
  const v = cells.map((c) => c.hoursPerDay).sort((a, b) => a - b);
  const n = v.length;
  const q = (p: number) => {
    if (!n) return 0;
    const x = p * (n - 1), lo = Math.floor(x), hi = Math.min(n - 1, lo + 1);
    return v[lo] + (v[hi] - v[lo]) * (x - lo);
  };
  const flat = n < 2 || v[0] === v[n - 1];
  const t1 = flat ? 0 : q(0.5), t2 = flat ? 0 : q(0.85);
  return {
    thresholds: [t1, t2],
    levelOf: (c) => (flat ? 0 : c.hoursPerDay >= t2 ? 2 : c.hoursPerDay >= t1 ? 1 : 0),
  };
}

/** Khoá bảng loài ứng với lát đang xem: ngày/tháng → tháng-trong-năm, mùa → mùa, trăng → cả năm. */
export function speciesKeyFor(sel: DensitySel): string {
  if (sel.mode === "day" || sel.mode === "month") return sel.key.slice(5, 7) || "tat";
  if (sel.mode === "season") return sel.key;
  return "tat";
}

/** Ô (lat, lon) gần nhất trên trục lưới (trong nửa ô) → cá hay có ở lát đó; không có ⇒ []. Lùi về "tat" khi tháng/mùa trống. */
export function densitySpeciesAt(d: FleetDensity, sel: DensitySel, lat: number, lon: number): [string, number][] {
  if (!d.species) return [];
  const { lat0, lon0, step, nLat, nLon } = d.axis;
  const i = Math.round((lat - lat0) / step), j = Math.round((lon - lon0) / step);
  if (i < 0 || j < 0 || i >= nLat || j >= nLon) return [];
  if (Math.abs(lat - (lat0 + i * step)) > step / 2 || Math.abs(lon - (lon0 + j * step)) > step / 2) return [];
  const ij = `${i},${j}`;
  return d.species[speciesKeyFor(sel)]?.[ij] ?? d.species.tat?.[ij] ?? [];
}

/** Ô mật độ chứa điểm (lat, lon) trong lát — để thẻ chạm nói "Đông · N tàu · X giờ/ngày". */
export function densityCellAt(cells: DensityCell[], step: number, lat: number, lon: number): DensityCell | null {
  const h = step / 2;
  return cells.find((c) => Math.abs(c.lat - lat) <= h && Math.abs(c.lon - lon) <= h) ?? null;
}

/** Nhãn người đọc cho khoá của một chế độ ("12/10", "Tháng 10/2026", "Vụ Nam", "Rằm"). */
export function densityKeyLabel(mode: DensityMode, key: string): string {
  if (mode === "day") {
    const [y, m, d] = key.split("-");
    return y && m && d ? `${Number(d)}/${Number(m)}/${y}` : key;
  }
  if (mode === "month") {
    const [y, m] = key.split("-");
    return y && m ? `Tháng ${Number(m)}/${y}` : key;
  }
  if (mode === "season") return DENSITY_SEASONS.find((s) => s.id === key)?.label ?? key;
  return DENSITY_MOONS.find((s) => s.id === key)?.label ?? key;
}

let cached: Promise<FleetDensity> | null = null;

/**
 * Tải lưới (một lần cho cả phiên; ~vài MB, CÙNG ORIGIN nên service worker giữ được khi đã tải).
 * `async` là lá chắn chống ném đồng bộ (án lệ fetchKhuTruBao). Hỏng ⇒ XOÁ đệm để lần sóng về thử
 * lại — mất sóng không khoá vĩnh viễn một lớp bản đồ.
 */
export async function fetchFleetDensity(): Promise<FleetDensity> {
  if (!cached) {
    cached = fetchDataJson<FleetDensity>(fleetDensityUrl(), 30000, "fleet-density")
      .then((d) => {
        if (!d || d.v !== 1 || !d.axis || !d.day || !d.month) throw new Error("fleet-density: file sai dạng");
        return d;
      })
      .catch((e) => {
        cached = null;
        throw e;
      });
  }
  return cached;
}

/* ──────────────────────────────────────────────────────────────────────────────
 * DỰ BÁO MẬT ĐỘ TÀU 16 NGÀY TỚI (anh Long 25/10: "cứ tính toán rồi hiện từ ngày hiện tại trở đi,
 * trọng số trăng, gió, bão, mùa vụ"; lọc theo NGHỀ như bản sáng, không lọc loài — anh chốt lại tối 25/10).
 *
 *   dự kiến(ô, ngày, nghề) = nền mùa(ô, tháng của ngày, nghề) × trăng(ô, pha của ngày, nghề) × gió(ngày, vùng) × bão(ngày)
 *
 *   nền mùa  : lát tháng cùng tháng-trong-năm của nghề (giờ/ngày); thiếu thì hai tháng kề ×0,5.
 *   trăng    : giờ/ngày của pha đó (nghề đó) chia trung bình 8 pha, kẹp [0,5; 1,5] — ô không có số liệu ⇒ 1.
 *   gió      : gió mạnh nhất trong ngày ở trạm gần ô nhất: < 39 km/h ⇒ 1 · cấp 6 ⇒ 0,6 · cấp 7 ⇒ 0,3 · ≥ cấp 8 ⇒ 0,1.
 *   bão      : ngày bão ⇒ CHỈ ô trong vùng bão hạ (rà Codex 26/10, điểm 2 — trước nhân 0,1 cả Biển Đông, một tin
 *              bão là mất lớp toàn vùng): trong vùng ảnh hưởng / cách tâm hay đường đi ≤ 300 km ⇒ 0,1 · ≤ 600 km ⇒ 0,5 ·
 *              xa hơn ⇒ 1. Tin không có toạ độ ⇒ 0,1 cả vùng như cũ.
 *   gió      : trạm cảng chỉ đại diện trong WIND_STATION_MAX_KM (điểm 4 — trước lấy trạm gần nhất vô hạn, một trạm
 *              nói thay cả khơi); ô không có trạm trong tầm ⇒ hệ số 1 + cờ `windPartial`.
 *   TÀU/NGÀY (điểm 1): số tàu lát tháng là số tàu KHÁC NHAU cả tháng (337) — không phải tàu/ngày (8–267). Thẻ nay nói
 *              `vesselsPerDay` = trung bình tàu khác nhau MỖI NGÀY của ô trong lát NGÀY cùng tháng (bỏ ngày bão),
 *              nghề lẻ chia theo tỷ lệ giờ nghề/mọi nghề; không có lát ngày ⇒ null, thẻ không in số.
 *   NỀN MỎNG : tháng nền phủ < DENSITY_THIN_DAYS ngày ⇒ cờ `thinBase` (tháng 10/2026 mới 6 ngày) — panel nói rõ.
 *   ĐIỂM 0–100 = giá trị ô ÷ "ô mạnh QUANH ĐÓ" × 100 — ô mạnh = max nền×trăng trong bán kính
 *   DENSITY_LOCAL_RADIUS_KM, nhưng không thấp hơn DENSITY_LOCAL_FLOOR × p98 cả nước (anh Long 25/10 tối:
 *   một thang cả nước thì ô 337 tàu ngoài Côn Đảo "nuốt" hết thang, khơi Hoàng Sa/Trường Sa 59 tàu/ô trông
 *   như không ai — chấm theo vùng để mỗi vùng có Đông/Vừa/Thưa của nó; sàn tuyệt đối để vùng lác đác vài
 *   tàu không tự thành Đông). CHỈ TÔ ô ≥ DENSITY_MIN_SCORE ("đừng tô tím cả biển"; 25 → 21 tối 25/10,
 *   anh Long "tăng thêm tầm 30 %": tháng 10 mọi nghề 261 → ~340 ô); mức cố định Thưa 21–50 · Vừa 50–75 ·
 *   Đông ≥75 như lớp cá ⇒ ngày gió bão ô rớt điểm, biến mất hẳn.
 *   Thuần, không mạng; thiếu gió ⇒ hệ số 1 + cờ `windMissing`.
 *   Loài KHÔNG lọc — thẻ chạm ô vẫn nói "cá vùng này hay có" (densitySpeciesAt).
 * ────────────────────────────────────────────────────────────────────────────── */

export const FLEET_FORECAST_DAYS = 16;

export interface WindStation {
  lat: number;
  lon: number;
  /** ISO ngày → gió mạnh nhất km/h */
  byDate: Record<string, number>;
}

/** Vùng bão lấy từ tin bão (lib/storms StormAlert): tâm + đường đi [lon,lat][] + vùng ảnh hưởng (polygon [lon,lat]). */
export interface StormZone {
  lat: number;
  lon: number;
  track?: number[][];
  areas?: number[][][][];
}

export interface FleetForecastInput {
  d: FleetDensity;
  /** ISO hôm nay (giờ VN) */
  todayIso: string;
  /** 0 = hôm nay … 15 */
  dayOffset: number;
  /** nhóm nghề, "tat" = mọi nghề */
  gear: DensityGear;
  wind?: WindStation[];
  /** ngày coi là có bão (tin còn mới) — hệ số bão chỉ áp những ngày này */
  stormDays?: Set<string>;
  /** vùng bão để hạ THEO VÙNG; rỗng/thiếu ⇒ hạ cả vùng tính (tin không toạ độ) */
  storms?: StormZone[];
}

export interface FleetForecastCell extends DensityCell {
  /** giờ/ngày dự kiến sau mọi hệ số */
  value: number;
  /** 0–100 so với ô mạnh trong ngày (p98 nền×trăng) */
  score: number;
  level: 0 | 1 | 2;
  /** ước TÀU/NGÀY sau hệ số (từ lát ngày — đúng đơn vị); null = tháng nền không có lát ngày ⇒ không in số */
  vesselsPerDay: number | null;
  /** hệ số bão đã áp cho ô (1 = ngoài vùng bão) */
  stormF: number;
}

/** Sàn tô + ranh mức (điểm 0–100, cố định — cùng ngữ pháp FISH_LEVEL_BANDS). */
export const DENSITY_MIN_SCORE = 21;
export const DENSITY_SCORE_BANDS: [number, number] = [50, 75];
/** Phân vị cả nước — chỉ còn dùng làm SÀN tuyệt đối cho mốc vùng. */
export const DENSITY_REF_Q = 0.98;
/** Bán kính "quanh đây" khi chấm theo vùng (~135 hải lý). */
export const DENSITY_LOCAL_RADIUS_KM = 250;
/** Mốc vùng không được thấp hơn tỷ lệ này của p98 cả nước (vùng lác đác vài tàu không tự thành Đông). */
export const DENSITY_LOCAL_FLOOR = 0.15;

export interface FleetForecast {
  dateIso: string;
  /** CHỈ ô ≥ DENSITY_MIN_SCORE */
  cells: FleetForecastCell[];
  /** sàn tuyệt đối của mốc vùng (DENSITY_LOCAL_FLOOR × p98 cả nước), giờ/ngày */
  ref: number;
  /** không có trạm gió nào có số ngày này ⇒ mọi ô hệ số 1 */
  windMissing: boolean;
  /** có gió nhưng một phần ô (thường là khơi xa) không có trạm trong WIND_STATION_MAX_KM */
  windPartial: boolean;
  /** ngày bão (có áp hệ số bão) */
  storm: boolean;
  /** số ô nền bị hạ vì bão (0 khi ngày bão nhưng vùng bão xa hết) */
  stormCells: number;
  /** số ngày số liệu của tháng nền; thinBase = dưới DENSITY_THIN_DAYS */
  baseDays: number;
  thinBase: boolean;
  moonBin: string;
}

export const addDaysIso = (iso: string, n: number): string =>
  new Date(new Date(`${iso}T00:00:00Z`).getTime() + n * 86400000).toISOString().slice(0, 10);

/** Hệ số gió theo km/h (ranh Beaufort: cấp 6 từ 39, cấp 7 từ 50, cấp 8 từ 62). */
export function windFactor(kmh: number | undefined): number {
  if (kmh == null || !Number.isFinite(kmh)) return 1;
  if (kmh >= 62) return 0.1;
  if (kmh >= 50) return 0.3;
  if (kmh >= 39) return 0.6;
  return 1;
}
export const STORM_FACTOR = 0.1;
/** Ngoài vùng gần nhưng trong tầm xa của bão: tàu bớt ra, chưa nằm bờ hết. */
export const STORM_FAR_FACTOR = 0.5;
export const STORM_NEAR_KM = 300;
export const STORM_FAR_KM = 600;
/** Trạm gió cảng chỉ nói thay cho ô trong bán kính này (~135 hải lý). */
export const WIND_STATION_MAX_KM = 250;
/** Tháng nền phủ dưới ngần này ngày ⇒ nền mỏng, panel nói rõ. */
export const DENSITY_THIN_DAYS = 10;
export const MOON_CLAMP: [number, number] = [0.5, 1.5];

const KM_PER_DEG_LAT = 111.32;
/** Khoảng cách phẳng (km) — đủ cho ngưỡng vài trăm km trên Biển Đông. */
export function kmBetween(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dy = (lat2 - lat1) * KM_PER_DEG_LAT;
  const dx = (lon2 - lon1) * KM_PER_DEG_LAT * Math.cos(((lat1 + lat2) / 2) * (Math.PI / 180));
  return Math.sqrt(dx * dx + dy * dy);
}

/** Điểm trong ring [lon,lat][] (ray casting). */
function inRing(ring: number[][], lon: number, lat: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * Hệ số bão tại một ô: trong vùng ảnh hưởng hoặc cách tâm/đường đi ≤ STORM_NEAR_KM ⇒ STORM_FACTOR; ≤ STORM_FAR_KM ⇒
 * STORM_FAR_FACTOR; xa hơn ⇒ 1. Không có vùng nào (tin không toạ độ) ⇒ STORM_FACTOR cho mọi ô (an toàn như cũ).
 */
export function stormFactorAt(zones: StormZone[] | undefined, lat: number, lon: number): number {
  if (!zones || zones.length === 0) return STORM_FACTOR;
  let f = 1;
  for (const z of zones) {
    for (const poly of z.areas ?? []) {
      const ring = poly[0];
      if (ring && ring.length >= 3 && inRing(ring, lon, lat)) return STORM_FACTOR;
    }
    let dmin = kmBetween(lat, lon, z.lat, z.lon);
    for (const pt of z.track ?? []) {
      if (pt.length < 2) continue;
      const dd = kmBetween(lat, lon, pt[1], pt[0]);
      if (dd < dmin) dmin = dd;
    }
    if (dmin <= STORM_NEAR_KM) return STORM_FACTOR;
    if (dmin <= STORM_FAR_KM) f = Math.min(f, STORM_FAR_FACTOR);
  }
  return f;
}

/**
 * TÀU/NGÀY theo ô của một tháng ("YYYY-MM") từ lát NGÀY: trung bình số tàu khác nhau mỗi ngày (ngày bão bỏ, ô vắng
 * ngày nào tính 0 vì dưới 3 tàu). Tháng không có lát ngày ⇒ Map rỗng.
 */
export function dailyVessels(d: FleetDensity, monthKey: string): Map<string, number> {
  const stormy = new Set(Object.keys(d.storms ?? {}));
  const keys = Object.keys(d.day).filter((k) => k.startsWith(monthKey) && !stormy.has(k));
  const out = new Map<string, number>();
  if (!keys.length) return out;
  for (const k of keys) {
    for (const c of densityCells(d, { mode: "day", key: k, gear: "tat" })) {
      const id = `${c.lat},${c.lon}`;
      out.set(id, (out.get(id) ?? 0) + c.vessels / keys.length);
    }
  }
  return out;
}

export interface BaseCell extends DensityCell {
  /** tàu/ngày trung bình của ô (lát ngày, nghề chia theo tỷ lệ giờ); null khi tháng nền không có lát ngày */
  vesselsPerDay: number | null;
}

/** Số ngày số liệu của các tháng nền được chọn cho `mm` (cùng luật chọn với seasonBase). */
export function seasonBaseDays(d: FleetDensity, mm: string): number {
  const keys = Object.keys(d.month).sort();
  const sameMonth = keys.filter((k) => k.slice(5, 7) === mm);
  const prev = String(((Number(mm) + 10) % 12) + 1).padStart(2, "0");
  const next = String((Number(mm) % 12) + 1).padStart(2, "0");
  const picks = sameMonth.length ? sameMonth : keys.filter((k) => k.slice(5, 7) === prev || k.slice(5, 7) === next);
  return picks.reduce((s, k) => s + (d.days.month?.[k] ?? 0), 0);
}

/** Nền mùa: giờ/ngày + số tàu theo ô cho tháng-trong-năm `mm` ("01".."12") của nghề; thiếu ⇒ hai tháng kề ×0,5. */
export function seasonBase(d: FleetDensity, mm: string, gear: DensityGear = "tat"): Map<string, BaseCell> {
  const keys = Object.keys(d.month).sort();
  const sameMonth = keys.filter((k) => k.slice(5, 7) === mm);
  const prev = String(((Number(mm) + 10) % 12) + 1).padStart(2, "0");
  const next = String((Number(mm) % 12) + 1).padStart(2, "0");
  const picks: [string, number][] = sameMonth.length
    ? sameMonth.map((k) => [k, 1])
    : keys.filter((k) => k.slice(5, 7) === prev || k.slice(5, 7) === next).map((k) => [k, 0.5]);
  const acc = new Map<string, DensityCell & { w: number; vpd: number; vpdW: number }>();
  let wSum = 0;
  for (const [k, w] of picks) {
    wSum += w;
    const daily = dailyVessels(d, k);
    // nghề lẻ: tàu/ngày × (giờ nghề ÷ giờ mọi nghề) của ô trong lát tháng — lát ngày không tách nghề
    const tatHours = new Map<string, number>();
    if (gear !== "tat") for (const c of densityCells(d, { mode: "month", key: k, gear: "tat" })) tatHours.set(`${c.lat},${c.lon}`, c.hoursPerDay);
    for (const c of densityCells(d, { mode: "month", key: k, gear })) {
      const id = `${c.lat},${c.lon}`;
      const a = acc.get(id) ?? { lat: c.lat, lon: c.lon, hoursPerDay: 0, vessels: 0, w: 0, vpd: 0, vpdW: 0 };
      a.hoursPerDay += w * c.hoursPerDay;
      a.vessels += w * c.vessels;
      a.w += w;
      const dv = daily.get(id);
      if (dv != null) {
        const share = gear === "tat" ? 1 : Math.min(1, c.hoursPerDay / Math.max(c.hoursPerDay, tatHours.get(id) ?? c.hoursPerDay));
        a.vpd += w * dv * share;
        a.vpdW += w;
      }
      acc.set(id, a);
    }
  }
  const out = new Map<string, BaseCell>();
  if (!wSum) return out;
  for (const [id, a] of acc)
    out.set(id, {
      lat: a.lat,
      lon: a.lon,
      hoursPerDay: a.hoursPerDay / wSum,
      vessels: a.vessels / wSum,
      vesselsPerDay: a.vpdW > 0 ? a.vpd / a.vpdW : null,
    });
  return out;
}

/** Hệ số trăng theo ô cho pha `bin` (nghề `gear`): giờ/ngày pha đó ÷ trung bình 8 pha, kẹp MOON_CLAMP. */
export function moonFactors(d: FleetDensity, bin: string, gear: DensityGear = "tat"): Map<string, number> {
  const mean = new Map<string, number>();
  for (const b of DENSITY_MOONS) {
    for (const c of densityCells(d, { mode: "moon", key: b.id, gear })) {
      const id = `${c.lat},${c.lon}`;
      mean.set(id, (mean.get(id) ?? 0) + c.hoursPerDay / DENSITY_MOONS.length);
    }
  }
  const out = new Map<string, number>();
  for (const c of densityCells(d, { mode: "moon", key: bin, gear })) {
    const id = `${c.lat},${c.lon}`;
    const m = mean.get(id) ?? 0;
    if (m > 0) out.set(id, Math.min(MOON_CLAMP[1], Math.max(MOON_CLAMP[0], c.hoursPerDay / m)));
  }
  return out;
}

/** Trạm gió gần nhất TRONG WIND_STATION_MAX_KM; xa hơn ⇒ null (trạm cảng không nói thay khơi xa). */
export function nearestStation(st: WindStation[], lat: number, lon: number, maxKm = WIND_STATION_MAX_KM): WindStation | null {
  let best: WindStation | null = null, bd = Infinity;
  for (const s of st) {
    const dd = kmBetween(lat, lon, s.lat, s.lon);
    if (dd < bd) { bd = dd; best = s; }
  }
  return best && bd <= maxKm ? best : null;
}

export function forecastFleetDensity(inp: FleetForecastInput): FleetForecast {
  const { d, todayIso, gear } = inp;
  const dateIso = addDaysIso(todayIso, inp.dayOffset);
  const mm = dateIso.slice(5, 7);
  const moonBin = moonBinOf(new Date(`${dateIso}T05:00:00Z`)); // trưa giờ VN
  const base = seasonBase(d, mm, gear);
  const baseDays = seasonBaseDays(d, mm);
  const moon = moonFactors(d, moonBin, gear);
  const storm = !!inp.stormDays?.has(dateIso);
  const stations = inp.wind?.filter((s) => s.byDate[dateIso] != null) ?? [];
  const windMissing = stations.length === 0;
  let windPartial = false;
  let stormCells = 0;

  // nền × trăng (để lấy ngưỡng mức, không gió/bão)
  const pre: { c: BaseCell; v: number; moonF: number }[] = [];
  for (const c of base.values()) {
    const moonF = moon.get(`${c.lat},${c.lon}`) ?? 1;
    pre.push({ c, v: c.hoursPerDay * moonF, moonF });
  }
  const sorted = pre.map((p) => p.v).sort((a, b) => a - b);
  const q = (p: number) => {
    const n = sorted.length;
    if (!n) return 0;
    const x = p * (n - 1), lo = Math.floor(x), hi = Math.min(n - 1, lo + 1);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (x - lo);
  };
  const ref = q(DENSITY_REF_Q) * DENSITY_LOCAL_FLOOR;

  // mốc VÙNG: max nền×trăng trong bán kính quanh ô (quét n² — ≤ ~1 500 ô/ngày, vài ms), không dưới sàn `ref`
  const rad2 = DENSITY_LOCAL_RADIUS_KM ** 2;
  const kmPerDegLat = KM_PER_DEG_LAT;
  const localRef = (c: DensityCell): number => {
    let m = ref;
    const cosLat = Math.cos((c.lat * Math.PI) / 180);
    for (const o of pre) {
      const dy = (o.c.lat - c.lat) * kmPerDegLat;
      const dx = (o.c.lon - c.lon) * kmPerDegLat * cosLat;
      if (dx * dx + dy * dy <= rad2 && o.v > m) m = o.v;
    }
    return m;
  };

  const cells: FleetForecastCell[] = [];
  if (ref > 0) {
    for (const { c, v, moonF } of pre) {
      const st = windMissing ? null : nearestStation(stations, c.lat, c.lon);
      if (!windMissing && !st) windPartial = true;
      const wf = windFactor(st?.byDate[dateIso]);
      const stormF = storm ? stormFactorAt(inp.storms, c.lat, c.lon) : 1;
      if (stormF < 1) stormCells++;
      const f = wf * stormF;
      const value = v * f;
      const score = Math.min(100, Math.round((value / localRef(c)) * 100));
      if (score < DENSITY_MIN_SCORE) continue;
      const level: 0 | 1 | 2 = score >= DENSITY_SCORE_BANDS[1] ? 2 : score >= DENSITY_SCORE_BANDS[0] ? 1 : 0;
      cells.push({
        lat: c.lat,
        lon: c.lon,
        hoursPerDay: c.hoursPerDay,
        vessels: Math.max(0, Math.round(c.vessels * moonF * f)),
        value,
        score,
        level,
        vesselsPerDay: c.vesselsPerDay == null ? null : Math.max(0, Math.round(c.vesselsPerDay * moonF * f)),
        stormF,
      });
    }
  }
  return { dateIso, cells, ref, windMissing, windPartial, storm, stormCells, baseDays, thinBase: baseDays < DENSITY_THIN_DAYS, moonBin };
}
