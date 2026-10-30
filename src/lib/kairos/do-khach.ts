// KAIROS — ĐO (CDP nội bộ SDVICO), 14 §22. THUẦN, có test (kairos-do-khach.test.ts).
//
// Anh Long 2026-10-30: "tương tự hệ thống CDP — phục vụ nội bộ của mình, không làm lộ lọt dữ liệu KH".
// Hai phần:
//   1. Lượt XEM / BẤM thẻ Tài trợ — app gom trong hàng đợi tín hiệu đọc sẵn có (gui-tin-hieu.ts), gửi kèm lô
//      /api/kairos/doc; DB gộp theo (ngày, SĐT, bài) — kairos_record_tai_tro (0077).
//   2. Số liệu cho /quan-tri › Kairos › Đo: hàm DB `kairos_do(days)` trả từng khách thật + theo chủ đề + theo bài
//      tài trợ; file này kiểm hình dạng, chia NHÓM KHÁCH (để gọi bán) và tính tỷ lệ.
// Khách = customers role 'customer' + account_kind 'real' (không tính agent Kairos, tài khoản test, nhân viên).

const AD_ID_RE = /^[a-z0-9-]{4,40}$/;

// ── 1. Lượt xem / bấm thẻ Tài trợ ─────────────────────────────────────────

export interface DemTaiTro {
  id: string;
  xem: number;
  bam: number;
}

/** Một lô gửi tối đa chừng này bài tài trợ (danh sách tài trợ cũng trần 20 — QC_TRAN.soLuong). */
export const TT_LO_TOI_DA = 20;

/** Gộp đếm mới vào hàng đợi (cùng bài thì cộng); trần 1000/bài/lô như DB. */
export function gopDemTaiTro(hang: readonly DemTaiTro[], moi: readonly DemTaiTro[]): DemTaiTro[] {
  const m = new Map<string, DemTaiTro>();
  for (const x of [...hang, ...moi]) {
    const cu = m.get(x.id);
    m.set(x.id, { id: x.id, xem: Math.min((cu?.xem ?? 0) + x.xem, 1000), bam: Math.min((cu?.bam ?? 0) + x.bam, 1000) });
  }
  return [...m.values()].slice(-TT_LO_TOI_DA);
}

/** Kiểm mảng `tt` của thân request / hàng đợi máy — mục hỏng bị bỏ, không làm hỏng cả lô. Không phải mảng ⇒ []. */
export function docDemTaiTro(raw: unknown): DemTaiTro[] {
  if (!Array.isArray(raw)) return [];
  const out: DemTaiTro[] = [];
  for (const x of raw.slice(0, TT_LO_TOI_DA)) {
    const o = x as Partial<DemTaiTro> | null;
    if (!o || typeof o.id !== "string" || !AD_ID_RE.test(o.id)) continue;
    const xem = Number.isInteger(o.xem) ? Math.max(0, Math.min(o.xem as number, 1000)) : 0;
    const bam = Number.isInteger(o.bam) ? Math.max(0, Math.min(o.bam as number, 1000)) : 0;
    if (xem || bam) out.push({ id: o.id, xem, bam });
  }
  return out;
}

// ── 2. Số liệu Đo ─────────────────────────────────────────────────────────

/** Khoảng ngày cho phép (kairos_reads chỉ giữ 90 ngày). */
export const DO_KHOANG = [7, 30, 90] as const;
export type DoKhoang = (typeof DO_KHOANG)[number];
export const docKhoang = (v: unknown): DoKhoang => (DO_KHOANG.includes(Number(v) as DoKhoang) ? (Number(v) as DoKhoang) : 30);

export interface DoKhach {
  phone: string;
  name: string | null;
  tier: string | null;
  may: string | null;
  lanMo: string | null;
  queTinh: string | null;
  cang: string | null;
  baiXem: number;
  baiMo: number;
  giayDoc: number;
  /** điểm theo chủ đề: lượt xem + 3 × mở */
  chuDe: Record<string, number>;
  ttXem: number;
  ttBam: number;
  ttBamIds: string[];
  /** đơn Chợ + yêu cầu đặt + hỏi mua + hỏi SDVICO trong khoảng */
  don: number;
}
export interface DoChuDe { topic: string; nguoi: number; luotXem: number; baiXem: number; baiMo: number; giayDoc: number }
export interface DoTaiTro { id: string; nguoiXem: number; luotXem: number; nguoiBam: number; luotBam: number }
export interface DoTho { tongKhach: number; khach: DoKhach[]; chuDe: DoChuDe[]; taiTro: DoTaiTro[] }

const so = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.round(v)) : Number(v) > 0 ? Math.round(Number(v)) : 0);
const chu = (v: unknown) => (typeof v === "string" && v ? v : null);

/** Đọc kết quả `kairos_do` (jsonb) — dòng sai hình dạng bị bỏ, không ném. */
export function docDoTho(raw: unknown): DoTho {
  const o = (raw ?? {}) as Record<string, unknown>;
  const arr = (v: unknown) => (Array.isArray(v) ? (v as Record<string, unknown>[]) : []).filter((x) => x && typeof x === "object");
  const khach: DoKhach[] = arr(o.khach)
    .filter((k) => typeof k.phone === "string" && k.phone)
    .map((k) => {
      const cd: Record<string, number> = {};
      if (k.chu_de && typeof k.chu_de === "object") for (const [t, n] of Object.entries(k.chu_de)) if (so(n)) cd[t] = so(n);
      return {
        phone: k.phone as string, name: chu(k.name), tier: chu(k.tier), may: chu(k.device_platform), lanMo: chu(k.lan_mo),
        queTinh: chu(k.que_tinh), cang: chu(k.home_port),
        baiXem: so(k.bai_xem), baiMo: so(k.bai_mo), giayDoc: so(k.giay_doc), chuDe: cd,
        ttXem: so(k.tt_xem), ttBam: so(k.tt_bam), ttBamIds: Array.isArray(k.tt_bam_ids) ? k.tt_bam_ids.filter((x): x is string => typeof x === "string") : [],
        don: so(k.don),
      };
    });
  return {
    tongKhach: so(o.tong_khach),
    khach,
    chuDe: arr(o.chu_de)
      .filter((c) => typeof c.topic === "string")
      .map((c) => ({ topic: c.topic as string, nguoi: so(c.nguoi), luotXem: so(c.luot_xem), baiXem: so(c.bai_xem), baiMo: so(c.bai_mo), giayDoc: so(c.giay_doc) }))
      .sort((a, b) => b.baiXem - a.baiXem),
    taiTro: arr(o.tai_tro)
      .filter((t) => typeof t.id === "string")
      .map((t) => ({ id: t.id as string, nguoiXem: so(t.nguoi_xem), luotXem: so(t.luot_xem), nguoiBam: so(t.nguoi_bam), luotBam: so(t.luot_bam) }))
      .sort((a, b) => b.luotXem - a.luotXem),
  };
}

/** Chủ đề đọc nhiều nhất của một khách (hoà ⇒ theo tên cho ổn định); chưa đọc ⇒ null. */
export function chuDeChinh(cd: Record<string, number>): string | null {
  let best: string | null = null;
  for (const [t, n] of Object.entries(cd)) if (n > 0 && (best == null || n > cd[best] || (n === cd[best] && t < best))) best = t;
  return best;
}

/** Nhóm khách — mỗi nhóm kèm việc nên làm (để người bán gọi đúng người, đúng chuyện). Thứ tự = ưu tiên gọi. */
export const NHOM = [
  { id: "bam-chua-mua", ten: "Bấm chưa mua", viec: "Gọi chốt — đã quan tâm sản phẩm" },
  { id: "chinh-sach", ten: "Đọc chính sách", viec: "Giới thiệu thiết bị đạt chuẩn, hỗ trợ theo chính sách" },
  { id: "doc-ky", ten: "Đọc kỹ", viec: "Đăng bài tài trợ đúng chủ đề họ hay đọc" },
  { id: "chi-luot", ten: "Chỉ lướt", viec: "Quảng cáo phải nói đủ trong tiêu đề + ảnh" },
  { id: "khong-doc", ten: "Không đọc", viec: "Mở app nhưng không đọc tin — tiếp cận qua thông báo hoặc gọi điện" },
  { id: "da-mua", ten: "Đã mua", viec: "Đã đặt hàng / hỏi mua — chăm sóc sau bán, mời mua thêm" },
] as const;
export type NhomId = (typeof NHOM)[number]["id"];

/** Ngưỡng "đọc kỹ": mở ≥ 2 bài hoặc đọc ≥ 2 phút. */
export const DOC_KY = { baiMo: 2, giay: 120 } as const;

/** Một khách thuộc những nhóm nào (có thể nhiều nhóm). */
export function nhomCua(k: DoKhach): NhomId[] {
  const out: NhomId[] = [];
  if (k.ttBam > 0 && k.don === 0) out.push("bam-chua-mua");
  if (chuDeChinh(k.chuDe) === "chinh-sach" || (k.chuDe["chinh-sach"] ?? 0) >= 10) out.push("chinh-sach");
  if (k.baiMo >= DOC_KY.baiMo || k.giayDoc >= DOC_KY.giay) out.push("doc-ky");
  if (k.baiXem > 0 && k.baiMo === 0) out.push("chi-luot");
  if (k.baiXem === 0) out.push("khong-doc");
  if (k.don > 0) out.push("da-mua");
  return out;
}

const tyLe = (a: number, b: number) => (b > 0 ? a / b : null);

export interface DoTongHop {
  tongKhach: number;
  /** khách thật có hoạt động trong khoảng (mở app / đọc / bấm / đặt) */
  hoatDong: number;
  nguoiDoc: number;
  /** người đọc / hoạt động */
  tyLeDoc: number | null;
  baiXem: number;
  baiMo: number;
  /** bài mở / bài lướt qua */
  tyLeMo: number | null;
  /** giây đọc trung bình mỗi bài đã mở */
  giayMoiBai: number | null;
  /** tỷ lệ có đơn/hỏi mua: nhóm có đọc Kairos vs nhóm không đọc */
  muaCoDoc: number | null;
  muaKhongDoc: number | null;
  ttXem: number;
  ttBam: number;
  /** lượt bấm / lượt xem thẻ tài trợ */
  ctr: number | null;
  nhom: Record<NhomId, number>;
}

export function tongHop(d: DoTho): DoTongHop {
  const doc = d.khach.filter((k) => k.baiXem > 0);
  const khong = d.khach.filter((k) => k.baiXem === 0);
  const sum = (xs: DoKhach[], f: (k: DoKhach) => number) => xs.reduce((s, k) => s + f(k), 0);
  const baiXem = sum(d.khach, (k) => k.baiXem);
  const baiMo = sum(d.khach, (k) => k.baiMo);
  const ttXem = sum(d.khach, (k) => k.ttXem);
  const ttBam = sum(d.khach, (k) => k.ttBam);
  const nhom = Object.fromEntries(NHOM.map((n) => [n.id, 0])) as Record<NhomId, number>;
  for (const k of d.khach) for (const n of nhomCua(k)) nhom[n]++;
  return {
    tongKhach: d.tongKhach,
    hoatDong: d.khach.length,
    nguoiDoc: doc.length,
    tyLeDoc: tyLe(doc.length, d.khach.length),
    baiXem,
    baiMo,
    tyLeMo: tyLe(baiMo, baiXem),
    giayMoiBai: baiMo > 0 ? Math.round(sum(d.khach, (k) => k.giayDoc) / baiMo) : null,
    muaCoDoc: tyLe(doc.filter((k) => k.don > 0).length, doc.length),
    muaKhongDoc: tyLe(khong.filter((k) => k.don > 0).length, khong.length),
    ttXem,
    ttBam,
    ctr: tyLe(ttBam, ttXem),
    nhom,
  };
}

/** Danh sách khách của một nhóm, người "nóng" trước (bấm tài trợ → mở bài → lướt → mới mở app). */
export function khachTrongNhom(d: DoTho, nhom: NhomId): DoKhach[] {
  return d.khach
    .filter((k) => nhomCua(k).includes(nhom))
    .sort((a, b) => b.ttBam - a.ttBam || b.baiMo - a.baiMo || b.baiXem - a.baiXem || (b.lanMo ?? "").localeCompare(a.lanMo ?? ""));
}

/** Che SĐT cho người không được xem danh sách khách: 0912345678 ⇒ 0912•••678. */
export const cheSdt = (p: string) => (p.length >= 7 ? `${p.slice(0, 4)}•••${p.slice(-3)}` : "•••");

/** "12,5 %" — null ⇒ "—". */
export const phanTram = (x: number | null) =>
  x == null ? "—" : `${(Math.round(x * 1000) / 10).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} %`;
