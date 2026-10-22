// BỘ CHẤM DẪN ĐƯỜNG — KHUNG DÙNG CHUNG (2026-10-22).
// Thuần logic, chạy dưới vitest (vitest.dan-duong.config.ts) để dùng được alias "@/lib/*".
// Mục đích: dựng KỊCH BẢN có sự thật biết trước (lưới độ sâu tổng hợp, trường thời tiết
// tổng hợp, vật chặn cắm sẵn) rồi hỏi bộ tìm đường / bộ dẫn đường; mỗi tiêu chí ra một
// điểm 0–100 + đạt/không. Xem docs/app-map/ops/dan-duong-khoa-hoc.md §4–§5.

import fs from "node:fs";
import path from "node:path";
import {
  DEPTH_META,
  DEPTH_GRID_BYTES,
  decodeDepthGrid,
  type DepthClass,
  type DepthGrid,
} from "@/lib/depth-grid";
import {
  bboxOfPoints,
  haversineKm,
  type BBox,
  type BoatProfile,
  type HourSample,
  type LatLon,
  type RoutePlan,
  type WeatherField,
} from "@/lib/route-plan";
import { packHazards, type Hazard, type HazardPacked } from "@/lib/hazards";
import { distToSegmentKm } from "@/lib/route-storm";

export const ROOT = path.resolve(__dirname, "../..");
/** thư mục kết quả — ngoài git (.gitignore), đổi bằng DAN_DUONG_OUT */
export const OUT_DIR = process.env.DAN_DUONG_OUT ?? path.join(ROOT, ".dan-duong");

// ── lưới độ sâu tổng hợp ──────────────────────────────────────────────────

/** Lưới toàn nước sâu (lớp 5). ~8,5 MB — dựng một lần cho cả file chấm. */
export function luoiSauHet(): DepthGrid {
  const data = new Uint8Array(DEPTH_GRID_BYTES);
  data.fill(0x55);
  return { data };
}

export function datLop(g: DepthGrid, lat: number, lon: number, cls: DepthClass): void {
  const i = Math.round((lat - DEPTH_META.lat0) / DEPTH_META.step);
  const j = Math.round((lon - DEPTH_META.lon0) / DEPTH_META.step);
  if (i < 0 || i >= DEPTH_META.nLat || j < 0 || j >= DEPTH_META.nLon) return;
  const k = i * DEPTH_META.nLon + j;
  const b = k >> 1;
  if (k & 1) g.data[b] = (g.data[b] & 0x0f) | (cls << 4);
  else g.data[b] = (g.data[b] & 0xf0) | cls;
}

/** Tô hình tròn bán kính rKm quanh tâm thành lớp cls. */
export function toTron(g: DepthGrid, tam: LatLon, rKm: number, cls: DepthClass): void {
  const dLat = rKm / 111.32;
  const dLon = rKm / (111.32 * Math.cos((tam.lat * Math.PI) / 180));
  for (let lat = tam.lat - dLat; lat <= tam.lat + dLat; lat += DEPTH_META.step)
    for (let lon = tam.lon - dLon; lon <= tam.lon + dLon; lon += DEPTH_META.step)
      if (haversineKm(tam, { lat, lon }) <= rKm) datLop(g, lat, lon, cls);
}

/** Tô hình chữ nhật theo độ. */
export function toChuNhat(g: DepthGrid, b: BBox, cls: DepthClass): void {
  for (let lat = b.latMin; lat <= b.latMax; lat += DEPTH_META.step)
    for (let lon = b.lonMin; lon <= b.lonMax; lon += DEPTH_META.step) datLop(g, lat, lon, cls);
}

/** Lưới độ sâu THẬT trong public/data (bản rõ trong git). */
let luoiThatCache: DepthGrid | null = null;
export function luoiThat(): DepthGrid {
  if (!luoiThatCache) {
    const raw = fs.readFileSync(path.join(ROOT, "public/data/depth-grid.v1.bin"));
    luoiThatCache = decodeDepthGrid(
      raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength) as ArrayBuffer,
    );
  }
  return luoiThatCache;
}

// ── trường thời tiết tổng hợp ─────────────────────────────────────────────

export const GIO_EM: HourSample = {
  waveM: 0.5,
  waveFromDeg: 90,
  wavePeriodS: 6,
  windKmh: 12,
  windFromDeg: 90,
  currentKmh: 0,
  currentToDeg: null,
};

export type HamMau = (lat: number, lon: number, gio: number) => HourSample | null;

/**
 * Trường n×n phủ bbox, `hours` giờ, mỗi mắt lấy từ `f(lat, lon, giờ)`; `f` trả null ⇒ mắt
 * KHÔNG CÓ SỐ (onSea=false) — dùng để dựng lưới thủng.
 */
export function truong(
  bbox: BBox,
  f: HamMau = () => GIO_EM,
  n = 10,
  hours = 72,
  extra: Partial<WeatherField> = {},
): WeatherField {
  const dLat = (bbox.latMax - bbox.latMin) / (n - 1);
  const dLon = (bbox.lonMax - bbox.lonMin) / (n - 1);
  const cells = [];
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      const lat = bbox.latMin + i * dLat;
      const lon = bbox.lonMin + j * dLon;
      const hs: HourSample[] = [];
      let co = false;
      for (let h = 0; h < hours; h++) {
        const s = f(lat, lon, h);
        if (s) co = true;
        hs.push(s ?? GIO_EM);
      }
      cells.push(co ? { onSea: true, hours: hs } : { onSea: false, hours: [] });
    }
  return { lat0: bbox.latMin, lon0: bbox.lonMin, dLat, dLon, nLat: n, nLon: n, cells, ...extra };
}

/** Trường RỖNG hoàn toàn (nguồn 'none' — Open-Meteo từ chối, máy chưa lưu lưới). */
export function truongRong(bbox: BBox): WeatherField {
  return { ...truong(bbox, () => null, 4, 0), source: "none", rateLimited: true };
}

// ── vật chặn ──────────────────────────────────────────────────────────────

export function vat(
  id: string,
  p: LatLon,
  rKm: number,
  loai: Hazard["loai"] = "xac-tau",
): Hazard {
  return { id, lat: p.lat, lon: p.lon, rKm, loai, ten: id, nam: 2024, doSauM: null, tinVua: false, nguon: "tbhh" };
}
export const goi = (hs: Hazard[]): HazardPacked => packHazards(hs);

// ── hình học đo đạc trên tuyến ────────────────────────────────────────────

// dùng lại bản có sẵn (NT15 §3 — không đẻ bản hai)
export { distToSegmentKm } from "@/lib/route-storm";

/** khoảng cách nhỏ nhất từ điểm tới polyline tuyến (km) */
export function khoangToiTuyen(p: LatLon, wps: LatLon[]): number {
  let m = Infinity;
  for (let i = 1; i < wps.length; i++) m = Math.min(m, distToSegmentKm(p, wps[i - 1], wps[i]));
  return m;
}

/** mẫu dày dọc tuyến, mỗi `buocKm` */
export function mauDocTuyen(wps: LatLon[], buocKm = 0.2): LatLon[] {
  const out: LatLon[] = [];
  for (let i = 1; i < wps.length; i++) {
    const a = wps[i - 1], b = wps[i];
    const n = Math.max(1, Math.ceil(haversineKm(a, b) / buocKm));
    for (let s = 0; s <= n; s++) out.push({ lat: a.lat + (b.lat - a.lat) * (s / n), lon: a.lon + (b.lon - a.lon) * (s / n) });
  }
  return out;
}

export function tongKm(wps: LatLon[]): number {
  let s = 0;
  for (let i = 1; i < wps.length; i++) s += haversineKm(wps[i - 1], wps[i]);
  return s;
}

/** góc rẽ (độ, 0–180) tại từng waypoint trong */
export function gocRe(wps: LatLon[]): number[] {
  const brg = (a: LatLon, b: LatLon) => {
    const r = Math.PI / 180;
    const y = Math.sin((b.lon - a.lon) * r) * Math.cos(b.lat * r);
    const x = Math.cos(a.lat * r) * Math.sin(b.lat * r) - Math.sin(a.lat * r) * Math.cos(b.lat * r) * Math.cos((b.lon - a.lon) * r);
    return ((Math.atan2(y, x) / r) + 360) % 360;
  };
  const out: number[] = [];
  for (let i = 1; i < wps.length - 1; i++) {
    const d = Math.abs(((brg(wps[i], wps[i + 1]) - brg(wps[i - 1], wps[i]) + 540) % 360) - 180);
    out.push(d);
  }
  return out;
}

export const TAU_7KN: BoatProfile = { speedKn: 7, litersPerHour: 20, draftM: null };
export const TAU_MON_1_2: BoatProfile = { speedKn: 7, litersPerHour: 20, draftM: 1.2 };
export const TAU_MON_3: BoatProfile = { speedKn: 9, litersPerHour: 35, draftM: 3 };

export function khung(points: LatLon[], marginKm = 60): BBox {
  return bboxOfPoints(points, marginKm);
}

// ── bảng điểm ─────────────────────────────────────────────────────────────

export type Bac = "A" | "B" | "C";
export type KetQuaTieuChi = {
  id: string;
  nhom: string;
  ten: string;
  /** A = cổng cứng (an toàn — phải đạt bất kể tỉ lệ) · B = quan trọng · C = chất lượng */
  bac: Bac;
  diem: number;
  dat: boolean;
  /** số đo thô để agent đọc — không phải câu chữ */
  so: Record<string, number | string | boolean | null>;
  ghi: string;
  /** "chua-do" = chưa có oracle/đường đo — tính là KHÔNG đạt, việc của vòng lặp là dựng */
  trangThai?: "do" | "chua-do";
  /** cần anh Long/thuyền trưởng chốt — vòng lặp máy KHÔNG tự chọn tiêu chí này */
  canNguoi?: boolean;
};

export const bang: KetQuaTieuChi[] = [];

export function ghi(k: Omit<KetQuaTieuChi, "dat"> & { dat?: boolean }): KetQuaTieuChi {
  const r: KetQuaTieuChi = { trangThai: "do", ...k, dat: k.dat ?? k.diem >= 90 };
  bang.push(r);
  return r;
}

/** điểm tuyến tính: giá trị ≤ tot → 100, ≥ te → 0 */
export function diemTuyenTinh(v: number, tot: number, te: number): number {
  if (!Number.isFinite(v)) return 0;
  if (tot <= te) return v <= tot ? 100 : v >= te ? 0 : Math.round(100 * (1 - (v - tot) / (te - tot)));
  return v >= tot ? 100 : v <= te ? 0 : Math.round(100 * ((v - te) / (tot - te)));
}

export function tomTat(plan: RoutePlan | null) {
  if (!plan) return { co: false };
  return {
    co: true,
    km: Math.round(plan.distKm * 10) / 10,
    gio: Math.round(plan.hours * 100) / 100,
    dau: Math.round(plan.fuelL),
    wp: plan.waypoints.length,
    maxWave: plan.maxWaveM,
    co: {
      rough: plan.hasRoughLeg, shallow: plan.hasShallowLeg, veryShallow: plan.hasVeryShallowLeg,
      nearLand: plan.hasNearLandLeg, hazard: plan.hasHazardLeg, hazardPort: plan.hasHazardNearPortLeg,
      depthChecked: plan.depthChecked, hazardChecked: plan.hazardChecked, capped: plan.cappedToDirect,
      bestEffort: plan.bestEffortSeas, noWeatherKm: Math.round(plan.noWeatherKm), weatherSeen: plan.weatherSeen,
      beyondH: plan.beyondForecastH,
    },
  } as const;
}

/** Ghi bảng điểm ra JSON + Markdown; trả tổng kết. */
export function xuatBang(tenLuot = "bang-diem") {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const tong = bang.length;
  const datN = bang.filter((b) => b.dat).length;
  const aHong = bang.filter((b) => b.bac === "A" && !b.dat).map((b) => b.id);
  const tiLe = tong ? Math.round((1000 * datN) / tong) / 10 : 0;
  const theoNhom: Record<string, { dat: number; tong: number }> = {};
  for (const b of bang) {
    theoNhom[b.nhom] ??= { dat: 0, tong: 0 };
    theoNhom[b.nhom].tong++;
    if (b.dat) theoNhom[b.nhom].dat++;
  }
  const ketLuan = { luc: new Date().toISOString(), tong, dat: datN, tiLe, mucTieu: 90, quaCong: tiLe >= 90 && aHong.length === 0, aHong, theoNhom, tieuChi: bang };
  fs.writeFileSync(path.join(OUT_DIR, `${tenLuot}.json`), JSON.stringify(ketLuan, null, 2));
  const md = [
    `# Bảng điểm dẫn đường — ${ketLuan.luc}`,
    ``,
    `**Đạt ${datN}/${tong} = ${tiLe} %** (mục tiêu ≥ 90 %) · cổng A hỏng: ${aHong.length ? aHong.join(", ") : "không"} · **${ketLuan.quaCong ? "QUA CỔNG" : "CHƯA QUA"}**`,
    ``,
    `| Nhóm | Đạt |`,
    `|---|---|`,
    ...Object.entries(theoNhom).map(([n, v]) => `| ${n} | ${v.dat}/${v.tong} |`),
    ``,
    `| # | Bậc | Tiêu chí | Điểm | Đạt | Số đo | Ghi |`,
    `|---|---|---|---|---|---|---|`,
    ...bang.map((b) => `| ${b.id} | ${b.bac} | ${b.ten} | ${b.diem} | ${b.dat ? "✅" : b.trangThai === "chua-do" ? "⬜ chưa đo" : "❌"} | ${JSON.stringify(b.so)} | ${b.ghi} |`),
  ].join("\n");
  fs.writeFileSync(path.join(OUT_DIR, `${tenLuot}.md`), md + "\n");
  return ketLuan;
}
