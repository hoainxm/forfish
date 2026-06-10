// ADAPTER SDWork CRM → OwnedAssets (types trung lập ở owned-assets.ts).
//
// Bối cảnh (user chốt 2026-06-10): khi khách mua hàng, SDWork tạo account +
// đơn hàng + dịch vụ, nhưng KHÔNG cấp quyền vào SDWork (app nội bộ/CTV/đại
// lý). Tài khoản đó "tách ra" thành tài khoản ForFish. Vì vậy ForFish đọc
// dữ liệu CRM bằng SERVICE KEY phía server (khách không có session CRM,
// không cần mở RLS CRM cho khách) — và route gọi adapter này BẮT BUỘC tự
// suy account từ session ForFish, KHÔNG BAO GIỜ nhận account id từ client.
//
// Chuỗi nối: profiles.sdwork_customer_ref (= auth.users.id phía CRM)
//   → accounts.owner_user_id → accounts.id (+ accounts con qua parent)
//   → warranty_cards / service_instances / orders.
//
// Đổi vendor: viết adapter khác trả OwnedAssets, UI/domain không đổi.

import { createClient } from "@supabase/supabase-js";
import type {
  OwnedAssets,
  OwnedProduct,
  OwnedService,
  OwedPayment,
} from "@/lib/owned-assets";

const CRM_URL = process.env.SDWORK_SUPABASE_URL ?? "";
// Service key CHỈ tồn tại trên server (API route) — tuyệt đối không lộ client.
const CRM_SERVICE_KEY = process.env.SDWORK_SUPABASE_SERVICE_KEY ?? "";

export function isAssetSyncConfigured(): boolean {
  return Boolean(CRM_URL && CRM_SERVICE_KEY);
}

function crmAdmin() {
  return createClient(CRM_URL, CRM_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ── kiểu hàng thô từ CRM (chỉ các cột adapter đọc) ────────────────────────

export interface CrmWarrantyRow {
  serial: string | null;
  activated_at: string | null;
  expires_at: string | null;
  status: string | null;
  order_id: string | null;
  products: { name: string | null } | null;
  orders: { code: string | null } | null;
}

export interface CrmServiceRow {
  id: string;
  service_name: string | null;
  service_type: string | null;
  status: string | null;
  start_date: string | null;
  next_due_date: string | null;
  end_date: string | null;
}

export interface CrmOrderDebtRow {
  code: string | null;
  debt_amount: number | null;
  debt_due_date: string | null;
}

/** Mapping thuần CRM rows → OwnedAssets — test được, không network. */
export function mapCrmAssets(
  warranties: CrmWarrantyRow[],
  services: CrmServiceRow[],
  debts: CrmOrderDebtRow[],
  customerName?: string,
): OwnedAssets {
  const products: OwnedProduct[] = warranties.map((w, i) => ({
    id: `sdv-${w.serial ?? i}`,
    name: w.products?.name ?? "Sản phẩm SDVICO",
    serial: w.serial ?? undefined,
    purchasedOn: w.activated_at?.slice(0, 10) ?? undefined,
    warrantyUntil: w.expires_at?.slice(0, 10) ?? undefined,
    orderCode: w.orders?.code ?? undefined,
  }));

  const seenService = new Set<string>();
  const servicesOut: OwnedService[] = [];
  for (const s of services) {
    if (seenService.has(s.id)) continue;
    seenService.add(s.id);
    servicesOut.push({
      id: s.id,
      name: s.service_name ?? "Dịch vụ SDVICO",
      kind: s.service_type ?? "other",
      startedOn: s.start_date ?? undefined,
      nextDueOn: s.next_due_date ?? undefined,
      endsOn: s.end_date ?? undefined,
      active: s.status === "active",
    });
  }
  // kỳ gần nhất lên đầu; không có kỳ thì xuống cuối
  servicesOut.sort((a, b) => {
    if (!a.nextDueOn && !b.nextDueOn) return 0;
    if (!a.nextDueOn) return 1;
    if (!b.nextDueOn) return -1;
    return a.nextDueOn.localeCompare(b.nextDueOn);
  });

  const payments: OwedPayment[] = debts
    .filter((d) => (d.debt_amount ?? 0) > 0 && d.code)
    .map((d) => ({
      orderCode: d.code!,
      amountVnd: d.debt_amount!,
      dueOn: d.debt_due_date ?? undefined,
    }));

  return { products, services: servicesOut, payments, customerName };
}

/**
 * Đọc đồ của khách từ CRM theo user id phía CRM (sdwork_customer_ref) +
 * SĐT dự phòng (vài account cũ chưa gắn owner_user_id).
 * Trả null khi chưa cấu hình / không tìm thấy account / CRM lỗi.
 */
export async function fetchOwnedAssets(
  crmUserId: string | null,
  phone0: string | null,
): Promise<OwnedAssets | null> {
  if (!isAssetSyncConfigured()) return null;
  const crm = crmAdmin();

  try {
    // 1. account của khách: ưu tiên owner_user_id; fallback theo SĐT
    let accounts: { id: string; name: string | null }[] = [];
    if (crmUserId) {
      const r = await crm
        .from("accounts")
        .select("id, name")
        .eq("owner_user_id", crmUserId)
        .in("type", ["customer", "sub"]);
      accounts = r.data ?? [];
    }
    if (accounts.length === 0 && phone0) {
      const r = await crm
        .from("accounts")
        .select("id, name")
        .in("type", ["customer", "sub"])
        .or(`login_phone.eq.${phone0},phone.eq.${phone0}`);
      accounts = r.data ?? [];
    }
    if (accounts.length === 0) return null;
    const ids = accounts.map((a) => a.id);

    // 2. bảo hành + dịch vụ + công nợ — chỉ trong account của đúng khách này
    const [warr, svc, debt] = await Promise.all([
      crm
        .from("warranty_cards")
        .select(
          "serial, activated_at, expires_at, status, order_id, products(name), orders(code)",
        )
        .in("customer_id", ids),
      crm
        .from("service_instances")
        .select(
          "id, service_name, service_type, status, start_date, next_due_date, end_date",
        )
        .in("customer_id", ids),
      crm
        .from("orders")
        .select("code, debt_amount, debt_due_date")
        .in("customer_id", ids)
        .gt("debt_amount", 0),
    ]);

    return mapCrmAssets(
      (warr.data ?? []) as unknown as CrmWarrantyRow[],
      (svc.data ?? []) as unknown as CrmServiceRow[],
      (debt.data ?? []) as unknown as CrmOrderDebtRow[],
      accounts[0]?.name ?? undefined,
    );
  } catch {
    // CRM không với tới được — coi như chưa đồng bộ, UI dùng dữ liệu local
    return null;
  }
}
