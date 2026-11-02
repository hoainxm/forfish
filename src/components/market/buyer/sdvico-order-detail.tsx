"use client";

// `/cho/don-sdvico/[id]` — CHI TIẾT ĐƠN SDVICO (mua qua CRM, ADR 0018). CHỈ XEM:
// đơn do SDVICO quản, bà con cần gì thì gọi SDVICO (nút Gọi KHÔNG ẩn khi mất sóng).
// Mất sóng: đọc từ bản lưu danh sách đơn SDVICO trong máy.
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AlertIcon } from "@/components/icons";
import { EmptyNet } from "@/components/market/shared/empty-net";
import { MoneyText } from "@/components/market/shared/price-text";
import { OfflineLine } from "@/components/ui/offline-line";
import { CallButton } from "@/components/ui/primitives";
import { SDVICO_HOTLINE } from "@/data/sdvico-showcase";
import { todayIsoVN } from "@/lib/days";
import { formatVnd, formatVnDate } from "@/lib/format";
import { NHAN } from "@/lib/labels";
import { marketGet } from "@/lib/market/client";
import { loadCachedSdvicoOrders } from "@/lib/sdvico-orders/cache";
import { SDVICO_STATUS_TEXT } from "@/lib/sdvico-orders/status";
import type { SdvicoOrder } from "@/lib/sdvico-orders/types";
import { useAuthUser } from "@/lib/use-auth";
import { SdvicoStatusChip } from "./sdvico-order-card";
import { ErrorBlock } from "./ui";

export function SdvicoOrderDetail({ id }: { id: string }) {
  const { phone } = useAuthUser();
  const [order, setOrder] = useState<SdvicoOrder | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "error" | "offline" | "gone">("loading");
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const load = useCallback(async () => {
    setStatus("loading");
    const res = await marketGet<{ order: SdvicoOrder }>(`/api/cho/don-sdvico/${id}`);
    if (res.ok) {
      setOrder(res.data.order);
      setSavedAt(null);
      setStatus("ok");
      return;
    }
    if (res.status === 404) {
      setStatus("gone");
      return;
    }
    const cache = loadCachedSdvicoOrders(phone);
    const hit = cache?.orders.find((o) => o.id === id);
    if (hit && cache) {
      setOrder(hit);
      setSavedAt(cache.savedAt);
      setStatus("ok");
    } else {
      setStatus(res.offline ? "offline" : "error");
    }
  }, [id, phone]);

  useEffect(() => {
    void load();
  }, [load]);

  if (status === "loading") {
    return (
      <div role="status" aria-label="Đang tải đơn" className="px-4 py-3 pb-[7rem]">
        <div className="h-8 w-1/2 animate-pulse rounded bg-field" />
        <div className="surface mt-3 h-32 animate-pulse" />
        <div className="surface mt-3 h-40 animate-pulse" />
      </div>
    );
  }
  if (status === "gone") {
    return (
      <div className="px-4 py-8 pb-[7rem] text-center">
        <div className="mx-auto mb-3 w-fit text-foreground/50"><AlertIcon className="h-8 w-8" /></div>
        <p className="text-[1rem] font-semibold text-navy">Không tìm thấy đơn này.</p>
        <Link
          href="/cho/don"
          className="display mx-auto mt-4 flex min-h-(--row-h) w-full max-w-[15rem] items-center justify-center rounded-full bg-field text-[1rem] font-semibold text-navy"
        >
          {NHAN.donHang}
        </Link>
      </div>
    );
  }
  if (!order) {
    return (
      <div className="px-4 py-4 pb-[7rem]">
        {status === "offline" ? (
          <EmptyNet what="đơn này" onRetry={() => void load()} />
        ) : (
          <ErrorBlock what="đơn này" onRetry={() => void load()} />
        )}
      </div>
    );
  }

  return (
    <div className="px-4 pb-[7rem] pt-3">
      {savedAt != null && (
        <div className="mb-3 overflow-hidden rounded-2xl"><OfflineLine savedAt={savedAt} /></div>
      )}

      {/* ── Đầu đơn ────────────────────────────────────────────────────── */}
      <section className="surface px-4 py-3">
        <p className="text-[1rem] font-semibold text-navy">{NHAN.sdvico} · {order.code}</p>
        <p className="mt-1"><SdvicoStatusChip status={order.status} /></p>
        <p className="mt-1 text-[1rem] font-semibold text-navy">{SDVICO_STATUS_TEXT[order.status]}</p>
        {order.orderedAt && (
          // orderedAt là MỐC GIỜ (timestamptz) — đổi về ngày lịch VN trước khi in dd/mm/yyyy
          <p className="mt-0.5 text-[1rem] text-muted">Ngày đặt: {formatVnDate(todayIsoVN(new Date(order.orderedAt)))}</p>
        )}
        {(order.carrierName || order.trackingNumber) && order.status !== "da_huy" && (
          <p className="mt-1 text-[1rem]">
            <span className="font-semibold text-navy">Vận chuyển: </span>
            {[order.carrierName, order.trackingNumber && `mã ${order.trackingNumber}`].filter(Boolean).join(" · ")}
          </p>
        )}
      </section>

      {/* ── Hàng + dịch vụ ─────────────────────────────────────────────── */}
      <section className="surface mt-3 px-4 py-3">
        <h3 className="mb-2 text-[1rem] font-semibold text-navy">Hàng trong đơn</h3>
        <ul className="flex flex-col gap-2">
          {[...order.items, ...order.services].map((l, i) => (
            <li key={`${i}|${l.name}`} className="flex items-start gap-3">
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 text-[1rem] font-semibold leading-snug text-navy">{l.name}</span>
                <span className="block text-[1rem] text-muted">
                  {formatVnd(l.unitPriceVnd)} × {l.qty}{"unit" in l && l.unit ? ` ${l.unit}` : ""}
                </span>
              </span>
              <MoneyText vnd={l.lineTotalVnd} className="shrink-0" />
            </li>
          ))}
        </ul>
        <div className="mt-2 flex flex-col gap-0.5 border-t pt-2 text-[1rem]" style={{ borderColor: "var(--line)" }}>
          <p className="flex justify-between">
            <span className="text-foreground/70">Tiền hàng</span>
            <MoneyText vnd={order.subtotalVnd} bold={false} />
          </p>
          {order.serviceVnd > 0 && (
            <p className="flex justify-between">
              <span className="text-foreground/70">Dịch vụ</span>
              <MoneyText vnd={order.serviceVnd} bold={false} />
            </p>
          )}
          {order.discountVnd > 0 && (
            <p className="flex justify-between">
              <span className="text-foreground/70">Chiết khấu</span>
              <span className="whitespace-nowrap text-foreground/80">−{formatVnd(order.discountVnd)}</span>
            </p>
          )}
          {order.vatVnd > 0 && (
            <p className="flex justify-between">
              <span className="text-foreground/70">Thuế VAT</span>
              <MoneyText vnd={order.vatVnd} bold={false} />
            </p>
          )}
          <p className="flex justify-between text-[1rem]">
            <span className="font-semibold text-navy">Tổng</span>
            <MoneyText vnd={order.totalVnd} />
          </p>
        </div>
      </section>

      {/* ── Hỏi SDVICO (KHÔNG ẩn khi mất sóng) ─────────────────────────── */}
      <section className="surface mt-3 flex items-center gap-3 px-4 py-3">
        <p className="min-w-0 flex-1 text-[1rem] leading-snug">
          Cần đổi hay hỏi về đơn này, bà con gọi SDVICO.
        </p>
        <CallButton phone={SDVICO_HOTLINE} label={NHAN.goiSdvico} />
      </section>
    </div>
  );
}
