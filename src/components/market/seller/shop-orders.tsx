"use client";

// /ban-hang/don — ĐƠN CỦA SHOP (11 §6.5). Tab theo 6 trạng thái, badge số lấy
// từ `stats.byStatus` (route thống kê đã settle đơn quá hạn). Danh sách KHÔNG
// cache — đơn đổi liên tục và người bán ở bờ (11 §9).
import { useEffect, useState } from "react";
import Link from "next/link";
import { OrderStatusChip } from "@/components/market/shared/order-status-chip";
import { ChipRow, type ChipOption } from "@/components/ui/chip-row";
import { EmptyState } from "@/components/ui/primitives";
import { CartIcon, ChevronRightIcon } from "@/components/icons";
import { formatVnd } from "@/lib/format";
import { isPendingTooLong, ORDER_STATUSES, ORDER_STATUS_LABEL, PAYMENT_METHOD_LABEL } from "@/lib/market/order-state";
import type { Order, OrderStatus, ShopStats } from "@/lib/market/types";
import { LoadView, agoLabel, useMarketData } from "./seller-net";

interface ListRes { items: Order[]; total: number; page: number; pageSize: number }

export function ShopOrders() {
  const [tab, setTab] = useState<OrderStatus>("cho_xac_nhan");
  const stats = useMarketData<{ stats: ShopStats }>("/api/ban-hang/thong-ke?range=30d");
  const list = useMarketData<ListRes>(`/api/ban-hang/don?status=${tab}&page=1`);

  // deep-link từ Tổng quan: /ban-hang/don?tab=dang_giao (đọc sau mount)
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get("tab");
    if (wanted && (ORDER_STATUSES as readonly string[]).includes(wanted)) setTab(wanted as OrderStatus);
  }, []);

  const byStatus = stats.state.kind === "ok" ? stats.state.data.stats.byStatus : null;
  const options: readonly ChipOption<OrderStatus>[] = ORDER_STATUSES.map((s) => ({
    id: s,
    label: byStatus && byStatus[s] > 0 ? `${ORDER_STATUS_LABEL[s]} ${byStatus[s]}` : ORDER_STATUS_LABEL[s],
  }));

  return (
    <div className="pb-10">
      <div className="mb-3">
        <ChipRow options={options} value={tab} onChange={setTab} accent="t3" level={2} ariaLabel="Trạng thái đơn" />
      </div>
      <LoadView state={list.state} what="đơn hàng của shop" onRetry={list.reload}>
        {(d) => <Rows items={d.items} tab={tab} />}
      </LoadView>
    </div>
  );
}

function Rows({ items, tab }: { items: Order[]; tab: OrderStatus }) {
  if (items.length === 0) {
    return (
      <div className="px-4">
        <EmptyState icon={<CartIcon className="h-8 w-8" />}>
          Không có đơn {ORDER_STATUS_LABEL[tab].toLowerCase()}.
        </EmptyState>
      </div>
    );
  }
  const nowIso = new Date().toISOString();
  return (
    <ul className="space-y-1 px-4">
      {items.map((o) => {
        const late = isPendingTooLong(o, nowIso);
        const soMon = o.items.reduce((s, l) => s + l.qty, 0);
        return (
          <li key={o.id}>
            <Link href={`/ban-hang/don/${o.id}`} className="flex min-h-[3.5rem] items-center gap-3 px-4 py-3 surface">
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <b className="text-[1rem] text-navy">{o.code}</b>
                  <OrderStatusChip status={o.status} />
                  {o.paymentStatus === "bao_da_chuyen" && (
                    <span className="rounded-full px-2 py-0.5 text-[0.8125rem] font-bold"
                      style={{ backgroundColor: "var(--warn-bg)", color: "var(--warn)" }}>
                      Báo đã CK
                    </span>
                  )}
                  {o.needsRefund && (
                    <span className="rounded-full px-2 py-0.5 text-[0.8125rem] font-bold"
                      style={{ backgroundColor: "var(--danger-bg)", color: "var(--danger)" }}>
                      Cần hoàn tiền
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block truncate text-[1rem] text-foreground/85">
                  {o.address.name} · {o.address.province}
                </span>
                <span className="mt-0.5 block truncate text-[0.9375rem] text-foreground/65">
                  {soMon} món · {PAYMENT_METHOD_LABEL[o.paymentMethod]} · {agoLabel(o.createdAt)}
                </span>
                <b className="mt-0.5 block text-[1.125rem] text-navy">{formatVnd(o.totalVnd)}</b>
                {late && (
                  <span className="mt-1 block rounded-2xl px-3 py-1.5 text-[0.9375rem] font-bold"
                    style={{ backgroundColor: "var(--warn-bg)", color: "var(--warn)" }}>
                    Đơn chờ quá 2 ngày — xác nhận hoặc gọi người mua giúp.
                  </span>
                )}
              </span>
              <ChevronRightIcon className="h-5 w-5 shrink-0 text-foreground/40" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
