// SEN BIỂN — Gemma 3 270M TRONG MÁY, chỉ bản Android (ADR 0012, doc 15 §20).
//
// Vai: TÁCH THAM SỐ. Bộ n-gram + luật (hieu-y.ts) vẫn chọn việc và trả lời ngay;
// có Gemma thì hỏi thêm Gemma, và CHỈ khi Gemma đoán CÙNG việc mới lấy tham số của
// nó (hướng, loài, đi luôn, lớp, ngày giờ, tầng, tên chỗ lệch giọng). Gemma lỗi /
// chưa tải / quá giờ ⇒ giữ nguyên câu trả lời của luật. Web không có Gemma.
//
// Mô hình 62 MB nằm trong gói Play Asset Delivery on-demand (plugin Kotlin
// SenBienGemmaPlugin.kt). Prompt dưới đây phải KHỚP TỪNG CHỮ với lúc train (repo AI
// Assistant train/tro-ly/chung.mjs SYSTEM + userMsg, du-doan-hf.py hạ chữ thường).

import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";

import type { SenDest, SenReply } from "./hieu-y";
import type { CauHoi } from "./hoi-ban-do";
import type { LenhBanDo, LopBanDo, LoaiCaHoi } from "./lenh-ban-do";
import { foldVn, INTENTS, type SenIntent } from "./ngram";

export type GemmaTrangThai = {
  trangThai: "co" | "dang_tai" | "cho" | "cho_wifi" | "can_dong_y" | "loi" | "huy" | "chua_co" | "khong_ro";
  daNap?: boolean;
  phanTram?: number;
  tongMB?: number;
  maLoi?: number;
};

interface SenBienGemmaPlugin {
  trangThai(): Promise<GemmaTrangThai>;
  taiVe(): Promise<GemmaTrangThai>;
  nap(): Promise<GemmaTrangThai>;
  hoi(o: { he: string; nguoi: string }): Promise<{ txt: string; ms: number }>;
  dong(): Promise<void>;
  addListener(ev: "tien", fn: (s: GemmaTrangThai) => void): Promise<PluginListenerHandle>;
}

const Plugin = registerPlugin<SenBienGemmaPlugin>("SenBienGemma");

/** Có Gemma trong bản này không (chỉ app Android có plugin). */
export function coGemma(): boolean {
  return Capacitor.getPlatform() === "android" && Capacitor.isPluginAvailable("SenBienGemma");
}

export const SYSTEM =
  'Bộ hiểu ý Trợ lý Forfish. Đọc câu ngư dân nói, trả đúng một dòng JSON {"y":ý định,"s":tham số,"f":ý thứ hai,"r":lý do chặn}.';

export type GemmaCtx = { xn?: boolean; cang?: string[]; diem?: string[]; tau?: string[] };

/** = chung.mjs userMsg, câu HẠ CHỮ THƯỜNG (bộ nghe trả CHỮ HOA; không hạ thì Gemma tụt 95 → 61 %). */
export function userMsg(cau: string, ctx: GemmaCtx): string {
  const l = (a?: string[]) => (a && a.length ? a.join(";") : "-");
  return `xn=${ctx.xn ? 1 : 0} | cang=${l(ctx.cang)} | diem=${l(ctx.diem)} | tau=${l(ctx.tau)}\ncau: ${cau.toLowerCase()}`;
}

export type GemmaDap = { y: SenIntent; s: Record<string, unknown> };

/** Đọc một dòng JSON của Gemma (chịu rác quanh, thiếu ngoặc cuối); hỏng ⇒ null. = chung.mjs docDap. */
export function docDap(txt: string): GemmaDap | null {
  const m = String(txt ?? "").match(/\{[\s\S]*\}/);
  if (!m) return null;
  let o: unknown;
  try {
    o = JSON.parse(m[0]);
  } catch {
    let d = 0;
    let end = -1;
    for (let i = 0; i < m[0].length; i++) {
      if (m[0][i] === "{") d++;
      else if (m[0][i] === "}" && --d === 0) {
        end = i;
        break;
      }
    }
    if (end < 0) return null;
    try {
      o = JSON.parse(m[0].slice(0, end + 1));
    } catch {
      return null;
    }
  }
  const r = o as { y?: unknown; s?: unknown };
  if (!r || typeof r.y !== "string" || !(INTENTS as readonly string[]).includes(r.y)) return null;
  return { y: r.y as SenIntent, s: r.s && typeof r.s === "object" ? (r.s as Record<string, unknown>) : {} };
}

const HUONG_DO: Record<string, number> = { bac: 0, dong_bac: 45, dong: 90, dong_nam: 135, nam: 180, tay_nam: 225, tay: 270, tay_bac: 315 };
const LOPS: readonly LopBanDo[] = ["gio", "song", "dong_chay", "may", "mua", "nhiet_kk", "dong_set", "ap_suat", "nhiet_nuoc", "phu_du", "do_sau", "ca"];
const Y_HOI: Partial<Record<SenIntent, CauHoi["loai"]>> = {
  hoi_dao_gan: "dao_gan", hoi_o_dau: "o_dau", hoi_ran_gan: "ran_gan", hoi_do_sau: "do_sau", hoi_phia_truoc: "phia_truoc",
  hoi_den_bien: "den_bien", hoi_phao: "phao", hoi_xac_tau: "xac_tau", hoi_tru_bao: "tru_bao", hoi_vung_cam: "vung_cam",
  hoi_cang_gan: "cang_gan", hoi_ca: "ca", con_nuoc: "con_nuoc",
};

/** species của Gemma (khoá loài đã bỏ dấu, hoặc nhóm "ca ngu"/"muc"/"tom") → loài app biết. */
function loaiTu(species: unknown, loaiCa: readonly string[]): LoaiCaHoi | undefined {
  if (typeof species !== "string" || !species) return undefined;
  const k = foldVn(species);
  const mot = loaiCa.find((sp) => foldVn(sp) === k || `ca ${foldVn(sp)}` === k);
  if (mot) return { ds: [mot], ten: mot.startsWith("cá ") ? mot : `cá ${mot}` };
  for (const [g, ten] of [["ca ngu", "cá ngừ"], ["muc", "mực"], ["tom", "tôm"]] as const) {
    if (k !== g) continue;
    const goc = foldVn(ten).replace(/^ca /, "");
    const ds = loaiCa.filter((sp) => foldVn(sp).startsWith(`${goc} `));
    if (ds.length) return { ds, ten };
  }
  return undefined;
}

const so = (v: unknown) => (typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN);

/**
 * Áp tham số của Gemma lên câu trả lời của luật — THUẦN, có test. Gemma phải đoán
 * CÙNG việc; khác việc thì bỏ (n-gram + luật đã đo đúng việc hơn, ADR 0012).
 */
export function apDungGemma(r: SenReply, g: GemmaDap | null, loaiCa: readonly string[], dests: readonly SenDest[]): SenReply {
  if (!g) return r;
  const s = g.s;
  if (r.kind === "hoi" && Y_HOI[g.y] === r.q.loai) {
    const q: CauHoi = { ...r.q };
    if (typeof s.huong === "string" && s.huong in HUONG_DO) q.huong = HUONG_DO[s.huong];
    if (q.loai === "ca") {
      const l = loaiTu(s.species, loaiCa);
      if (l) q.loaiCa = l;
    }
    if (s.di === 1 || s.di === "1") q.muonDi = true;
    return { kind: "hoi", q };
  }
  if (r.kind === "map" && g.y === r.lenh.viec) {
    const l = { ...r.lenh } as LenhBanDo & Record<string, unknown>;
    if ((l.viec === "mo_lop" || l.viec === "doc_gia_tri") && typeof s.lop === "string" && (LOPS as readonly string[]).includes(s.lop))
      l.lop = s.lop as LopBanDo;
    if (l.viec === "mo_lop" || l.viec === "doc_gia_tri" || l.viec === "doi_thoi_diem") {
      const ngay = so(s.day);
      const gio = so(s.gio);
      if (Number.isInteger(ngay) && ngay >= 0 && ngay <= 15)
        l.luc = Number.isInteger(gio) && gio >= 0 && gio <= 23 ? { ngay, gio } : { ngay };
      const ca = loaiTu(s.species, loaiCa);
      if (ca && (l.lop === "ca" || l.viec === "doc_gia_tri")) l.loaiCa = ca;
    }
    if (l.viec === "mo_lop") {
      const t = so(s.tang);
      if (l.lop === "dong_chay" && (t === 50 || t === 150 || t === 300)) l.tang = t;
    }
    return { kind: "map", lenh: l as LenhBanDo };
  }
  // dẫn đường mà luật không thấy tên (bộ nghe lệch giọng: "XA HUYỀN"): Gemma học sửa về tên trong danh sách
  if (r.kind === "say" && r.y === "dan_duong" && g.y === "dan_duong" && typeof s.placeName === "string") {
    const k = foldVn(s.placeName);
    const hit = dests.filter((d) => foldVn(d.name).replace(/^(cang ca|cang|ben ca|ben)\s+/, "") === k);
    if (hit.length === 1) return { kind: "go", dest: hit[0], say: `Đi ${hit[0].name}.` };
  }
  return r;
}

/** Câu trả lời nào đáng hỏi Gemma (có tham số để tinh chỉnh). */
export const canGemma = (r: SenReply) => r.kind === "hoi" || r.kind === "map" || (r.kind === "say" && r.y === "dan_duong");

/** Hỏi Gemma, có TRẦN thời gian; mọi lỗi ⇒ null (không bao giờ ném). */
export async function hoiGemma(cau: string, ctx: GemmaCtx, tranMs = 2500): Promise<GemmaDap | null> {
  if (!coGemma()) return null;
  try {
    const kq = await Promise.race([
      Plugin.hoi({ he: SYSTEM, nguoi: userMsg(cau, ctx) }),
      new Promise<null>((ok) => setTimeout(() => ok(null), tranMs)),
    ]);
    return kq ? docDap(kq.txt) : null;
  } catch {
    return null;
  }
}

/**
 * Lúc mở bản đồ: có gói thì nạp trước; chưa có thì xin Play tải (một lần, Play tự lo
 * Wi-Fi/4G và hỏi bà con khi cần). Máy bật tiết kiệm dữ liệu thì không xin tải.
 * Không bao giờ ném.
 */
export async function chuanBiGemma(tietKiemDuLieu: boolean): Promise<GemmaTrangThai | null> {
  if (!coGemma()) return null;
  try {
    const t = await Plugin.trangThai();
    if (t.trangThai === "co") return await Plugin.nap();
    if (tietKiemDuLieu || t.trangThai === "dang_tai" || t.trangThai === "cho") return t;
    return await Plugin.taiVe();
  } catch {
    return null;
  }
}

/** Rời bản đồ: nhả RAM. */
export function dongGemma(): void {
  if (coGemma()) void Plugin.dong().catch(() => {});
}

/* ── VAI THỨ HAI (2026-10-19): CHỌN CÂU HỎI TRONG KHO ────────────────────────────────────────────────────────────
   n-gram v5b đưa 9 câu hỏi chuẩn gần nhất (dau-kho.ts, hoi-kho.ts); Gemma đọc câu bà con + 9 câu, trả MỘT chữ số:
   1–9 = câu cùng ý, 0 = không câu nào (⇒ hỏi máy nhà khi có sóng / câu an toàn khi mất sóng). Prompt KHỚP TỪNG CHỮ
   với lúc train (repo AI Assistant tro-ly-v5r `dung-chon.mjs` hàm `mau`, tron:false — thứ tự theo n-gram, KHÔNG hạ
   chữ thường: dữ liệu train đã trộn HOA/thường như bộ nghe).
   nợ: mô hình đang ở gói Play Asset (.litertlm hiện tại) CHƯA học vai này — nó trả JSON hiểu ý, không phải chữ số
   ⇒ `docSoChon` ra null ⇒ hoi-kho lùi về ngưỡng n-gram như web. Trần: Android chưa được Gemma chọn câu. Nâng cấp khi
   bản đa nhiệm g270v5r (hiểu ý v4 + chọn câu) qua cổng: thay .litertlm trong `android/sen-bien-gemma` (doc 15 §26,
   ops/native-deploy §3c), không đổi code. */
export const SYSTEM_CHON =
  "Bộ chọn câu hỏi Sen Biển. Đọc câu ngư dân hỏi và 9 câu hỏi có sẵn, trả đúng một số: số của câu cùng ý, không câu nào cùng ý thì 0.";

/** = dung-chon.mjs mau(): "cau: <câu>" rồi mỗi dòng "n. <câu hỏi chuẩn>". */
export function nguoiChon(cau: string, hoi: readonly string[]): string {
  return `cau: ${cau}\n` + hoi.map((h, i) => `${i + 1}. ${h}`).join("\n");
}

/** Ký tự đầu (bỏ khoảng trắng) là chữ số 0–9 và không vượt số ứng viên ⇒ số đó; còn lại ⇒ null. */
export function docSoChon(txt: unknown, n: number): number | null {
  const c = String(txt ?? "").trim().charAt(0);
  if (!/^[0-9]$/.test(c)) return null;
  const k = Number(c);
  return k <= n ? k : null;
}

/** Trần chờ Gemma chọn câu — quá thì coi như không có Gemma. */
export const CHON_HAN_MS = 4000;

/** Hỏi Gemma chọn câu (Android). Không có Gemma / lỗi / quá giờ / trả không phải chữ số ⇒ null. Không bao giờ ném. */
export async function chonCauHoi(cau: string, hoi: readonly string[], tranMs = CHON_HAN_MS): Promise<number | null> {
  if (!hoi.length || !coGemma()) return null;
  let t: ReturnType<typeof setTimeout> | undefined;
  try {
    const kq = await Promise.race([
      Plugin.hoi({ he: SYSTEM_CHON, nguoi: nguoiChon(cau, hoi) }),
      new Promise<null>((ok) => {
        t = setTimeout(() => ok(null), tranMs);
      }),
    ]);
    return kq ? docSoChon(kq.txt, hoi.length) : null;
  } catch {
    return null;
  } finally {
    if (t) clearTimeout(t);
  }
}
