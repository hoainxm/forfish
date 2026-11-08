/**
 * LỚP "MẬT ĐỘ TÀU DỰ KIẾN" — PHẦN MÁY (tách 2026-11-08, docs/app-map/ops/khong-lo-nguon.md nợ #7).
 *
 * MÁY CHỦ tính "nền" từng ngày (mùa × trăng theo nghề, chấm theo vùng — dựng từ dữ liệu đội tàu, chỉ máy chủ có) qua
 * `/api/fleet-density` (`fleet-density-server.ts`). MÁY chỉ nhận số đó cho 16 ngày, CẤT cả bộ cho offline, rồi nhân
 * hệ số gió (thang Beaufort) + bão (theo vùng tin bão) — hai thứ máy đã có sẵn ngoài biển. Máy không giữ lưới giờ
 * đánh, không giữ hàm dựng nền.
 * Đây là ước tính để tham khảo, KHÔNG phải dự báo cá — chữ hiển thị không nói "có cá".
 */

import { apiUrl } from "@/lib/api-base";
import { timeoutSignal } from "@/lib/abort";
import { tokenHeader } from "@/lib/device-token-store";
import { saveForecast, loadForecast } from "@/lib/forecast-cache";
import { forecastStoreReady } from "@/lib/forecast-store";

/** Lớp đang ở giai đoạn XEM TRƯỚC NỘI BỘ: chỉ tài khoản trong danh sách này thấy nút (2026-10-25). */
export const DENSITY_PREVIEW_PHONES = ["0938635689"] as const;

export function canSeeDensity(phone: string | null | undefined): boolean {
  if (!phone) return false;
  const digits = phone.replace(/\D/g, "").replace(/^84/, "0");
  return (DENSITY_PREVIEW_PHONES as readonly string[]).includes(digits);
}

/** "keo-doi"/"keo-don" (2026-11-08): cào đôi / cào đơn tách bằng vết VMS (scripts/add-density-keo-tach.mjs) — chỉ lát
 *  tháng/mùa/trăng có; dùng để tính bãi của lộ trình, KHÔNG có chip trên lớp mật độ (`DENSITY_GEARS`). */
export type DensityGear = "tat" | "vay" | "cau" | "re" | "keo" | "chup" | "khac" | "keo-doi" | "keo-don";

export interface DensityCell {
  lat: number;
  lon: number;
  /** giờ tàu đánh bắt mỗi ngày trong ô (đã chia ngày phủ) */
  hoursPerDay: number;
  /** số tàu khác nhau đã đánh trong ô ở khoá này */
  vessels: number;
}

export const DENSITY_GEARS: { id: DensityGear; label: string }[] = [
  { id: "tat", label: "Mọi nghề" },
  { id: "vay", label: "Vây" },
  { id: "cau", label: "Câu" },
  { id: "re", label: "Rê" },
  { id: "keo", label: "Kéo" },
  { id: "chup", label: "Chụp" },
  { id: "khac", label: "Khác" },
];

/** Mọi nghề route `/api/fleet-density` nhận — chip lớp mật độ + hai nghề cào tách (chỉ lộ trình dùng). */
export const DENSITY_GEAR_IDS: readonly DensityGear[] = [...DENSITY_GEARS.map((g) => g.id), "keo-doi", "keo-don"];

/** Ba mức mật độ — một họ TÍM, KHÁC hẳn xanh/vàng/đỏ của lớp cá để không đọc nhầm thành "mức cá".
 *  Hex để ở đây (như FISH_LEVEL_BANDS) vì MapLibre paint không đọc được biến CSS. */
export const DENSITY_LEVELS = [
  { key: "thua", label: "Thưa", color: "#c4b5fd" },
  { key: "vua", label: "Vừa", color: "#8b5cf6" },
  { key: "dong", label: "Đông", color: "#4c1d95" },
] as const;

/** Ô mật độ chứa điểm (lat, lon) trong lát — để thẻ chạm nói "Đông · N tàu · X giờ/ngày". */
export function densityCellAt(cells: DensityCell[], step: number, lat: number, lon: number): DensityCell | null {
  const h = step / 2;
  return cells.find((c) => Math.abs(c.lat - lat) <= h && Math.abs(c.lon - lon) <= h) ?? null;
}

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

export const KM_PER_DEG_LAT = 111.32;

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

/** Trạm gió gần nhất TRONG WIND_STATION_MAX_KM; xa hơn ⇒ null (trạm cảng không nói thay khơi xa). */
export function nearestStation(st: WindStation[], lat: number, lon: number, maxKm = WIND_STATION_MAX_KM): WindStation | null {
  let best: WindStation | null = null, bd = Infinity;
  for (const s of st) {
    const dd = kmBetween(lat, lon, s.lat, s.lon);
    if (dd < bd) { bd = dd; best = s; }
  }
  return best && bd <= maxKm ? best : null;
}

/* ──────────────────────────────────────────────────────────────────────────────
 * NỀN NGÀY TỪ MÁY CHỦ → dự báo của ngày (nhân gió + bão ở máy).
 * ────────────────────────────────────────────────────────────────────────────── */

/** Một ô nền: [lat, lon, giờ/ngày nền, giá trị nền×trăng, điểm nền 0–100+ (chưa gió/bão, chưa làm tròn),
 *  số tàu × trăng, tàu/ngày × trăng | null]. Máy chủ đã bỏ ô điểm nền < DENSITY_MIN_SCORE (gió/bão chỉ kéo xuống). */
export type NenO = [number, number, number, number, number, number, number | null];

export interface NenNgay {
  dateIso: string;
  moonBin: string;
  baseDays: number;
  thinBase: boolean;
  /** sàn tuyệt đối của mốc vùng (giờ/ngày) */
  ref: number;
  o: NenO[];
}

export interface NenFleet {
  ok: true;
  /** ngày đầu (giờ VN) của bộ 16 ngày */
  tu: string;
  nghe: DensityGear;
  /** bước lưới (độ) — để tô ô */
  step: number;
  ngay: NenNgay[];
  /** cá vùng hay có theo tháng-trong-năm "MM" → "lat,lon" → [[tên ngắn, %]] (chỉ ô có trong `ngay`) */
  loai: Record<string, Record<string, [string, number][]>>;
  /** ISO lúc máy chủ tính */
  generatedAt: string;
}

/** Dự báo của MỘT ngày từ nền máy chủ: nhân gió (trạm cảng trong tầm) × bão (theo vùng, chỉ ngày bão). Thuần. */
export function apHeSoNgay(
  nen: NenNgay,
  opt: { wind?: WindStation[]; stormDays?: Set<string>; storms?: StormZone[] } = {},
): FleetForecast {
  const dateIso = nen.dateIso;
  const storm = !!opt.stormDays?.has(dateIso);
  const stations = opt.wind?.filter((s) => s.byDate[dateIso] != null) ?? [];
  const windMissing = stations.length === 0;
  let windPartial = false;
  let stormCells = 0;
  const cells: FleetForecastCell[] = [];
  for (const [lat, lon, hoursPerDay, v, diemNen, vM, vpdM] of nen.o) {
    const st = windMissing ? null : nearestStation(stations, lat, lon);
    if (!windMissing && !st) windPartial = true;
    const wf = windFactor(st?.byDate[dateIso]);
    const stormF = storm ? stormFactorAt(opt.storms, lat, lon) : 1;
    if (stormF < 1) stormCells++;
    const f = wf * stormF;
    const score = Math.min(100, Math.round(diemNen * f));
    if (score < DENSITY_MIN_SCORE) continue;
    const level: 0 | 1 | 2 = score >= DENSITY_SCORE_BANDS[1] ? 2 : score >= DENSITY_SCORE_BANDS[0] ? 1 : 0;
    cells.push({
      lat,
      lon,
      hoursPerDay,
      vessels: Math.max(0, Math.round(vM * f)),
      value: v * f,
      score,
      level,
      vesselsPerDay: vpdM == null ? null : Math.max(0, Math.round(vpdM * f)),
      stormF,
    });
  }
  return { dateIso, cells, ref: nen.ref, windMissing, windPartial, storm, stormCells, baseDays: nen.baseDays, thinBase: nen.thinBase, moonBin: nen.moonBin };
}

/** Cá vùng đó hay có (theo tháng của ngày) tại ô — cho thẻ chạm. Không có ⇒ []. */
export function loaiTaiO(nen: NenFleet, dateIso: string, lat: number, lon: number): [string, number][] {
  return nen.loai[dateIso.slice(5, 7)]?.[`${lat},${lon}`] ?? nen.loai.tat?.[`${lat},${lon}`] ?? [];
}

/** Bản nhận từ máy chủ có dùng được không (kiểm ở ranh giới — bản hỏng không được đè bản tốt). */
export function laNenFleet(x: unknown): x is NenFleet {
  const n = x as NenFleet | null;
  return !!n && n.ok === true && typeof n.tu === "string" && Array.isArray(n.ngay) && n.ngay.length > 0 && typeof n.step === "number";
}

const NEN_NS = "fleetnen";

/**
 * Tải nền 16 ngày của một nghề. CẤT cả bộ vào kho bền (IndexedDB qua forecast-cache) — mất sóng ngoài khơi vẫn có
 * đủ các ngày của chuyến. Mạng hỏng / 4xx-5xx / bản hỏng ⇒ trả bản ĐÃ CẤT (kèm `tuKho`), không có thì ném để màn
 * hình nói "chưa tải" + nút thử lại. Bản mới chỉ ĐÈ khi hợp lệ (không đè bản tốt bằng rác).
 */
export async function fetchFleetNen(nghe: DensityGear, tuIso: string): Promise<NenFleet & { tuKho?: true }> {
  await forecastStoreReady();
  try {
    const r = await fetch(apiUrl(`/api/fleet-density?nghe=${encodeURIComponent(nghe)}&tu=${encodeURIComponent(tuIso)}`), {
      headers: tokenHeader(),
      signal: timeoutSignal(30000),
    });
    if (r.ok) {
      const j: unknown = await r.json();
      if (laNenFleet(j)) {
        saveForecast(NEN_NS, nghe, j);
        return j;
      }
    }
  } catch {
    /* mất sóng → bản đã cất */
  }
  const hit = loadForecast<unknown>(NEN_NS, nghe)?.data;
  if (laNenFleet(hit)) return { ...hit, tuKho: true as const };
  throw new Error("fleet-density: chưa có bản trong máy");
}

/** Ngày của bộ nền khớp `dateIso` (bộ cất từ hôm trước vẫn dùng được cho các ngày còn lại). */
export function nenCuaNgay(nen: NenFleet, dateIso: string): NenNgay | null {
  return nen.ngay.find((x) => x.dateIso === dateIso) ?? null;
}
