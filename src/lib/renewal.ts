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

// ── Hứng luồng gia hạn từ thẻ S-Tracking (2026-11-05) ──────────────────────
// Máy chủ SDFish đã có hạn cước THẬT (bảng stracking_thiet_bi, máy GPU đồng bộ)
// ⇒ (1) không tin serial/chủ tàu từ máy khách khi tàu có trên S-Tracking của
// đúng SĐT phiên, (2) không tạo yêu cầu TRÙNG khi tàu đã có yêu cầu đang mở,
// (3) thẻ "máy của tôi" hiện yêu cầu gia hạn đang chạy của từng tàu.

/** THUẦN — mã tàu so khớp: bỏ khoảng trắng, chữ hoa ("bv 1234-ts" ≡ "BV-1234-TS" khi gõ khác cách). */
export function chuanMaTau(s: string | null | undefined): string {
  return (s ?? "").replace(/\s+/g, "").toUpperCase();
}

// ── "Đã gia hạn" CHỈ KHI S-Tracking xác nhận (anh Long 2026-11-05) ──
// "nếu gia hạn thì phải vô kiểm tra xem cái info trên hệ thống s tracking đã đổi chưa? chứ ko phải
// sdvico nhận tiền báo đã gia hạn là ghi nhận". CRM `extended` = SDVICO BÁO đã gia hạn; xong thật khi
// hạn cước trên S-Tracking (stracking_thiet_bi.het_han, máy GPU kéo về 4 lần/ngày) đã lùi tới mốc mới.

/** Dung sai ngày khi so hạn S-Tracking với hạn mong đợi (lệch cách tính tháng/ngày chốt kỳ của Viettel). */
export const XAC_NHAN_DUNG_SAI_NGAY = 3;
/** CRM báo đã gia hạn quá ngần này mà S-Tracking chưa đổi ⇒ LỆCH, bà con gọi SDVICO. */
export const XAC_NHAN_TRE_GIO = 48;

export type XacNhanST = "da-xac-nhan" | "cho-xac-nhan" | "lech" | "khong-doi-chieu";

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

/**
 * THUẦN — hạn TỐI THIỂU S-Tracking phải có sau khi gia hạn. Có `newExpiryDate` (nhân viên ghi) thì dùng;
 * không thì ngày gia hạn + số tháng: gia hạn từ hạn cũ còn dài hay từ lúc quá hạn, hạn mới đều ≥ mốc này.
 * Không đủ dữ liệu ⇒ null (không đối chiếu được).
 */
export function hanMongDoi(r: RenewalRequestSummary): string | null {
  if (r.newExpiryDate) return r.newExpiryDate.slice(0, 10);
  if (r.extendedAt && r.monthsCount) {
    const t = Date.parse(r.extendedAt);
    if (!Number.isFinite(t)) return null;
    // Ngày theo giờ VN (UTC+7) — extendedAt là mốc ISO.
    const ngayVn = new Date(t + 7 * 3600_000).toISOString().slice(0, 10);
    return congThang(ngayVn, r.monthsCount);
  }
  return null;
}

/**
 * THUẦN — đối chiếu yêu cầu `extended` với hạn S-Tracking của đúng tàu.
 * `hetHanST === undefined` = tàu không có trên S-Tracking của SĐT này ⇒ "khong-doi-chieu".
 * Hạn S-Tracking ≥ mong đợi − dung sai ⇒ "da-xac-nhan"; chưa tới và CRM báo xong > 48 giờ ⇒ "lech";
 * còn lại "cho-xac-nhan". Trạng thái khác `extended` ⇒ null.
 */
export function xacNhanGiaHan(
  r: RenewalRequestSummary,
  hetHanST: string | null | undefined,
  nowMs: number,
): XacNhanST | null {
  if (r.status !== "extended") return null;
  if (hetHanST === undefined) return "khong-doi-chieu";
  const mong = hanMongDoi(r);
  if (mong && hetHanST && hetHanST.slice(0, 10) >= congNgay(mong, -XAC_NHAN_DUNG_SAI_NGAY)) return "da-xac-nhan";
  const luc = r.extendedAt ? Date.parse(r.extendedAt) : NaN;
  if (Number.isFinite(luc) && nowMs - luc > XAC_NHAN_TRE_GIO * 3600_000) return "lech";
  return "cho-xac-nhan";
}

export type GiaHanTauLoai = "cho-ck" | "cho-gia-han" | "cho-xac-nhan" | "lech";
export interface GiaHanTau {
  loai: GiaHanTauLoai;
  requestCode: string;
  /** Hạn S-Tracking phải đạt (chỉ ở cho-xac-nhan/lech; null = không tính được). */
  hanMoi: string | null;
}

/**
 * THUẦN — yêu cầu gia hạn CHƯA XONG của một tàu có trên S-Tracking (danh sách `list` đã mới trước).
 * - pending_payment còn hạn QR → "cho-ck" · hết hạn QR → coi như không có.
 * - pending_extension → "cho-gia-han" (đã nhận tiền).
 * - extended → đối chiếu S-Tracking (`xacNhanGiaHan`): đã xác nhận ⇒ xong (null, dòng hạn đã hiện ngày mới);
 *   chưa ⇒ "cho-xac-nhan"; quá 48 giờ chưa đổi ⇒ "lech".
 * - cancelled/expired/draft/lạ → không có. Chỉ xét yêu cầu MỚI NHẤT của tàu.
 */
export function giaHanCuaTau(
  requests: readonly RenewalRequestSummary[],
  maTau: string | null | undefined,
  /** undefined = tàu không có trên S-Tracking của SĐT này (tự khai) — `extended` coi như xong. */
  hetHanST: string | null | undefined,
  nowMs: number,
): GiaHanTau | null {
  const ma = chuanMaTau(maTau);
  if (!ma) return null;
  const r = requests.find((x) => chuanMaTau(x.vesselCode) === ma);
  if (!r) return null;
  if (r.status === "pending_payment") {
    const het = r.qrExpiresAt ? Date.parse(r.qrExpiresAt) : NaN;
    if (Number.isFinite(het) && het <= nowMs) return null;
    return { loai: "cho-ck", requestCode: r.requestCode, hanMoi: null };
  }
  if (r.status === "pending_extension") {
    return { loai: "cho-gia-han", requestCode: r.requestCode, hanMoi: null };
  }
  if (r.status === "extended") {
    const x = xacNhanGiaHan(r, hetHanST, nowMs);
    if (x === "cho-xac-nhan" || x === "lech") return { loai: x, requestCode: r.requestCode, hanMoi: hanMongDoi(r) };
  }
  return null;
}

/**
 * THUẦN — tàu còn yêu cầu CHƯA XONG ⇒ CHẶN tạo thêm (chống trả tiền hai lần): chờ CK, chờ gia hạn, và —
 * khi tàu có trên S-Tracking (`hetHanST` khác undefined) — SDVICO báo xong mà S-Tracking chưa xác nhận.
 * Tàu tự khai (không đối chiếu được) thì `extended` coi như xong như trước.
 */
export function yeuCauDangMo(
  requests: readonly RenewalRequestSummary[],
  maTau: string,
  nowMs: number,
  hetHanST?: string | null,
): RenewalRequestSummary | null {
  const g = giaHanCuaTau(requests, maTau, hetHanST, nowMs);
  if (!g) return null;
  return requests.find((x) => x.requestCode === g.requestCode) ?? null;
}

/** THUẦN — nhãn màn "Yêu cầu" cho yêu cầu `extended`, theo đối chiếu S-Tracking. */
export function renewalExtendedView(x: XacNhanST | null | undefined): RenewalStatusView {
  if (x === "da-xac-nhan") return { label: "Đã gia hạn · S-Tracking đã xác nhận", tone: "ok" };
  if (x === "cho-xac-nhan") return { label: "SDVICO báo đã gia hạn · chờ S-Tracking", tone: "warn" };
  if (x === "lech") return { label: "S-Tracking chưa đổi hạn · gọi SDVICO", tone: "danger" };
  return { label: "SDVICO báo đã gia hạn", tone: "ok" };
}

export interface TauStrackingRow {
  serial: string;
  ten_tau: string | null;
  chu_tau: string | null;
  het_han?: string | null;
}

/**
 * THUẦN — tàu S-Tracking (đã lọc theo SĐT phiên) ứng với yêu cầu máy khách: ưu tiên khớp
 * serial, rồi khớp mã tàu. Khớp ⇒ máy chủ dùng serial/chủ tàu/mã tàu của S-Tracking.
 */
export function chonTauStracking(
  rows: readonly TauStrackingRow[],
  yeuCau: { maTau: string; serial?: string | null },
): TauStrackingRow | null {
  const serial = (yeuCau.serial ?? "").trim();
  if (serial) {
    const theoSerial = rows.find((r) => r.serial === serial);
    if (theoSerial) return theoSerial;
  }
  const ma = chuanMaTau(yeuCau.maTau);
  return (ma && rows.find((r) => chuanMaTau(r.ten_tau) === ma)) || null;
}
