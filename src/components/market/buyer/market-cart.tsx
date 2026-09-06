"use client";

// `/cho/gio` — GIỎ HÀNG (11 §5.5). Giỏ nằm trong MÁY (id + biến thể + số
// lượng); giá và phí giao do MÁY CHỦ tra lại (`POST /api/cho/gio/tinh`) rồi cất
// làm bản tra để mất sóng còn hiện "giá lúc HH:MM".
//
// XEM ĐƯỢC KHI CHƯA ĐĂNG NHẬP (LEAD §5 #8) — chỉ nút Đặt hàng mới cần tài khoản.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { QtyStepper } from "@/components/cart-sheet";
import { CartIcon, TrashIcon } from "@/components/icons";
import { MoneyText, PriceText } from "@/components/market/shared/price-text";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/primitives";
import { SQ_BTN } from "@/components/ui/sq-btn";
import { StatusBanner } from "@/components/ui/status-banner";
import { clockVN } from "@/lib/day-labels";
import { formatVnd } from "@/lib/format";
import { removeMarketLine, setMarketLineQty, loadMarketQuote, saveMarketQuote } from "@/lib/market/cart";
import { marketPost } from "@/lib/market/client";
import { computeCartSummary, computeTotals, DROP_LABEL } from "@/lib/market/pricing";
import type { CartQuote, MarketCartLine } from "@/lib/market/types";
import { useOnlineRefetch } from "@/lib/market/use-online";
import { CHECKOUT_MAX_SHOPS, ORDER_MAX_LINES } from "@/lib/market/validate";
import { LoginInvite } from "./ui";
import { useMarketCart, useOnlineState } from "./hooks";

type QuoteRes = { quote: CartQuote; titles: Record<string, string> };

const keyOf = (productId: string, variantLabel?: string) => `${productId}|${variantLabel ?? ""}`;

/**
 * Tính lại bản tra theo giỏ HIỆN TẠI của máy — để bấm −/+ là tổng đổi NGAY,
 * không phải chờ mạng. Đơn giá vẫn là đơn giá máy chủ vừa trả (không tự bịa);
 * lượt tra sau sẽ xác nhận lại.
 */
function reprice(q: CartQuote, items: MarketCartLine[]): CartQuote {
  const qtyBy = new Map(items.map((l) => [keyOf(l.productId, l.variantLabel), l.qty]));
  const groups = q.groups
    .map((g) => {
      const lines = g.lines
        .filter((l) => qtyBy.has(keyOf(l.productId, l.variantLabel)))
        .map((l) => {
          const qty = qtyBy.get(keyOf(l.productId, l.variantLabel)) ?? l.qty;
          return { ...l, qty, lineTotalVnd: l.priceVnd * qty };
        });
      return { ...g, lines, ...computeTotals(lines, g.shop) };
    })
    .filter((g) => g.lines.length > 0);
  const dropped = q.dropped.filter((d) => qtyBy.has(keyOf(d.productId, d.variantLabel)));
  return {
    ...q,
    groups,
    dropped,
    summary: computeCartSummary(groups.map((g) => ({ lines: g.lines, shippingVnd: g.shippingVnd }))),
  };
}

export function MarketCart() {
  const router = useRouter();
  const online = useOnlineState();
  const cart = useMarketCart();

  const [quote, setQuote] = useState<CartQuote | null>(null);
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [changed, setChanged] = useState<Record<string, { from: number; to: number }>>({});
  const [status, setStatus] = useState<"loading" | "ok" | "error" | "offline">("loading");
  const [stale, setStale] = useState(false);
  const [gate, setGate] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [undo, setUndo] = useState<{ items: MarketCartLine[]; label: string } | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchQuote = useCallback(
    async (items: MarketCartLine[]) => {
      if (items.length === 0) {
        setQuote(null);
        setStatus("ok");
        return;
      }
      const res = await marketPost<QuoteRes>("/api/cho/gio/tinh", { items });
      if (!res.ok) {
        // Mất sóng ⇒ lấy bản tra gần nhất trong máy, nói rõ nó cũ (11 §5.5).
        const saved = loadMarketQuote(cart.phone);
        if (saved) {
          setQuote(reprice(saved, items));
          setStale(true);
          setStatus("ok");
        } else {
          setStatus(res.offline ? "offline" : "error");
        }
        return;
      }
      // "Giá vừa đổi: a → b" — so với bản tra trước khi gọi
      const before = new Map<string, number>();
      for (const g of quote?.groups ?? []) for (const l of g.lines) before.set(keyOf(l.productId, l.variantLabel), l.priceVnd);
      const diff: Record<string, { from: number; to: number }> = {};
      for (const g of res.data.quote.groups) {
        for (const l of g.lines) {
          const k = keyOf(l.productId, l.variantLabel);
          const old = before.get(k);
          if (old != null && old !== l.priceVnd) diff[k] = { from: old, to: l.priceVnd };
        }
      }
      setChanged(diff);
      setQuote(res.data.quote);
      setTitles(res.data.titles ?? {});
      setStale(false);
      setStatus("ok");
      saveMarketQuote(cart.phone, res.data.quote);
    },
    [cart.phone, quote],
  );

  /*  TRA LẠI KHI GIỎ ĐỔI, KHÔNG PHẢI KHI RENDER ĐỔI.
      Giỏ đọc từ máy TRONG effect, nên lần vẽ đầu `cart.items` còn rỗng — tra
      ngay lúc đó là tra một giỏ trống rồi không bao giờ tra lại (đã dính:
      màn báo "không còn món nào mua được" trong khi giỏ có hàng). Nên khoá
      theo VÂN TAY nội dung giỏ; đổi số lượng thì chờ 700 ms cho bà con bấm
      xong mới hỏi máy chủ (mạng ngoài bến yếu, đừng bắn mỗi lần chạm). */
  const sig = cart.items.map((l) => `${l.productId}|${l.variantLabel ?? ""}|${l.qty}`).join(",");
  const quotedSig = useRef<string | null>(null);
  useEffect(() => {
    if (quotedSig.current === sig) return;
    const firstRun = quotedSig.current === null;
    const t = setTimeout(() => {
      quotedSig.current = sig;
      void fetchQuote(cart.items);
    }, firstRun ? 0 : 700);
    return () => clearTimeout(t);
  }, [sig, cart.items, fetchQuote]);
  useOnlineRefetch(() => void fetchQuote(cart.items));

  useEffect(() => () => {
    if (undoTimer.current) clearTimeout(undoTimer.current);
  }, []);

  const applyItems = (next: MarketCartLine[]) => {
    if (!cart.commit(next)) return; // máy hết chỗ — băng đỏ đã bật, đừng vẽ số sai
    if (quote) setQuote(reprice(quote, next));
  };

  const removeLine = (productId: string, variantLabel: string | undefined, label: string) => {
    const prev = cart.items;
    applyItems(removeMarketLine(prev, productId, variantLabel));
    setUndo({ items: prev, label });
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndo(null), 5000);
  };

  // ── ma trận trạng thái ─────────────────────────────────────────────────
  if (cart.items.length === 0) {
    return (
      <div className="px-4 py-6">
        <EmptyState icon={<CartIcon className="h-8 w-8" />}>Giỏ đang trống.</EmptyState>
        <Link
          href="/cho"
          className="display mx-auto mt-4 flex min-h-[3.5rem] w-full max-w-[15rem] items-center justify-center rounded-full bg-trim text-[1.125rem] font-bold text-white shadow-trim-cta"
        >
          Đi chợ
        </Link>
      </div>
    );
  }

  const quoteAtMs = quote ? Date.parse(quote.at) : NaN;
  const quoteAt = Number.isFinite(quoteAtMs) ? quoteAtMs : null;
  const groups = quote?.groups ?? [];
  const dropped = quote?.dropped ?? [];
  const summary = quote?.summary ?? { subtotalVnd: 0, shippingVnd: 0, totalVnd: 0, shopCount: 0 };
  const lineCount = groups.reduce((s, g) => s + g.lines.length, 0);
  const tooManyLines = groups.find((g) => g.lines.length > ORDER_MAX_LINES);
  const tooManyShops = groups.length > CHECKOUT_MAX_SHOPS;
  const nothingBuyable = status === "ok" && groups.length === 0;

  const blocked = !online || stale
    ? "Đặt hàng cần có sóng. Giỏ vẫn giữ nguyên."
    : tooManyLines
      ? `Mỗi đơn tối đa ${ORDER_MAX_LINES} món — tách bớt sang lần đặt sau.`
      : tooManyShops
        ? `Mỗi lần đặt tối đa ${CHECKOUT_MAX_SHOPS} shop — bỏ bớt rồi đặt lần sau.`
        : nothingBuyable
          ? "Không còn món nào mua được trong giỏ."
          : null;

  return (
    <div className="pb-[9rem]">
      <div className="px-4 pt-3">
        {cart.saveFailed && (
          <div className="mb-3 overflow-hidden rounded-2xl">
            <StatusBanner level="danger">
              Máy hết chỗ — CHƯA lưu được giỏ. Đóng app là mất; bà con đặt ngay hoặc xoá bớt ảnh/ứng dụng.
            </StatusBanner>
          </div>
        )}
        {/*  Mốc lấy TỪ BẢN TRA, không lấy giờ máy lúc vẽ: đây là câu trả lời
             cho "giá này cũ chưa", nói giờ hiện tại là nói dối. */}
        {stale && quoteAt != null && (
          <p className="mb-3 text-[1rem] font-semibold text-foreground/70">
            Giá lúc {clockVN(quoteAt)} — có sóng sẽ tra lại.
          </p>
        )}
        {cart.items.length >= 50 && (
          <p className="mb-3 text-[1rem] font-bold text-warn">Giỏ đã đủ 50 món.</p>
        )}

        {status === "loading" && (
          <p role="status" className="py-8 text-center text-[1.125rem] text-foreground/65">Đang tra giá…</p>
        )}
        {status === "offline" && (
          <div className="rounded-[1.25rem] bg-field/70 px-4 py-8 text-center" role="status">
            <p className="text-[1.125rem] font-bold text-navy">
              Giỏ có {cart.items.length} dòng. Chưa tải được giá — máy không có sóng.
            </p>
            <button
              type="button"
              onClick={() => void fetchQuote(cart.items)}
              className="display mx-auto mt-4 flex min-h-[3.5rem] w-full max-w-[15rem] items-center justify-center rounded-full bg-trim text-[1.125rem] font-bold text-white shadow-trim-cta"
            >
              Thử lại
            </button>
          </div>
        )}
        {status === "error" && (
          <div className="rounded-[1.25rem] bg-danger-bg px-4 py-8 text-center" role="alert">
            <p className="text-[1.125rem] font-bold text-danger">Chợ đang trục trặc, chưa tra được giá. Thử lại giúp.</p>
            <button
              type="button"
              onClick={() => void fetchQuote(cart.items)}
              className="display mx-auto mt-4 flex min-h-[3.5rem] w-full max-w-[15rem] items-center justify-center rounded-full bg-trim text-[1.125rem] font-bold text-white shadow-trim-cta"
            >
              Thử lại
            </button>
          </div>
        )}

        {undo && (
          <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl bg-field px-3.5 py-2.5" role="status">
            <span className="min-w-0 text-[1rem] font-semibold text-navy">Đã bỏ {undo.label}.</span>
            <button
              type="button"
              onClick={() => {
                applyItems(undo.items);
                setUndo(null);
              }}
              className="min-h-[3.5rem] shrink-0 px-2 text-[1rem] font-bold text-t3"
            >
              Hoàn lại
            </button>
          </div>
        )}

        {/* ── Nhóm theo shop ─────────────────────────────────────────────── */}
        {groups.map((g) => (
          <section key={g.shop.id} className="surface mb-3 overflow-hidden">
            <div className="flex items-center gap-2 px-4 pt-3">
              <Link href={`/cho/shop/${g.shop.slug}`} className="min-w-0 flex-1 text-[1.0625rem] font-bold text-navy">
                {g.shop.name}
              </Link>
              {g.shop.paused && (
                <span
                  className="rounded-full px-2 py-0.5 text-[0.75rem] font-bold"
                  style={{ backgroundColor: "var(--warn-bg)", color: "var(--warn)" }}
                >
                  Tạm nghỉ
                </span>
              )}
            </div>
            <ul className="flex flex-col">
              {g.lines.map((l) => {
                const k = keyOf(l.productId, l.variantLabel);
                const diff = changed[k];
                return (
                  <li key={k} className="flex gap-3 px-4 py-3">
                    <Link href={`/cho/sp/${l.productId}`} className="shrink-0">
                      {l.image ? (
                        // eslint-disable-next-line @next/next/no-img-element -- ảnh sàn, không qua optimizer
                        <img src={l.image} alt="" className="h-20 w-20 rounded-2xl object-cover" />
                      ) : (
                        <span className="flex h-20 w-20 items-center justify-center rounded-2xl bg-field text-foreground/40">
                          <CartIcon className="h-8 w-8" />
                        </span>
                      )}
                    </Link>
                    <div className="min-w-0 flex-1">
                      <Link href={`/cho/sp/${l.productId}`} className="line-clamp-2 text-[1rem] font-bold leading-snug text-navy">
                        {l.title}
                      </Link>
                      {l.variantLabel && <p className="text-[0.9375rem] text-foreground/65">Loại: {l.variantLabel}</p>}
                      <PriceText priceVnd={l.priceVnd} className="mt-0.5" />
                      {diff && (
                        <p className="mt-0.5 text-[0.9375rem] font-bold text-warn">
                          Giá vừa đổi: {formatVnd(diff.from)} → {formatVnd(diff.to)}
                        </p>
                      )}
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <QtyStepper
                          qty={l.qty}
                          onChange={(n) => applyItems(setMarketLineQty(cart.items, l.productId, l.variantLabel, n))}
                          label={l.title}
                        />
                        <button
                          type="button"
                          onClick={() => removeLine(l.productId, l.variantLabel, l.title)}
                          aria-label={`Bỏ ${l.title} khỏi giỏ`}
                          className={SQ_BTN}
                          style={{ color: "var(--danger)", backgroundColor: "var(--danger-bg)" }}
                        >
                          <TrashIcon className="h-6 w-6" />
                          Bỏ
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="flex flex-col gap-0.5 bg-field/60 px-4 py-2.5 text-[1rem]">
              <p className="flex justify-between">
                <span className="text-foreground/70">Tiền hàng shop này</span>
                <MoneyText vnd={g.subtotalVnd} />
              </p>
              <p className="flex justify-between">
                <span className="text-foreground/70">Giao</span>
                {g.shippingVnd > 0 ? <MoneyText vnd={g.shippingVnd} bold={false} /> : <span className="font-bold text-ok">Miễn phí</span>}
              </p>
              {g.lines.length > ORDER_MAX_LINES && (
                <p className="text-[0.9375rem] font-bold text-danger">
                  Mỗi đơn tối đa {ORDER_MAX_LINES} món — bỏ bớt ở shop này.
                </p>
              )}
            </div>
          </section>
        ))}

        {/* ── Món không mua được ────────────────────────────────────────── */}
        {dropped.length > 0 && (
          <section className="mb-3">
            <h3 className="mb-1.5 text-[1.0625rem] font-bold text-navy">Không mua được</h3>
            <ul className="flex flex-col gap-2">
              {dropped.map((d) => (
                <li
                  key={keyOf(d.productId, d.variantLabel)}
                  className="surface flex items-center gap-3 px-4 py-3 opacity-70"
                >
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-[1rem] font-bold leading-snug text-navy">
                      {titles[d.productId] ?? "Món trong giỏ"}
                      {d.variantLabel ? ` · ${d.variantLabel}` : ""}
                    </p>
                    <p className="text-[0.9375rem] font-bold text-danger">
                      {DROP_LABEL[d.reason].replace("{n}", String(d.available ?? 0))}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeLine(d.productId, d.variantLabel, titles[d.productId] ?? "món này")}
                    aria-label="Bỏ món không mua được"
                    className={SQ_BTN}
                    style={{ color: "var(--danger)", backgroundColor: "var(--danger-bg)" }}
                  >
                    <TrashIcon className="h-6 w-6" />
                    Bỏ
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {gate && <LoginInvite feature="đặt hàng" online={online} onClose={() => setGate(false)} />}

        <button
          type="button"
          onClick={() => setConfirmClear(true)}
          className="mx-auto mt-2 flex min-h-[3.5rem] items-center justify-center px-4 text-[1rem] font-bold text-danger"
        >
          Bỏ hết giỏ
        </button>
      </div>

      {/* ── Thanh ghim đáy ───────────────────────────────────────────────── */}
      <div
        /*  NGAY TRÊN DOCK, không đè lên nó: dock là `fixed bottom:0` cao
            `--dock-total` (globals.css) và vẽ SAU nội dung — thanh này để
            `bottom:0` là bà con bấm vào dock chứ không bấm được nút. */
        className="fixed inset-x-0 z-20 mx-auto flex max-w-[480px] items-center gap-3 border-t px-4 py-3"
        style={{
          bottom: "var(--dock-total)",
          backgroundColor: "var(--card)",
          borderColor: "var(--line)",
        }}
      >
        <div className="min-w-0 flex-1">
          <p className="text-[0.9375rem] text-foreground/65">{lineCount} món · Tổng tạm</p>
          <p className="display text-[1.25rem] font-bold text-navy">{formatVnd(summary.totalVnd)}</p>
          {blocked && <p className="text-[0.875rem] font-semibold leading-snug text-danger">{blocked}</p>}
        </div>
        <button
          type="button"
          disabled={!!blocked}
          onClick={() => {
            if (!cart.signedIn) {
              setGate(true);
              return;
            }
            router.push("/cho/thanh-toan");
          }}
          className="display flex min-h-[3.5rem] shrink-0 items-center justify-center rounded-full bg-trim px-6 text-[1.125rem] font-bold text-white shadow-trim-cta transition active:scale-[0.98] disabled:opacity-40 disabled:shadow-none"
        >
          Đặt hàng
        </button>
      </div>

      {confirmClear && (
        <ConfirmDialog
          title="Bỏ hết giỏ?"
          message="Mọi món đang chọn sẽ bị bỏ. Món đã đặt rồi không ảnh hưởng."
          confirmLabel="Bỏ hết"
          onCancel={() => setConfirmClear(false)}
          onConfirm={() => {
            applyItems([]);
            setQuote(null);
            setConfirmClear(false);
          }}
        />
      )}
    </div>
  );
}
