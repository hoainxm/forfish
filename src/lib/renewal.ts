// SDFish → CRM (DB chung exueouggmbjtjvsvpfya): gửi/tra YÊU CẦU GIA HẠN S-Tracking
// qua edge function `sdfish-renewal`. Yêu cầu vào ĐÚNG pipeline gia hạn hiện có
// của crm-sdvico-40; nhân viên đối soát + duyệt → trigger đổ sang trang "Quản lý
// gia hạn" của cskh-tasker-hub. Contract: docs/contracts/stracking-renewal.contract.md.
//
// Phần GỌI MẠNG chỉ chạy server (đọc env server-only); mọi lỗi trả `null` (app
// phải chạy được khi mất sóng — KHÔNG throw). Phần THUẦN (kỳ hạn, nhãn trạng
// thái) test được, dùng chung client + server.

import { timeoutSignal } from "@/lib/abort";

const CRM_URL = process.env.SDWORK_SUPABASE_URL ?? "";
const CRM_SECRET = process.env.SDFISH_RENEWAL_SECRET ?? "";

export function isRenewalConfigured(): boolean {
  return Boolean(CRM_URL && CRM_SECRET);
}

/** Kỳ hạn gia hạn cho SDFish CHỈ 3 mốc cố định (chủ dự án chốt). */
export const RENEWAL_MONTH_OPTIONS = [3, 6, 12] as const;
export type RenewalMonths = (typeof RENEWAL_MONTH_OPTIONS)[number];

/** Giá THAM KHẢO/tháng — CHỈ để HIỂN THỊ khi lấy giá live lỗi (bà con vẫn thấy
 *  con số thay vì "chưa lấy được giá"). Giá tính tiền THẬT luôn lấy từ server
 *  (bảng stracking_pricing_rules) lúc tạo yêu cầu — không dùng hằng này.
 *  nợ: khớp với đơn giá S-Tracking bên crm; nâng cấp khi giá đổi hoặc khi có
 *  cách đọc giá offline đáng tin. */
export const RENEWAL_FALLBACK_MONTHLY_PRICE = 385000;

/** THUẦN — chặn số tháng lạ từ body/UI (chỉ 3/6/12). */
export function isValidRenewalMonths(n: unknown): n is RenewalMonths {
  return (
    typeof n === "number" &&
    (RENEWAL_MONTH_OPTIONS as readonly number[]).includes(n)
  );
}

/** THUẦN — nhãn kỳ hạn tiếng Việt ("3 tháng", "6 tháng", "1 năm"). */
export function renewalMonthsLabel(n: number): string {
  return n === 12 ? "1 năm" : `${n} tháng`;
}

/** THUẦN — tổng tiền = số tháng × đơn giá/tháng. */
export function renewalTotal(months: number, monthlyPrice: number): number {
  return months * monthlyPrice;
}

// ── Trạng thái yêu cầu (khớp enum stracking_renewal_status phía DB chung) ──
export type RenewalStatus =
  | "draft"
  | "pending_payment"
  | "pending_extension"
  | "extended"
  | "cancelled"
  | "expired"
  | (string & {});

export interface RenewalStatusView {
  label: string;
  tone: "ok" | "warn" | "danger" | "neutral";
}

/**
 * THUẦN — trạng thái DB → dòng chữ + màu cho bà con đọc. Giọng nói THẬT:
 * "đã nhận tiền, chờ gia hạn" (không kỹ thuật). Giá trị lạ → "đang xử lý".
 */
export function renewalStatusView(status: RenewalStatus): RenewalStatusView {
  switch (status) {
    case "pending_payment":
      return { label: "Chờ chuyển khoản", tone: "warn" };
    case "pending_extension":
      return { label: "Đã nhận tiền, chờ gia hạn", tone: "warn" };
    case "extended":
      // Chưa đối chiếu S-Tracking — xem renewalExtendedView (SDVICO báo ≠ xong thật).
      return { label: "SDVICO báo đã gia hạn", tone: "ok" };
    case "cancelled":
      return { label: "Đã hủy", tone: "neutral" };
    case "expired":
      return { label: "Hết hạn mã QR", tone: "neutral" };
    case "draft":
      return { label: "Đang tạo", tone: "neutral" };
    default:
      return { label: "Đang xử lý", tone: "neutral" };
  }
}

// ── Kiểu dữ liệu trả về từ edge function ──────────────────────────────────
export interface RenewalBank {
  bankName: string;
  accountNumber: string;
  accountName: string;
  binCode: string;
}

export interface RenewalCreateResult {
  requestCode: string;
  status: RenewalStatus;
  vesselCode: string;
  monthsCount: number;
  monthlyPrice: number;
  totalAmount: number;
  transferNote: string;
  qrUrl: string;
  qrExpiresAt: string;
  currentExpiry: string | null;
  bank: RenewalBank;
}

export interface RenewalRequestSummary {
  /** SDFish tự gắn ở /api/renewal/mine (không phải từ edge fn): đối chiếu hạn S-Tracking khi `extended`. */
  xacNhanST?: XacNhanST | null;
  requestCode: string;
  status: RenewalStatus;
  totalAmount: number;
  transferNote: string;
  qrUrl: string | null;
  qrExpiresAt: string | null;
  createdAt: string | null;
  paidAt: string | null;
  extendedAt: string | null;
  vesselCode: string | null;
  monthsCount: number | null;
  newExpiryDate: string | null;
  /** Serial máy S-Tracking của yêu cầu — KHOÁ ghép yêu cầu ↔ máy (edge fn từ 2026-11-05; bản cũ không có). */
  serialNumber?: string | null;
  /** Hạn S-Tracking lúc tạo yêu cầu (mốc tính hạn mong đợi; edge fn từ 2026-11-05). */
  currentExpiryDate?: string | null;
}

/** Gọi edge function sdfish-renewal — SERVER-ONLY, timeout mặc định 15s, mọi lỗi → null. */
async function callRenewal<T>(
  payload: Record<string, unknown>,
  timeoutMs = 15000,
): Promise<T | null> {
  if (!isRenewalConfigured()) return null;
  try {
    const r = await fetch(`${CRM_URL}/functions/v1/sdfish-renewal`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // KHÔNG gửi apikey/Authorization: function chạy verify_jwt=false, mà anon key
        // của project là định dạng mới `sb_publishable_…` — cổng Kong TỪ CHỐI nó khi
        // gửi làm apikey (401 "Invalid API key") TRƯỚC khi tới function (đã đo thật
        // 2026-08-21). Gác thật là shared secret `x-sdfish-secret`.
        "x-sdfish-secret": CRM_SECRET,
      },
      body: JSON.stringify(payload),
      signal: timeoutSignal(timeoutMs),
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { ok?: boolean } & T;
    return j?.ok ? j : null;
  } catch {
    return null;
  }
}

export interface RenewalCreateInput {
  /** SĐT đã XÁC THỰC ở cổng chuỗi — KHÔNG lấy từ body máy khách. */
  phone: string;
  name: string;
  /** Mã tàu / số đăng ký = vessel_code phía S-Tracking. */
  maTau: string;
  ownerName?: string;
  serial?: string;
  imei?: string;
  /** Hạn hiện tại trên S-Tracking (YYYY-MM-DD) — mốc để tự xác nhận khi hạn đổi. */
  currentExpiry?: string | null;
  monthsCount: RenewalMonths;
}

/** Tạo 1 yêu cầu gia hạn + sinh QR. Trả `null` khi chưa cấu hình / CRM lỗi. */
export async function createRenewalRequest(
  input: RenewalCreateInput,
): Promise<RenewalCreateResult | null> {
  return callRenewal<RenewalCreateResult>({
    action: "create",
    phone: input.phone,
    name: input.name,
    monthsCount: input.monthsCount,
    vessel: {
      maTau: input.maTau,
      ownerName: input.ownerName,
      serial: input.serial,
      imei: input.imei,
      currentExpiry: input.currentExpiry ?? undefined,
    },
  });
}

/** Liệt kê yêu cầu gia hạn của 1 SĐT (màn theo dõi trạng thái). */
export async function listRenewalRequests(
  phone: string,
  timeoutMs?: number,
): Promise<RenewalRequestSummary[] | null> {
  const j = await callRenewal<{ requests: RenewalRequestSummary[] }>(
    { action: "list", phone },
    timeoutMs,
  );
  return j?.requests ?? null;
}

/** Đơn giá/tháng hiện hành (để hiện tổng tiền TRƯỚC khi tạo yêu cầu). null = lỗi. */
export async function getRenewalMonthlyPrice(): Promise<number | null> {
  const j = await callRenewal<{ monthlyPrice: number }>({ action: "price" });
  return j?.monthlyPrice ?? null;
}

// ── Gia hạn theo SERIAL máy S-Tracking (2026-11-05) ────────────────────────
// Anh Long: "đơn giản hơn, hiệu quả hơn, tránh để nhầm info, cái đích cuối là gia hạn, đóng tiền, đổi hạn".
// MỘT khoá: serial máy trên S-Tracking (stracking_thiet_bi, máy GPU đồng bộ 4 lần/ngày). Bà con thấy 3 bước:
//   ① Chờ chuyển khoản → ② Đã nhận tiền, đang gia hạn → ③ Hạn mới (CHỈ khi S-Tracking đổi hạn của ĐÚNG máy).
// CRM `extended` (nhân viên bấm) CHƯA là bước 3. Hệ thống tự đóng yêu cầu khi thấy hạn đổi (cron
// xac-nhan-gia-han → edge fn `confirm`) — nhân viên chỉ đối soát tiền + gia hạn trên stracking.viettel.io.

/** THUẦN — mã tàu so khớp: bỏ khoảng trắng, chữ hoa. Chỉ dùng khi yêu cầu cũ không có serial. */
export function chuanMaTau(s: string | null | undefined): string {
  return (s ?? "").replace(/\s+/g, "").toUpperCase();
}

/** Dung sai ngày khi so hạn S-Tracking với hạn mong đợi (cách tính tháng/ngày chốt kỳ của Viettel). */
export const XAC_NHAN_DUNG_SAI_NGAY = 3;
/** Đã nhận tiền / SDVICO báo xong quá ngần này mà S-Tracking chưa đổi ⇒ LỆCH, bà con gọi SDVICO. */
export const XAC_NHAN_TRE_GIO = 48;
/** Bước 3 "đã đổi hạn" còn hiện ngần này ngày sau khi xong, rồi thôi (dòng hạn đã ghi ngày mới). */
export const XONG_HIEN_NGAY = 7;

const NGAY_MS = 86_400_000;

function congNgay(iso: string, ngay: number): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + ngay);
  return d.toISOString().slice(0, 10);
}
function congThang(iso: string, thang: number): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + thang);
  return d.toISOString().slice(0, 10);
}
/** Ngày theo giờ VN (UTC+7) của một mốc ISO; lạ ⇒ null. */
function ngayVnCua(iso: string | null | undefined): string | null {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t) ? new Date(t + 7 * 3600_000).toISOString().slice(0, 10) : null;
}

/**
 * THUẦN — hạn TỐI THIỂU S-Tracking phải có sau khi gia hạn: (hạn cũ còn dài thì từ hạn cũ, đã quá hạn thì
 * từ ngày nhận tiền) + số tháng. `newExpiryDate` nhân viên ghi thì dùng luôn. Thiếu dữ liệu ⇒ null.
 */
export function hanMongDoi(r: {
  newExpiryDate?: string | null;
  currentExpiryDate?: string | null;
  paidAt?: string | null;
  extendedAt?: string | null;
  monthsCount?: number | null;
}): string | null {
  if (r.newExpiryDate) return r.newExpiryDate.slice(0, 10);
  if (!r.monthsCount) return null;
  const tu = ngayVnCua(r.paidAt) ?? ngayVnCua(r.extendedAt);
  const cu = r.currentExpiryDate?.slice(0, 10) ?? null;
  const goc = cu && tu ? (cu > tu ? cu : tu) : (cu ?? tu);
  return goc ? congThang(goc, r.monthsCount) : null;
}

/**
 * THUẦN — hạn S-Tracking `hetHanST` đã đủ để coi là ĐÃ ĐỔI HẠN chưa: ≥ mong đợi − dung sai, và (biết hạn cũ thì)
 * phải LỚN HƠN hạn cũ. Không tính được mong đợi ⇒ false (không đoán).
 */
export function daDoiHan(
  r: Parameters<typeof hanMongDoi>[0],
  hetHanST: string | null | undefined,
): boolean {
  if (!hetHanST) return false;
  const st = hetHanST.slice(0, 10);
  const cu = r.currentExpiryDate?.slice(0, 10);
  if (cu && st <= cu) return false;
  const mong = hanMongDoi(r);
  return !!mong && st >= congNgay(mong, -XAC_NHAN_DUNG_SAI_NGAY);
}

export type XacNhanST = "da-xac-nhan" | "cho-xac-nhan" | "lech" | "khong-doi-chieu";

/**
 * THUẦN — đối chiếu yêu cầu `extended` với hạn S-Tracking của đúng máy. `undefined` = không ghép được máy
 * (yêu cầu cũ/không có trên S-Tracking của SĐT) ⇒ "khong-doi-chieu". Trạng thái khác `extended` ⇒ null.
 */
export function xacNhanGiaHan(
  r: RenewalRequestSummary,
  hetHanST: string | null | undefined,
  nowMs: number,
): XacNhanST | null {
  if (r.status !== "extended") return null;
  if (hetHanST === undefined) return "khong-doi-chieu";
  if (daDoiHan(r, hetHanST)) return "da-xac-nhan";
  const luc = r.extendedAt ? Date.parse(r.extendedAt) : NaN;
  if (Number.isFinite(luc) && nowMs - luc > XAC_NHAN_TRE_GIO * 3600_000) return "lech";
  return "cho-xac-nhan";
}

/** Máy S-Tracking để ghép yêu cầu. `tenTrung` = trong máy CỦA SĐT này có máy khác cùng tên ⇒ cấm ghép theo tên. */
export interface MayGhep {
  serial: string;
  tenTau: string | null;
  tenTrung: boolean;
}

/** THUẦN — yêu cầu thuộc máy này? Có serial ⇒ so serial (chắc chắn). Yêu cầu cũ chưa có serial ⇒ so tên, CHỈ khi tên không trùng. */
export function laYeuCauCuaMay(r: RenewalRequestSummary, m: MayGhep): boolean {
  if (r.serialNumber) return r.serialNumber === m.serial;
  if (m.tenTrung) return false;
  const ma = chuanMaTau(m.tenTau);
  return !!ma && chuanMaTau(r.vesselCode) === ma;
}

/** THUẦN — đánh dấu tên trùng trong danh sách máy của một SĐT. */
export function danhDauTenTrung<T extends { serial: string; tenTau: string | null }>(ds: readonly T[]): (T & { tenTrung: boolean })[] {
  const dem = new Map<string, number>();
  for (const m of ds) {
    const k = chuanMaTau(m.tenTau);
    if (k) dem.set(k, (dem.get(k) ?? 0) + 1);
  }
  return ds.map((m) => ({ ...m, tenTrung: (dem.get(chuanMaTau(m.tenTau)) ?? 0) > 1 }));
}

/** 3 bước bà con thấy: 1 chờ CK · 2 đã nhận tiền/đang gia hạn (kể cả SDVICO báo xong mà hạn chưa đổi) · 3 đã đổi hạn. */
export type GiaHanTauLoai = "cho-ck" | "dang-gia-han" | "lech" | "xong";
export interface GiaHanTau {
  loai: GiaHanTauLoai;
  buoc: 1 | 2 | 3;
  requestCode: string;
  /** Hạn S-Tracking phải đạt (bước 2/lệch) hoặc hạn mới (bước 3); null = không tính được. */
  hanMoi: string | null;
}

/**
 * THUẦN — yêu cầu gần nhất của MỘT máy → bước hiện tại (danh sách `list` đã mới trước). null = không có gì để báo.
 * - pending_payment còn hạn QR → bước 1 · hết hạn QR → không có.
 * - pending_extension / extended mà S-Tracking chưa đổi hạn → bước 2; quá 48 giờ kể từ lúc nhận tiền
 *   (hoặc lúc SDVICO báo xong) → "lech".
 * - S-Tracking đã đổi hạn (bất kể CRM đang ở pending_extension hay extended) → bước 3, hiện 7 ngày.
 * - cancelled/expired/draft/lạ → không có.
 */
export function giaHanCuaTau(
  requests: readonly RenewalRequestSummary[],
  may: MayGhep,
  hetHanST: string | null,
  nowMs: number,
): GiaHanTau | null {
  const r = requests.find((x) => laYeuCauCuaMay(x, may));
  if (!r) return null;
  const base = { requestCode: r.requestCode };
  if (r.status === "pending_payment") {
    const het = r.qrExpiresAt ? Date.parse(r.qrExpiresAt) : NaN;
    if (Number.isFinite(het) && het <= nowMs) return null;
    return { ...base, loai: "cho-ck", buoc: 1, hanMoi: null };
  }
  if (r.status !== "pending_extension" && r.status !== "extended") return null;
  if (daDoiHan(r, hetHanST)) {
    const moc = Date.parse(r.extendedAt ?? r.paidAt ?? "");
    if (Number.isFinite(moc) && nowMs - moc > XONG_HIEN_NGAY * NGAY_MS) return null;
    return { ...base, loai: "xong", buoc: 3, hanMoi: hetHanST!.slice(0, 10) };
  }
  const tu = Date.parse((r.status === "extended" ? r.extendedAt : r.paidAt) ?? "");
  const tre = Number.isFinite(tu) && nowMs - tu > XAC_NHAN_TRE_GIO * 3600_000;
  return { ...base, loai: tre ? "lech" : "dang-gia-han", buoc: 2, hanMoi: hanMongDoi(r) };
}

/** THUẦN — máy còn yêu cầu CHƯA XONG (bước 1/2/lệch) ⇒ CHẶN tạo thêm, không trả tiền hai lần. */
export function yeuCauDangMo(
  requests: readonly RenewalRequestSummary[],
  may: MayGhep,
  hetHanST: string | null,
  nowMs: number,
): RenewalRequestSummary | null {
  const g = giaHanCuaTau(requests, may, hetHanST, nowMs);
  if (!g || g.loai === "xong") return null;
  return requests.find((x) => x.requestCode === g.requestCode) ?? null;
}

/** THUẦN — nhãn màn "Yêu cầu" cho yêu cầu `extended`, theo đối chiếu S-Tracking. */
export function renewalExtendedView(x: XacNhanST | null | undefined): RenewalStatusView {
  if (x === "da-xac-nhan") return { label: "Đã đổi hạn trên hệ thống", tone: "ok" };
  if (x === "cho-xac-nhan") return { label: "Đang chờ hệ thống đổi hạn", tone: "warn" };
  if (x === "lech") return { label: "Hạn chưa đổi · gọi SDVICO", tone: "danger" };
  return { label: "SDVICO báo đã gia hạn", tone: "ok" };
}

// ── Tự đóng yêu cầu khi S-Tracking đổi hạn (cron xac-nhan-gia-han → edge fn) ──
/** Yêu cầu SDFish đã nhận tiền, chờ đổi hạn (edge fn action `pending`). */
export interface RenewalPending {
  requestCode: string;
  phone: string;
  serialNumber: string | null;
  vesselCode: string | null;
  monthsCount: number | null;
  currentExpiryDate: string | null;
  paidAt: string | null;
}

/** Danh sách yêu cầu `pending_extension` của SDFish. null = lỗi/chưa cấu hình. */
export async function listPendingExtensions(): Promise<RenewalPending[] | null> {
  const j = await callRenewal<{ requests: RenewalPending[] }>({ action: "pending" });
  return j?.requests ?? null;
}

/** Đóng 1 yêu cầu: S-Tracking đã đổi hạn của đúng serial. Edge fn tự kiểm lại trạng thái + serial. */
export async function confirmFromStracking(input: {
  requestCode: string;
  serialNumber: string;
  newExpiryDate: string;
}): Promise<boolean> {
  const j = await callRenewal<{ requestCode: string }>({ action: "confirm", ...input });
  return !!j;
}

export interface TauStrackingRow {
  serial: string;
  imei?: string | null;
  ten_tau: string | null;
  chu_tau: string | null;
  het_han?: string | null;
}

export interface DongYeuCau {
  requestCode: string;
  serialNumber: string;
  newExpiryDate: string;
  phone: string;
  tenTau: string | null;
}

/**
 * THUẦN — yêu cầu nào ĐÓNG được: có serial, máy đó có trên S-Tracking, và hạn S-Tracking đã đổi (`daDoiHan`).
 * Yêu cầu thiếu serial (tạo trước 2026-11-05) KHÔNG đoán theo tên — để nhân viên đóng tay.
 */
export function chonYeuCauDong(
  pending: readonly RenewalPending[],
  mayTheoSerial: ReadonlyMap<string, { het_han: string | null; ten_tau: string | null }>,
): DongYeuCau[] {
  const ra: DongYeuCau[] = [];
  for (const p of pending) {
    if (!p.serialNumber) continue;
    const m = mayTheoSerial.get(p.serialNumber);
    if (!m?.het_han || !daDoiHan(p, m.het_han)) continue;
    ra.push({
      requestCode: p.requestCode,
      serialNumber: p.serialNumber,
      newExpiryDate: m.het_han.slice(0, 10),
      phone: p.phone,
      tenTau: m.ten_tau ?? p.vesselCode,
    });
  }
  return ra;
}
