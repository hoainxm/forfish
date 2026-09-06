import {
  ORDER_STATUS_CHIP,
  ORDER_STATUS_LABEL,
  PAYMENT_STATUS_LABEL,
} from "@/lib/market/order-state";
import type { OrderStatus, PaymentStatus } from "@/lib/market/types";

/** Chip trạng thái ĐƠN — màu từ `ORDER_STATUS_CHIP` (token, không hex) như my-orders.tsx. */
export function OrderStatusChip({ status, className = "" }: { status: OrderStatus; className?: string }) {
  const c = ORDER_STATUS_CHIP[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-[0.875rem] font-bold ${className}`}
      style={{ backgroundColor: c.bg, color: c.fg }}
    >
      {ORDER_STATUS_LABEL[status]}
    </span>
  );
}

const PAY_CHIP: Record<PaymentStatus, { bg: string; fg: string }> = {
  chua_thanh_toan: { bg: "var(--field)", fg: "var(--navy)" },
  bao_da_chuyen: { bg: "var(--warn-bg)", fg: "var(--warn)" },
  da_thanh_toan: { bg: "var(--ok-bg)", fg: "var(--ok)" },
};

/** Chip trạng thái THANH TOÁN (3 nấc — lời khai hai bên, app không xác minh tiền). */
export function PaymentStatusChip({ status, className = "" }: { status: PaymentStatus; className?: string }) {
  const c = PAY_CHIP[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-[0.875rem] font-bold ${className}`}
      style={{ backgroundColor: c.bg, color: c.fg }}
    >
      {PAYMENT_STATUS_LABEL[status]}
    </span>
  );
}
