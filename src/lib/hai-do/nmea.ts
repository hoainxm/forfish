/*
  ĐỌC CÂU NMEA 0183 — chế độ Hải đồ, bảng §8 hàng 19 "kết nối thiết bị" (2026-11-04).
  Đối chiếu iSailor (Connections: TCP/UDP, NMEA) + OpenCPN (NMEA 0183 data sources).

  PHẦN NÀY CHỈ LÀ BỘ ĐỌC THUẦN — chưa có đường vào (plugin TCP/UDP của bản cài native
  sẽ đẩy từng dòng vào `docCau`). CHƯA THỬ VỚI THIẾT BỊ THẬT: câu mẫu trong test lấy theo
  chuẩn NMEA 0183 / ITU-R M.1371 (AIS), không phải từ máy trên tàu bà con.

  Câu đọc được:
    GGA (vị trí + chất lượng fix) · RMC (vị trí, tốc độ, hướng đi, giờ) · VTG (hướng đi,
    tốc độ) · HDT (mũi tàu thật) · DBT / DPT (độ sâu máy dò) ·
    VDM / VDO (AIS: kiểu 1/2/3 Class A, 18 Class B, 5 + 24 tên/loại tàu; tin nhiều mảnh ghép lại).
  Mọi lỗi (checksum sai, thiếu trường, số "không có") ⇒ null / trường null — KHÔNG ném:
  một câu hỏng trên dây không được làm sập màn hải đồ.
*/

export type CauNmea =
  | { loai: "vi-tri"; nguon: "GGA" | "RMC"; lat: number; lon: number; kn: number | null; huong: number | null; soVeTinh: number | null; hdop: number | null; lucMs: number | null }
  | { loai: "huong-di"; huong: number | null; kn: number | null }
  | { loai: "mui-tau"; mui: number }
  | { loai: "do-sau"; doSauM: number }
  | { loai: "ais"; tin: TinAis };

export interface TinAis {
  kieu: number;
  mmsi: number;
  lat?: number | null;
  lon?: number | null;
  kn?: number | null;
  huong?: number | null;
  mui?: number | null;
  ten?: string | null;
  hoHieu?: string | null;
  imo?: number | null;
  /** loại tàu theo mã của app (lib/tau-ais LOAI_TAU: 2 = tàu cá) */
  loai?: number | null;
  /** VDO = tàu MÌNH phát (bộ phát AIS trên tàu) */
  cuaMinh: boolean;
}

/** XOR mọi ký tự giữa `$`/`!` và `*` — đúng ⇒ true. Câu không có `*hh` ⇒ true (nhiều máy cũ bỏ checksum). */
export function kiemTong(cau: string): boolean {
  const s = cau.trim();
  const sao = s.lastIndexOf("*");
  if (sao < 0) return true;
  const than = s.slice(1, sao);
  const hh = s.slice(sao + 1, sao + 3);
  if (!/^[0-9A-Fa-f]{2}$/.test(hh)) return false;
  let x = 0;
  for (let i = 0; i < than.length; i++) x ^= than.charCodeAt(i);
  return x === parseInt(hh, 16);
}

const so = (v: string | undefined): number | null => {
  if (v == null || v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** "1050.1234","N" ⇒ 10,8354 — độ-phút NMEA (ddmm.mmmm / dddmm.mmmm). */
export function doPhut(v: string | undefined, ban: string | undefined): number | null {
  const n = so(v);
  if (n == null || !ban) return null;
  const deg = Math.floor(n / 100);
  const min = n - deg * 100;
  if (min >= 60) return null;
  const d = deg + min / 60;
  const dau = ban === "S" || ban === "W" ? -1 : ban === "N" || ban === "E" ? 1 : 0;
  if (!dau) return null;
  return dau * d;
}

/** hhmmss.ss + ddmmyy ⇒ epoch ms (UTC). Thiếu ngày ⇒ null. */
function gioRmc(t: string | undefined, d: string | undefined): number | null {
  if (!t || !d || t.length < 6 || d.length !== 6) return null;
  const ms = Date.UTC((Number(d.slice(4, 6)) < 80 ? 2000 : 1900) + Number(d.slice(4, 6)), Number(d.slice(2, 4)) - 1, Number(d.slice(0, 2)), Number(t.slice(0, 2)), Number(t.slice(2, 4)), Number(t.slice(4)));
  return Number.isFinite(ms) ? Math.round(ms) : null;
}

const hopLeViTri = (lat: number | null, lon: number | null): lat is number =>
  lat != null && lon != null && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;

/* ── AIS: giải mã 6 bit (ITU-R M.1371) ─────────────────────────────────────── */

function boBit(payload: string, fill: number): string | null {
  let bits = "";
  for (let i = 0; i < payload.length; i++) {
    let c = payload.charCodeAt(i) - 48;
    if (c < 0 || c > 71 || (c > 39 && c < 48)) return null;
    if (c > 40) c -= 8;
    bits += c.toString(2).padStart(6, "0");
  }
  return fill > 0 ? bits.slice(0, bits.length - fill) : bits;
}

const uint = (b: string, tu: number, dai: number): number | null => (b.length >= tu + dai ? parseInt(b.slice(tu, tu + dai), 2) : null);
function sint(b: string, tu: number, dai: number): number | null {
  const u = uint(b, tu, dai);
  if (u == null) return null;
  return b[tu] === "1" ? u - 2 ** dai : u;
}
function chu6(b: string, tu: number, soKyTu: number): string | null {
  let s = "";
  for (let i = 0; i < soKyTu; i++) {
    const v = uint(b, tu + i * 6, 6);
    if (v == null) break;
    s += String.fromCharCode(v < 32 ? v + 64 : v);
  }
  const t = s.replace(/@.*$/, "").trim();
  return t || null;
}

/** Mã loại tàu AIS (ITU, 0–99) ⇒ mã gọn của app (lib/tau-ais LOAI_TAU). */
export function loaiTuMaAis(ma: number | null): number {
  if (ma == null) return 0;
  if (ma === 30) return 2;
  if (ma >= 40 && ma <= 49) return 4;
  if (ma >= 60 && ma <= 69) return 6;
  if (ma >= 70 && ma <= 79) return 7;
  if (ma >= 80 && ma <= 89) return 8;
  if (ma === 36 || ma === 37) return 9;
  if (ma === 31 || ma === 32 || ma === 33 || (ma >= 50 && ma <= 59)) return 3;
  return 0;
}

const viDoAis = (raw: number | null, kieu: "lat" | "lon"): number | null => {
  if (raw == null) return null;
  const d = raw / 600000;
  const max = kieu === "lat" ? 90 : 180;
  return Math.abs(d) > max ? null : Math.round(d * 1e6) / 1e6; // 91° / 181° = "không có"
};
const knAis = (raw: number | null) => (raw == null || raw === 1023 ? null : raw / 10);
const huongAis = (raw: number | null) => (raw == null || raw >= 3600 ? null : raw / 10);
const muiAis = (raw: number | null) => (raw == null || raw >= 360 ? null : raw);

/** Một gói AIS đã đủ mảnh ⇒ tin. Kiểu chưa đọc ⇒ null. */
export function giaiMaAis(payload: string, fill: number, cuaMinh = false): TinAis | null {
  const b = boBit(payload, fill);
  if (!b) return null;
  const kieu = uint(b, 0, 6);
  const mmsi = uint(b, 8, 30);
  if (kieu == null || mmsi == null) return null;
  if (kieu === 1 || kieu === 2 || kieu === 3) {
    return { kieu, mmsi, cuaMinh, kn: knAis(uint(b, 50, 10)), lon: viDoAis(sint(b, 61, 28), "lon"), lat: viDoAis(sint(b, 89, 27), "lat"), huong: huongAis(uint(b, 116, 12)), mui: muiAis(uint(b, 128, 9)) };
  }
  if (kieu === 18) {
    return { kieu, mmsi, cuaMinh, kn: knAis(uint(b, 46, 10)), lon: viDoAis(sint(b, 57, 28), "lon"), lat: viDoAis(sint(b, 85, 27), "lat"), huong: huongAis(uint(b, 112, 12)), mui: muiAis(uint(b, 124, 9)) };
  }
  if (kieu === 5) {
    const imo = uint(b, 40, 30);
    return { kieu, mmsi, cuaMinh, imo: imo ? imo : null, hoHieu: chu6(b, 70, 7), ten: chu6(b, 112, 20), loai: loaiTuMaAis(uint(b, 232, 8)) };
  }
  if (kieu === 24) {
    const phan = uint(b, 38, 2);
    if (phan === 0) return { kieu, mmsi, cuaMinh, ten: chu6(b, 40, 20) };
    if (phan === 1) return { kieu, mmsi, cuaMinh, loai: loaiTuMaAis(uint(b, 40, 8)), hoHieu: chu6(b, 90, 7) };
  }
  return null;
}

/* ── Ghép tin AIS nhiều mảnh (kiểu 5 luôn 2 mảnh) ─────────────────────────── */

const MANH_HET_HAN_MS = 10_000;

export class BoGhepAis {
  private cho = new Map<string, { phan: string[]; con: number; luc: number }>();

  /** Đưa một câu VDM/VDO đã tách trường; đủ mảnh ⇒ {payload, fill}. */
  them(f: string[], now: number): { payload: string; fill: number } | null {
    const tong = Number(f[1]);
    const thu = Number(f[2]);
    const fill = Number((f[6] ?? "0").split("*")[0]) || 0;
    const payload = f[5] ?? "";
    if (!Number.isInteger(tong) || !Number.isInteger(thu) || tong < 1 || thu < 1 || thu > tong) return null;
    if (tong === 1) return { payload, fill };
    for (const [k, v] of this.cho) if (now - v.luc > MANH_HET_HAN_MS) this.cho.delete(k);
    const khoa = `${f[3] ?? ""}|${f[4] ?? ""}|${tong}`;
    const g = this.cho.get(khoa) ?? { phan: new Array<string>(tong).fill(""), con: tong, luc: now };
    if (!g.phan[thu - 1]) g.con--;
    g.phan[thu - 1] = payload;
    this.cho.set(khoa, g);
    if (thu !== tong || g.con > 0) return null;
    this.cho.delete(khoa);
    return { payload: g.phan.join(""), fill };
  }
}

/* ── Một dòng ⇒ một câu ───────────────────────────────────────────────────── */

/**
 * Đọc một dòng NMEA. `ghep` giữ mảnh AIS giữa các dòng (một bộ cho mỗi kết nối).
 * Trả null khi: sai checksum, câu không đọc, chưa đủ mảnh, GPS báo chưa fix.
 */
export function docCau(dong: string, ghep: BoGhepAis, now = Date.now()): CauNmea | null {
  const s = dong.trim();
  if (!/^[$!]/.test(s) || !kiemTong(s)) return null;
  const f = s.split("*")[0].split(",");
  const ma = f[0].slice(-3);
  if (ma === "VDM" || ma === "VDO") {
    const du = ghep.them(s.split(","), now);
    if (!du) return null;
    const tin = giaiMaAis(du.payload, du.fill, ma === "VDO");
    return tin ? { loai: "ais", tin } : null;
  }
  if (ma === "GGA") {
    if (!Number(f[6])) return null; // 0 = chưa fix
    const lat = doPhut(f[2], f[3]);
    const lon = doPhut(f[4], f[5]);
    if (!hopLeViTri(lat, lon)) return null;
    return { loai: "vi-tri", nguon: "GGA", lat, lon: lon!, kn: null, huong: null, soVeTinh: so(f[7]), hdop: so(f[8]), lucMs: null };
  }
  if (ma === "RMC") {
    if (f[2] !== "A") return null; // V = cảnh báo, không tin
    const lat = doPhut(f[3], f[4]);
    const lon = doPhut(f[5], f[6]);
    if (!hopLeViTri(lat, lon)) return null;
    return { loai: "vi-tri", nguon: "RMC", lat, lon: lon!, kn: so(f[7]), huong: so(f[8]), soVeTinh: null, hdop: null, lucMs: gioRmc(f[1], f[9]) };
  }
  if (ma === "VTG") return { loai: "huong-di", huong: so(f[1]), kn: so(f[5]) };
  if (ma === "HDT") {
    const m = so(f[1]);
    return m == null ? null : { loai: "mui-tau", mui: m };
  }
  if (ma === "DBT") {
    // feet,f,metres,M,fathoms,F — lấy mét, thiếu thì đổi từ feet
    const m = so(f[3]) ?? (so(f[1]) != null ? so(f[1])! * 0.3048 : null);
    return m == null ? null : { loai: "do-sau", doSauM: Math.round(m * 10) / 10 };
  }
  if (ma === "DPT") {
    // độ sâu dưới đầu dò + độ lệch (dương = từ mặt nước; âm = tới đáy sống tàu) — cộng phần dương
    const m = so(f[1]);
    if (m == null) return null;
    const lech = so(f[2]);
    return { loai: "do-sau", doSauM: Math.round((m + (lech != null && lech > 0 ? lech : 0)) * 10) / 10 };
  }
  return null;
}
