// ADAPTER SDWork CRM → OwnedAssets (types trung lập ở owned-assets.ts).
//
// Bối cảnh (user chốt 2026-06-10): khi khách mua hàng, SDWork tạo account +
// đơn hàng + dịch vụ, nhưng KHÔNG cấp quyền vào SDWork (app nội bộ/CTV/đại
// lý). Tài khoản đó "tách ra" thành tài khoản ForFish.
//
// Cách nối (2026-06-10, không cần phát thêm key nào): CRM có Edge Function
// `forfish-gateway` chạy BÊN TRONG project CRM (service key tự cấp, không
// rời Supabase). ForFish server gọi gateway qua HTTPS bằng ANON KEY sẵn có
// (SDWORK_SUPABASE_ANON_KEY — cùng env mà SSO đang dùng). Gateway chỉ phục
// vụ 3 việc: assets (lọc nghiêm theo account của đúng khách) / catalog /
// request — route gọi adapter này BẮT BUỘC tự suy khách từ session ForFish.
//
// Chuỗi nối: profiles.sdwork_customer_ref (= auth.users.id phía CRM)
//   → accounts.owner_user_id (fallback SĐT) → warranty_cards /
//   service_instances / orders. Đổi vendor: viết adapter khác trả
//   OwnedAssets, UI/domain không đổi.
//
// v4 (2026-06-11): gateway gộp THÊM thiết bị import (vw_imported_serials —
// chủ yếu giám sát hành trình Viettel) khớp theo SĐT chuẩn hoá 9 số cuối, kể
// cả khách CHƯA có account. Các thiết bị này về trong `warranties` với
// expires_at=null (không có hạn BH/đơn) — mapCrmAssets hiển thị tên + serial,
// KHÔNG bịa hạn bảo hành.

import type {
  OwnedAssets,
  OwnedProduct,
  OwnedService,
  OwedPayment,
  SupportRequest,
} from "@/lib/owned-assets";
import type { CatalogProduct } from "@/lib/sdvico-catalog";

const CRM_URL = process.env.SDWORK_SUPABASE_URL ?? "";
const CRM_ANON = process.env.SDWORK_SUPABASE_ANON_KEY ?? "";

export function isAssetSyncConfigured(): boolean {
  return Boolean(CRM_URL && CRM_ANON);
}

/** Gọi gateway phía CRM — server-only, timeout 15s, lỗi nào cũng trả null. */
async function callGateway<T>(payload: Record<string, unknown>): Promise<T | null> {
  if (!isAssetSyncConfigured()) return null;
  try {
    const r = await fetch(`${CRM_URL}/functions/v1/forfish-gateway`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${CRM_ANON}`,
        apikey: CRM_ANON,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { ok?: boolean } & T;
    return j?.ok ? j : null;
  } catch {
    return null;
  }
}

// ── kiểu hàng thô từ CRM (chỉ các cột gateway trả về) ─────────────────────

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

export interface CrmRequestRow {
  id: string;
  message: string | null;
  status: string | null;
  created_at: string | null;
}

/** Mapping thuần CRM rows → OwnedAssets — test được, không network. */
export function mapCrmAssets(
  warranties: CrmWarrantyRow[],
  services: CrmServiceRow[],
  debts: CrmOrderDebtRow[],
  customerName?: string,
  requestRows: CrmRequestRow[] = [],
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

  const requests: SupportRequest[] = requestRows.map((r) => ({
    id: r.id,
    // bỏ tiền tố kênh "[ForFish] " cho gọn mắt người đọc
    summary: (r.message ?? "").replace(/^\[ForFish\]\s*/, ""),
    status: r.status ?? "pending",
    sentAt: r.created_at ?? undefined,
  }));

  return { products, services: servicesOut, payments, requests, customerName };
}

/**
 * Đọc đồ của khách theo user id phía CRM (sdwork_customer_ref) + SĐT dự
 * phòng. Trả null khi chưa cấu hình / không tìm thấy account / CRM lỗi.
 */
export async function fetchOwnedAssets(
  crmUserId: string | null,
  phone0: string | null,
): Promise<OwnedAssets | null> {
  const j = await callGateway<{
    customerName: string | null;
    warranties: CrmWarrantyRow[];
    services: CrmServiceRow[];
    debts: CrmOrderDebtRow[];
    requests: CrmRequestRow[];
  }>({ action: "assets", crmUserId, phone0 });
  if (!j) return null;
  return mapCrmAssets(
    j.warranties ?? [],
    j.services ?? [],
    j.debts ?? [],
    j.customerName ?? undefined,
    j.requests ?? [],
  );
}

/** Danh mục sản phẩm đang bán (cho thẻ gợi ý) — KHÔNG dữ liệu cá nhân. */
export async function fetchCatalogProducts(): Promise<CatalogProduct[] | null> {
  const j = await callGateway<{
    products: {
      id: string;
      sku: string | null;
      name: string;
      unit: string | null;
      warranty_months: number | null;
    }[];
  }>({ action: "catalog" });
  if (!j?.products) return null;
  return j.products.map((p) => ({
    id: p.id,
    sku: p.sku ?? null,
    name: p.name,
    unit: p.unit ?? null,
    warrantyMonths: p.warranty_months ?? 0,
  }));
}

/**
 * Khách bấm "Gọi SDVICO" trong ForFish → gateway ghi vào hộp yêu cầu tư vấn
 * của CRM (nhân viên SDWork xử lý theo status). `message` do route dựng sẵn
 * dạng "[ForFish] Chủ đề — chi tiết".
 */
export async function createConsultationRequest(req: {
  fullName: string;
  phone: string;
  message: string;
}): Promise<boolean> {
  const j = await callGateway<{ ok: boolean }>({
    action: "request",
    fullName: req.fullName,
    phone: req.phone,
    message: req.message,
  });
  return Boolean(j);
}
