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
  /** loài hay đánh theo ô: khoá "nam"/"bac" (mùa), "01".."12" (tháng trong năm), "tat" (cả năm) → "i,j" → [[tên ngắn, %kg]] top 3 */
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

/** Ô (lat, lon) gần nhất trên trục lưới (trong nửa ô) → loài hay đánh ở lát đó; không có ⇒ []. Lùi về "tat" khi tháng/mùa trống. */
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
