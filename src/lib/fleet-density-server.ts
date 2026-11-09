/**
 * MẬT ĐỘ TÀU — PHẦN MÁY CHỦ (tách 2026-11-08, docs/app-map/ops/khong-lo-nguon.md nợ #7). CHỈ route
 * `/api/fleet-density` + scripts + test import. Giữ lưới giờ đánh theo ngày · tháng · mùa · trăng × nghề
 * (`src/data/fleet-density.v1.json` — dựng từ dữ liệu đội tàu, KHÔNG phát ra máy) và hàm dựng NỀN mỗi ngày
 * (mùa × trăng, chấm theo vùng). Máy nhận `NenFleet` rồi tự nhân gió/bão (`apHeSoNgay`, lib/fleet-density.ts).
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { moonPhase } from "@/lib/moon";
import {
  addDaysIso,
  apHeSoNgay,
  DENSITY_MIN_SCORE,
  DENSITY_THIN_DAYS,
  FLEET_FORECAST_DAYS,
  KM_PER_DEG_LAT,
  type DensityCell,
  type DensityGear,
  type FleetForecast,
  type NenFleet,
  type NenNgay,
  type NenO,
  type StormZone,
  type WindStation,
} from "@/lib/fleet-density";

export * from "@/lib/fleet-density";

/** Đường file trên máy chủ (next.config `outputFileTracingIncludes` mang theo khi build). */
export const FLEET_DENSITY_FILE = join("src", "data", "fleet-density.v1.json");

/**
 * MỐC DỮ LIỆU của file đang phát (= `builtFrom.to`). ĐỔI CÙNG LÚC với file (rà Codex 2026-10-26, điểm 5):
 * file đi nhánh cache-first của service worker mà KHÔNG nằm trong vỏ, nên thay file trên máy chủ thì máy đã tải
 * giữ bản cũ tới khi bump kho vỏ. URL mang mốc (`?b=`) ⇒ bản mới = khoá cache mới, tải khi có sóng; bản cũ vẫn
 * nằm trong kho cho lúc mất sóng. Cổng: fleet-density.test (file thật) đỏ khi mốc lệch file.
 */
export const FLEET_DENSITY_BUILT = "2026-11-08";

/** [i, j, giờ×10, số tàu] */
export type DensityRow = [number, number, number, number];

export type DensityMode = "day" | "month" | "season" | "moon";

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

/** Nhãn ≤2 chữ cho chip (src/lib/labels.ts giữ tên khu; tên lát để ở đây vì chỉ lớp này dùng). */
export const DENSITY_MODES: { id: DensityMode; label: string }[] = [
  { id: "day", label: "Ngày" },
  { id: "month", label: "Tháng" },
  { id: "season", label: "Mùa" },
  { id: "moon", label: "Trăng" },
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

/** Phân vị cả nước — chỉ còn dùng làm SÀN tuyệt đối cho mốc vùng. */
export const DENSITY_REF_Q = 0.98;

/** Bán kính "quanh đây" khi chấm theo vùng (~135 hải lý). */
export const DENSITY_LOCAL_RADIUS_KM = 250;

/** Mốc vùng không được thấp hơn tỷ lệ này của p98 cả nước (vùng lác đác vài tàu không tự thành Đông). */
export const DENSITY_LOCAL_FLOOR = 0.15;

export const MOON_CLAMP: [number, number] = [0.5, 1.5];

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

let docCache: FleetDensity | null = null;
/** Đọc lưới (một lần mỗi tiến trình). Hỏng ⇒ ném — route trả 503 mã chung. */
export function docFleetDensity(root = process.cwd()): FleetDensity {
  if (docCache) return docCache;
  const d = JSON.parse(readFileSync(join(root, FLEET_DENSITY_FILE), "utf8")) as FleetDensity;
  if (!d || d.v !== 1 || !d.axis || !d.day || !d.month) throw new Error("fleet-density: file sai dạng");
  docCache = d;
  return d;
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

/**
 * NỀN của một ngày (máy chủ): nền mùa × trăng theo nghề, điểm so "ô mạnh quanh đây" (DENSITY_LOCAL_RADIUS_KM, sàn
 * DENSITY_LOCAL_FLOOR × p98). Chưa gió/bão. Bỏ ô điểm nền < DENSITY_MIN_SCORE — gió/bão chỉ kéo xuống nên ô đó không
 * bao giờ được tô.
 */
export function nenNgay(d: FleetDensity, todayIso: string, dayOffset: number, gear: DensityGear): NenNgay {
  const dateIso = addDaysIso(todayIso, dayOffset);
  const mm = dateIso.slice(5, 7);
  const moonBin = moonBinOf(new Date(`${dateIso}T05:00:00Z`)); // trưa giờ VN
  const base = seasonBase(d, mm, gear);
  const baseDays = seasonBaseDays(d, mm);
  const moon = moonFactors(d, moonBin, gear);
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
  const rad2 = DENSITY_LOCAL_RADIUS_KM ** 2;
  const localRef = (c: DensityCell): number => {
    let m = ref;
    const cosLat = Math.cos((c.lat * Math.PI) / 180);
    for (const o of pre) {
      const dy = (o.c.lat - c.lat) * KM_PER_DEG_LAT;
      const dx = (o.c.lon - c.lon) * KM_PER_DEG_LAT * cosLat;
      if (dx * dx + dy * dy <= rad2 && o.v > m) m = o.v;
    }
    return m;
  };
  const o: NenO[] = [];
  if (ref > 0) {
    for (const { c, v, moonF } of pre) {
      const diemNen = (v / localRef(c)) * 100;
      if (Math.min(100, Math.round(diemNen)) < DENSITY_MIN_SCORE) continue;
      o.push([c.lat, c.lon, c.hoursPerDay, v, diemNen, c.vessels * moonF, c.vesselsPerDay == null ? null : c.vesselsPerDay * moonF]);
    }
  }
  return { dateIso, moonBin, baseDays, thinBase: baseDays < DENSITY_THIN_DAYS, ref, o };
}

/** Bộ 16 ngày cho máy (route). Số làm gọn để payload nhỏ — không đổi mức hiển thị. */
export function nenFleet(d: FleetDensity, tuIso: string, nghe: DensityGear, nowIso: string): NenFleet {
  const gon = (x: number) => Math.round(x * 100) / 100;
  const ngay = Array.from({ length: FLEET_FORECAST_DAYS }, (_, k) => {
    const n = nenNgay(d, tuIso, k, nghe);
    return { ...n, ref: gon(n.ref), o: n.o.map(([la, lo, h, v, s, vm, vpd]) => [la, lo, gon(h), gon(v), gon(s), gon(vm), vpd == null ? null : gon(vpd)] as NenO) };
  });
  const loai: NenFleet["loai"] = {};
  for (const n of ngay) {
    const mm = n.dateIso.slice(5, 7);
    const bang = (loai[mm] ??= {});
    for (const [la, lo] of n.o) {
      const k = `${la},${lo}`;
      if (bang[k]) continue;
      const sp = densitySpeciesAt(d, { mode: "month", key: `${n.dateIso.slice(0, 7)}`, gear: "tat" }, la, lo);
      if (sp.length) bang[k] = sp;
    }
  }
  return { ok: true, tu: tuIso, nghe, step: d.axis.step, ngay, loai, generatedAt: nowIso };
}

/** Dự báo đủ (nền máy chủ × gió/bão) — cho test/scripts đối chiếu với máy. */
export function forecastFleetDensity(inp: FleetForecastInput): FleetForecast {
  return apHeSoNgay(nenNgay(inp.d, inp.todayIso, inp.dayOffset, inp.gear), { wind: inp.wind, stormDays: inp.stormDays, storms: inp.storms });
}
