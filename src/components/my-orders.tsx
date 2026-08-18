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
  loadCachedOrders,
  saveCachedOrders,
  type CatalogOrder,
  type OrderStatus,
} from "@/lib/catalog-orders";
import { savedAgoLabel } from "@/lib/forecast-cache";
import { useOnline } from "@/lib/use-online";

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
  /** đang hiện BẢN ĐÃ LƯU trong máy (mất sóng) — kèm mốc lưu để nói thật */
  | { kind: "saved"; orders: CatalogOrder[]; savedAt: number }
  | { kind: "error" };

export function MyOrders() {
  const { signedIn, ready, phone } = useAuthUser();
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<CatalogOrder | null>(null);
  const [cancelErr, setCancelErr] = useState("");
  /** vừa huỷ xong — nói một câu 8 giây rồi tự tắt (audit 2026-08-18 G4;
   *  2 dòng = 8s theo chính sách thông báo) */
  const [cancelOk, setCancelOk] = useState("");
  const online = useOnline();
  useEffect(() => {
    if (!cancelOk) return;
    const t = window.setTimeout(() => setCancelOk(""), 8000);
    return () => window.clearTimeout(t);
  }, [cancelOk]);

  /*  BẢN TRONG MÁY LÀ ĐƯỜNG LÙI, KHÔNG PHẢI MÀN LỖI (2026-08-18, chủ dự án:
      "cửa hàng nó ít đổi món và đơn, nên cứ xem bình thường, online lại thì tự
      động tải mới"). Đơn đổi trạng thái vài lần trong đời nó, nên bản đã tải ở
      cảng vẫn trả lời đúng câu bà con cần giữa biển: mình đặt gì, giao ở đâu,
      gọi ai. Chỉ khi máy CHƯA TỪNG tải được đơn nào mới hiện màn lỗi. */
  const fetchOrders = useCallback(async () => {
    setLoad({ kind: "loading" });
    const { res } = await authedFetch(
      "/api/me/orders",
      { signal: timeoutSignal(15000) },
      15000,
    );
    const luiVeBanLuu = () => {
      const luu = loadCachedOrders(phone);
      setLoad(
        luu
          ? { kind: "saved", orders: luu.orders, savedAt: luu.savedAt }
          : { kind: "error" },
      );
    };
    if (!res || !res.ok) {
      luiVeBanLuu();
      return;
    }
    const j = (await res.json().catch(() => null)) as
      | { ok?: boolean; orders?: CatalogOrder[] }
      | null;
    if (j?.ok && Array.isArray(j.orders)) {
      saveCachedOrders(phone, j.orders);
      setLoad({ kind: "ok", orders: j.orders });
      // tải được bản mới = câu lỗi huỷ cũ hết hiệu lực (audit G8)
      setCancelErr("");
    } else {
      luiVeBanLuu();
    }
  }, [phone]);

  useEffect(() => {
    if (!ready) return;
    if (!signedIn) return; // khách → không gọi API
    fetchOrders();
  }, [ready, signedIn, fetchOrders]);

  /*  CÓ SÓNG LẠI THÌ TỰ TẢI LẠI (2026-08-17, ADR 0004 bất biến 6). Đơn hàng là
      khu ở-bờ, KHÔNG cache — nhưng cũng không được bắt bà con bấm "Thử lại"
      mỗi lần sóng chập chờn ở cảng. Chỉ khi đã đăng nhập (khách không gọi API)
      và không đang tải. */
  useEffect(() => {
    if (!ready || !signedIn) return;
    const onOnline = () => {
      if (load.kind !== "loading") fetchOrders();
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [ready, signedIn, fetchOrders, load.kind]);

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
      setCancelErr(
        "Chưa huỷ được — việc này cần có mạng. Có sóng lại bà con bấm huỷ lần nữa giúp; danh sách đơn thì máy tự cập nhật.",
      );
      return;
    }
    const j = (await res.json().catch(() => null)) as
      | { ok?: boolean; code?: string }
      | null;
    if (res.ok && j?.ok) {
      setCancelOk(`Đã huỷ đơn “${summarizeItems(order) || "này"}”.`);
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

  // ── Chưa đăng nhập — MỘT khối mời (O1); ẨN lời mời khi mất sóng vì /login
  //    cần sóng (tầng 5, chính sách thông báo 2026-08-18) ────────────────────
  if (ready && !signedIn) {
    return (
      <div className="px-4 pt-1">
        {online ? (
          <Link
            href="/login"
            className="flex min-h-[3.5rem] w-full items-center justify-center rounded-full bg-field px-4 text-center text-[1.0625rem] font-bold text-navy transition active:scale-[0.98]"
          >
            Đăng nhập bằng SĐT để xem đơn của mình
          </Link>
        ) : (
          <RefNote>
            Đơn của mình chỉ xem được khi đã đăng nhập — việc đó cần sóng, máy
            đang không có sóng.
          </RefNote>
        )}
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
      {cancelOk && (
        <p
          role="status"
          className="mb-3 rounded-2xl px-3.5 py-3 text-[1rem] font-semibold"
          style={{ color: "var(--ok)", backgroundColor: "var(--ok-bg)" }}
        >
          {cancelOk}
        </p>
      )}

      {load.kind === "loading" && (
        <p className="surface px-4 py-8 text-center text-[1.0625rem] text-foreground/65">
          Đang tải đơn của bà con…
        </p>
      )}

      {/* MÀN LỖI chỉ còn cho ca máy CHƯA TỪNG tải được đơn nào */}
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

      {/* ĐANG XEM BẢN ĐÃ LƯU — xem bình thường, chỉ nói thật là bản lúc nào */}
      {load.kind === "saved" && (
        <div className="mb-3 overflow-hidden rounded-2xl">
          <StatusBanner level="warn">
            Đang xem đơn đã lưu trong máy ({savedAgoLabel(load.savedAt)}) — chưa
            hỏi được máy chủ. Trạng thái đơn có thể đã đổi; có sóng lại là máy tự
            tải bản mới.
          </StatusBanner>
        </div>
      )}

      {(load.kind === "ok" || load.kind === "saved") &&
        load.orders.length === 0 && (
          <EmptyState icon={<CartIcon className="h-10 w-10" />}>
            Chưa đặt đơn nào. Vào mục “Cửa hàng” chọn hàng rồi đặt.
          </EmptyState>
        )}

      {(load.kind === "ok" || load.kind === "saved") && load.orders.length > 0 && (
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
