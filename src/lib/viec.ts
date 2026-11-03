// VIỆC LÀM (spec docs/app-map/17-ba-spec-vai-tai-khoan.md §6) — logic THUẦN, dùng chung route / màn / test.
//
// Hai chiều, liên hệ thẳng (Gọi/Zalo — không nhắn trong app): chủ tàu đăng TIN TUYỂN (`job_posts`), bạn thuyền đăng
// HỒ SƠ TÌM TÀU (`job_seekers`, một SĐT một hồ sơ). Trần ở đây khớp từng số với check của migration 0079 — route kiểm
// trước khi chạm DB, nên gọi thẳng route (bỏ qua app) vẫn bị chặn với câu tiếng Việt thay vì lỗi Postgres.
//
// Chữ: bộ lọc Kairos (`contentFlag` — chữ bậy, chủ quyền, chống phá, link nguy hiểm) + luật CẤM THU PHÍ riêng của
// việc làm (§6.1). Độ dài đếm theo KÝ TỰ (code point) như `char_length` của Postgres.

import { NGHE, isNghe } from "@/lib/kairos/ho-so";
import { charLen, cleanText, contentFlag } from "@/lib/kairos/validate";

/* ── DANH MỤC ─────────────────────────────────────────────────────────────── */

/** Vị trí trên tàu (§6.1) — mã lưu ở `vi_tri text[]`. Thứ tự = thứ tự chip. */
export const VI_TRI = [
  { id: "thuyen-vien", name: "Thuyền viên" },
  { id: "thuyen-truong", name: "Thuyền trưởng" },
  { id: "may-truong", name: "Máy trưởng" },
  { id: "may-phu", name: "Máy phụ" },
  { id: "nau-an", name: "Nấu ăn" },
  { id: "tho-lan", name: "Thợ lặn" },
] as const;
export type ViTriId = (typeof VI_TRI)[number]["id"];

/** Giấy cần có / đang có (§6.1) — mã lưu ở `giay text[]`. */
export const GIAY = [
  { id: "cc-thuyen-truong", name: "Chứng chỉ thuyền trưởng" },
  { id: "cc-may-truong", name: "Chứng chỉ máy trưởng" },
  { id: "so-thuyen-vien", name: "Sổ thuyền viên" },
] as const;
export type GiayId = (typeof GIAY)[number]["id"];

const VI_TRI_NAME = new Map<string, string>(VI_TRI.map((v) => [v.id, v.name]));
const GIAY_NAME = new Map<string, string>(GIAY.map((g) => [g.id, g.name]));

export const isViTri = (v: unknown): v is ViTriId => typeof v === "string" && VI_TRI_NAME.has(v);
export const isGiay = (v: unknown): v is GiayId => typeof v === "string" && GIAY_NAME.has(v);
export const tenViTri = (id: string): string => VI_TRI_NAME.get(id) ?? "";
export const tenGiay = (id: string): string => GIAY_NAME.get(id) ?? "";
export { NGHE };

/* ── TRẦN (khớp migration 0079) ───────────────────────────────────────────── */

export const DAY_MS = 24 * 60 * 60 * 1000;
/** Tin tuyển tự ẩn sau 14 ngày; "Gia hạn" = thêm 14 ngày tính từ hôm nay (§6.1). */
export const HAN_TIN_MS = 14 * DAY_MS;
/** Hồ sơ không bật lại trong 30 ngày thì coi như tắt (§6.2). */
export const TAT_HO_SO_MS = 30 * DAY_MS;
/** Số tin ĐANG MỞ (mo + chưa hết hạn) tối đa mỗi SĐT (§6.1). */
export const TRAN_TIN_MO = 5;

export const TIN_LIMITS = {
  soNguoiMin: 1,
  soNguoiMax: 30,
  soNgayMin: 1,
  soNgayMax: 120,
  cong: 80,
  ghiChu: 300,
  boatReg: 30,
  viTriMax: 6,
  giayMax: 3,
} as const;

export const HO_SO_LIMITS = {
  ngheMax: 9,
  soNamMax: 50,
  viTriMax: 6,
  portsMin: 1,
  portsMax: 3,
  giayMax: 3,
  ghiChu: 150,
} as const;

/* ── LUẬT CẤM THU PHÍ (§6.1, AC6) ─────────────────────────────────────────── */

export const CAU_PHI = "Tin tuyển không được thu tiền của người đi bạn.";

/*  "phí" đứng thành chữ riêng (không bắt "phía"); "miễn phí" KHÔNG tính — đó là cho không, không phải thu tiền
    (Assumption: spec ghi "có chữ phí"; chặn cả "miễn phí ăn uống" là chặn đúng thứ có lợi cho bà con).
    Bắt cả bản gõ không dấu "dat coc", "chuyen khoan truoc" — bà con hay gõ không dấu. */
// KHÔNG dùng lookbehind (Safari cũ ném lỗi cú pháp — đã dính 2026-11, cổng CI): gỡ "miễn phí" trước rồi mới tìm.
const MIEN_PHI_RE = /miễn\s+phí/giu;
const PHI_RE = /(^|[^\p{L}])phí($|[^\p{L}])/iu;
const PHI_CUM_RE = /đặt\s*cọc|dat\s*coc|chuyển\s*khoản\s*trước|chuyen\s*khoan\s*truoc/iu;

/** Chữ có đòi tiền người đi bạn không. */
export function coThuPhi(text: string | null | undefined): boolean {
  if (!text) return false;
  const t = text.normalize("NFC").toLowerCase().replace(MIEN_PHI_RE, " ");
  return PHI_RE.test(t) || PHI_CUM_RE.test(t);
}

/* ── KIỂU DỮ LIỆU ─────────────────────────────────────────────────────────── */

export type Checked<T> = { ok: true; value: T } | { ok: false; code: string; term?: string };

/** Thân tin tuyển ĐÃ kiểm — tên cột như DB. */
export interface TinInput {
  nghe: string;
  port_id: string;
  vi_tri: string[];
  so_nguoi: number;
  ngay_di: string | null;
  so_ngay: number | null;
  cong: string | null;
  giay: string[];
  ghi_chu: string | null;
  boat_reg: string | null;
  show_boat: boolean;
}

/** Thân hồ sơ tìm tàu ĐÃ kiểm — tên cột như DB (thiếu phone/bat_luc: route điền). */
export interface HoSoInput {
  nghe: string[];
  so_nam: number | null;
  vi_tri: string[];
  ports: string[];
  giay: string[];
  san_sang: string | null;
  ghi_chu: string | null;
  dang_tim: boolean;
}

/** Tin tuyển ra client — KHÔNG SĐT (§5, §7). */
export interface ViecTin {
  id: string;
  nghe: string;
  portId: string;
  viTri: string[];
  soNguoi: number;
  ngayDi: string | null;
  soNgay: number | null;
  cong: string | null;
  giay: string[];
  ghiChu: string | null;
  /** chỉ có khi chủ tàu bật hiện số hiệu */
  boatReg: string | null;
  status: "mo" | "du" | "an";
  expiresAt: string;
  createdAt: string;
  /** người xem là chủ tin */
  cuaToi?: boolean;
}

/** Hồ sơ tìm tàu ra client — id là `kairos_profiles.id`, KHÔNG phải SĐT. */
export interface ViecHoSo {
  id: string;
  ten: string;
  nghe: string[];
  soNam: number | null;
  viTri: string[];
  ports: string[];
  giay: string[];
  sanSang: string | null;
  ghiChu: string | null;
  updatedAt: string;
}

/* ── KIỂM ĐẦU VÀO ─────────────────────────────────────────────────────────── */

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** "YYYY-MM-DD" có thật (không nhận 2026-02-30). */
export function isNgay(v: unknown): v is string {
  if (typeof v !== "string") return false;
  const m = v.match(DATE_RE);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

const isInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);

/** Danh sách mã: mảng, không trùng, mỗi mã hợp lệ, trong [min, max]. null = sai. */
function maList(raw: unknown, ok: (v: unknown) => boolean, min: number, max: number): string[] | null {
  if (raw == null) raw = [];
  if (!Array.isArray(raw)) return null;
  const out: string[] = [];
  for (const v of raw) {
    if (!ok(v)) return null;
    if (!out.includes(v as string)) out.push(v as string);
  }
  return out.length >= min && out.length <= max ? out : null;
}

/** Chữ tự do tuỳ chọn: làm sạch, rỗng ⇒ null, quá dài ⇒ "too_long". */
function chuTuyChon(raw: unknown, max: number): { ok: true; v: string | null } | { ok: false } {
  if (raw == null) return { ok: true, v: null };
  if (typeof raw !== "string") return { ok: false };
  const t = cleanText(raw);
  if (!t) return { ok: true, v: null };
  return charLen(t) <= max ? { ok: true, v: t } : { ok: false };
}

/** Số nguyên tuỳ chọn trong [min, max]; "" / null ⇒ null. */
function soTuyChon(raw: unknown, min: number, max: number): { ok: true; v: number | null } | { ok: false } {
  if (raw == null || raw === "") return { ok: true, v: null };
  return isInt(raw) && raw >= min && raw <= max ? { ok: true, v: raw } : { ok: false };
}

/**
 * Tin tuyển (tạo hoặc sửa). `portIds` = tập id cảng hợp lệ (fishing-ports). Mã lỗi:
 * bad_body · bad_nghe · bad_port · bad_vi_tri · bad_so_nguoi · bad_ngay · bad_so_ngay · bad_giay ·
 * too_long · bad_words/sovereignty/anti_state/dangerous_link (Kairos) · phi (cấm thu phí).
 */
export function validateTin(raw: unknown, ctx: { portIds: ReadonlySet<string> }): Checked<TinInput> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, code: "bad_body" };
  const r = raw as Record<string, unknown>;
  if (!isNghe(r.nghe)) return { ok: false, code: "bad_nghe" };
  if (typeof r.portId !== "string" || !ctx.portIds.has(r.portId)) return { ok: false, code: "bad_port" };
  const viTri = maList(r.viTri, isViTri, 1, TIN_LIMITS.viTriMax);
  if (!viTri) return { ok: false, code: "bad_vi_tri" };
  if (!isInt(r.soNguoi) || r.soNguoi < TIN_LIMITS.soNguoiMin || r.soNguoi > TIN_LIMITS.soNguoiMax) {
    return { ok: false, code: "bad_so_nguoi" };
  }
  const ngayDi = r.ngayDi == null || r.ngayDi === "" ? null : r.ngayDi;
  if (ngayDi !== null && !isNgay(ngayDi)) return { ok: false, code: "bad_ngay" };
  const soNgay = soTuyChon(r.soNgay, TIN_LIMITS.soNgayMin, TIN_LIMITS.soNgayMax);
  if (!soNgay.ok) return { ok: false, code: "bad_so_ngay" };
  const giay = maList(r.giay, isGiay, 0, TIN_LIMITS.giayMax);
  if (!giay) return { ok: false, code: "bad_giay" };
  const cong = chuTuyChon(r.cong, TIN_LIMITS.cong);
  const ghiChu = chuTuyChon(r.ghiChu, TIN_LIMITS.ghiChu);
  const boatReg = chuTuyChon(r.boatReg, TIN_LIMITS.boatReg);
  if (!cong.ok || !ghiChu.ok || !boatReg.ok) return { ok: false, code: "too_long" };
  if (r.showBoat != null && typeof r.showBoat !== "boolean") return { ok: false, code: "bad_body" };

  const chu = [cong.v, ghiChu.v, boatReg.v].filter(Boolean).join("\n");
  const flag = contentFlag(chu);
  if (flag) return { ok: false, code: flag.code, term: flag.term };
  if (coThuPhi(cong.v) || coThuPhi(ghiChu.v)) return { ok: false, code: "phi" };

  return {
    ok: true,
    value: {
      nghe: r.nghe,
      port_id: r.portId,
      vi_tri: viTri,
      so_nguoi: r.soNguoi,
      ngay_di: ngayDi as string | null,
      so_ngay: soNgay.v,
      cong: cong.v,
      giay,
      ghi_chu: ghiChu.v,
      boat_reg: boatReg.v,
      // không có số hiệu thì không có gì để hiện
      show_boat: r.showBoat === true && !!boatReg.v,
    },
  };
}

/**
 * Hồ sơ tìm tàu. Mã lỗi: bad_body · bad_nghe · bad_so_nam · bad_vi_tri · bad_port · bad_giay · bad_ngay ·
 * too_long · bad_words/sovereignty/anti_state/dangerous_link.
 */
export function validateHoSo(raw: unknown, ctx: { portIds: ReadonlySet<string> }): Checked<HoSoInput> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, code: "bad_body" };
  const r = raw as Record<string, unknown>;
  const nghe = maList(r.nghe, isNghe, 1, HO_SO_LIMITS.ngheMax);
  if (!nghe) return { ok: false, code: "bad_nghe" };
  const soNam = soTuyChon(r.soNam, 0, HO_SO_LIMITS.soNamMax);
  if (!soNam.ok) return { ok: false, code: "bad_so_nam" };
  const viTri = maList(r.viTri, isViTri, 1, HO_SO_LIMITS.viTriMax);
  if (!viTri) return { ok: false, code: "bad_vi_tri" };
  const ports = maList(r.ports, (v) => typeof v === "string" && ctx.portIds.has(v), HO_SO_LIMITS.portsMin, HO_SO_LIMITS.portsMax);
  if (!ports) return { ok: false, code: "bad_port" };
  const giay = maList(r.giay, isGiay, 0, HO_SO_LIMITS.giayMax);
  if (!giay) return { ok: false, code: "bad_giay" };
  const sanSang = r.sanSang == null || r.sanSang === "" ? null : r.sanSang;
  if (sanSang !== null && !isNgay(sanSang)) return { ok: false, code: "bad_ngay" };
  const ghiChu = chuTuyChon(r.ghiChu, HO_SO_LIMITS.ghiChu);
  if (!ghiChu.ok) return { ok: false, code: "too_long" };
  if (r.dangTim != null && typeof r.dangTim !== "boolean") return { ok: false, code: "bad_body" };
  const flag = ghiChu.v ? contentFlag(ghiChu.v) : null;
  if (flag) return { ok: false, code: flag.code, term: flag.term };
  return {
    ok: true,
    value: {
      nghe,
      so_nam: soNam.v,
      vi_tri: viTri,
      ports,
      giay,
      san_sang: sanSang as string | null,
      ghi_chu: ghiChu.v,
      dang_tim: r.dangTim !== false,
    },
  };
}

/** PATCH tin của mình: gia hạn · đủ người · sửa (kèm thân tin). */
export type TinPatch = { action: "gia-han" } | { action: "du-nguoi" } | { action: "sua"; tin: unknown };

export function parseTinPatch(raw: unknown): TinPatch | null {
  const a = (raw as { action?: unknown } | null)?.action;
  if (a === "gia-han" || a === "du-nguoi") return { action: a };
  if (a === "sua") return { action: "sua", tin: (raw as { tin?: unknown }).tin };
  return null;
}

/** Báo xấu: post (uuid tin) hoặc seeker (id hồ sơ = uuid kairos_profiles). Lý do ≤300, tuỳ chọn. */
export function validateBaoXau(raw: unknown): Checked<{ kind: "post" | "seeker"; id: string; reason: string | null }> {
  if (!raw || typeof raw !== "object") return { ok: false, code: "bad_body" };
  const r = raw as Record<string, unknown>;
  if (r.kind !== "post" && r.kind !== "seeker") return { ok: false, code: "bad_target" };
  if (!isUuidLike(r.id)) return { ok: false, code: "bad_target" };
  const reason = chuTuyChon(r.reason, 300);
  if (!reason.ok) return { ok: false, code: "too_long" };
  return { ok: true, value: { kind: r.kind, id: (r.id as string).toLowerCase(), reason: reason.v } };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuidLike = (v: unknown): v is string => typeof v === "string" && UUID_RE.test(v);

/* ── HẠN TIN · HỒ SƠ ──────────────────────────────────────────────────────── */

export type TrangThaiTin = "mo" | "het-han" | "du" | "an";

/** Trạng thái hiện của một tin — `mo` mà quá hạn ⇒ `het-han`. Giờ hỏng ⇒ coi như hết hạn (an toàn). */
export function trangThaiTin(t: { status: string; expiresAt: string }, now: number): TrangThaiTin {
  if (t.status === "an") return "an";
  if (t.status === "du") return "du";
  const exp = Date.parse(t.expiresAt);
  return Number.isFinite(exp) && exp > now ? "mo" : "het-han";
}

/** Hạn mới khi "Gia hạn": 14 ngày tính từ bây giờ — không cộng dồn (bấm 5 lần không thành 70 ngày). */
export function hanGiaHan(now: number): string {
  return new Date(now + HAN_TIN_MS).toISOString();
}

/** Hạn của tin mới đăng. */
export function hanTinMoi(now: number): string {
  return new Date(now + HAN_TIN_MS).toISOString();
}

/** Còn đăng/mở thêm tin được không — `dangMo` = số tin mo + chưa hết hạn của SĐT này (chưa kể tin sắp mở). */
export function conChoDangTin(dangMo: number): boolean {
  return Number.isFinite(dangMo) && dangMo >= 0 && dangMo < TRAN_TIN_MO;
}

/** Hồ sơ đang hiện trong danh sách: bật và lần bật gần nhất chưa quá 30 ngày. */
export function hoSoDangHien(s: { dang_tim: boolean; bat_luc: string }, now: number): boolean {
  if (!s.dang_tim) return false;
  const t = Date.parse(s.bat_luc);
  return Number.isFinite(t) && now - t < TAT_HO_SO_MS;
}

/** Mốc ISO: hồ sơ bật trước mốc này là đã tự tắt (lọc danh sách ở DB). */
export function mocTatHoSo(now: number): string {
  return new Date(now - TAT_HO_SO_MS).toISOString();
}

/* ── LỌC DANH SÁCH ────────────────────────────────────────────────────────── */

export interface LocViec {
  port: string | null;
  /** tên tỉnh (khuôn HomeBar "Gần <Tỉnh>") — route đổi ra danh sách cảng trong tỉnh */
  tinh: string | null;
  nghe: string | null;
  viTri: string | null;
}

/** Đọc lọc từ query. Giá trị lạ ⇒ bỏ lọc đó (không 400 — link cũ vẫn mở được danh sách). */
export function parseLoc(sp: URLSearchParams, portIds: ReadonlySet<string>): LocViec {
  const port = sp.get("port");
  const tinh = (sp.get("tinh") ?? "").trim().slice(0, 60);
  const nghe = sp.get("nghe");
  const viTri = sp.get("viTri");
  return {
    port: port && portIds.has(port) ? port : null,
    tinh: tinh || null,
    nghe: isNghe(nghe) ? nghe : null,
    viTri: isViTri(viTri) ? viTri : null,
  };
}

/** Bỏ dấu + chữ thường + bỏ chữ "tỉnh/thành phố" — so tên tỉnh giữa danh mục cảng và tỉnh nhà. */
export function khoaTinh(s: string | null | undefined): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/\b(tinh|thanh pho|tp\.?)\b/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/** Id các cảng thuộc tỉnh `tinh` trong danh mục (so theo khoaTinh). Không tỉnh nào khớp ⇒ []. */
export function cangCuaTinh(tinh: string, ports: readonly { id: string; province?: string }[]): string[] {
  const k = khoaTinh(tinh);
  if (!k) return [];
  return ports.filter((p) => khoaTinh(p.province) === k).map((p) => p.id);
}

/* ── BẢN LƯU TRONG MÁY (§6.4 — mất sóng) ──────────────────────────────────── */

/** Bản lưu danh sách tin (mất sóng vẫn xem + Gọi). */
export const VIEC_KEY = "forfish.viec.v1";
/** Tin đã lưu để gọi sau (máy). */
export const VIEC_LUU_KEY = "forfish.viec.luu.v1";
/** Nháp tin đang đăng/sửa (mất sóng giữ chữ). */
export const VIEC_NHAP_KEY = "forfish.viec.nhap.v1";

export const CACHE_MAX_TIN = 100;
export const CACHE_MAX_BYTES = 200 * 1024;
export const LUU_MAX = 50;
/*  Bản lưu danh sách — CHỈ để vẽ ngay lúc mở màn (rồi tải lại). KHÔNG giữ SĐT: anh Long 03/11 *"vai chủ tàu mới cần
    offline, các vai khác thì đều đang online"* ⇒ Gọi luôn hỏi máy chủ, máy không cất số của người khác. Bản lưu cũ có
    trường `sdt` (bản build đầu 03/11, chưa phát hành) bị bỏ qua khi đọc và mất ở lần ghi kế. */
export interface ViecCache {
  luc: number;
  tin: ViecTin[];
}

function laTin(v: unknown): v is ViecTin {
  if (!v || typeof v !== "object") return false;
  const t = v as Record<string, unknown>;
  return (
    typeof t.id === "string" &&
    typeof t.nghe === "string" &&
    typeof t.portId === "string" &&
    Array.isArray(t.viTri) &&
    typeof t.soNguoi === "number" &&
    typeof t.expiresAt === "string"
  );
}

/** Đọc bản lưu; hỏng / lạ ⇒ null (không ném). */
export function parseCache(raw: string | null | undefined): ViecCache | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as Partial<ViecCache> | null;
    if (!o || typeof o.luc !== "number" || !Array.isArray(o.tin)) return null;
    return { luc: o.luc, tin: o.tin.filter(laTin).slice(0, CACHE_MAX_TIN) };
  } catch {
    return null;
  }
}

/** Chuỗi để ghi: ≤100 tin, ≤200 KB (cắt bớt tin cuối tới khi vừa). */
export function serializeCache(tin: readonly ViecTin[], luc: number): string {
  let list = tin.slice(0, CACHE_MAX_TIN);
  const build = () => JSON.stringify({ luc, tin: list } satisfies ViecCache);
  let s = build();
  while (byteLen(s) > CACHE_MAX_BYTES && list.length > 0) {
    list = list.slice(0, Math.max(0, Math.floor(list.length * 0.8)));
    s = build();
  }
  return s;
}

/** Byte UTF-8 (chữ Việt có dấu 2–3 byte). */
export function byteLen(s: string): number {
  return new TextEncoder().encode(s).length;
}

/** Tin đã lưu: đọc. Hỏng ⇒ []. */
export function parseLuu(raw: string | null | undefined): ViecTin[] {
  if (!raw) return [];
  try {
    const o = JSON.parse(raw) as unknown;
    return Array.isArray(o) ? o.filter(laTin).slice(0, LUU_MAX) : [];
  } catch {
    return [];
  }
}

/** Bật/tắt lưu một tin; tin mới lên đầu; ≤50 (bỏ tin cũ nhất). */
export function toggleLuu(list: readonly ViecTin[], tin: ViecTin): ViecTin[] {
  if (list.some((t) => t.id === tin.id)) return list.filter((t) => t.id !== tin.id);
  return [tin, ...list].slice(0, LUU_MAX);
}

/* ── CÂU CHO BÀ CON ───────────────────────────────────────────────────────── */

const CAU: Record<string, string> = {
  phi: CAU_PHI,
  vai: "Chỉ tài khoản Chủ tàu mới đăng được tin tuyển.",
  tran: `Mỗi số chỉ mở được ${TRAN_TIN_MO} tin cùng lúc — đóng bớt tin cũ trước.`,
  bad_words: "Có chữ không phù hợp — bà con sửa lại nhé.",
  sovereignty: "Có chữ gọi sai tên Biển Đông hoặc quần đảo của Việt Nam — bà con sửa lại nhé.",
  anti_state: "Có nội dung chống phá Nhà nước, không đăng được.",
  dangerous_link: "Có đường link không an toàn — bỏ link rồi đăng lại.",
  too_long: "Chữ dài quá — bà con viết ngắn lại.",
  bad_nghe: "Bà con chọn nghề.",
  bad_port: "Bà con chọn cảng.",
  bad_vi_tri: "Bà con chọn vị trí cần.",
  bad_so_nguoi: `Số người từ ${TIN_LIMITS.soNguoiMin} đến ${TIN_LIMITS.soNguoiMax}.`,
  bad_so_ngay: `Chuyến dài từ ${TIN_LIMITS.soNgayMin} đến ${TIN_LIMITS.soNgayMax} ngày.`,
  bad_so_nam: `Số năm đi biển từ 0 đến ${HO_SO_LIMITS.soNamMax}.`,
  bad_ngay: "Ngày chưa đúng.",
  bad_giay: "Giấy chọn chưa đúng.",
  banned: "Tài khoản đang bị tạm cấm đăng.",
  an: "Tin này đang bị ẩn vì có người báo xấu — chờ người trực xem.",
  not_found: "Không tìm thấy — có thể tin đã đóng.",
  self: "Không báo xấu tin của chính mình được.",
  rate_limited: "Bà con thao tác nhanh quá — chờ chút rồi thử lại.",
  unavailable: "Máy chủ chưa sẵn sàng — thử lại sau.",
  no_token: "Cần đăng nhập.",
};

/** Câu tiếng Việt cho mã lỗi route; lạ ⇒ câu chung. */
export function cauLoi(code: string | null | undefined): string {
  return (code && CAU[code]) || "Chưa làm được — thử lại.";
}
