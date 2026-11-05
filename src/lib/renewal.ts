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
      return { label: "Đã gia hạn xong", tone: "ok" };
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

export type GiaHanTauLoai = "cho-ck" | "cho-gia-han" | "da-gia-han";
export interface GiaHanTau {
  loai: GiaHanTauLoai;
  requestCode: string;
  /** Chỉ có ở "da-gia-han": hạn mới nhân viên đã gia hạn. */
  hanMoi: string | null;
}

/**
 * THUẦN — yêu cầu gia hạn ĐANG CÓ HIỆU LỰC của một tàu (danh sách `list` đã mới trước).
 * - pending_payment còn hạn QR → "cho-ck" (đã gửi, chờ chuyển khoản) · hết hạn QR → coi như không có.
 * - pending_extension → "cho-gia-han" (đã nhận tiền).
 * - extended mà hạn mới VƯỢT hạn S-Tracking đang thấy → "da-gia-han" (chờ máy GPU kéo hạn mới về);
 *   S-Tracking đã bắt kịp (hoặc không có hạn mới) → không còn gì để báo.
 * - cancelled/expired/draft/lạ → không có. Chỉ xét yêu cầu MỚI NHẤT của tàu: yêu cầu cũ hơn đã bị thay.
 */
export function giaHanCuaTau(
  requests: readonly RenewalRequestSummary[],
  maTau: string | null | undefined,
  hetHanST: string | null,
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
    const moi = r.newExpiryDate?.slice(0, 10) ?? null;
    if (!moi || (hetHanST && moi <= hetHanST.slice(0, 10))) return null;
    return { loai: "da-gia-han", requestCode: r.requestCode, hanMoi: moi };
  }
  return null;
}

/** THUẦN — tàu đã có yêu cầu đang mở (chưa CK hoặc đã CK chờ gia hạn) ⇒ CHẶN tạo thêm. */
export function yeuCauDangMo(
  requests: readonly RenewalRequestSummary[],
  maTau: string,
  nowMs: number,
): RenewalRequestSummary | null {
  const g = giaHanCuaTau(requests, maTau, null, nowMs);
  if (!g || g.loai === "da-gia-han") return null;
  return requests.find((x) => x.requestCode === g.requestCode) ?? null;
}

export interface TauStrackingRow {
  serial: string;
  ten_tau: string | null;
  chu_tau: string | null;
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
