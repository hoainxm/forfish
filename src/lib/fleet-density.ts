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

/** Mức của một loài trong ô theo phần trăm — chữ cho bà con, KHÔNG in số (anh Long 25/10): ≥40 nhiều · ≥20 trung bình · còn lại ít. */
export function speciesAmountLabel(pct: number): "nhiều" | "trung bình" | "ít" {
  return pct >= 40 ? "nhiều" : pct >= 20 ? "trung bình" : "ít";
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
    cached = fetchDataJson<FleetDensity>(FLEET_DENSITY_PATH, 30000, "fleet-density")
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
 *   bão      : ngày nằm trong tập ngày bão ⇒ 0,1 (tàu nằm bờ).
 *   ĐIỂM 0–100 = giá trị ô ÷ "ô mạnh QUANH ĐÓ" × 100 — ô mạnh = max nền×trăng trong bán kính
 *   DENSITY_LOCAL_RADIUS_KM, nhưng không thấp hơn DENSITY_LOCAL_FLOOR × p98 cả nước (anh Long 25/10 tối:
 *   một thang cả nước thì ô 337 tàu ngoài Côn Đảo "nuốt" hết thang, khơi Hoàng Sa/Trường Sa 59 tàu/ô trông
 *   như không ai — chấm theo vùng để mỗi vùng có Đông/Vừa/Thưa của nó; sàn tuyệt đối để vùng lác đác vài
 *   tàu không tự thành Đông). CHỈ TÔ ô ≥ DENSITY_MIN_SCORE ("đừng tô tím cả biển"); mức cố định
 *   Thưa 25–50 · Vừa 50–75 · Đông ≥75 như lớp cá ⇒ ngày gió bão ô rớt điểm, biến mất hẳn.
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

export interface FleetForecastInput {
  d: FleetDensity;
  /** ISO hôm nay (giờ VN) */
  todayIso: string;
  /** 0 = hôm nay … 15 */
  dayOffset: number;
  /** nhóm nghề, "tat" = mọi nghề */
  gear: DensityGear;
  wind?: WindStation[];
  stormDays?: Set<string>;
}

export interface FleetForecastCell extends DensityCell {
  /** giờ/ngày dự kiến sau mọi hệ số */
  value: number;
  /** 0–100 so với ô mạnh trong ngày (p98 nền×trăng) */
  score: number;
  level: 0 | 1 | 2;
}

/** Sàn tô + ranh mức (điểm 0–100, cố định — cùng ngữ pháp FISH_LEVEL_BANDS). */
export const DENSITY_MIN_SCORE = 25;
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
  windMissing: boolean;
  storm: boolean;
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
export const MOON_CLAMP: [number, number] = [0.5, 1.5];

/** Nền mùa: giờ/ngày + số tàu theo ô cho tháng-trong-năm `mm` ("01".."12") của nghề; thiếu ⇒ hai tháng kề ×0,5. */
export function seasonBase(d: FleetDensity, mm: string, gear: DensityGear = "tat"): Map<string, DensityCell> {
  const keys = Object.keys(d.month).sort();
  const sameMonth = keys.filter((k) => k.slice(5, 7) === mm);
  const prev = String(((Number(mm) + 10) % 12) + 1).padStart(2, "0");
  const next = String((Number(mm) % 12) + 1).padStart(2, "0");
  const picks: [string, number][] = sameMonth.length
    ? sameMonth.map((k) => [k, 1])
    : keys.filter((k) => k.slice(5, 7) === prev || k.slice(5, 7) === next).map((k) => [k, 0.5]);
  const acc = new Map<string, DensityCell & { w: number }>();
  let wSum = 0;
  for (const [k, w] of picks) {
    wSum += w;
    for (const c of densityCells(d, { mode: "month", key: k, gear })) {
      const id = `${c.lat},${c.lon}`;
      const a = acc.get(id) ?? { lat: c.lat, lon: c.lon, hoursPerDay: 0, vessels: 0, w: 0 };
      a.hoursPerDay += w * c.hoursPerDay;
      a.vessels += w * c.vessels;
      a.w += w;
      acc.set(id, a);
    }
  }
  const out = new Map<string, DensityCell>();
  if (!wSum) return out;
  for (const [id, a] of acc) out.set(id, { lat: a.lat, lon: a.lon, hoursPerDay: a.hoursPerDay / wSum, vessels: a.vessels / wSum });
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

function nearestStation(st: WindStation[], lat: number, lon: number): WindStation | null {
  let best: WindStation | null = null, bd = Infinity;
  for (const s of st) {
    const dd = (s.lat - lat) ** 2 + ((s.lon - lon) * Math.cos((lat * Math.PI) / 180)) ** 2;
    if (dd < bd) { bd = dd; best = s; }
  }
  return best;
}

export function forecastFleetDensity(inp: FleetForecastInput): FleetForecast {
  const { d, todayIso, gear } = inp;
  const dateIso = addDaysIso(todayIso, inp.dayOffset);
  const mm = dateIso.slice(5, 7);
  const moonBin = moonBinOf(new Date(`${dateIso}T05:00:00Z`)); // trưa giờ VN
  const base = seasonBase(d, mm, gear);
  const moon = moonFactors(d, moonBin, gear);
  const storm = !!inp.stormDays?.has(dateIso);
  const stations = inp.wind?.filter((s) => s.byDate[dateIso] != null) ?? [];
  const windMissing = stations.length === 0;

  // nền × trăng (để lấy ngưỡng mức, không gió/bão)
  const pre: { c: DensityCell; v: number; moonF: number }[] = [];
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
  const kmPerDegLat = 111.32;
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
      const wf = windFactor(st?.byDate[dateIso]);
      const f = wf * (storm ? STORM_FACTOR : 1);
      const value = v * f;
      const score = Math.min(100, Math.round((value / localRef(c)) * 100));
      if (score < DENSITY_MIN_SCORE) continue;
      const level: 0 | 1 | 2 = score >= DENSITY_SCORE_BANDS[1] ? 2 : score >= DENSITY_SCORE_BANDS[0] ? 1 : 0;
      cells.push({ lat: c.lat, lon: c.lon, hoursPerDay: c.hoursPerDay, vessels: Math.max(0, Math.round(c.vessels * moonF * f)), value, score, level });
    }
  }
  return { dateIso, cells, ref, windMissing, storm, moonBin };
}
