// KAIROS — BÀI TÀI TRỢ (quảng cáo tự quản), 14 §20. THUẦN, có test (kairos-quang-cao.test.ts).
//
// Anh Long 2026-10-24: "t muốn kairos có ads". Chọn QUẢNG CÁO TỰ QUẢN, không mạng quảng cáo (AdMob/FB Audience):
//   · không SDK, không mã quảng cáo (IDFA/AAID), không theo dõi — /quyen-rieng-tu + khai báo kho vẫn đúng phần "không
//     tracking"; chỉ đổi câu "không chứa quảng cáo" ⇒ "có bài Tài trợ gắn nhãn";
//   · SDVICO tự soạn ở /quan-tri › Kairos › Tài trợ (đại lý vật tư, link Shopee tiếp thị liên kết…), lưu một ô JSON
//     `app_config.kairos_ads` — KHÔNG cần migration;
//   · KHÔNG nhắm theo người đọc (không dùng tỉnh/cảng/thói quen) — mọi người thấy cùng danh sách, xoay vòng theo hạt
//     xáo của lượt làm mới;
//   · Luật Quảng cáo 75/2025/QH15 (hiệu lực 01/01/2026): quảng cáo phải có dấu hiệu nhận biết ⇒ nhãn "Tài trợ" + tên
//     nhà tài trợ trên MỌI thẻ, không tắt được.
// Nhịp: 1 thẻ / 20 bài (sau bài thứ 5 của mỗi khối 20) — tính RIÊNG, không ăn vào 85 % tin biển (phan-phoi).

export interface QuangCao {
  id: string;
  /** tên hiện sau "Tài trợ ·" — đại lý, hãng, "Shopee" */
  nhaTaiTro: string;
  tieuDe: string;
  noiDung: string;
  /** https — ảnh kho kairos-media (tải ở quản trị) hoặc ảnh ngoài */
  anh: string | null;
  /** https — trang đích (shop, link tiếp thị liên kết) */
  link: string;
  /** chữ nút, ≤ 2 chữ (luật nhãn) */
  nut: string;
  bat: boolean;
  /** ISO — null = chạy ngay / không hết hạn */
  tu: string | null;
  den: string | null;
}

export const QC_TRAN = { soLuong: 20, nhaTaiTro: 40, tieuDe: 80, noiDung: 200, link: 500, nut: 2 } as const;
/** Một thẻ Tài trợ cho mỗi chừng này bài. */
export const QC_MOI = 20;
/** Vị trí trong khối (0-based): sau bài thứ 5 — không chen vào bài đầu tiên bà con thấy. */
export const QC_VI_TRI = 4;
/** Nút mặc định khi để trống. */
export const QC_NUT_MAC_DINH = "Xem ngay";

const ID_RE = /^[a-z0-9-]{4,40}$/;
const len = (s: string) => [...s].length;

function httpsUrl(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s || s.length > max) return null;
  try {
    const u = new URL(s);
    return u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

function isoOrNull(v: unknown): string | null | undefined {
  if (v == null || v === "") return null;
  if (typeof v !== "string") return undefined;
  const t = Date.parse(v);
  return Number.isFinite(t) ? new Date(t).toISOString() : undefined;
}

const chu = (v: unknown, max: number): string | null => {
  if (typeof v !== "string") return null;
  const s = v.replace(/\s+/g, " ").trim();
  return s && len(s) <= max ? s : null;
};

/**
 * Kiểm danh sách quản trị gửi lên (ranh giới). Một dòng sai ⇒ cả lượt bị từ chối kèm câu nói dòng nào sai gì —
 * không ghi nửa vời.
 */
export function kiemDanhSach(raw: unknown): { ok: true; value: QuangCao[] } | { ok: false; loi: string } {
  if (!Array.isArray(raw)) return { ok: false, loi: "Dữ liệu không phải danh sách." };
  if (raw.length > QC_TRAN.soLuong) return { ok: false, loi: `Tối đa ${QC_TRAN.soLuong} bài tài trợ.` };
  const out: QuangCao[] = [];
  const ids = new Set<string>();
  for (let i = 0; i < raw.length; i++) {
    const x = raw[i] as Record<string, unknown> | null;
    const sai = (why: string) => ({ ok: false as const, loi: `Bài ${i + 1}: ${why}` });
    if (!x || typeof x !== "object") return sai("hỏng.");
    const id = typeof x.id === "string" ? x.id : "";
    if (!ID_RE.test(id) || ids.has(id)) return sai("mã bài sai hoặc trùng.");
    ids.add(id);
    const nhaTaiTro = chu(x.nhaTaiTro, QC_TRAN.nhaTaiTro);
    if (!nhaTaiTro) return sai(`thiếu tên nhà tài trợ (≤ ${QC_TRAN.nhaTaiTro} ký tự).`);
    const tieuDe = chu(x.tieuDe, QC_TRAN.tieuDe);
    if (!tieuDe) return sai(`thiếu tiêu đề (≤ ${QC_TRAN.tieuDe} ký tự).`);
    const noiDung = x.noiDung == null || x.noiDung === "" ? "" : chu(x.noiDung, QC_TRAN.noiDung);
    if (noiDung == null) return sai(`nội dung quá ${QC_TRAN.noiDung} ký tự.`);
    const link = httpsUrl(x.link, QC_TRAN.link);
    if (!link) return sai("đường dẫn phải bắt đầu bằng https://");
    const anh = x.anh == null || x.anh === "" ? null : httpsUrl(x.anh, QC_TRAN.link);
    if (x.anh && !anh) return sai("ảnh phải là đường dẫn https://");
    const nutRaw = x.nut == null || x.nut === "" ? QC_NUT_MAC_DINH : chu(x.nut, 20);
    if (!nutRaw || nutRaw.split(" ").length > QC_TRAN.nut) return sai("chữ nút tối đa 2 chữ.");
    const tu = isoOrNull(x.tu);
    const den = isoOrNull(x.den);
    if (tu === undefined || den === undefined) return sai("ngày bắt đầu/kết thúc sai.");
    if (tu && den && Date.parse(den) <= Date.parse(tu)) return sai("ngày kết thúc phải sau ngày bắt đầu.");
    out.push({ id, nhaTaiTro, tieuDe, noiDung, anh, link, nut: nutRaw, bat: x.bat !== false, tu, den });
  }
  return { ok: true, value: out };
}

/** Đọc ô `app_config.kairos_ads` — hỏng / trống ⇒ [] (quảng cáo không bao giờ được làm hỏng dòng tin). */
export function docOCauHinh(raw: string | null | undefined): QuangCao[] {
  if (!raw) return [];
  try {
    const r = kiemDanhSach(JSON.parse(raw));
    return r.ok ? r.value : [];
  } catch {
    return [];
  }
}

/** Bài đang chạy lúc `now`: bật + trong khoảng ngày. */
export function dangChay(list: readonly QuangCao[], now: number): QuangCao[] {
  return list.filter((q) => q.bat && (!q.tu || Date.parse(q.tu) <= now) && (!q.den || Date.parse(q.den) > now));
}

/**
 * Thứ tự xoay vòng cho một lượt làm mới: dịch vòng theo hạt (không hạt ⇒ thứ tự gốc). Mọi người cùng danh sách —
 * KHÔNG nhắm theo người đọc; chỉ chỗ bắt đầu đổi để bài tài trợ thứ 2, 3 cũng được thấy.
 */
export function xoayVong<T>(list: readonly T[], hat: number | undefined): T[] {
  if (list.length < 2 || hat == null) return [...list];
  const k = hat % list.length;
  return [...list.slice(k), ...list.slice(0, k)];
}

/** Dạng gửi về app (bỏ cờ quản trị). */
export type TheTaiTro = Pick<QuangCao, "id" | "nhaTaiTro" | "tieuDe" | "noiDung" | "anh" | "link" | "nut">;

export const raApp = (q: QuangCao): TheTaiTro => ({
  id: q.id, nhaTaiTro: q.nhaTaiTro, tieuDe: q.tieuDe, noiDung: q.noiDung, anh: q.anh, link: q.link, nut: q.nut,
});

/** App đọc `ads` trong phản hồi dòng tin — dòng nào sai hình dạng thì bỏ (không tin máy chủ mù quáng). */
export function docTheTaiTro(raw: unknown): TheTaiTro[] {
  if (!Array.isArray(raw)) return [];
  const r = kiemDanhSach(raw.slice(0, QC_TRAN.soLuong).map((x) => ({ ...(x as object), bat: true })));
  return r.ok ? r.value.map(raApp) : [];
}

/** Sau bài thứ `i` (0-based) của dòng tin có chen thẻ tài trợ không — và thẻ thứ mấy. */
export function theSauBai(i: number, soThe: number): number | null {
  if (soThe <= 0 || i % QC_MOI !== QC_VI_TRI) return null;
  return Math.floor(i / QC_MOI) % soThe;
}

/** Mã bài tài trợ mới cho màn quản trị. */
export const maMoi = (now: number, r: number) => `tt-${now.toString(36)}-${Math.floor(r * 1e6).toString(36)}`.slice(0, 40);
