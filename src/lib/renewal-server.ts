import "server-only";

// GỌI edge fn `sdfish-renewal` (DB chung crm/hub) — SERVER-ONLY. Tách khỏi lib/renewal.ts (2026-11-05) để
// đọc cấu hình từ /quan-tri (app_config, lib/app-config): `sdfish_renewal_secret` (env SDFISH_RENEWAL_SECRET) +
// `sdwork_crm_url` (env SDWORK_SUPABASE_URL) — ô quản trị thắng env, ô trống thì env cũ vẫn chạy.
// Mọi lỗi trả `null` (app phải chạy được khi mất sóng — KHÔNG throw).
// Contract: docs/contracts/stracking-renewal.contract.md.

import { timeoutSignal } from "@/lib/abort";
import { getConfigValue } from "@/lib/app-config";
import type {
  RenewalCreateInput,
  RenewalCreateResult,
  RenewalPending,
  RenewalRequestSummary,
} from "@/lib/renewal";

async function renewalConfig(): Promise<{ url: string; secret: string } | null> {
  const [url, secret] = await Promise.all([getConfigValue("sdwork_crm_url"), getConfigValue("sdfish_renewal_secret")]);
  return url && secret ? { url: url.replace(/\/+$/, ""), secret } : null;
}

/** Gia hạn trong app đã bật chưa (đủ địa chỉ DB chung + khoá chung). */
export async function isRenewalConfigured(): Promise<boolean> {
  return (await renewalConfig()) != null;
}

/** Gọi edge function sdfish-renewal — SERVER-ONLY, timeout mặc định 15s, mọi lỗi → null. */
async function callRenewal<T>(
  payload: Record<string, unknown>,
  timeoutMs = 15000,
): Promise<T | null> {
  const cfg = await renewalConfig();
  if (!cfg) return null;
  try {
    const r = await fetch(`${cfg.url}/functions/v1/sdfish-renewal`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // KHÔNG gửi apikey/Authorization: function chạy verify_jwt=false, mà anon key
        // của project là định dạng mới `sb_publishable_…` — cổng Kong TỪ CHỐI nó khi
        // gửi làm apikey (401 "Invalid API key") TRƯỚC khi tới function (đã đo thật
        // 2026-08-21). Gác thật là shared secret `x-sdfish-secret`.
        "x-sdfish-secret": cfg.secret,
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

