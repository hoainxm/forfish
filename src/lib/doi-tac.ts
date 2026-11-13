// API ĐỐI TÁC TÍCH HỢP — dữ liệu tàu AIS (2026-11-02, anh Long: "dựng API và hướng dẫn kết nối cho đơn vị tích hợp").
// PHẦN THUẦN (test được): đọc danh sách khoá, khớp token Bearer, lọc + đổi bản AIS nội bộ sang khuôn công khai.
// Route ở src/app/api/doi-tac/v1/*; tài liệu gửi khách: docs/integration/api-doi-tac-ais.md.
//
// PHẠM VI = BÁO GIÁ BG-AIS-2026-01 (30/10/2026): license theo SỐ KHU VỰC (1–5, lib/doi-tac-khu-vuc) × GÓI cập nhật
// (60 phút tiêu chuẩn / 30 phút). Mỗi gói đọc một bản riêng (`tau-ais:goi-60|30`, ghi ở POST /api/tau-ais/nhap khi bản gói đã
// đủ cũ — `banGoiCanGhi`) ⇒ gói 1 giờ thật sự chỉ thấy dữ liệu mới mỗi giờ, gọi dày hơn cũng không được bản mới hơn.
//
// Khoá: `app_config.doi_tac_ais` (env DOI_TAC_AIS đè nếu đặt) = "ten:sha256hex:khu:goi,…" (vd `doi-tac-1:ab…:135:60`
// = khu 1, 3, 5, gói 60 phút). Chỉ lưu BĂM — token rõ in một lần lúc cấp (scripts/doi-tac-khoa.mjs). Thu hồi = gỡ đúng mục.

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { idCoDinh, LOAI_TAU } from "@/lib/tau-ais/chuan-hoa.mjs";
import { khuVucCua } from "@/lib/doi-tac-khu-vuc";
import type { TauAis, TauAisBan } from "@/lib/tau-ais";

export type GoiDoiTac = 30 | 60;
export const GOI_DOI_TAC: readonly GoiDoiTac[] = [60, 30];
export const banGoiId = (goi: GoiDoiTac) => `tau-ais:goi-${goi}`;

export interface KhoaDoiTac {
  ten: string;
  bam: string;
  /** khu vực được mua, tăng dần, không trùng */
  khu: number[];
  goi: GoiDoiTac;
}

/** Khuôn MỘT mục — app-config-keys kiểm ô cấu hình bằng cùng regex này. */
export const MUC_KHOA_DOI_TAC = /^([a-z0-9][a-z0-9-]{1,39}):([0-9a-f]{64}):([1-5]{1,5}):(30|60)$/;

/** "ten:hex64:khu:goi,…" ⇒ danh sách hợp lệ (mục hỏng bỏ qua). Rỗng/null ⇒ []. */
export function docKhoaDoiTac(v: string | null | undefined): KhoaDoiTac[] {
  const out: KhoaDoiTac[] = [];
  for (const s of (v ?? "").split(",")) {
    const m = MUC_KHOA_DOI_TAC.exec(s.trim().toLowerCase());
    if (!m) continue;
    const khu = [...new Set(m[3].split("").map(Number))].sort((a, b) => a - b);
    out.push({ ten: m[1], bam: m[2], khu, goi: Number(m[4]) as GoiDoiTac });
  }
  return out;
}

/** Bản gói cần ghi lại khi bản đang có cũ hơn (chu kỳ gói − 5 phút) — máy thu đẩy ~10 phút/lần nên nhịp thật ≈ chu kỳ gói.
 *  Chưa có bản / mốc hỏng ⇒ ghi. */
export function banGoiCanGhi(lucBanGoi: string | null | undefined, now: number, goi: GoiDoiTac): boolean {
  const t = lucBanGoi ? Date.parse(lucBanGoi) : NaN;
  return !Number.isFinite(t) || now - t >= (goi - 5) * 60_000;
}

export const bamToken = (token: string) => createHash("sha256").update(token, "utf8").digest("hex");

/** Header `Authorization: Bearer <token>` ⇒ token, thiếu/sai dạng ⇒ null. */
export function layBearer(h: string | null | undefined): string | null {
  const m = /^Bearer\s+(\S{16,200})\s*$/i.exec(h ?? "");
  return m ? m[1] : null;
}

/** Token ⇒ mục đối tác, không khớp ⇒ null. So mọi mục thời-gian-hằng (không dừng sớm khi khớp). */
export function khopDoiTac(token: string | null, ds: KhoaDoiTac[]): KhoaDoiTac | null {
  if (!token) return null;
  const g = Buffer.from(bamToken(token), "hex");
  let kq: KhoaDoiTac | null = null;
  for (const k of ds) {
    if (timingSafeEqual(g, Buffer.from(k.bam, "hex")) && kq == null) kq = k;
  }
  return kq;
}

export interface LocTau {
  /** khu vực được trả — luôn ⊆ khu đã mua (route giao với license) */
  khu: number[];
  /** [lonMin, latMin, lonMax, latMax] */
  bbox?: [number, number, number, number];
  loai?: number[];
  mmsi?: number;
}

/** Tham số query ⇒ bộ lọc trong phạm vi `khuMua`, sai ⇒ { loi } (route trả 400 kèm mã). `zone` ngoài license ⇒ 403 `zone_not_licensed`. */
export function docLocTau(sp: URLSearchParams, khuMua: number[]): { loc: LocTau } | { loi: string } {
  const loc: LocTau = { khu: khuMua };
  const zone = sp.get("zone");
  if (zone != null) {
    const ds = zone.split(",").map((s) => Number(s.trim()));
    if (!ds.length || ds.some((x) => !Number.isInteger(x) || x < 1 || x > 5)) return { loi: "bad_zone" };
    if (ds.some((x) => !khuMua.includes(x))) return { loi: "zone_not_licensed" };
    loc.khu = [...new Set(ds)].sort((a, b) => a - b);
  }
  const bbox = sp.get("bbox");
  if (bbox != null) {
    const n = bbox.split(",").map(Number);
    if (n.length !== 4 || n.some((x) => !Number.isFinite(x))) return { loi: "bad_bbox" };
    const [lonMin, latMin, lonMax, latMax] = n;
    if (lonMin >= lonMax || latMin >= latMax || Math.abs(latMin) > 90 || Math.abs(latMax) > 90 || Math.abs(lonMin) > 180 || Math.abs(lonMax) > 180)
      return { loi: "bad_bbox" };
    loc.bbox = [lonMin, latMin, lonMax, latMax];
  }
  const loai = sp.get("type");
  if (loai != null) {
    const ds = loai.split(",").map((s) => Number(s.trim()));
    if (!ds.length || ds.some((x) => !Number.isInteger(x) || x < 0 || x > 9)) return { loi: "bad_type" };
    loc.loai = ds;
  }
  const mmsi = sp.get("mmsi");
  if (mmsi != null) {
    if (!/^\d{9}$/.test(mmsi)) return { loi: "bad_mmsi" };
    loc.mmsi = Number(mmsi);
  }
  return { loc };
}

/** Mã tàu CÔNG KHAI (2026-11-13): HMAC-SHA256(khoá `doi_tac_id_khoa`, "<tên đối tác>:<mã nội bộ>") ⇒ 16 hex. Mã nội bộ là mã của
 *  nguồn thu ⇒ trả thẳng là lộ nguồn; HMAC có khoá nên không dò ngược được (mã nội bộ chỉ vài triệu số — băm trần dò được).
 *  Theo TÊN đối tác ⇒ hai đối tác thấy hai bộ mã khác nhau, dữ liệu lộ ra ngoài thì biết của ai. Mã nội bộ cố định ⇒ mã công khai cố định. */
export function idCongKhai(khoa: string, ten: string, id: string): string {
  return createHmac("sha256", khoa).update(`${ten}:${id}`, "utf8").digest("hex").slice(0, 16);
}

/** Một tàu ở khuôn CÔNG KHAI (khoá tiếng Anh, đơn vị ghi rõ) — đổi tên trường ở đây là breaking với đối tác. */
export interface TauCongKhai {
  id: string;
  /** khu vực 1–5 theo báo giá */
  zone: number;
  /** true = id giữ nguyên qua các bản ⇒ gọi được /tau/vet */
  track_available: boolean;
  mmsi: number | null;
  imo: number | null;
  callsign: string | null;
  name: string | null;
  type: number;
  type_name: string;
  flag: string | null;
  lat: number;
  lon: number;
  speed_kn: number | null;
  course_deg: number | null;
  heading_deg: number | null;
  length_m: number | null;
  destination: string | null;
  /** ISO — lúc tàu phát tin gần nhất (lúc bản trừ số phút tin cũ) */
  last_seen: string;
}

const tenLoai = (l: number) => (LOAI_TAU as Record<number, string>)[l] ?? LOAI_TAU[0];

export function tauCongKhai(t: TauAis, lucBanMs: number, zone: number, maId: (id: string) => string): TauCongKhai {
  return {
    id: maId(t.id),
    zone,
    track_available: idCoDinh(t.id),
    mmsi: t.mmsi ?? null,
    imo: t.imo ?? null,
    callsign: t.hh ?? null,
    name: t.ten,
    type: t.loai,
    type_name: tenLoai(t.loai),
    flag: t.co,
    lat: t.lat,
    lon: t.lon,
    speed_kn: t.kn,
    course_deg: t.huong,
    heading_deg: t.mui,
    length_m: t.dai,
    destination: t.dich,
    last_seen: new Date(lucBanMs - Math.max(0, t.phut || 0) * 60_000).toISOString(),
  };
}

/** Lọc bản AIS theo khu vực + bộ lọc rồi đổi sang khuôn công khai (`maId` = idCongKhai đã gắn khoá + tên đối tác).
 *  Bản hỏng ⇒ mảng rỗng. */
export function locTau(ban: TauAisBan, loc: LocTau, maId: (id: string) => string): TauCongKhai[] {
  const lucMs = Date.parse(ban.luc);
  if (!Number.isFinite(lucMs) || !Array.isArray(ban.tau)) return [];
  const out: TauCongKhai[] = [];
  for (const t of ban.tau) {
    if (loc.bbox) {
      const [a, b, c, d] = loc.bbox;
      if (t.lon < a || t.lon > c || t.lat < b || t.lat > d) continue;
    }
    if (loc.loai && !loc.loai.includes(t.loai)) continue;
    if (loc.mmsi != null && t.mmsi !== loc.mmsi) continue;
    const zone = khuVucCua(t.lat, t.lon);
    if (zone == null || !loc.khu.includes(zone)) continue;
    out.push(tauCongKhai(t, lucMs, zone, maId));
  }
  return out;
}

/** Mã công khai ⇒ mã nội bộ, tra trong bản theo gói (HMAC không đảo được). Tàu đã rời bản ⇒ null. */
export function timIdNoiBo(ban: TauAisBan | null, maCongKhai: string, maId: (id: string) => string): string | null {
  if (!ban || !Array.isArray(ban.tau) || !/^[0-9a-f]{16}$/.test(maCongKhai)) return null;
  return ban.tau.find((t) => maId(t.id) === maCongKhai)?.id ?? null;
}

/** Trần gọi mỗi đối tác: 120 lượt / 10 phút (bản mới ~10 phút một lần, quá đủ cho đồng bộ định kỳ). */
export const TRAN_DOI_TAC = { limit: 120, windowMs: 10 * 60_000 };
