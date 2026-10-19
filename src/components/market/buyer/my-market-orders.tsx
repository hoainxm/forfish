"use client";

// `/cho/don` — ĐƠN HÀNG CỦA TÔI (11 §5.7). Bốn tab gom theo việc bà con phải
// làm, không phải theo tên trạng thái kỹ thuật: Đang xử lý · Chờ nhận · Xong ·
// Đã huỷ — chia đều bề ngang (F-13: tab 4 từng nằm ngoài màn, phải cuộn ngang).
// Thẻ đơn có ẢNH món đầu (F-06) — với người ít chữ, ảnh là cách nhận ra đơn.
//
// MẤT SÓNG: hiện BẢN LƯU trong máy + nói rõ nó cũ bao lâu; nút ghi vô hiệu
// ("việc này cần có sóng"); có sóng lại tự tải (useOnlineRefetch) — không bắt bấm.
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ChevronRightIcon, DocIcon } from "@/components/icons";
import { EmptyNet } from "@/components/market/shared/empty-net";
import { AutoCancelNote, EtaLine } from "@/components/market/shared/eta";
import { LineThumb } from "@/components/market/shared/line-thumb";
import { OrderStatusChip } from "@/components/market/shared/order-status-chip";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/primitives";
import { savedAgoLabel } from "@/lib/forecast-cache";
import { formatVnd } from "@/lib/format";
import { marketGet, marketPost } from "@/lib/market/client";
import { isPendingTooLong } from "@/lib/market/order-state";
import { loadCachedMarketOrders, saveCachedMarketOrders } from "@/lib/market/orders-cache";
import type { Order } from "@/lib/market/types";
import { useOnlineRefetch } from "@/lib/market/use-online";
import { useAuthUser } from "@/lib/use-auth";
import { ErrorBlock } from "./ui";
import { useOnlineState } from "./hooks";

type Tab = "dang_xu_ly" | "cho_nhan" | "xong" | "huy";

const TABS: { id: Tab; label: string }[] = [
  { id: "dang_xu_ly", label: "Đang xử lý" },
  { id: "cho_nhan", label: "Chờ nhận" },
  { id: "xong", label: "Xong" },
  { id: "huy", label: "Đã huỷ" },
];

const inTab = (o: Order, t: Tab) =>
  t === "dang_xu_ly"
    ? o.status === "cho_xac_nhan" || o.status === "da_xac_nhan" || o.status === "dang_giao"
    : t === "cho_nhan"
      ? o.status === "da_giao"
      : t === "xong"
        ? o.status === "hoan_thanh"
        : o.status === "da_huy";

/** "Dầu DO ×2, Đá cây ×10" — đủ để nhận ra đơn mà không phải mở. */
const summarize = (o: Order) =>
  o.items.slice(0, 3).map((l) => `${l.title} ×${l.qty}`).join(", ") + (o.items.length > 3 ? "…" : "");

/** Nút hành động trên thẻ — chữ 1rem, 3.5rem (F-07: không SQ_BTN 37px/11px cho Huỷ/Đã nhận). */
function ActionButton({
  tone, disabled, onClick, children,
}: { tone: "ok" | "warn" | "danger"; disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="min-h-(--row-h) rounded-full px-4 text-[1rem] font-semibold disabled:opacity-40"
      style={{ backgroundColor: `var(--${tone}-bg)`, color: `var(--${tone})` }}
    >
      {children}
    </button>
  );
}

/** Ba thẻ xương lúc tải (F-22) — không vẽ chữ trần "Đang tải…" trong khi màn khác có skeleton. */
function OrdersSkeleton() {
  return (
    <div role="status" aria-label="Đang tải đơn" className="flex flex-col gap-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="surface flex gap-3 px-4 py-3">
          <div className="h-14 w-14 shrink-0 animate-pulse rounded-xl bg-field" />
          <div className="flex-1 space-y-2 py-1">
            <div className="h-4 w-1/2 animate-pulse rounded bg-field" />
            <div className="h-4 w-3/4 animate-pulse rounded bg-field" />
            <div className="h-4 w-1/3 animate-pulse rounded bg-field" />
          </div>
        </div>
      ))}
    </div>
  );
}

type Pending = { order: Order; kind: "huy" | "da-nhan" | "bao-chuyen" };

export function MyMarketOrders() {
  const online = useOnlineState();
  const { phone } = useAuthUser();

  const [tab, setTab] = useState<Tab>("dang_xu_ly");
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<"loading" | "ok" | "error" | "offline">("loading");
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    async (p: number, replace: boolean) => {
      if (replace) setStatus("loading");
      const res = await marketGet<{ items: Order[]; total: number }>(`/api/cho/don?page=${p}`);
      if (!res.ok) {
        const cache = loadCachedMarketOrders(phone);
        if (cache && replace) {
          setOrders(cache.orders);
          setSavedAt(cache.savedAt);
          setStatus("ok");
        } else if (replace) {
          setStatus(res.offline ? "offline" : "error");
        }
        return;
      }
      const next = replace ? res.data.items : [...orders, ...res.data.items];
      setOrders(next);
      setTotal(res.data.total);
      setPage(p);
      setSavedAt(null);
      setStatus("ok");
      saveCachedMarketOrders(phone, next);
    },
    [phone, orders],
  );

  const [first, setFirst] = useState(true);
  useEffect(() => {
    if (!first) return;
    setFirst(false);
    void load(1, true);
  }, [first, load]);
  useOnlineRefetch(() => void load(1, true));

  const run = async ({ order, kind }: Pending) => {
    setBusy(true);
    const res = await marketPost<{ order: Order }>(`/api/cho/don/${order.id}/${kind}`, {});
    setBusy(false);
    setPending(null);
    if (!res.ok) {
      setNote(
        res.offline
          ? "Chưa gửi được — việc này cần có sóng."
          : res.code === "bad_transition"
            ? "Đơn đã sang bước khác rồi — đang tải lại."
            : res.message || "Chưa làm được — thử lại giúp.",
      );
      if (res.code === "bad_transition") void load(1, true);
      return;
    }
    const next = orders.map((o) => (o.id === res.data.order.id ? res.data.order : o));
    setOrders(next);
    saveCachedMarketOrders(phone, next);
    setNote(
      kind === "huy" ? `Đã huỷ đơn ${order.code}.` : kind === "da-nhan" ? "Cảm ơn bà con đã xác nhận nhận hàng." : "Đã báo shop — shop kiểm tra rồi xác nhận.",
    );
  };

  const nowIso = new Date().toISOString();
  const shown = orders.filter((o) => inTab(o, tab));
  const count = (t: Tab) => orders.filter((o) => inTab(o, t)).length;

  return (
    <div className="pb-[7rem]">
      <div className="mb-3 grid grid-cols-4 gap-1 px-3 pt-3" role="group" aria-label="Lọc đơn">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            aria-pressed={t.id === tab}
            className="flex min-h-(--row-h) flex-col items-center justify-center rounded-2xl px-1 text-[1rem] font-semibold leading-tight"
            style={{
              backgroundColor: t.id === tab ? "var(--t3)" : "var(--field)",
              color: t.id === tab ? "var(--card)" : "var(--navy)",
            }}
          >
            <span>{t.label}</span>
            <span className="text-[0.875rem] font-semibold opacity-80">{count(t.id)}</span>
          </button>
        ))}
      </div>

      <div className="px-4">
        {/* YÊU CẦU ĐẶT HÀNG — món chưa có trên chợ, chủ sàn báo giá (2026-10-18) */}
        <Link href="/cho/yeu-cau" className="surface mb-3 flex min-h-(--row-h) items-center gap-3 px-4 py-3">
          <span className="min-w-0 flex-1">
            <span className="block text-[1rem] font-semibold text-navy">Yêu cầu đặt hàng của tôi</span>
            <span className="block text-[0.875rem] text-foreground/70">Món không có trên chợ — xem báo giá của chủ sàn</span>
          </span>
          <ChevronRightIcon className="h-6 w-6 shrink-0 text-navy" />
        </Link>
        {savedAt != null && (
          <p className="mb-3 rounded-2xl bg-field px-3.5 py-2.5 text-[1rem] font-semibold text-navy" role="status">
            Đang xem đơn đã lưu trong máy ({savedAgoLabel(savedAt)}) — có sóng sẽ tự tải mới.
          </p>
        )}
        {note && (
          <p className="mb-3 rounded-2xl bg-field px-3.5 py-2.5 text-[1rem] font-semibold text-navy" role="status">
            {note}
          </p>
        )}

        {status === "loading" && <OrdersSkeleton />}
        {status === "error" && <ErrorBlock what="đơn hàng" onRetry={() => void load(1, true)} />}
        {status === "offline" && <EmptyNet what="đơn hàng" onRetry={() => void load(1, true)} />}

        {status === "ok" && shown.length === 0 && (
          <>
            <EmptyState icon={<DocIcon className="h-8 w-8" />}>
              {orders.length === 0 ? "Chưa có đơn nào." : "Không có đơn nào ở mục này."}
            </EmptyState>
            {orders.length === 0 && (
              <Link
                href="/cho"
                className="display mx-auto mt-4 flex min-h-(--row-h) w-full max-w-[15rem] items-center justify-center rounded-full bg-trim text-[1rem] font-semibold text-white "
              >
                Mua đồ
              </Link>
            )}
          </>
        )}

        <ul className="flex flex-col gap-3">
          {shown.map((o) => {
            const canCancel = o.status === "cho_xac_nhan";
            const canReceive = o.status === "da_giao";
            const canPay = o.paymentMethod === "chuyen_khoan" && o.paymentStatus === "chua_thanh_toan"
              && o.status !== "da_huy" && o.status !== "hoan_thanh";
            return (
              <li key={o.id} className="surface px-4 py-3">
                <Link href={`/cho/don/${o.id}`} className="flex items-start gap-3">
                  <LineThumb image={o.items[0]?.image} size={3.5} className="mt-0.5" />
                  <div className="min-w-0 flex-1">
                    {/*  TÊN SHOP MỘT DÒNG RIÊNG, CHIP TRẠNG THÁI DÒNG DƯỚI (R-04,
                         2026-09-06): xếp chung một hàng thì "Đại lý Hải Đăng" bị
                         cắt còn "Đại lý Hải Đă…" — bà con không biết đơn của ai. */}
                    <p className="text-[1rem] font-semibold leading-snug text-navy">{o.shopName ?? "Shop"}</p>
                    <p className="mt-1"><OrderStatusChip status={o.status} /></p>
                    <p className="mt-1 line-clamp-2 text-[1rem] font-semibold leading-snug text-navy">{summarize(o)}</p>
                    {/*  Mã đơn KHÔNG cắt (bà con đọc mã cho shop) — chật thì tổng tự
                         xuống dòng, canh phải. */}
                    <p className="mt-0.5 flex flex-wrap items-center justify-between gap-x-2 text-[1rem]">
                      <span className="whitespace-nowrap text-foreground/65">{o.code}</span>
                      <span className="ml-auto whitespace-nowrap text-[1rem] font-semibold text-navy">{formatVnd(o.totalVnd)}</span>
                    </p>
                  </div>
                  <ChevronRightIcon className="mt-1 h-6 w-6 shrink-0 text-navy" />
                </Link>
                {isPendingTooLong(o, nowIso) && <div className="mt-1"><AutoCancelNote order={o} who="buyer" /></div>}
                <div className="mt-1"><EtaLine order={o} /></div>
                {(canCancel || canReceive || canPay) && (
                  <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
                    {!online && (
                      <span className="mr-auto text-[0.875rem] text-foreground/65">Việc này cần có sóng.</span>
                    )}
                    {canCancel && (
                      <ActionButton tone="danger" disabled={!online || busy} onClick={() => setPending({ order: o, kind: "huy" })}>
                        Huỷ đơn
                      </ActionButton>
                    )}
                    {canPay && (
                      <ActionButton tone="warn" disabled={!online || busy} onClick={() => setPending({ order: o, kind: "bao-chuyen" })}>
                        Đã chuyển khoản
                      </ActionButton>
                    )}
                    {canReceive && (
                      <ActionButton tone="ok" disabled={!online || busy} onClick={() => setPending({ order: o, kind: "da-nhan" })}>
                        Đã nhận hàng
                      </ActionButton>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        {status === "ok" && orders.length < total && (
          <button
            type="button"
            onClick={() => void load(page + 1, false)}
            className="display mx-auto mt-3 flex min-h-(--row-h) w-full max-w-[17.5rem] items-center justify-center rounded-full bg-field text-[1rem] font-semibold text-navy"
          >
            Xem thêm
          </button>
        )}
      </div>

      {pending && (
        <ConfirmDialog
          title={
            pending.kind === "huy"
              ? `Huỷ đơn ${pending.order.code}?`
              : pending.kind === "da-nhan"
                ? "Xác nhận đã nhận hàng?"
                : "Báo shop là đã chuyển khoản?"
          }
          message={
            pending.kind === "huy"
              ? "Shop sẽ nhận được tin huỷ. Đơn đã huỷ không mở lại được."
              : pending.kind === "da-nhan"
                ? "Bấm khi bà con đã nhận đủ hàng."
                : "Shop sẽ kiểm tra tài khoản rồi xác nhận."
          }
          danger={pending.kind === "huy"}
          confirmLabel={pending.kind === "huy" ? "Huỷ đơn" : "Đúng rồi"}
          cancelLabel="Không"
          onCancel={() => setPending(null)}
          onConfirm={() => void run(pending)}
        />
      )}
    </div>
  );
}
