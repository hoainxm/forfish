/*
  CHẾ ĐỘ HẢI ĐỒ — ĐỢT 4 (2026-11-04): TUYẾN · GIÁM SÁT TUYẾN · VẾT · GPX. Thuần, có test.

  Đối chiếu iSailor (RouteEditPage: giờ đi, tốc độ, ETA, đảo tuyến, xuất GPX/KML;
  WaypointEditPage: hướng, cự ly, tốc độ chặng; RouteMonitoringPanel: Next WPT ·
  BTW · DTW · TTG · XTD; TrackViewPage: độ dài, thời gian, xuất, tạo tuyến) và
  OpenCPN (Route Manager, Route from Track, GPX). Chức năng, không chép.
  Kiểm nguy hiểm trên tuyến KHÔNG ở đây — dùng lại `auditRoute` (route-hazards.ts).
*/

import { bearingDeg, KMH_PER_KNOT, type LatLon } from "@/lib/route-plan";
import { haversineKm } from "@/lib/geo";
import { distToSegmentKm } from "@/lib/route-storm";

/* ── TUYẾN ────────────────────────────────────────────────────────────────── */

export interface Tuyen {
  id: string;
  ten: string;
  diem: LatLon[];
  /** epoch ms tạo/sửa lần cuối */
  luc: number;
}

/** Một chặng: từ điểm k tới điểm k+1. */
export interface Chang {
  pvDeg: number;
  km: number;
  /** phút chạy chặng này với tốc độ đã cho */
  phut: number;
  /** phút cộng dồn từ điểm đầu tới cuối chặng */
  phutDon: number;
}

export function cacChang(diem: readonly LatLon[], tocDoKn: number): Chang[] {
  const kmh = Math.max(0.5, tocDoKn) * KMH_PER_KNOT;
  let don = 0;
  const out: Chang[] = [];
  for (let k = 1; k < diem.length; k++) {
    const km = haversineKm(diem[k - 1], diem[k]);
    const phut = (km / kmh) * 60;
    don += phut;
    out.push({ pvDeg: bearingDeg(diem[k - 1], diem[k]), km, phut, phutDon: don });
  }
  return out;
}

/** Giờ (từ lúc đi) tại MỖI điểm — đầu vào `hoursAt` của auditRoute. */
export function gioTaiDiem(diem: readonly LatLon[], tocDoKn: number): number[] {
  return [0, ...cacChang(diem, tocDoKn).map((c) => c.phutDon / 60)];
}

export function tongKm(diem: readonly LatLon[]): number {
  let s = 0;
  for (let k = 1; k < diem.length; k++) s += haversineKm(diem[k - 1], diem[k]);
  return s;
}

export function daoTuyen<T>(diem: readonly T[]): T[] {
  return [...diem].reverse();
}

/** Tên mặc định: "Tuyến 04/11 08:25". */
/* ── SỬA TUYẾN BẰNG NGÓN (rà soát so iSailor RouteEdit / OpenCPN Route Manager, 2026-11-04) ──
   Hai app kia: kéo điểm để dời, chạm lên chặng để chèn điểm giữa. Ở đây làm trên TOẠ ĐỘ MÀN (px) mà
   màn đã chiếu sẵn — ngưỡng chạm tính bằng px mới đúng cảm giác ngón tay ở mọi mức phóng. Thuần, có test. */

/** Khoảng cách px từ điểm tới đoạn thẳng ab. */
function cachDoan(p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Điểm (px) đang bị chạm trúng — gần nhất trong `nguongPx`, không trúng ⇒ null. */
export function diemTrung(px: readonly { x: number; y: number }[], p: { x: number; y: number }, nguongPx = 22): number | null {
  let best: number | null = null;
  let bestD = nguongPx;
  px.forEach((q, i) => {
    const d = Math.hypot(q.x - p.x, q.y - p.y);
    if (d <= bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

/**
 * Chạm gần một chặng (≤ `nguongPx`) ⇒ vị trí CHÈN (index trong mảng điểm mới), không gần chặng nào ⇒ null
 * (chỗ gọi thêm vào cuối như cũ). Chạm trúng ngay một điểm cũng ⇒ null (để kéo, không chèn trùng).
 */
export function viTriChen(px: readonly { x: number; y: number }[], p: { x: number; y: number }, nguongPx = 18): number | null {
  if (px.length < 2 || diemTrung(px, p) != null) return null;
  let best: number | null = null;
  let bestD = nguongPx;
  for (let i = 0; i + 1 < px.length; i++) {
    const d = cachDoan(p, px[i], px[i + 1]);
    if (d <= bestD) {
      bestD = d;
      best = i + 1;
    }
  }
  return best;
}

export function tenMacDinh(ms: number): string {
  const d = new Date(ms + 7 * 3600_000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `Tuyến ${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

/* ── GIÁM SÁT TUYẾN ───────────────────────────────────────────────────────── */

/** Tới gần điểm kế hơn mức này ⇒ coi như tới, chuyển sang điểm sau (0,1 hải lý). */
export const TOI_DIEM_KM = 0.1 * KMH_PER_KNOT;
/** Lệch khỏi chặng hơn mức này ⇒ báo (0,5 hải lý). */
export const LECH_KM = 0.5 * KMH_PER_KNOT;

export interface GiamSat {
  /** chỉ số điểm ĐANG HƯỚNG TỚI (1…n-1); n = đã hết tuyến */
  toi: number;
  het: boolean;
  /** phương vị tàu → điểm kế */
  btwDeg: number | null;
  dtwKm: number | null;
  /** lệch khỏi chặng đang đi (km, luôn dương) */
  xtdKm: number | null;
  /** phút tới điểm kế / tới cuối tuyến với tốc độ hiện tại (null khi đứng) */
  ttgPhut: number | null;
  conLaiKm: number | null;
  denCuoiPhut: number | null;
  /** phương vị chặng đang đi — cho "Tuyến lên" */
  pvChang: number | null;
}

/**
 * Bám tuyến: `toiCu` = điểm đang hướng tới lần trước. Chuyển điểm khi tới gần
 * (≤ TOI_DIEM_KM) HOẶC đã vượt qua (gần điểm sau hơn điểm này mà đang ở chặng sau).
 */
export function giamSat(diem: readonly LatLon[], toiCu: number, pos: LatLon | null, speedKmh: number | null): GiamSat {
  const n = diem.length;
  let toi = Math.min(Math.max(1, toiCu), n);
  if (pos && toi < n) {
    while (toi < n && haversineKm(pos, diem[toi]) <= TOI_DIEM_KM) toi++;
    // vượt qua mà không chạm vòng: đã gần chặng sau hơn chặng này — CHỈ khi tàu đang trong hành
    // lang tuyến (≤ 2 × LECH_KM). Ở xa tuyến (vừa bấm Bắt đầu từ cảng) thì chặng nào cũng "gần
    // hơn" một cách vô nghĩa ⇒ không được nhảy điểm (lỗi bắt được khi kiểm trình duyệt 04/11).
    while (toi < n - 1) {
      const dNay = distToSegmentKm(pos, diem[toi - 1], diem[toi]);
      const dSau = distToSegmentKm(pos, diem[toi], diem[toi + 1]);
      if (dSau <= 2 * LECH_KM && dSau + 0.05 < dNay && haversineKm(pos, diem[toi]) < haversineKm(pos, diem[toi - 1])) toi++;
      else break;
    }
  }
  const het = toi >= n;
  if (!pos || het) {
    return { toi, het, btwDeg: null, dtwKm: null, xtdKm: null, ttgPhut: null, conLaiKm: null, denCuoiPhut: null, pvChang: het ? null : bearingDeg(diem[toi - 1], diem[toi]) };
  }
  const dtwKm = haversineKm(pos, diem[toi]);
  let conLaiKm = dtwKm;
  for (let k = toi + 1; k < n; k++) conLaiKm += haversineKm(diem[k - 1], diem[k]);
  const chay = speedKmh != null && speedKmh > 0.5;
  return {
    toi,
    het: false,
    btwDeg: bearingDeg(pos, diem[toi]),
    dtwKm,
    xtdKm: distToSegmentKm(pos, diem[toi - 1], diem[toi]),
    ttgPhut: chay ? (dtwKm / speedKmh!) * 60 : null,
    conLaiKm,
    denCuoiPhut: chay ? (conLaiKm / speedKmh!) * 60 : null,
    pvChang: bearingDeg(diem[toi - 1], diem[toi]),
  };
}

/** Câu báo lệch tuyến (vàng) — null khi trong hành lang. `hl` in cự ly theo đơn vị bà con chọn. */
export function cauLech(g: GiamSat, hl: (km: number) => string): string | null {
  if (g.het || g.xtdKm == null || g.xtdKm <= LECH_KM) return null;
  return `Lệch tuyến ${hl(g.xtdKm)}`;
}

/* ── VẾT TÀU ──────────────────────────────────────────────────────────────── */

/** [lat, lon, epoch ms] — gọn để lưu nhiều điểm. */
export type DiemVet = [number, number, number];

export interface Vet {
  id: string;
  batDau: number;
  diem: DiemVet[];
}

/** Ghi điểm khi đi được ≥ 20 m HOẶC đã 30 s (và nhích ≥ 5 m); bỏ fix sai số > 50 m. */
export const VET_M = 20;
export const VET_S = 30;
export const VET_SAI_SO_M = 50;

export function nhanDiemVet(cuoi: DiemVet | null, lat: number, lon: number, t: number, saiSoM: number | null): boolean {
  if (saiSoM != null && saiSoM > VET_SAI_SO_M) return false;
  if (!cuoi) return true;
  const m = haversineKm({ lat: cuoi[0], lon: cuoi[1] }, { lat, lon }) * 1000;
  return m >= VET_M || (t - cuoi[2] >= VET_S * 1000 && m >= 5);
}

export function thongKeVet(diem: readonly DiemVet[]): { km: number; phut: number } {
  let km = 0;
  for (let k = 1; k < diem.length; k++) km += haversineKm({ lat: diem[k - 1][0], lon: diem[k - 1][1] }, { lat: diem[k][0], lon: diem[k][1] });
  const phut = diem.length > 1 ? (diem[diem.length - 1][2] - diem[0][2]) / 60000 : 0;
  return { km, phut };
}

/** Giản lược Douglas–Peucker (km) — tạo tuyến từ vết: giữ chỗ đổi hướng, bỏ điểm thẳng hàng. */
export function gianLuoc(diem: readonly LatLon[], dungSaiKm = 0.2): LatLon[] {
  if (diem.length <= 2) return [...diem];
  let maxD = 0;
  let idx = 0;
  for (let k = 1; k < diem.length - 1; k++) {
    const d = distToSegmentKm(diem[k], diem[0], diem[diem.length - 1]);
    if (d > maxD) {
      maxD = d;
      idx = k;
    }
  }
  if (maxD <= dungSaiKm) return [diem[0], diem[diem.length - 1]];
  const trai = gianLuoc(diem.slice(0, idx + 1), dungSaiKm);
  const phai = gianLuoc(diem.slice(idx), dungSaiKm);
  return [...trai.slice(0, -1), ...phai];
}

/** Tuyến từ vết: giản lược, tối đa `toiDa` điểm (nới dung sai tới khi vừa). */
export function tuyenTuVet(v: Vet, toiDa = 30): LatLon[] {
  const ll = v.diem.map(([lat, lon]) => ({ lat, lon }));
  let sai = 0.2;
  let kq = gianLuoc(ll, sai);
  while (kq.length > toiDa && sai < 50) {
    sai *= 1.6;
    kq = gianLuoc(ll, sai);
  }
  return kq;
}

/* ── GPX 1.1 ──────────────────────────────────────────────────────────────── */

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const so = (v: number) => v.toFixed(6);

export interface DiemTen {
  ten: string;
  lat: number;
  lon: number;
}

/** Ghi GPX (tuyến → rte, vết → trk, điểm → wpt). Mở được bằng OpenCPN, iSailor, Navionics, máy định vị. */
export function vietGpx(d: { tuyen?: readonly Tuyen[]; vet?: readonly Vet[]; diem?: readonly DiemTen[] }): string {
  const out: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<gpx version="1.1" creator="SDFish" xmlns="http://www.topografix.com/GPX/1/1">',
  ];
  for (const p of d.diem ?? []) out.push(`  <wpt lat="${so(p.lat)}" lon="${so(p.lon)}"><name>${esc(p.ten)}</name></wpt>`);
  for (const t of d.tuyen ?? []) {
    out.push(`  <rte><name>${esc(t.ten)}</name>`);
    t.diem.forEach((p, k) => out.push(`    <rtept lat="${so(p.lat)}" lon="${so(p.lon)}"><name>${k + 1}</name></rtept>`));
    out.push("  </rte>");
  }
  for (const v of d.vet ?? []) {
    out.push(`  <trk><name>${esc(`Vết ${new Date(v.batDau).toISOString().slice(0, 16).replace("T", " ")}`)}</name><trkseg>`);
    for (const [lat, lon, t] of v.diem) out.push(`    <trkpt lat="${so(lat)}" lon="${so(lon)}"><time>${new Date(t).toISOString()}</time></trkpt>`);
    out.push("  </trkseg></trk>");
  }
  out.push("</gpx>");
  return out.join("\n");
}

const unesc = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
const ATTR = (tag: string, name: string) => {
  const m = new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`).exec(tag);
  return m ? Number(m[1]) : NaN;
};
const TEN = (body: string) => {
  const m = /<name>([\s\S]*?)<\/name>/.exec(body);
  return m ? unesc(m[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim()) : "";
};
const hopLe = (lat: number, lon: number) => Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;

/**
 * Đọc GPX (không cần DOMParser — chạy cả trong worker/test). Điểm hỏng bị BỎ,
 * không làm hỏng cả tệp. Vết không có <time> thì lấy thời điểm đọc + thứ tự.
 */
export function docGpx(xml: string, now: number): { tuyen: Tuyen[]; vet: Vet[]; diem: DiemTen[] } {
  const tuyen: Tuyen[] = [];
  const vet: Vet[] = [];
  const diem: DiemTen[] = [];
  // thẻ tự đóng `<wpt …/>` phải khớp TRƯỚC — không thì nhánh mở/đóng nuốt sang tận </wpt> của điểm sau
  for (const m of xml.matchAll(/<wpt\b([^>]*?)\/>|<wpt\b([^>]*)>([\s\S]*?)<\/wpt>/g)) {
    const attrs = m[1] ?? m[2] ?? "";
    const lat = ATTR(attrs, "lat");
    const lon = ATTR(attrs, "lon");
    if (hopLe(lat, lon)) diem.push({ ten: TEN(m[3] ?? "") || "Điểm", lat, lon });
  }
  let k = 0;
  for (const m of xml.matchAll(/<rte\b[^>]*>([\s\S]*?)<\/rte>/g)) {
    const pts: LatLon[] = [];
    for (const p of m[1].matchAll(/<rtept\b([^>]*?)(?:\/>|>)/g)) {
      const lat = ATTR(p[1], "lat");
      const lon = ATTR(p[1], "lon");
      if (hopLe(lat, lon)) pts.push({ lat, lon });
    }
    const ten = TEN(m[1].replace(/<rtept[\s\S]*$/, ""));
    if (pts.length >= 2) tuyen.push({ id: `gpx-${now}-${k++}`, ten: ten || tenMacDinh(now), diem: pts, luc: now });
  }
  for (const m of xml.matchAll(/<trk\b[^>]*>([\s\S]*?)<\/trk>/g)) {
    const pts: DiemVet[] = [];
    let j = 0;
    for (const p of m[1].matchAll(/<trkpt\b([^>]*?)(?:\/>|>([\s\S]*?)<\/trkpt>)/g)) {
      const lat = ATTR(p[1], "lat");
      const lon = ATTR(p[1], "lon");
      if (!hopLe(lat, lon)) continue;
      const tm = /<time>([^<]+)<\/time>/.exec(p[2] ?? "");
      const t = tm ? Date.parse(tm[1]) : NaN;
      pts.push([lat, lon, Number.isFinite(t) ? t : now + j++ * 1000]);
    }
    if (pts.length >= 2) vet.push({ id: `gpx-${now}-${k++}`, batDau: pts[0][2], diem: pts });
  }
  return { tuyen, vet, diem };
}
