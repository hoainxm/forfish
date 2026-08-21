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

/** Gọi edge function sdfish-renewal — SERVER-ONLY, timeout 15s, mọi lỗi → null. */
async function callRenewal<T>(
  payload: Record<string, unknown>,
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
      signal: timeoutSignal(15000),
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
): Promise<RenewalRequestSummary[] | null> {
  const j = await callRenewal<{ requests: RenewalRequestSummary[] }>({
    action: "list",
    phone,
  });
  return j?.requests ?? null;
}

/** Đơn giá/tháng hiện hành (để hiện tổng tiền TRƯỚC khi tạo yêu cầu). null = lỗi. */
export async function getRenewalMonthlyPrice(): Promise<number | null> {
  const j = await callRenewal<{ monthlyPrice: number }>({ action: "price" });
  return j?.monthlyPrice ?? null;
}
