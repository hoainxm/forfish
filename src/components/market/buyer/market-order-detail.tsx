"use client";

// `/cho/don/[id]` — CHI TIẾT ĐƠN (11 §5.8). Mọi hành động ghi đều qua
// ConfirmDialog rồi trả lời bằng một dòng ngay tại chỗ (không toast).
//
// MẤT SÓNG: đọc đơn từ bản lưu trong máy; nút ghi vô hiệu kèm câu "việc này cần
// có sóng"; **nút Gọi shop KHÔNG ẩn** (LEAD §4 #10).
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AlertIcon, CheckIcon } from "@/components/icons";
import { AutoCancelNote, EtaLine, OrderSteps } from "@/components/market/shared/eta";
import { LineThumb } from "@/components/market/shared/line-thumb";
import { MoneyText } from "@/components/market/shared/price-text";
import { OrderStatusChip, PaymentStatusChip } from "@/components/market/shared/order-status-chip";
import { OrderTimeline } from "@/components/market/shared/order-timeline";
import { RatingStars } from "@/components/market/shared/rating-stars";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CallButton, PrimaryButton, inputClass } from "@/components/ui/primitives";
import { StatusBanner } from "@/components/ui/status-banner";
import { savedAgoLabel } from "@/lib/forecast-cache";
import { formatVnd } from "@/lib/format";
import { marketLineKey } from "@/lib/market/cart";
import { marketGet, marketPost } from "@/lib/market/client";
import {
  isPendingTooLong, PAYMENT_METHOD_LABEL,
} from "@/lib/market/order-state";
import { loadCachedMarketOrders, saveCachedMarketOrders } from "@/lib/market/orders-cache";
import type { CartQuote, Order, OrderLine } from "@/lib/market/types";
import { useOnlineRefetch } from "@/lib/market/use-online";
import { REVIEW_MAX } from "@/lib/market/validate";
import { useAuthUser } from "@/lib/use-auth";
import { ErrorBlock } from "./ui";
import { useMarketCart, useOnlineState } from "./hooks";

type Act = "huy" | "da-nhan" | "bao-chuyen";

const CANCEL_REASONS = ["Đặt nhầm món", "Không cần nữa", "Tìm được chỗ gần hơn", "Shop lâu xác nhận"];

export function MarketOrderDetail({ id }: { id: string }) {
  const online = useOnlineState();
  const { phone } = useAuthUser();
  const cart = useMarketCart();

  const [order, setOrder] = useState<Order | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "error" | "offline" | "gone">("loading");
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [act, setAct] = useState<Act | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [reviewLine, setReviewLine] = useState<OrderLine | null>(null);
  const [rating, setRating] = useState<1 | 2 | 3 | 4 | 5>(5);
  const [comment, setComment] = useState("");
  const [reviewed, setReviewed] = useState<string[]>([]);
  const [reviewNote, setReviewNote] = useState<string | null>(null);
  const [rebuying, setRebuying] = useState(false);
  const [rebuyNote, setRebuyNote] = useState<string | null>(null);
  const [rebuyAdded, setRebuyAdded] = useState(0);

  const load = useCallback(async () => {
    setStatus("loading");
    const res = await marketGet<{ order: Order }>(`/api/cho/don/${id}`);
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
    const cache = loadCachedMarketOrders(phone);
    const cached = cache?.orders.find((o) => o.id === id);
    if (cached) {
      setOrder(cached);
      setSavedAt(cache?.savedAt ?? null);
      setStatus("ok");
      return;
    }
    setStatus(res.offline ? "offline" : "error");
  }, [id, phone]);

  useEffect(() => {
    void load();
  }, [load]);
  useOnlineRefetch(() => void load());

  const run = async (kind: Act) => {
    if (!order) return;
    setBusy(true);
    const body = kind === "huy" && reason.trim() ? { reason: reason.trim() } : {};
    const res = await marketPost<{ order: Order }>(`/api/cho/don/${order.id}/${kind}`, body);
    setBusy(false);
    setAct(null);
    if (!res.ok) {
      setNote(
        res.offline
          ? "Chưa gửi được — việc này cần có sóng."
          : res.code === "bad_transition"
            ? "Đơn đã sang bước khác rồi — đang tải lại."
            : res.message || "Chưa làm được — thử lại giúp.",
      );
      if (res.code === "bad_transition") void load();
      return;
    }
    setOrder(res.data.order);
    const cache = loadCachedMarketOrders(phone);
    if (cache) saveCachedMarketOrders(phone, cache.orders.map((o) => (o.id === res.data.order.id ? res.data.order : o)));
    setNote(
      kind === "huy"
        ? `Đã huỷ đơn ${res.data.order.code}.`
        : kind === "da-nhan"
          ? "Cảm ơn bà con. Đánh giá món hàng giúp shop nhé?"
          : "Đã báo shop — shop kiểm tra rồi xác nhận.",
    );
  };

  const sendReview = async () => {
    if (!order || !reviewLine) return;
    setBusy(true);
    const res = await marketPost(`/api/cho/don/${order.id}/danh-gia`, {
      productId: reviewLine.productId,
      rating,
      ...(comment.trim() ? { comment: comment.trim() } : {}),
    });
    setBusy(false);
    if (!res.ok) {
      setReviewNote(
        res.offline
          ? "Chưa gửi được — đánh giá cần có sóng."
          : res.code === "already_reviewed"
            ? "Món này bà con đã đánh giá rồi."
            : res.message || "Chưa gửi được đánh giá — thử lại giúp.",
      );
      if (res.code === "already_reviewed") setReviewed((v) => [...v, reviewLine.productId]);
      return;
    }
    setReviewed((v) => [...v, reviewLine.productId]);
    setReviewLine(null);
    setComment("");
    setRating(5);
    setReviewNote(null);
    setNote("Đã gửi đánh giá. Cảm ơn bà con.");
  };

  /*  MUA LẠI (11 §5.8): thêm lại đúng các món CÒN BÁN vào giỏ. Tra lại bằng
      chính route giỏ (`/api/cho/gio/tinh`) — nó đã biết luật món ngừng bán /
      hết hàng / shop nghỉ, khỏi đẻ luật thứ hai ở đây. Mất sóng hay chợ trục
      trặc thì VẪN thêm (giỏ là việc của máy) và nói thẳng là chưa kiểm được,
      chứ không chặn bà con. */
  const rebuy = async () => {
    if (!order || rebuying) return;
    setRebuying(true);
    const items = order.items.map((l) => ({
      productId: l.productId, qty: l.qty, ...(l.variantLabel ? { variantLabel: l.variantLabel } : {}),
    }));
    const res = await marketPost<{ quote: CartQuote }>("/api/cho/gio/tinh", { items });
    setRebuying(false);

    const checked = res.ok;
    const sellable = checked
      ? new Set(res.data.quote.groups.flatMap((g) => g.lines.map((l) => marketLineKey(l.productId, l.variantLabel))))
      : null;
    let added = 0;
    let gone = 0;
    let full = false;
    for (const l of order.items) {
      if (sellable && !sellable.has(marketLineKey(l.productId, l.variantLabel))) {
        gone += 1;
        continue;
      }
      const r = cart.add(l.productId, l.variantLabel, l.qty);
      if (r === "ok") added += 1;
      else full = true;
    }
    setRebuyAdded(added);
    setRebuyNote(
      added === 0
        ? gone > 0
          ? "Các món trong đơn này không còn bán nữa."
          : "Chưa thêm được vào giỏ — máy hết chỗ hoặc giỏ đã đầy."
        : [
            `Đã thêm ${added} món vào giỏ.`,
            gone > 0 ? `${gone} món không còn bán.` : "",
            full ? "Còn lại chưa thêm được — giỏ đầy hoặc máy hết chỗ." : "",
            !checked ? "Chưa kiểm được món nào còn bán (mất sóng) — xem lại ở giỏ giúp." : "",
          ].filter(Boolean).join(" "),
    );
  };

  const copyCode = async () => {
    if (!order) return;
    try {
      await navigator.clipboard.writeText(order.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      setCopied(false);
    }
  };

  if (status === "loading") {
    return (
      <div role="status" aria-label="Đang tải đơn" className="px-4 py-3 pb-[7rem]">
        <div className="h-8 w-1/2 animate-pulse rounded bg-field" />
        <div className="mt-2 h-6 w-1/3 animate-pulse rounded bg-field" />
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
          Về đơn của tôi
        </Link>
      </div>
    );
  }
  if (!order) {
    return (
      <div className="px-4 py-4 pb-[7rem]">
        {status === "offline" ? (
          <div className="rounded-2xl bg-field/70 px-4 py-8 text-center" role="status">
            <p className="text-[1rem] font-semibold text-navy">
              Máy đang không có sóng — chưa mở được đơn này và máy chưa lưu bản nào.
            </p>
            <button
              type="button"
              onClick={() => void load()}
              className="display mx-auto mt-4 flex min-h-(--row-h) w-full max-w-[15rem] items-center justify-center rounded-full bg-trim text-[1rem] font-semibold text-white "
            >
              Thử lại
            </button>
          </div>
        ) : (
          <ErrorBlock what="đơn này" onRetry={() => void load()} />
        )}
      </div>
    );
  }

  const nowIso = new Date().toISOString();
  const canCancel = order.status === "cho_xac_nhan";
  const canReceive = order.status === "da_giao";
  const canPay =
    order.paymentMethod === "chuyen_khoan" && order.paymentStatus === "chua_thanh_toan" &&
    order.status !== "da_huy" && order.status !== "hoan_thanh";
  const canReview = order.status === "hoan_thanh";
  /*  MUA LẠI chỉ ở đơn ĐÃ KẾT THÚC (hoàn thành / đã huỷ): đơn đang chạy mà thêm
      lại vào giỏ là mời bà con đặt trùng. */
  const canRebuy = order.status === "hoan_thanh" || order.status === "da_huy";
  // P3: shop trả lời "chưa thấy tiền" ⇒ mục cuối cùng của dòng thời gian là chua_thanh_toan
  const notSeen = [...order.timeline].reverse().find((t) => t.status === "chua_thanh_toan");

  return (
    <div className="px-4 py-3 pb-[7rem]">
      {savedAt != null && (
        <p className="mb-3 rounded-2xl bg-field px-3.5 py-2.5 text-[1rem] font-semibold text-navy" role="status">
          Đang xem bản đã lưu trong máy ({savedAgoLabel(savedAt)}) — có sóng sẽ tự tải mới.
        </p>
      )}

      {/* ── Mã đơn ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[1rem] text-foreground/65">Mã đơn</p>
          <p className="display select-all text-[1.5rem] font-semibold text-navy">{order.code}</p>
        </div>
        <button
          type="button"
          onClick={() => void copyCode()}
          className="flex min-h-(--row-h) shrink-0 items-center gap-1 rounded-full px-4 text-[1rem] font-semibold"
          style={{ backgroundColor: "var(--field)", color: "var(--navy)" }}
          aria-label="Sao chép mã đơn"
        >
          {copied && <CheckIcon className="h-5 w-5 text-ok" />}
          {copied ? "Đã chép" : "Chép mã"}
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <OrderStatusChip status={order.status} />
        <PaymentStatusChip status={order.paymentStatus} />
      </div>

      {note && (
        <p className="mt-3 rounded-2xl bg-field px-3.5 py-2.5 text-[1rem] font-semibold text-navy" role="status">{note}</p>
      )}
      {order.needsRefund && (
        <div className="mt-3 overflow-hidden rounded-2xl">
          <StatusBanner level="danger">
            Shop cần hoàn tiền cho bà con — gọi shop để nhận lại số đã chuyển.
          </StatusBanner>
        </div>
      )}
      {order.status === "da_huy" && order.cancelBy !== "buyer" && (
        <div className="mt-3 overflow-hidden rounded-2xl">
          <StatusBanner level="danger">
            {order.cancelBy === "system" ? `${order.cancelReason || "Đơn tự huỷ"}.` : `Shop đã huỷ: ${order.cancelReason || "không ghi lý do"}.`}
          </StatusBanner>
        </div>
      )}
      {order.paymentStatus === "chua_thanh_toan" && notSeen && (
        <div className="mt-3 overflow-hidden rounded-2xl">
          <StatusBanner level="warn">
            Shop chưa thấy tiền: {notSeen.note || "không ghi lý do"} — kiểm tra lại giao dịch hoặc gọi shop.
          </StatusBanner>
        </div>
      )}
      {/* kiểu Shopee (2026-10-18): thanh 5 bước + hẹn giao/trễ hẹn + đếm ngược tự huỷ */}
      <section className="surface mt-3 space-y-3 px-4 py-3">
        <OrderSteps status={order.status} />
        {isPendingTooLong(order, nowIso) || order.status === "cho_xac_nhan" ? <AutoCancelNote order={order} who="buyer" /> : null}
        <EtaLine order={order} />
        {order.requestId && (
          <Link href={`/cho/yeu-cau/${order.requestId}`} className="block text-[1rem] font-semibold text-sea underline">
            Đơn đặt theo yêu cầu — xem yêu cầu
          </Link>
        )}
      </section>

      {/* ── Dòng thời gian ─────────────────────────────────────────────── */}
      <section className="surface mt-3 px-4 py-3">
        <h3 className="mb-2 text-[1rem] font-semibold text-navy">Đơn đi tới đâu rồi</h3>
        <OrderTimeline timeline={order.timeline} carrier={order.carrier} trackingCode={order.trackingCode} />
      </section>

      {/* ── Dòng hàng ──────────────────────────────────────────────────── */}
      <section className="surface mt-3 px-4 py-3">
        <h3 className="mb-2 text-[1rem] font-semibold text-navy">Hàng trong đơn</h3>
        <ul className="flex flex-col gap-2">
          {order.items.map((l) => (
            /*  R-01 (2026-09-06): "Đánh giá" XUỐNG HÀNG RIÊNG. Bản cũ nhét ảnh +
                tên + thành tiền + nút trên MỘT hàng flex ⇒ ở 390px cột tên còn
                48px, "120.000 đ × 3 cái" gãy 4 dòng và số tiền đè lên chữ. Đây
                là màn bà con nhìn để nhớ mình mua gì — đọc không ra là hỏng. */
            <li key={`${l.productId}|${l.variantLabel ?? ""}`} className="flex flex-col gap-1">
              <div className="flex items-center gap-3">
                <Link href={`/cho/sp/${l.productId}`} className="flex min-h-(--row-h) min-w-0 flex-1 items-center gap-3">
                  <LineThumb image={l.image} size={3.5} />
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 text-[1rem] font-semibold leading-snug text-navy">
                      {l.title}
                      {l.variantLabel ? ` · ${l.variantLabel}` : ""}
                    </span>
                    <span className="block text-[1rem] text-foreground/65">
                      {formatVnd(l.priceVnd)} × {l.qty} {l.unit}
                    </span>
                  </span>
                </Link>
                <MoneyText vnd={l.lineTotalVnd} className="shrink-0" />
              </div>
              {canReview && !reviewed.includes(l.productId) && (
                <button
                  type="button"
                  disabled={!online}
                  onClick={() => setReviewLine(l)}
                  aria-label={`Đánh giá ${l.title}`}
                  className="min-h-(--row-h) w-full rounded-full text-[1rem] font-semibold disabled:opacity-40"
                  style={{ backgroundColor: "var(--t3-bg)", color: "var(--t3)" }}
                >
                  Đánh giá
                </button>
              )}
            </li>
          ))}
        </ul>
        <div className="mt-2 flex flex-col gap-0.5 border-t pt-2 text-[1rem]" style={{ borderColor: "var(--line)" }}>
          <p className="flex justify-between">
            <span className="text-foreground/70">Tiền hàng</span>
            <MoneyText vnd={order.subtotalVnd} bold={false} />
          </p>
          <p className="flex justify-between">
            <span className="text-foreground/70">Phí giao</span>
            <MoneyText vnd={order.shippingVnd} bold={false} />
          </p>
          <p className="flex justify-between text-[1rem]">
            <span className="font-semibold text-navy">Tổng</span>
            <MoneyText vnd={order.totalVnd} />
          </p>
        </div>
      </section>

      {/* ── Nhận tại + trả tiền ────────────────────────────────────────── */}
      <section className="surface mt-3 px-4 py-3">
        <h3 className="text-[1rem] font-semibold text-navy">Nhận tại</h3>
        <p className="mt-0.5 text-[1rem] leading-snug">
          {order.address.name} · {order.address.phone}
          <br />
          {order.address.detail}, {order.address.province}
        </p>
        <h3 className="mt-3 text-[1rem] font-semibold text-navy">Trả tiền</h3>
        <p className="mt-0.5 text-[1rem]">{PAYMENT_METHOD_LABEL[order.paymentMethod]}</p>
        {order.bankSnapshot && (
          <div className="mt-2 rounded-2xl bg-field px-3.5 py-2.5">
            <p className="text-[1rem]">{order.bankSnapshot.bankName}</p>
            <p className="text-[1rem] font-semibold text-navy">{order.bankSnapshot.bankAccount}</p>
            <p className="text-[1rem]">{order.bankSnapshot.bankHolder}</p>
            <p className="mt-1 text-[1rem]">
              Nội dung chuyển: <span className="font-semibold text-navy">{order.code}</span>
            </p>
          </div>
        )}
        {order.buyerNote && (
          <p className="mt-3 text-[1rem]">
            <span className="font-semibold text-navy">Ghi chú của tôi: </span>
            {order.buyerNote}
          </p>
        )}
        {order.sellerNote && (
          <p className="mt-1 text-[1rem]">
            <span className="font-semibold text-navy">Shop nhắn: </span>
            {order.sellerNote}
          </p>
        )}
      </section>

      {/* ── Shop + gọi (KHÔNG ẩn khi mất sóng) ─────────────────────────── */}
      <section className="surface mt-3 flex items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-[1rem] font-semibold text-navy">{order.shopName ?? "Shop"}</p>
          {order.shopSlug && (
            <Link href={`/cho/shop/${order.shopSlug}`} className="flex min-h-(--row-h) items-center text-[1rem] font-semibold text-t3">
              Xem shop
            </Link>
          )}
        </div>
        {order.shopPhone && <CallButton phone={order.shopPhone} label="Gọi shop" />}
      </section>

      {/* ── Mua lại (đơn đã kết thúc) ──────────────────────────────────── */}
      {canRebuy && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => void rebuy()}
            disabled={rebuying}
            className="min-h-(--row-h) w-full rounded-full text-[1rem] font-semibold disabled:opacity-40"
            style={{ backgroundColor: "var(--t3-bg)", color: "var(--t3)" }}
          >
            {rebuying ? "Đang xem món còn bán…" : "Mua lại"}
          </button>
          {rebuyNote && (
            <div
              role="status"
              className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-field px-3.5 py-2.5"
            >
              <span className="min-w-0 text-[1rem] font-semibold leading-snug text-navy">{rebuyNote}</span>
              {rebuyAdded > 0 && (
                <Link href="/cho/gio" className="flex min-h-(--row-h) shrink-0 items-center text-[1rem] font-semibold text-t3 underline">
                  Xem giỏ ({cart.count})
                </Link>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Hành động theo trạng thái ──────────────────────────────────── */}
      {(canCancel || canReceive || canPay) && (
        <div className="mt-4 flex flex-col gap-2">
          {canReceive && (
            <PrimaryButton disabled={!online || busy} onClick={() => setAct("da-nhan")}>
              Đã nhận hàng
            </PrimaryButton>
          )}
          {canPay && (
            <button
              type="button"
              disabled={!online || busy}
              onClick={() => setAct("bao-chuyen")}
              className="min-h-(--row-h) w-full rounded-full text-[1rem] font-semibold disabled:opacity-40"
              style={{ backgroundColor: "var(--warn-bg)", color: "var(--warn)" }}
            >
              Tôi đã chuyển khoản
            </button>
          )}
          {canCancel && (
            <button
              type="button"
              disabled={!online || busy}
              onClick={() => {
                setReason("");
                setAct("huy");
              }}
              className="min-h-(--row-h) w-full rounded-full text-[1rem] font-semibold disabled:opacity-40"
              style={{ backgroundColor: "var(--danger-bg)", color: "var(--danger)" }}
            >
              Huỷ đơn
            </button>
          )}
          {!online && <p className="text-center text-[1rem] text-foreground/65">Việc này cần có sóng.</p>}
        </div>
      )}

      {act && (
        <ConfirmDialog
          title={
            act === "huy" ? `Huỷ đơn ${order.code}?` : act === "da-nhan" ? "Xác nhận đã nhận hàng?" : "Báo shop là đã chuyển khoản?"
          }
          message={
            act === "huy"
              ? "Shop sẽ nhận được tin huỷ. Đơn đã huỷ không mở lại được."
              : act === "da-nhan"
                ? "Bấm khi bà con đã nhận đủ hàng."
                : "Shop sẽ kiểm tra tài khoản rồi xác nhận."
          }
          danger={act === "huy"}
          confirmLabel={act === "huy" ? "Huỷ đơn" : "Đúng rồi"}
          cancelLabel="Không"
          onCancel={() => setAct(null)}
          onConfirm={() => void run(act)}
        >
          {act === "huy" && (
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {CANCEL_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  aria-pressed={reason === r}
                  className="min-h-(--row-h) rounded-full px-3.5 text-[1rem] font-semibold"
                  style={{
                    backgroundColor: reason === r ? "var(--t3)" : "var(--field)",
                    color: reason === r ? "var(--card)" : "var(--navy)",
                  }}
                >
                  {r}
                </button>
              ))}
            </div>
          )}
        </ConfirmDialog>
      )}

      {reviewLine && (
        <BottomSheet title={`Đánh giá ${reviewLine.title}`} onClose={() => setReviewLine(null)}>
          <div className="pb-3">
            <RatingStars value={rating} interactive onChange={setRating} className="justify-center" />
            <textarea
              className={`${inputClass} mt-3`}
              rows={4}
              maxLength={REVIEW_MAX}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Hàng có tốt không, giao có đúng hẹn không…"
            />
            {reviewNote && (
              <p role="alert" className="mt-2 text-[1rem] font-semibold text-danger">{reviewNote}</p>
            )}
            <PrimaryButton className="mt-3" disabled={busy || !online} onClick={() => void sendReview()}>
              {busy ? "Đang gửi…" : "Gửi đánh giá"}
            </PrimaryButton>
          </div>
        </BottomSheet>
      )}
    </div>
  );
}
