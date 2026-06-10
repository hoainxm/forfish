// Đồ của khách mua từ công ty — TYPES TRUNG LẬP VENDOR (quy tắc adapter,
// 01-product §5): sản phẩm đã mua, dịch vụ đang dùng, khoản còn nợ/đến kỳ.
// Nguồn hiện tại là SDWork CRM (adapter: sdwork-assets.ts) nhưng types này
// KHÔNG biết vendor là ai — đổi nguồn không đổi UI/domain.
//
// Logic trạng thái thuần, test tại __tests__/owned-assets.test.ts.

/** Sản phẩm đã mua (kèm bảo hành) — đồng bộ từ hệ thống bán hàng. */
export interface OwnedProduct {
  id: string;
  name: string;
  serial?: string;
  /** ISO date ngày mua / kích hoạt */
  purchasedOn?: string;
  /** ISO date hết bảo hành (undefined = không rõ) */
  warrantyUntil?: string;
  /** Mã đơn hàng để bà con đối chiếu khi gọi tổng đài */
  orderCode?: string;
}

/** Dịch vụ đang dùng (bảo trì định kỳ, thuê bao giám sát, wifi...). */
export interface OwnedService {
  id: string;
  name: string;
  /** repair | maintenance | warranty | subscription | other */
  kind: string;
  /** ISO date bắt đầu */
  startedOn?: string;
  /** ISO date kỳ tiếp theo (đến hạn bảo trì / đóng cước) */
  nextDueOn?: string;
  /** ISO date kết thúc hợp đồng dịch vụ */
  endsOn?: string;
  active: boolean;
}

/** Khoản tiền còn phải thu theo đơn hàng (công nợ / cước chưa đóng). */
export interface OwedPayment {
  orderCode: string;
  amountVnd: number;
  /** ISO date hạn thanh toán nếu có */
  dueOn?: string;
}

/** Gói dữ liệu đồng bộ về cho một khách. */
export interface OwnedAssets {
  products: OwnedProduct[];
  services: OwnedService[];
  payments: OwedPayment[];
  /** Tên khách bên hệ thống bán hàng — đối chiếu đúng người */
  customerName?: string;
}

// ── trạng thái kỳ dịch vụ (mirror getWarrantyStatus bên products.ts) ──────

export type DueLevel = "overdue" | "soon" | "ok" | "none";

export interface ServiceDueStatus {
  level: DueLevel;
  days: number | null;
  label: string;
}

const SOON_DAYS = 14;

function daysUntil(isoDate: string, today: Date): number {
  const target = new Date(isoDate + "T00:00:00Z");
  const base = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
  );
  return Math.round((target.getTime() - base) / 86_400_000);
}

/** Nhãn kỳ tới của dịch vụ: đến hạn bảo trì / đóng cước. */
export function getServiceDueStatus(
  service: OwnedService,
  today: Date,
): ServiceDueStatus {
  if (!service.active) {
    return { level: "none", days: null, label: "Đã ngưng" };
  }
  if (!service.nextDueOn) {
    return { level: "none", days: null, label: "Không có kỳ hẹn" };
  }
  const days = daysUntil(service.nextDueOn, today);
  if (days < 0) {
    return {
      level: "overdue",
      days,
      label: `Quá kỳ ${Math.abs(days)} ngày`,
    };
  }
  if (days === 0) return { level: "soon", days, label: "Đến kỳ hôm nay" };
  if (days <= SOON_DAYS) {
    return { level: "soon", days, label: `Còn ${days} ngày tới kỳ` };
  }
  return { level: "ok", days, label: `Còn ${days} ngày tới kỳ` };
}

/** Nhãn tiếng đời thường cho loại dịch vụ. */
export function serviceKindLabel(kind: string): string {
  switch (kind) {
    case "maintenance":
      return "Bảo trì định kỳ";
    case "repair":
      return "Sửa chữa khi cần";
    case "warranty":
      return "Gói bảo hành";
    case "subscription":
      return "Thuê bao / cước";
    default:
      return "Dịch vụ";
  }
}
