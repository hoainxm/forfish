"use client";

// /ban-hang/don/[id] — CHI TIẾT ĐƠN phía người bán (11 §6.5).
// Hàng hành động đi đúng `TRANSITIONS.seller`; mọi cú bấm qua ConfirmDialog một
// câu, chống bấm đúp bằng `busy`, và 409 `bad_transition` (người khác vừa đổi)
// ⇒ nói thẳng + tự tải lại. Nút Gọi người mua KHÔNG ẩn khi mất sóng (LEAD §4 #10).
import { useState } from "react";
import { OrderStatusChip, PaymentStatusChip } from "@/components/market/shared/order-status-chip";
import { LineThumb } from "@/components/market/shared/line-thumb";
import { OrderTimeline } from "@/components/market/shared/order-timeline";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { ChipRow, type ChipOption } from "@/components/ui/chip-row";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CallButton, Field, PrimaryButton, inputClass } from "@/components/ui/primitives";
import { StatusBanner } from "@/components/ui/status-banner";
import { CartIcon, CheckIcon, CloseIcon, RouteIcon } from "@/components/icons";
import { formatVnd } from "@/lib/format";
import { marketSend } from "@/lib/market/client";
import {
  isPendingTooLong, ORDER_STATUS_LABEL, PAYMENT_METHOD_LABEL,
} from "@/lib/market/order-state";
import type { Order, OrderStatus } from "@/lib/market/types";
import { agoLabel, LoadView, marketErrorText, useInlineNote, useMarketData } from "./seller-net";
import { SELLER_BTN } from "./ui";

const CANCEL_CHIPS: readonly ChipOption<string>[] = [
  { id: "Hết hàng", label: "Hết hàng" },
  { id: "Không giao tới được", label: "Không giao tới được" },
  { id: "Không liên lạc được với người mua", label: "Không liên lạc được" },
];
const CARRIER_CHIPS: readonly ChipOption<string>[] = [
  { id: "Tự giao", label: "Tự giao" },
  { id: "Gửi xe", label: "Gửi xe" },
  { id: "Gửi ra cảng", label: "Gửi ra cảng" },
];

export function ShopOrderDetail({ id }: { id: string }) {
  const { state, reload, set } = useMarketData<{ order: Order }>(`/api/ban-hang/don/${id}`);
  return (
    <LoadView state={state} what="đơn hàng" onRetry={reload}>
      {(d) => <Inner order={d.order} onOrder={(order) => set({ order })} onReload={reload} />}
    </LoadView>
  );
}

type Ask =
  | { kind: "status"; to: OrderStatus; title: string; message: string }
  | { kind: "payment"; to: "da_thanh_toan"; title: string; message: string };

function Inner({ order, onOrder, onReload }: { order: Order; onOrder: (o: Order) => void; onReload: () => void }) {
  const note = useInlineNote();
  const [busy, setBusy] = useState(false);
  const [ask, setAsk] = useState<Ask | null>(null);
  const [cancelSheet, setCancelSheet] = useState(false);
  const [shipSheet, setShipSheet] = useState(false);
  const [payNoteSheet, setPayNoteSheet] = useState(false);
  const [sellerNote, setSellerNote] = useState(order.sellerNote ?? "");

  async function send(body: Record<string, unknown>, done: string) {
    if (busy) return; // chống bấm đúp
    setBusy(true);
    note.clear();
    const res = await marketSend<{ order: Order }>("PATCH", `/api/ban-hang/don/${order.id}`, body);
    setBusy(false);
    if (res.ok) {
      onOrder(res.data.order);
      note.show(done);
      return;
    }
    if (res.code === "bad_transition") {
      note.show("Đơn đã sang bước khác rồi — đang tải lại.", "danger");
      onReload();
      return;
    }
    note.show(res.offline ? "Cần sóng để xử lý đơn — nội dung vẫn còn đây." : marketErrorText(res), "danger");
  }

  const move = (to: OrderStatus, extra: Record<string, unknown> = {}) =>
    send({ status: to, ...extra }, `Đã chuyển sang ${ORDER_STATUS_LABEL[to]}.`);

  const late = isPendingTooLong(order, new Date().toISOString());
  const byAdmin = order.timeline.some((t) => t.by.startsWith("admin"));
  // ĐẾM SỐ DÒNG, không cộng số lượng (B-06/F-18)
  const soMon = order.items.length;

  return (
    <div className="pb-10">
      {order.needsRefund && (
        <div className="mb-3 overflow-hidden">
          <StatusBanner level="danger">
            Cần hoàn {formatVnd(order.totalVnd)} cho người mua {order.address.phone} — app không chuyển tiền giúp được.
          </StatusBanner>
        </div>
      )}
      {late && (
        <div className="mb-3 overflow-hidden">
          <StatusBanner level="warn">Đơn chờ quá 2 ngày — xác nhận hoặc gọi người mua giúp.</StatusBanner>
        </div>
      )}
      {byAdmin && (
        <div className="mb-3 overflow-hidden">
          <StatusBanner level="neutral">SDVICO đã xử lý thay shop ở một bước trong đơn này.</StatusBanner>
        </div>
      )}

      {note.node}

      <div className="px-4">
        <div className="surface px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <b className="text-[1.125rem] text-navy">{order.code}</b>
            <OrderStatusChip status={order.status} />
            <PaymentStatusChip status={order.paymentStatus} />
          </div>
          <p className="mt-1 text-[0.9375rem] text-foreground/65">
            Đặt {agoLabel(order.createdAt)} · {soMon} món · {PAYMENT_METHOD_LABEL[order.paymentMethod]}
          </p>
        </div>

        {/* ── Người nhận ─────────────────────────────────────────────── */}
        <div className="mt-3 surface px-4 py-3">
          <p className="text-[1rem] font-bold text-navy">Giao cho</p>
          <p className="mt-1 text-[1.125rem] font-bold text-navy">{order.address.name}</p>
          <p className="text-[1rem] text-foreground/80">
            {order.address.isPort ? "Cảng/bến: " : ""}{order.address.detail} · {order.address.province}
          </p>
          <p className="mt-0.5 text-[1rem] text-foreground/80">{order.address.phone}</p>
          {order.buyerNote && (
            <p className="mt-2 rounded-2xl bg-field px-3.5 py-2.5 text-[1rem] text-foreground/85">
              Người mua dặn: {order.buyerNote}
            </p>
          )}
          <div className="mt-3">
            {/* tel: KHÔNG ẩn khi mất sóng — mất data vẫn còn sóng thoại (LEAD §4 #10) */}
            <CallButton phone={order.address.phone} label="Gọi người mua" />
          </div>
        </div>

        {/* ── Hàng trong đơn ─────────────────────────────────────────── */}
        <div className="mt-3 surface px-4 py-3">
          <p className="mb-2 text-[1rem] font-bold text-navy">Hàng trong đơn</p>
          <ul className="space-y-2">
            {order.items.map((l, i) => (
              <li key={`${l.productId}-${l.variantLabel ?? ""}-${i}`} className="flex items-start justify-between gap-3">
                {/* Ảnh món để shop soạn hàng bằng mắt (F-15) */}
                <LineThumb image={l.image} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[1rem] font-semibold text-navy">{l.title}</span>
                  <span className="block text-[0.9375rem] text-foreground/65">
                    {l.variantLabel ? `${l.variantLabel} · ` : ""}{l.qty} {l.unit} × {formatVnd(l.priceVnd)}
                  </span>
                </span>
                <b className="shrink-0 text-[1rem] text-navy">{formatVnd(l.lineTotalVnd)}</b>
              </li>
            ))}
          </ul>
          <div className="mt-3 border-t border-line pt-2 text-[1rem]">
            <p className="flex justify-between text-foreground/80"><span>Tiền hàng</span><span>{formatVnd(order.subtotalVnd)}</span></p>
            <p className="flex justify-between text-foreground/80"><span>Phí giao</span><span>{formatVnd(order.shippingVnd)}</span></p>
            <p className="mt-1 flex justify-between text-[1.125rem] font-bold text-navy"><span>Tổng</span><span>{formatVnd(order.totalVnd)}</span></p>
          </div>
          {order.bankSnapshot && (
            <p className="mt-2 rounded-2xl bg-field px-3.5 py-2.5 text-[0.9375rem] leading-snug text-foreground/85">
              Chuyển khoản về {order.bankSnapshot.bankName} · {order.bankSnapshot.bankAccount} ·{" "}
              {order.bankSnapshot.bankHolder} — nội dung {order.code}
            </p>
          )}
        </div>

        {/* ── Tiền đang chờ xác nhận ─────────────────────────────────── */}
        {order.paymentStatus === "bao_da_chuyen" && order.status !== "da_huy" && order.status !== "hoan_thanh" && (
          <div className="mt-3 rounded-2xl px-4 py-3" style={{ backgroundColor: "var(--warn-bg)" }}>
            <p className="text-[1rem] font-bold" style={{ color: "var(--warn)" }}>
              Người mua báo đã chuyển {formatVnd(order.totalVnd)} · nội dung {order.code}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setAsk({
                  kind: "payment", to: "da_thanh_toan",
                  title: "Đã nhận đủ tiền?",
                  message: "Bấm xong người mua thấy đơn đã thanh toán.",
                })}
                className={`${SELLER_BTN} bg-card text-navy`}
              >
                <CheckIcon className="h-6 w-6" />
                {busy ? "Đang gửi…" : "Đã nhận tiền"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setPayNoteSheet(true)}
                className={`${SELLER_BTN} bg-card`}
                style={{ color: "var(--danger)" }}
              >
                <CloseIcon className="h-6 w-6" />
                {busy ? "Đang gửi…" : "Chưa thấy tiền"}
              </button>
            </div>
          </div>
        )}

        {/* ── Hành động theo trạng thái ──────────────────────────────── */}
        <div className="mt-3">
          {order.status === "cho_xac_nhan" && (
            <>
              <PrimaryButton
                disabled={busy}
                onClick={() => setAsk({
                  kind: "status", to: "da_xac_nhan",
                  title: "Xác nhận đơn này?",
                  message: "Người mua sẽ thấy shop đã nhận đơn.",
                })}
              >
                <CheckIcon className="h-6 w-6" /> {busy ? "Đang gửi…" : "Xác nhận đơn"}
              </PrimaryButton>
              <div className="mt-3 flex justify-center">
                <button type="button" disabled={busy} onClick={() => setCancelSheet(true)} className={`${SELLER_BTN} bg-field`} style={{ color: "var(--danger)" }}>
                  <CloseIcon className="h-6 w-6" />
                  {busy ? "Đang gửi…" : "Huỷ đơn"}
                </button>
              </div>
            </>
          )}

          {order.status === "da_xac_nhan" && (
            <>
              <PrimaryButton disabled={busy} onClick={() => setShipSheet(true)}>
                <RouteIcon className="h-6 w-6" /> {busy ? "Đang gửi…" : "Giao hàng"}
              </PrimaryButton>
              <div className="mt-3 flex justify-center">
                <button type="button" disabled={busy} onClick={() => setCancelSheet(true)} className={`${SELLER_BTN} bg-field`} style={{ color: "var(--danger)" }}>
                  <CloseIcon className="h-6 w-6" />
                  {busy ? "Đang gửi…" : "Huỷ đơn"}
                </button>
              </div>
            </>
          )}

          {order.status === "dang_giao" && (
            <PrimaryButton
              disabled={busy}
              onClick={() => setAsk({
                kind: "status", to: "da_giao",
                title: "Đã giao xong đơn này?",
                message: "Người mua sẽ được nhắc bấm Đã nhận hàng.",
              })}
            >
              <CartIcon className="h-6 w-6" /> {busy ? "Đang gửi…" : "Đã giao xong"}
            </PrimaryButton>
          )}

          {order.status === "da_giao" && (
            <p className="rounded-2xl bg-field px-4 py-3 text-[1rem] text-foreground/80">
              Chờ người mua bấm Đã nhận hàng — quá 7 ngày đơn tự hoàn thành.
            </p>
          )}

          {order.status === "da_huy" && order.cancelReason && (
            <p className="rounded-2xl px-4 py-3 text-[1rem]" style={{ backgroundColor: "var(--danger-bg)", color: "var(--danger)" }}>
              Đã huỷ: {order.cancelReason}
            </p>
          )}
        </div>

        {/* ── Ghi chú của shop cho người mua ─────────────────────────── */}
        <div className="mt-4">
          <Field label="Ghi chú cho người mua">
            <textarea
              className={inputClass}
              rows={2}
              value={sellerNote}
              onChange={(e) => setSellerNote(e.target.value)}
              maxLength={300}
              placeholder="Ví dụ: gửi xe Phương Trang chuyến 5 giờ chiều"
            />
          </Field>
          {/*  Nút Lưu chỉ hiện khi ô ĐÃ ĐỔI (F-26): nút mờ nằm sẵn thì bà con
              không biết mình đã gõ gì chưa lưu; hiện lên là lời nhắc. */}
          {sellerNote !== (order.sellerNote ?? "") && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void send({ sellerNote }, "Đã lưu ghi chú.")}
              /* nút phụ: cam full-width để dành cho hành động chính của màn */
              className={`${SELLER_BTN} w-full bg-field text-navy`}
            >
              <CheckIcon className="h-6 w-6" />
              Lưu ghi chú
            </button>
          )}
        </div>

        <div className="mt-4 surface px-4 py-3">
          <p className="mb-2 text-[1rem] font-bold text-navy">Đường đi của đơn</p>
          <OrderTimeline timeline={order.timeline} carrier={order.carrier} trackingCode={order.trackingCode} />
        </div>
      </div>

      {ask && (
        <ConfirmDialog
          title={ask.title}
          message={ask.message}
          confirmLabel="Đồng ý"
          danger={false}
          onCancel={() => setAsk(null)}
          onConfirm={() => {
            const a = ask;
            setAsk(null);
            if (a.kind === "status") void move(a.to);
            else void send({ paymentStatus: a.to }, "Đã ghi nhận nhận tiền.");
          }}
        />
      )}

      {cancelSheet && (
        <CancelSheet
          busy={busy}
          refundVnd={
            /*  Cùng luật với `needsRefund` ở tầng đơn (AC-36): chuyển khoản mà
                người mua đã báo đã chuyển, hoặc shop đã nhận tiền. Nói TRƯỚC
                khi bấm, không phải sau — huỷ rồi thì không lùi được. */
            order.paymentMethod === "chuyen_khoan" &&
            (order.paymentStatus === "bao_da_chuyen" || order.paymentStatus === "da_thanh_toan")
              ? order.totalVnd
              : 0
          }
          onClose={() => setCancelSheet(false)}
          onSend={(reason) => { setCancelSheet(false); void move("da_huy", { note: reason }); }}
        />
      )}

      {shipSheet && (
        <ShipSheet
          busy={busy}
          onClose={() => setShipSheet(false)}
          onSend={(carrier, trackingCode) => {
            setShipSheet(false);
            void move("dang_giao", { ...(carrier ? { carrier } : {}), ...(trackingCode ? { trackingCode } : {}) });
          }}
        />
      )}

      {payNoteSheet && (
        <PayNoteSheet
          busy={busy}
          onClose={() => setPayNoteSheet(false)}
          onSend={(reason) => {
            setPayNoteSheet(false);
            void send({ paymentStatus: "chua_thanh_toan", note: reason }, "Đã báo người mua là chưa thấy tiền.");
          }}
        />
      )}
    </div>
  );
}

/** Huỷ đơn — LÝ DO BẮT BUỘC 5–200 chữ (11 §4.1 T6), chip gợi ý cho nhanh. */
function CancelSheet({
  busy,
  refundVnd,
  onClose,
  onSend,
}: {
  busy: boolean;
  /** > 0 khi huỷ đơn này SẼ đẻ ra nghĩa vụ hoàn tiền — cảnh báo TRƯỚC */
  refundVnd: number;
  onClose: () => void;
  onSend: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const short = reason.trim().length < 5;
  return (
    <BottomSheet title="Huỷ đơn — vì sao?" onClose={onClose}>
      <div className="px-4 pb-4">
        {refundVnd > 0 && (
          <div className="mb-3 rounded-2xl px-4 py-3" style={{ backgroundColor: "var(--danger-bg)" }}>
            <p className="text-[1rem] font-bold leading-snug" style={{ color: "var(--danger)" }}>
              Người mua đã chuyển tiền đơn này. Huỷ xong bà con PHẢI tự chuyển trả
              {" "}
              {formatVnd(refundVnd)} cho họ — app không giữ tiền, không tự hoàn được.
            </p>
          </div>
        )}
        <div className="-mx-4 mb-3">
          <ChipRow options={CANCEL_CHIPS} value={reason} onChange={setReason} accent="t3" level={1} ariaLabel="Lý do huỷ" />
        </div>
        <Field label="Lý do cho người mua biết">
          <textarea
            className={inputClass}
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={200}
            placeholder="Ít nhất 5 chữ"
          />
        </Field>
        {/*  Câu này KHÔNG gác theo "đã gõ được chữ nào chưa" nữa (R-03): trước đây nút mờ
             ngay lúc mở tấm che, mà lúc đó ô còn trống nên KHÔNG có chữ nào —
             bà con thấy một nút chết không lời giải thích. */}
        {short && (
          <p className="mb-2 text-[1rem] font-bold" style={{ color: "var(--danger)" }}>
            Ghi ít nhất 5 chữ nói vì sao huỷ — người mua sẽ đọc câu này.
          </p>
        )}
        <PrimaryButton disabled={busy || short} onClick={() => onSend(reason.trim())}>
          {busy ? "Đang huỷ…" : "Huỷ đơn này"}
        </PrimaryButton>
      </div>
    </BottomSheet>
  );
}

/** Giao hàng — cách giao / nhà xe / mã vận đơn đều TUỲ CHỌN (11 §6.5). */
function ShipSheet({ busy, onClose, onSend }: { busy: boolean; onClose: () => void; onSend: (carrier: string, tracking: string) => void }) {
  const [carrier, setCarrier] = useState("");
  const [tracking, setTracking] = useState("");
  return (
    <BottomSheet title="Giao hàng" onClose={onClose}>
      <div className="px-4 pb-4">
        <div className="-mx-4 mb-3">
          <ChipRow options={CARRIER_CHIPS} value={carrier} onChange={setCarrier} accent="t3" level={1} ariaLabel="Cách giao" />
        </div>
        <Field label="Đơn vị / nhà xe (không bắt buộc)">
          <input className={inputClass} value={carrier} onChange={(e) => setCarrier(e.target.value)} maxLength={40} placeholder="Ví dụ: Xe Phương Trang" />
        </Field>
        <Field label="Mã vận đơn (không bắt buộc)">
          <input className={inputClass} value={tracking} onChange={(e) => setTracking(e.target.value)} maxLength={40} placeholder="Ví dụ: PT-88213" />
        </Field>
        <PrimaryButton disabled={busy} onClick={() => onSend(carrier.trim(), tracking.trim())}>
          {busy ? "Đang gửi…" : "Chuyển sang Đang giao"}
        </PrimaryButton>
      </div>
    </BottomSheet>
  );
}

/** "Chưa thấy tiền" (P3) — lý do BẮT BUỘC 5–200 chữ, người mua nhận tin ngay. */
function PayNoteSheet({ busy, onClose, onSend }: { busy: boolean; onClose: () => void; onSend: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  const short = reason.trim().length < 5;
  return (
    <BottomSheet title="Chưa thấy tiền về" onClose={onClose}>
      <div className="px-4 pb-4">
        <Field label="Nói rõ cho người mua kiểm lại">
          <textarea
            className={inputClass}
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={200}
            placeholder="Ví dụ: tài khoản chưa thấy tiền về, nhờ bà con kiểm lại nội dung chuyển khoản"
          />
        </Field>
        {/* Cùng luật R-03 với tấm che huỷ đơn — xem chú thích ở CancelSheet. */}
        {short && (
          <p className="mb-2 text-[1rem] font-bold" style={{ color: "var(--danger)" }}>
            Ghi ít nhất 5 chữ nói rõ chưa thấy tiền — người mua sẽ đọc câu này.
          </p>
        )}
        <PrimaryButton disabled={busy || short} onClick={() => onSend(reason.trim())}>
          {busy ? "Đang gửi…" : "Báo chưa thấy tiền"}
        </PrimaryButton>
      </div>
    </BottomSheet>
  );
}
