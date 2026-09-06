"use client";

/*
  Mục "Đơn hàng" của tab Chợ vật tư — admin XỬ LÝ THAY SHOP (11 §7, LEAD §4 #2).
  Dùng khi gian hàng SDVICO chưa có chủ, hoặc bà con gọi tổng đài khiếu nại.
  Mỗi bước ghi một dòng timeline `by = admin:<sđt>` (route lo) nên người bán mở
  đơn ra vẫn biết ai đã đụng vào.
*/

import { useState } from "react";
import { formatVnd } from "@/lib/format";
import { clockVN } from "@/lib/day-labels";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  ORDER_STATUS_LABEL,
  ORDER_STATUSES,
  PAYMENT_METHOD_LABEL,
} from "@/lib/market/order-state";
import { OrderStatusChip, PaymentStatusChip } from "@/components/market/shared/order-status-chip";
import { OrderTimeline } from "@/components/market/shared/order-timeline";
import type { Order, OrderStatus } from "@/lib/market/types";
import {
  EmptyBox,
  ErrorBox,
  FilterChip,
  LoadingBox,
  marketAdminPatch,
  NoticeBar,
  PageHint,
  ReasonDialog,
  useAdminList,
} from "./market-admin-shared";

/** Bộ lọc trạng thái — tab giữ hộ để ô KPI bấm được sang đúng mục (11 §7). */
export type OrderFilter = OrderStatus | "all";
type Ask = "xac-nhan" | "giao" | "da-giao" | "hoan-thanh" | "huy" | "nhan-tien" | "chua-thay" | null;

const INPUT =
  "min-h-[2.75rem] rounded-xl border-0 bg-field px-3 text-[1rem] focus:bg-card focus:outline-none focus:ring-2 focus:ring-sea";

export function MarketAdminOrders({
  shops,
  shopId,
  onShopId,
  status,
  onStatus,
  onChanged,
}: {
  shops: { id: string; name: string }[];
  shopId: string;
  onShopId: (id: string) => void;
  status: OrderFilter;
  onStatus: (s: OrderFilter) => void;
  onChanged: () => void;
}) {
  const [codeDraft, setCodeDraft] = useState("");
  const [phoneDraft, setPhoneDraft] = useState("");
  const [query, setQuery] = useState({ code: "", buyerPhone: "" });
  const [openId, setOpenId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const sp = new URLSearchParams();
  if (status !== "all") sp.set("status", status);
  if (shopId) sp.set("shopId", shopId);
  if (query.code) sp.set("code", query.code);
  if (query.buyerPhone) sp.set("buyerPhone", query.buyerPhone);
  const { rows, total, error, loadingMore, reload, refresh, loadMore } = useAdminList<Order>(
    `/api/admin/cho/don?${sp.toString()}`,
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        <FilterChip label="Tất cả" active={status === "all"} onClick={() => onStatus("all")} />
        {ORDER_STATUSES.map((s) => (
          <FilterChip
            key={s}
            label={ORDER_STATUS_LABEL[s]}
            active={status === s}
            onClick={() => onStatus(s)}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={shopId}
          onChange={(e) => onShopId(e.target.value)}
          className={`${INPUT} max-w-full`}
          aria-label="Lọc theo gian hàng"
        >
          <option value="">Mọi gian hàng</option>
          {shops.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <input
          value={codeDraft}
          onChange={(e) => setCodeDraft(e.target.value.toUpperCase())}
          placeholder="Mã đơn (SD…)"
          className={`${INPUT} w-[11rem]`}
          aria-label="Mã đơn"
        />
        <input
          value={phoneDraft}
          onChange={(e) => setPhoneDraft(e.target.value.replace(/[^\d]/g, ""))}
          placeholder="SĐT người mua"
          inputMode="numeric"
          className={`${INPUT} w-[11rem] tabular-nums`}
          aria-label="SĐT người mua"
        />
        <button
          type="button"
          onClick={() => setQuery({ code: codeDraft.trim(), buyerPhone: phoneDraft.trim() })}
          className="min-h-[2.75rem] rounded-xl bg-navy px-5 text-[0.9375rem] font-bold text-white"
        >
          Tìm
        </button>
        {(query.code || query.buyerPhone) && (
          <button
            type="button"
            onClick={() => {
              setCodeDraft("");
              setPhoneDraft("");
              setQuery({ code: "", buyerPhone: "" });
            }}
            className="min-h-[2.75rem] rounded-xl bg-field px-4 text-[0.9375rem] font-bold text-navy"
          >
            Xoá lọc
          </button>
        )}
      </div>

      {notice && (
        <NoticeBar ok={notice.ok} text={notice.text} onClose={() => setNotice(null)} />
      )}

      {error && <ErrorBox text={error} onRetry={reload} />}
      {!rows && !error && <LoadingBox what="đơn hàng" />}
      {rows && rows.length === 0 && (
        <EmptyBox
          text={
            status === "all"
              ? "Chưa có đơn nào khớp bộ lọc — thử bỏ lọc gian hàng / mã đơn / SĐT."
              : `Không có đơn nào đang ở "${ORDER_STATUS_LABEL[status]}" — chọn "Tất cả" để xem mọi đơn.`
          }
        />
      )}

      {rows && rows.length > 0 && (
        <PageHint
          shown={rows.length}
          total={total}
          what="đơn"
          /* Phải nói ra: danh sách này KHÔNG giới hạn ngày, còn ô KPI ở đầu tab
             đếm theo kỳ — hai số lệch nhau là bình thường, im lặng thì admin
             tưởng máy đếm sai (F-27). */
          note={
            <>
              Danh sách không giới hạn ngày; ô KPI ở đầu tab đếm <b>theo kỳ</b> (hôm nay · 7 ngày
              · 30 ngày) nên hai số có thể khác nhau.
            </>
          }
          onMore={loadMore}
          loadingMore={loadingMore}
        />
      )}
      {rows && rows.length > 0 && (
        <ul className="space-y-3">
          {rows.map((o) => (
            <OrderRow
              key={o.id}
              order={o}
              open={openId === o.id}
              onToggle={() => setOpenId(openId === o.id ? null : o.id)}
              onDone={(say) => {
                setNotice({ ok: true, text: say });
                refresh();
                onChanged();
              }}
              onError={(msg) => setNotice({ ok: false, text: msg })}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function OrderRow({
  order,
  open,
  onToggle,
  onDone,
  onError,
}: {
  order: Order;
  open: boolean;
  onToggle: () => void;
  onDone: (say: string) => void;
  onError: (msg: string) => void;
}) {
  const [ask, setAsk] = useState<Ask>(null);
  const [busy, setBusy] = useState(false);
  const [carrier, setCarrier] = useState(order.carrier ?? "");
  const [tracking, setTracking] = useState(order.trackingCode ?? "");

  const ended = order.status === "hoan_thanh" || order.status === "da_huy";
  const canConfirmMoney = order.paymentMethod === "chuyen_khoan" && !ended && order.paymentStatus !== "da_thanh_toan";

  async function patch(body: Record<string, unknown>, say: string) {
    setBusy(true);
    try {
      await marketAdminPatch(`/api/admin/cho/don/${encodeURIComponent(order.id)}`, body);
      onDone(`${order.code}: ${say}`);
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const btn = "min-h-[2.5rem] shrink-0 rounded-lg px-3 text-[0.8125rem] font-bold disabled:opacity-50";

  return (
    <li className="surface overflow-hidden">
      <div className="flex items-start justify-between gap-3 px-4 pt-3">
        <div className="min-w-0">
          <p className="text-[1rem] font-bold text-navy">
            {order.code}
            {order.shopName ? ` · ${order.shopName}` : ""}
          </p>
          <p className="mt-0.5 text-[0.8125rem] tabular-nums text-foreground/70">
            {order.address.name} · {order.address.phone} · {order.address.province}
          </p>
          <p className="text-[0.8125rem] text-foreground/55">
            {clockVN(Date.parse(order.createdAt))} · {order.items.length} món ·{" "}
            {PAYMENT_METHOD_LABEL[order.paymentMethod]}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <OrderStatusChip status={order.status} />
          <span className="text-[1rem] font-bold tabular-nums text-navy">
            {formatVnd(order.totalVnd)}
          </span>
        </div>
      </div>

      {order.needsRefund && (
        <p className="mt-2 bg-danger-bg px-4 py-2 text-[0.875rem] font-bold text-danger">
          Cần hoàn tiền cho người mua {order.buyerPhone} — app không xử lý tiền, shop tự chuyển lại.
        </p>
      )}

      <div className="flex flex-wrap gap-1.5 border-t border-line px-4 py-2.5">
        <button type="button" onClick={onToggle} className={`${btn} bg-field text-navy`}>
          {open ? "Thu gọn" : "Xem chi tiết"}
        </button>
        {order.status === "cho_xac_nhan" && (
          <button type="button" disabled={busy} onClick={() => setAsk("xac-nhan")} className={`${btn} bg-navy text-white`}>
            Xác nhận đơn
          </button>
        )}
        {order.status === "da_xac_nhan" && (
          <button type="button" disabled={busy} onClick={() => setAsk("giao")} className={`${btn} bg-navy text-white`}>
            Bắt đầu giao
          </button>
        )}
        {order.status === "dang_giao" && (
          <button type="button" disabled={busy} onClick={() => setAsk("da-giao")} className={`${btn} bg-navy text-white`}>
            Đã giao xong
          </button>
        )}
        {order.status === "da_giao" && (
          <button type="button" disabled={busy} onClick={() => setAsk("hoan-thanh")} className={`${btn} bg-navy text-white`}>
            Người mua đã nhận
          </button>
        )}
        {canConfirmMoney && (
          <button type="button" disabled={busy} onClick={() => setAsk("nhan-tien")} className={`${btn} bg-ok-bg text-ok`}>
            Đã nhận tiền
          </button>
        )}
        {order.paymentStatus === "bao_da_chuyen" && !ended && (
          <button type="button" disabled={busy} onClick={() => setAsk("chua-thay")} className={`${btn} bg-warn-bg text-warn`}>
            Chưa thấy tiền
          </button>
        )}
        {(order.status === "cho_xac_nhan" ||
          order.status === "da_xac_nhan" ||
          order.status === "dang_giao") && (
          <button type="button" disabled={busy} onClick={() => setAsk("huy")} className={`${btn} bg-danger-bg text-danger`}>
            Huỷ đơn
          </button>
        )}
      </div>

      {open && (
        <div className="border-t border-line px-4 py-3">
          <ul className="mb-2">
            {order.items.map((l, i) => (
              <li
                key={`${l.productId}-${i}`}
                className="flex items-baseline justify-between gap-3 py-1 text-[0.875rem]"
              >
                <span className="min-w-0 text-foreground/85">
                  {l.title}
                  {l.variantLabel ? ` (${l.variantLabel})` : ""}{" "}
                  <span className="text-foreground/55">
                    ×{l.qty} {l.unit} @ {formatVnd(l.priceVnd)}
                  </span>
                </span>
                <span className="shrink-0 font-semibold tabular-nums text-navy">
                  {formatVnd(l.lineTotalVnd)}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-[0.875rem] text-foreground/70">
            Hàng {formatVnd(order.subtotalVnd)} · giao {formatVnd(order.shippingVnd)} ·{" "}
            <b className="text-navy">tổng {formatVnd(order.totalVnd)}</b>
          </p>
          <p className="mt-1 text-[0.875rem] text-foreground/70">
            Nhận tại: {order.address.detail}
            {order.address.isPort ? " (cảng/bến)" : ""}
          </p>
          {order.buyerNote && (
            <p className="mt-1 text-[0.875rem] text-foreground/70">
              Ghi chú người mua: {order.buyerNote}
            </p>
          )}
          {order.sellerNote && (
            <p className="mt-1 text-[0.875rem] text-foreground/70">
              Ghi chú của shop: {order.sellerNote}
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <PaymentStatusChip status={order.paymentStatus} />
            {order.bankSnapshot && (
              <span className="text-[0.8125rem] tabular-nums text-foreground/65">
                {order.bankSnapshot.bankName} · {order.bankSnapshot.bankAccount} ·{" "}
                {order.bankSnapshot.bankHolder}
              </span>
            )}
          </div>

          {order.status === "da_xac_nhan" && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                value={carrier}
                onChange={(e) => setCarrier(e.target.value.slice(0, 40))}
                placeholder="Đơn vị / nhà xe (tuỳ chọn)"
                className={`${INPUT} w-[14rem]`}
                aria-label="Đơn vị giao hàng"
              />
              <input
                value={tracking}
                onChange={(e) => setTracking(e.target.value.slice(0, 40))}
                placeholder="Mã vận đơn (tuỳ chọn)"
                className={`${INPUT} w-[11rem]`}
                aria-label="Mã vận đơn"
              />
            </div>
          )}

          <p className="mt-3 text-[0.875rem] font-semibold text-foreground/60">Diễn biến đơn</p>
          <OrderTimeline
            timeline={order.timeline}
            carrier={order.carrier}
            trackingCode={order.trackingCode}
            className="mt-1"
          />
        </div>
      )}

      {ask === "xac-nhan" && (
        <ConfirmDialog
          title={`Xác nhận đơn ${order.code} thay shop?`}
          message="Người mua sẽ thấy đơn đã được xác nhận. Diễn biến ghi rõ SDVICO làm thay."
          confirmLabel="Xác nhận"
          cancelLabel="Không"
          danger={false}
          onCancel={() => setAsk(null)}
          onConfirm={() => {
            setAsk(null);
            patch({ status: "da_xac_nhan" }, "Đã xác nhận đơn.");
          }}
        />
      )}
      {ask === "giao" && (
        <ConfirmDialog
          title={`Chuyển đơn ${order.code} sang Đang giao?`}
          message="Người mua nhận thông báo kèm nhà xe / mã vận đơn đã ghi ở trên."
          confirmLabel="Bắt đầu giao"
          cancelLabel="Không"
          danger={false}
          onCancel={() => setAsk(null)}
          onConfirm={() => {
            setAsk(null);
            patch(
              {
                status: "dang_giao",
                ...(carrier.trim() ? { carrier: carrier.trim() } : {}),
                ...(tracking.trim() ? { trackingCode: tracking.trim() } : {}),
              },
              "Đơn đã chuyển sang Đang giao.",
            );
          }}
        />
      )}
      {ask === "da-giao" && (
        <ConfirmDialog
          title={`Đơn ${order.code} đã giao xong?`}
          message="Người mua được nhắc bấm Đã nhận hàng; sau 7 ngày đơn tự hoàn thành."
          confirmLabel="Đã giao xong"
          cancelLabel="Không"
          danger={false}
          onCancel={() => setAsk(null)}
          onConfirm={() => {
            setAsk(null);
            patch({ status: "da_giao" }, "Đơn đã chuyển sang Đã giao.");
          }}
        />
      )}
      {ask === "hoan-thanh" && (
        <ConfirmDialog
          title={`Đóng đơn ${order.code} là hoàn thành?`}
          message="Chỉ làm khi người mua xác nhận qua điện thoại đã nhận đủ hàng."
          confirmLabel="Hoàn thành"
          cancelLabel="Không"
          danger={false}
          onCancel={() => setAsk(null)}
          onConfirm={() => {
            setAsk(null);
            patch({ status: "hoan_thanh" }, "Đơn đã hoàn thành.");
          }}
        />
      )}
      {ask === "nhan-tien" && (
        <ConfirmDialog
          title={`Xác nhận shop đã nhận tiền đơn ${order.code}?`}
          message="Chỉ bấm khi shop báo tiền đã về tài khoản."
          confirmLabel="Đã nhận tiền"
          cancelLabel="Không"
          danger={false}
          onCancel={() => setAsk(null)}
          onConfirm={() => {
            setAsk(null);
            patch({ paymentStatus: "da_thanh_toan" }, "Đã ghi nhận tiền về.");
          }}
        />
      )}
      {ask === "chua-thay" && (
        <ReasonDialog
          title={`Báo chưa thấy tiền đơn ${order.code}?`}
          message="Người mua nhận thông báo để kiểm tra lại."
          confirmLabel="Báo chưa thấy"
          placeholder="Vì sao chưa thấy tiền? (5–200 chữ)"
          maxLen={200}
          onCancel={() => setAsk(null)}
          onConfirm={(reason) => {
            setAsk(null);
            patch({ paymentStatus: "chua_thanh_toan", note: reason }, "Đã báo chưa thấy tiền.");
          }}
        />
      )}
      {ask === "huy" && (
        <ReasonDialog
          title={`Huỷ đơn ${order.code}?`}
          message="Hàng được hoàn về kho shop. Người mua nhận thông báo kèm lý do."
          confirmLabel="Huỷ đơn"
          placeholder="Lý do huỷ (5–200 chữ)"
          maxLen={200}
          suggestions={["Hết hàng", "Không giao tới được", "Không liên lạc được người mua"]}
          onCancel={() => setAsk(null)}
          onConfirm={(reason) => {
            setAsk(null);
            patch({ status: "da_huy", note: reason }, "Đã huỷ đơn.");
          }}
        />
      )}
    </li>
  );
}
