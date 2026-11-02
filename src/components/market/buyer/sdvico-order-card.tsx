"use client";

// THẺ ĐƠN SDVICO trong `/cho/don` (ADR 0018) — đơn mua qua cửa hàng/CRM SDVICO,
// CHỈ XEM: không nút Huỷ / Đã nhận / Đã chuyển khoản (đơn do SDVICO quản).
// Cùng khuôn thẻ đơn chợ (surface, tên dòng 1, chip dòng 2, mã + tổng dòng cuối).
import Link from "next/link";
import { ChevronRightIcon } from "@/components/icons";
import { formatVnd } from "@/lib/format";
import { NHAN } from "@/lib/labels";
import { SDVICO_STATUS_CHIP, SDVICO_STATUS_CHIP_LABEL } from "@/lib/sdvico-orders/status";
import type { SdvicoOrder, SdvicoOrderStatus } from "@/lib/sdvico-orders/types";

export function SdvicoStatusChip({ status, className = "" }: { status: SdvicoOrderStatus; className?: string }) {
  const c = SDVICO_STATUS_CHIP[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-[0.875rem] font-semibold ${className}`}
      style={{ backgroundColor: c.bg, color: c.fg }}
    >
      {SDVICO_STATUS_CHIP_LABEL[status]}
    </span>
  );
}

/** "Máy S-Tracking ×1, Ắc quy ×2" — đủ nhận ra đơn mà không phải mở. */
export const summarizeSdvico = (o: SdvicoOrder) => {
  const lines = [...o.items, ...o.services];
  return lines.slice(0, 3).map((l) => `${l.name} ×${l.qty}`).join(", ") + (lines.length > 3 ? "…" : "");
};

export function SdvicoOrderCard({ order }: { order: SdvicoOrder }) {
  return (
    <li className="surface px-4 py-3">
      <Link href={`/cho/don-sdvico/${order.id}`} className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[1rem] font-semibold leading-snug text-navy">{NHAN.sdvico}</p>
          <p className="mt-1"><SdvicoStatusChip status={order.status} /></p>
          <p className="mt-1 line-clamp-2 text-[1rem] font-semibold leading-snug text-navy">{summarizeSdvico(order)}</p>
          <p className="mt-0.5 flex flex-wrap items-center justify-between gap-x-2 text-[1rem]">
            <span className="whitespace-nowrap text-muted">{order.code}</span>
            <span className="ml-auto whitespace-nowrap text-[1rem] font-semibold text-navy">{formatVnd(order.totalVnd)}</span>
          </p>
        </div>
        <ChevronRightIcon className="mt-1 h-6 w-6 shrink-0 text-navy" />
      </Link>
    </li>
  );
}
