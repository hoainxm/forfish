"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { StatusBanner } from "@/components/ui/status-banner";
import { EmptyState, RefNote } from "@/components/ui/primitives";
import { CartIcon, ClockIcon } from "@/components/icons";
import { useAuthUser } from "@/lib/use-auth";
import { authedFetch } from "@/lib/device-token-store";
import { timeoutSignal } from "@/lib/abort";
import { formatVnd, formatVnDate } from "@/lib/format";
import {
  ORDER_STATUS_LABELS,
  type CatalogOrder,
  type OrderStatus,
} from "@/lib/catalog-orders";

/*
  ĐƠN CỦA TÔI (2026-08-11) — chủ tàu xem đơn đã đặt + huỷ đơn còn "Mới".
  Online-only: GET /api/me/orders cần mạng, mất sóng thì BÁO THẬT + nút Thử lại,
  KHÔNG hiện dữ liệu giả. Chưa đăng nhập → mời đăng nhập (không gọi API).
*/

function statusChip(s: OrderStatus): { bg: string; fg: string } {
  switch (s) {
    case "moi":
      return { bg: "var(--field)", fg: "var(--navy)" };
    case "da_nhan":
      return { bg: "var(--warn-bg)", fg: "var(--warn)" };
    case "dang_giao":
      return { bg: "var(--sea)", fg: "#ffffff" };
    case "da_giao":
      return { bg: "var(--ok-bg)", fg: "var(--ok)" };
    case "da_huy":
      return { bg: "var(--danger-bg)", fg: "var(--danger)" };
  }
}

/** "Đá cây ×2, Dầu DO ×1" — tóm tắt món trong đơn. */
function summarizeItems(o: CatalogOrder): string {
  return o.items.map((l) => `${l.title} ×${l.qty}`).join(", ");
}

type Load =
  | { kind: "loading" }
  | { kind: "ok"; orders: CatalogOrder[] }
  | { kind: "error" };

export function MyOrders() {
  const { signedIn, ready } = useAuthUser();
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<CatalogOrder | null>(null);
  const [cancelErr, setCancelErr] = useState("");

  const fetchOrders = useCallback(async () => {
    setLoad({ kind: "loading" });
    const { res } = await authedFetch(
      "/api/me/orders",
      { signal: timeoutSignal(15000) },
      15000,
    );
    if (!res || !res.ok) {
      setLoad({ kind: "error" });
      return;
    }
    const j = (await res.json().catch(() => null)) as
      | { ok?: boolean; orders?: CatalogOrder[] }
      | null;
    if (j?.ok && Array.isArray(j.orders)) {
      setLoad({ kind: "ok", orders: j.orders });
    } else {
      setLoad({ kind: "error" });
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (!signedIn) return; // khách → không gọi API
    fetchOrders();
  }, [ready, signedIn, fetchOrders]);

  async function doCancel(order: CatalogOrder) {
    setCancelErr("");
    setCancelling(order.id);
    const { res } = await authedFetch(
      `/api/me/orders/${order.id}/cancel`,
      { method: "POST", signal: timeoutSignal(15000) },
      15000,
    );
    setCancelling(null);
    setConfirmCancel(null);
    if (!res) {
      setCancelErr("Chưa huỷ được — cần có mạng, thử lại khi có sóng.");
      return;
    }
    const j = (await res.json().catch(() => null)) as
      | { ok?: boolean; code?: string }
      | null;
    if (res.ok && j?.ok) {
      fetchOrders();
      return;
    }
    if (j?.code === "cannot_cancel") {
      setCancelErr("Đơn đã được xử lý, không huỷ được nữa.");
      fetchOrders(); // đồng bộ lại trạng thái mới
    } else {
      setCancelErr("Chưa huỷ được — thử lại khi có sóng.");
    }
  }

  // ── Chưa đăng nhập ──────────────────────────────────────────────────
  if (ready && !signedIn) {
    return (
      <div className="px-4 pt-1">
        <RefNote>
          Đăng nhập bằng SĐT để đặt hàng và theo dõi đơn của mình.
        </RefNote>
        <Link
          href="/login"
          className="mt-2.5 flex min-h-[3.5rem] w-full items-center justify-center rounded-full bg-field text-[1.0625rem] font-bold text-navy transition active:scale-[0.98]"
        >
          Đăng nhập để xem đơn của mình
        </Link>
      </div>
    );
  }

  return (
    <div className="px-4 pt-1">
      {cancelErr && (
        <p
          role="alert"
          className="mb-3 rounded-2xl px-3.5 py-3 text-[1rem] font-semibold"
          style={{ color: "var(--danger)", backgroundColor: "var(--danger-bg)" }}
        >
          {cancelErr}
        </p>
      )}

      {load.kind === "loading" && (
        <p className="surface px-4 py-8 text-center text-[1.0625rem] text-foreground/65">
          Đang tải đơn của bà con…
        </p>
      )}

      {load.kind === "error" && (
        <div className="overflow-hidden surface">
          <StatusBanner level="danger">
            Chưa tải được đơn — mạng có thể đang yếu.
          </StatusBanner>
          <div className="px-4 py-3">
            <button
              type="button"
              onClick={fetchOrders}
              className="min-h-[3.25rem] w-full rounded-full bg-danger px-4 text-[1.0625rem] font-bold text-white active:scale-[0.98]"
            >
              Thử lại
            </button>
          </div>
        </div>
      )}

      {load.kind === "ok" && load.orders.length === 0 && (
        <EmptyState icon={<CartIcon className="h-10 w-10" />}>
          Chưa đặt đơn nào. Vào mục “Cửa hàng” chọn hàng rồi đặt.
        </EmptyState>
      )}

      {load.kind === "ok" && load.orders.length > 0 && (
        <ul className="space-y-3">
          {load.orders.map((o) => {
            const chip = statusChip(o.status);
            return (
              <li key={o.id} className="overflow-hidden surface">
                <div className="px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="rounded-full px-3 py-1 text-[0.875rem] font-bold"
                      style={{ backgroundColor: chip.bg, color: chip.fg }}
                    >
                      {ORDER_STATUS_LABELS[o.status]}
                    </span>
                    <span className="display text-[1.125rem] font-bold text-navy">
                      {formatVnd(o.totalVnd)}
                    </span>
                  </div>

                  <p className="mt-2 text-[1.0625rem] font-semibold leading-snug text-navy">
                    {summarizeItems(o) || "Đơn hàng"}
                  </p>

                  <div className="mt-1.5 space-y-0.5 text-[0.9375rem] text-foreground/70">
                    <p className="flex items-center gap-1.5">
                      <ClockIcon className="h-4 w-4 shrink-0" />
                      Đặt ngày {formatVnDate(o.createdAt.slice(0, 10))}
                    </p>
                    {o.deliveryLocation && (
                      <p>Giao tới: {o.deliveryLocation}</p>
                    )}
                    {o.boatName && <p>Tàu: {o.boatName}</p>}
                  </div>

                  {o.status === "moi" && (
                    <button
                      type="button"
                      onClick={() => setConfirmCancel(o)}
                      disabled={cancelling === o.id}
                      className="mt-3 min-h-[3.25rem] w-full rounded-full bg-field text-[1.0625rem] font-bold text-danger active:scale-[0.98] disabled:opacity-40"
                    >
                      {cancelling === o.id ? "Đang huỷ…" : "Huỷ đơn"}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {confirmCancel && (
        <ConfirmDialog
          title="Huỷ đơn này?"
          message={`Đơn “${summarizeItems(confirmCancel) || "này"}” sẽ được huỷ. Chỉ huỷ được khi đơn còn “Mới”.`}
          cancelLabel="Không huỷ"
          confirmLabel="Huỷ đơn"
          onCancel={() => setConfirmCancel(null)}
          onConfirm={() => doCancel(confirmCancel)}
        />
      )}
    </div>
  );
}
