"use client";

/*  Tách nguyên văn khỏi src/app/quan-tri/page.tsx (2026-10-19, rà Codex đợt 3: trang quản trị 6.718 dòng
    — tách theo tab, KHÔNG đổi hành vi; trang chính nạp tab khi mở). */

import { AdminSkeleton } from "@/components/admin/admin-nav";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { apiUrl } from "@/lib/api-base";
import { ORDER_STATUS_LABELS, canTransition, type CatalogOrder, type OrderStatus } from "@/lib/catalog-orders";
import { tokenHeader } from "@/lib/device-token-store";
import { formatVnDate, formatVnd } from "@/lib/format";
import { type TabPerms } from "@/lib/staff-permissions";
import { useCallback, useEffect, useState } from "react";
import { fmtDT } from "@/components/admin/quan-tri-chung";

/* ── ĐƠN HÀNG (NCC/ADMIN xử lý đơn đặt của chủ tàu) ───────────────────────
   Danh sách đơn từ bảng catalog_orders (API /api/admin/orders). Lọc theo trạng
   thái, đổi trạng thái theo bảng chuyển hợp lệ (canTransition — server chốt
   lại), ghi chú NCC. Đổi trạng thái tự báo push cho chủ tàu (ở route). Khuôn
   theo InquiriesTab: danh sách + đổi trạng thái + ghi chú xử lý. */

export type OrderStatusFilter = OrderStatus | "all";

export const ORDER_BADGE: Record<OrderStatus, string> = {
  moi: "bg-warn-bg text-warn",
  da_nhan: "bg-sea/15 text-sea",
  dang_giao: "bg-t3/15 text-t3",
  da_giao: "bg-ok-bg text-ok",
  da_huy: "bg-danger-bg text-danger",
};

/** Các bước chuyển tiến (không tính Huỷ) kèm nhãn nút cho từng đích. */
export const ORDER_STEP_ACTIONS: { to: OrderStatus; label: string }[] = [
  { to: "da_nhan", label: "Xác nhận nhận đơn" },
  { to: "dang_giao", label: "Đang trên đường giao" },
  { to: "da_giao", label: "Đã giao thành công" },
];

/** Mã ngắn dễ đọc cho NCC (6 ký tự cuối id, viết hoa). */
export const shortCode = (id: string): string =>
  id.replace(/-/g, "").slice(-6).toUpperCase();

export function OrdersTab({ perms }: { perms: TabPerms }) {
  const [status, setStatus] = useState<OrderStatusFilter>("moi");
  const [orders, setOrders] = useState<CatalogOrder[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toCancel, setToCancel] = useState<CatalogOrder | null>(null);

  const load = useCallback(() => {
    setError(null);
    setOrders(null);
    const qs = status === "all" ? "" : `?status=${status}`;
    fetch(apiUrl(`/api/admin/orders${qs}`), { headers: tokenHeader() })
      .then(async (r) => {
        const j = (await r.json()) as {
          ok: boolean;
          code?: string;
          orders?: CatalogOrder[];
        };
        if (!j.ok) throw new Error(j.code ?? "load");
        setOrders(j.orders ?? []);
      })
      .catch((e: Error) =>
        setError(
          e.message === "not_configured"
            ? "Chưa kết nối được cơ sở dữ liệu (Supabase). Tính năng này không chạy ở chế độ dùng thử."
            : "Chưa tải được danh sách đơn hàng. Vui lòng thử lại.",
        ),
      );
  }, [status]);
  useEffect(load, [load]);

  async function changeStatus(order: CatalogOrder, next: OrderStatus) {
    setBusyId(order.id);
    const r = await fetch(apiUrl(`/api/admin/orders/${encodeURIComponent(order.id)}`), {
      method: "PATCH",
      // chuỗi cứng (2026-10-02) — bản cũ thiếu, sống nhờ đường lùi cookie
      headers: { "content-type": "application/json", ...tokenHeader() },
      body: JSON.stringify({ status: next }),
    }).catch(() => null);
    const j = (await r?.json().catch(() => null)) as {
      ok?: boolean;
      code?: string;
    } | null;
    setBusyId(null);
    if (!r?.ok || !j?.ok) {
      setError(
        j?.code === "bad_transition"
          ? "Thao tác chuyển trạng thái không đúng luồng. Vui lòng tải lại trang để xem trạng thái mới nhất."
          : "Đổi trạng thái không thành công. Vui lòng thử lại.",
      );
      return;
    }
    load();
  }

  async function saveNote(order: CatalogOrder, note: string) {
    setBusyId(order.id);
    const r = await fetch(apiUrl(`/api/admin/orders/${encodeURIComponent(order.id)}`), {
      method: "PATCH",
      // chuỗi cứng (2026-10-02) — bản cũ thiếu, sống nhờ đường lùi cookie
      headers: { "content-type": "application/json", ...tokenHeader() },
      body: JSON.stringify({ dealerNote: note }),
    }).catch(() => null);
    const j = (await r?.json().catch(() => null)) as { ok?: boolean } | null;
    setBusyId(null);
    if (!r?.ok || !j?.ok) {
      setError("Lưu ghi chú không thành công. Vui lòng thử lại.");
      return;
    }
    load();
  }

  const chip = (id: OrderStatusFilter, label: string) => (
    <button
      key={id}
      type="button"
      onClick={() => setStatus(id)}
      aria-pressed={status === id}
      className={`min-h-[2.5rem] shrink-0 rounded-full px-4 text-[0.875rem] font-bold transition ${
        status === id ? "bg-navy text-white" : "bg-field text-foreground/70"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="mt-4 space-y-4">
      {/*  ĐÃ NGHỈ (2026-09-07, ADR 0014) — đơn cũ của "Cửa hàng" đã chuyển sang
           chợ (migration 0061); từ nay bà con đặt hàng là đơn về tab Cửa hàng.
           Màn này KHÔNG nhận đơn mới nữa, chỉ còn để tra lại. */}
      <div className="surface border-l-4 px-4 py-3" style={{ borderColor: "var(--warn)" }}>
        <p className="text-[0.9375rem] font-bold text-navy">
          Màn đơn này ĐÃ NGHỈ — đơn mới về tab Cửa hàng.
        </p>
        <p className="mt-1 text-[0.875rem] leading-snug text-foreground/70">
          Từ 07/09/2026 màn &quot;Cửa hàng&quot; cũ đã gộp vào <b>Cửa hàng</b> (chợ chung). Đơn cũ
          đã được chuyển sang chợ nên <b>xử lý đơn ở tab Cửa hàng → Đơn hàng</b>,
          đừng xử lý hai nơi cho một đơn. Màn này giữ để tra lại bản gốc.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {chip("all", "Tất cả")}
        {chip("moi", "Đơn mới")}
        {chip("da_nhan", "Đã tiếp nhận")}
        {chip("dang_giao", "Đang giao hàng")}
        {chip("da_giao", "Giao thành công")}
        {chip("da_huy", "Đã huỷ")}
      </div>

      {error && (
        <div className="surface px-4 py-6 text-center">
          <p className="text-[1rem] text-danger">{error}</p>
          <button
            type="button"
            onClick={load}
            className="mt-3 min-h-[2.75rem] rounded-xl bg-navy px-6 text-[0.9375rem] font-bold text-white"
          >
            Thử lại
          </button>
        </div>
      )}
      {!orders && !error && (
        <AdminSkeleton label="Đang tải đơn hàng…" />
      )}
      {orders && orders.length === 0 && (
        <p className="surface px-4 py-8 text-center text-[1rem] text-foreground/65">
          Không có đơn nào ở mục này.
        </p>
      )}

      {orders && orders.length > 0 && (
        <ul className="space-y-3">
          {orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              perms={perms}
              busy={busyId === order.id}
              onChangeStatus={changeStatus}
              onSaveNote={saveNote}
              onRequestCancel={() => setToCancel(order)}
            />
          ))}
        </ul>
      )}

      {toCancel && (
        <ConfirmDialog
          title={`Xác nhận huỷ đơn hàng ${shortCode(toCancel.id)}?`}
          message={`Đơn hàng sẽ chuyển sang trạng thái "Đã huỷ" và ứng dụng sẽ thông báo cho chủ tàu. Thao tác này không thể đảo ngược.`}
          confirmLabel="Xác nhận huỷ đơn"
          cancelLabel="Hủy thao tác"
          danger
          onCancel={() => setToCancel(null)}
          onConfirm={() => {
            const o = toCancel;
            setToCancel(null);
            changeStatus(o, "da_huy");
          }}
        />
      )}
    </div>
  );
}

export function OrderCard({
  order,
  perms,
  busy,
  onChangeStatus,
  onSaveNote,
  onRequestCancel,
}: {
  order: CatalogOrder;
  perms: TabPerms;
  busy: boolean;
  onChangeStatus: (o: CatalogOrder, next: OrderStatus) => void;
  onSaveNote: (o: CatalogOrder, note: string) => void;
  onRequestCancel: () => void;
}) {
  const [note, setNote] = useState(order.dealerNote ?? "");
  const steps = ORDER_STEP_ACTIONS.filter((a) =>
    canTransition(order.status, a.to),
  );
  const canCancel = perms.edit && canTransition(order.status, "da_huy");
  const noteDirty = note.trim() !== (order.dealerNote ?? "").trim();

  return (
    <li className="surface overflow-hidden">
      <div className="flex items-start justify-between gap-3 px-4 pt-3">
        <div className="min-w-0">
          <p className="text-[1rem] font-bold text-navy">
            Đơn {shortCode(order.id)}
            {order.boatName ? ` · ${order.boatName}` : ""}
          </p>
          <p className="mt-0.5 text-[0.8125rem] tabular-nums text-foreground/70">
            SĐT {order.contactPhone}
            {order.contactName ? ` · ${order.contactName}` : ""}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[0.75rem] font-bold ${
            ORDER_BADGE[order.status]
          }`}
        >
          {ORDER_STATUS_LABELS[order.status]}
        </span>
      </div>

      <p className="px-4 pt-1 text-[0.8125rem] text-foreground/55">
        đặt {formatVnDate(order.createdAt.slice(0, 10))}
        {order.deliveryLocation ? ` · giao hàng tại ${order.deliveryLocation}` : ""}
      </p>

      <ul className="mt-2 border-t border-line">
        {order.items.map((line, i) => (
          <li
            key={`${line.listingId}-${i}`}
            className="flex items-baseline justify-between gap-3 px-4 py-1.5 text-[0.875rem]"
          >
            <span className="min-w-0 text-foreground/85">
              {line.title}{" "}
              <span className="text-foreground/55">
                ×{line.qty} {line.unit} @ {formatVnd(line.priceVnd)}
              </span>
            </span>
            <span className="shrink-0 font-semibold tabular-nums text-navy">
              {formatVnd(line.lineTotalVnd)}
            </span>
          </li>
        ))}
      </ul>
      <div className="flex items-baseline justify-between gap-3 border-t border-line px-4 py-2">
        <span className="text-[0.875rem] font-bold text-foreground/70">Tổng giá trị</span>
        <span className="text-[1.0625rem] font-bold tabular-nums text-navy">
          {formatVnd(order.totalVnd)}
        </span>
      </div>

      {order.note && (
        <p className="border-t border-line px-4 py-2 text-[0.875rem] leading-snug text-foreground/80">
          <span className="font-semibold text-foreground/60">Ghi chú từ chủ tàu: </span>
          {order.note}
        </p>
      )}

      {order.handledBy && (
        <p className="px-4 pt-2 text-[0.8125rem] text-foreground/55">
          xử lý bởi {order.handledBy}
          {order.handledAt ? ` · ${fmtDT(order.handledAt)}` : ""}
        </p>
      )}

      {perms.edit ? (
        <div className="border-t border-line px-4 py-2.5">
          <textarea
            placeholder="Ghi chú dành cho Nhà cung cấp (thông tin nội bộ) — tuỳ chọn"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="min-h-[3rem] w-full rounded-xl border-0 bg-field px-3 py-2 text-[0.875rem] focus:bg-card focus:outline-none focus:ring-2 focus:ring-sea"
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {noteDirty && (
              <button
                type="button"
                disabled={busy}
                onClick={() => onSaveNote(order, note.trim())}
                className="min-h-[2.5rem] shrink-0 rounded-lg bg-field px-3 text-[0.8125rem] font-bold text-navy disabled:opacity-50"
              >
                Lưu ghi chú
              </button>
            )}
            {steps.map((a) => (
              <button
                key={a.to}
                type="button"
                disabled={busy}
                onClick={() => onChangeStatus(order, a.to)}
                className="min-h-[2.5rem] flex-1 rounded-lg bg-navy px-3 text-[0.8125rem] font-bold text-white disabled:opacity-50"
              >
                {a.label}
              </button>
            ))}
            {canCancel && (
              <button
                type="button"
                disabled={busy}
                onClick={onRequestCancel}
                className="min-h-[2.5rem] shrink-0 rounded-lg bg-danger-bg px-3 text-[0.8125rem] font-bold text-danger disabled:opacity-50"
              >
                Huỷ
              </button>
            )}
          </div>
        </div>
      ) : (
        order.dealerNote && (
          <p className="border-t border-line px-4 py-2 text-[0.875rem] leading-snug text-foreground/80">
            <span className="font-semibold text-foreground/60">Ghi chú của Nhà cung cấp: </span>
            {order.dealerNote}
          </p>
        )
      )}
    </li>
  );
}
