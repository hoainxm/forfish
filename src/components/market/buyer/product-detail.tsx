"use client";

// `/cho/sp/[id]` — TRANG MÓN (11 §5.3). Nút chính DUY NHẤT là "Thêm vào giỏ"
// (được phép full-width theo ngoại lệ 03 §Nút hành động) — spec KHÔNG có "Mua
// ngay": bà con hay gom nhiều món của nhiều shop rồi mới đặt một lượt.
//
// MẤT SÓNG: hiện bản thẻ vừa xem ở danh sách (sessionStorage, xem product-peek)
// + "giá lúc HH:MM"; thêm vào giỏ VẪN chạy (việc của máy); nút Gọi shop KHÔNG
// ẩn (LEAD §4 #10 — mất data vẫn còn sóng thoại ở bến).
import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { QtyStepper } from "@/components/cart-sheet";
import { AlertIcon, CartIcon, ChevronRightIcon, StarIcon } from "@/components/icons";
import { EmptyNet } from "@/components/market/shared/empty-net";
import { PriceText } from "@/components/market/shared/price-text";
import { RatingStars } from "@/components/market/shared/rating-stars";
import { ShopBadge } from "@/components/market/shared/shop-badge";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { CallButton, PrimaryButton } from "@/components/ui/primitives";
import { StatusBanner } from "@/components/ui/status-banner";
import { clockVN } from "@/lib/day-labels";
import { marketGet } from "@/lib/market/client";
import { discountPercent, unitPriceFor } from "@/lib/market/pricing";
import type { ProductCard, Review, ShopPublic } from "@/lib/market/types";
import { useOnlineRefetch } from "@/lib/market/use-online";
import { CartFeedback, ErrorBlock, LoginInvite } from "./ui";
import { readPeek } from "./product-peek";
import { useFavorites, useMarketCart, useOnlineState } from "./hooks";

interface DetailRes {
  product: ProductCard;
  shop: ShopPublic;
  reviews: { avg: number; count: number; latest: Review[] };
  canReview: { orderId: string } | null;
}

export function ProductDetail({ id }: { id: string }) {
  const online = useOnlineState();
  const cart = useMarketCart();
  const fav = useFavorites();

  const [data, setData] = useState<DetailRes | null>(null);
  const [peek, setPeek] = useState<{ at: number; product: ProductCard } | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "error" | "offline" | "gone">("loading");
  const [variant, setVariant] = useState<string | undefined>(undefined);
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState<string | null>(null);
  const [gate, setGate] = useState(false);
  const [descOpen, setDescOpen] = useState(false);
  /*  "Xem thêm" CHỈ khi mô tả thật sự bị cắt (F-17): đo `scrollHeight >
      clientHeight` sau khi vẽ — bản cũ luôn hiện nút dù mô tả một dòng. */
  const [descClamped, setDescClamped] = useState(false);
  const descRef = useRef<HTMLParagraphElement>(null);
  const [imgIdx, setImgIdx] = useState(0); // nhãn "1/3" của dải ảnh (F-23)
  /*  R-03 (2026-09-06): nút chính KHÔNG mờ khi chưa chọn loại — bấm là cuộn tới
      khối loại/cỡ và làm nó nháy viền. Nút mờ + chữ "Chọn loại" là hướng dẫn
      mù: bà con bấm, không thấy gì đổi, tưởng app hỏng. */
  const variantRef = useRef<HTMLDivElement>(null);
  const [variantHint, setVariantHint] = useState(false);
  const [reviewsOpen, setReviewsOpen] = useState(false);
  const [allReviews, setAllReviews] = useState<Review[] | null>(null);

  const load = useCallback(async () => {
    setStatus("loading");
    const res = await marketGet<DetailRes>(`/api/cho/san-pham/${id}`);
    if (res.ok) {
      setData(res.data);
      setStatus("ok");
      return;
    }
    if (res.status === 404) {
      setStatus("gone");
      return;
    }
    setStatus(res.offline ? "offline" : "error");
  }, [id]);

  useEffect(() => {
    setPeek(readPeek(id));
    void load();
  }, [id, load]);
  useOnlineRefetch(() => void load());

  const product = data?.product ?? (status === "offline" ? peek?.product ?? null : null);
  const shop = data?.shop ?? null;
  const stale = !data && !!product;
  const description = product?.description ?? "";

  useEffect(() => {
    if (!variantHint) return;
    const t = setTimeout(() => setVariantHint(false), 2000);
    return () => clearTimeout(t);
  }, [variantHint]);

  useLayoutEffect(() => {
    if (descOpen) return;
    const el = descRef.current;
    if (!el) {
      setDescClamped(false);
      return;
    }
    setDescClamped(el.scrollHeight > el.clientHeight + 1);
  }, [description, descOpen]);

  // ── nhánh không có gì để hiện ───────────────────────────────────────────
  if (status === "loading") {
    return (
      <div className="px-4 py-4 pb-[7rem]" role="status">
        <div className="aspect-square w-full animate-pulse rounded-[1.25rem] bg-field" />
        <div className="mt-4 h-6 w-3/4 animate-pulse rounded bg-field" />
        <div className="mt-2 h-6 w-1/3 animate-pulse rounded bg-field" />
        <p className="mt-4 text-[1.125rem] text-foreground/65">Đang tải món…</p>
      </div>
    );
  }
  if (status === "gone") {
    return (
      <div className="px-4 py-8 pb-[7rem] text-center">
        <div className="mx-auto mb-3 w-fit text-foreground/50">
          <AlertIcon className="h-8 w-8" />
        </div>
        <p className="text-[1.125rem] font-bold text-navy">Món này không còn trên chợ.</p>
        <Link
          href="/cho"
          className="display mx-auto mt-4 flex min-h-[3.5rem] w-full max-w-[15rem] items-center justify-center rounded-full bg-trim text-[1.125rem] font-bold text-white shadow-trim-cta"
        >
          Về cửa hàng
        </Link>
      </div>
    );
  }
  if (!product) {
    return (
      <div className="px-4 py-4 pb-[7rem]">
        {status === "offline" ? (
          <EmptyNet what="trang món" onRetry={() => void load()} />
        ) : (
          <ErrorBlock what="món này" onRetry={() => void load()} />
        )}
      </div>
    );
  }

  // ── dữ liệu dẫn xuất ────────────────────────────────────────────────────
  const hasVariants = product.variants.length > 0;
  const unitPrice = unitPriceFor(product, hasVariants ? variant : undefined) ?? product.priceVnd;
  const pct = discountPercent({ priceVnd: unitPrice, compareAtVnd: product.compareAtVnd });
  const shopClosed = shop ? shop.status !== "hoat_dong" : false;
  const shopPaused = shop?.paused ?? product.shopPaused;
  /*  LIÊN HỆ BÁO GIÁ (xem `Product.priceVnd`): món bán qua tư vấn, không tự đặt
      được. Không tính tồn kho cho nó (để 0, hàng vẫn có) và KHÔNG nói "Hết
      hàng" — thanh đáy đổi hẳn sang gọi shop. */
  const quoteOnly = product.priceVnd == null;
  const outOfStock = product.status !== "dang_ban" || (!quoteOnly && product.stock <= 0);
  const needVariant = hasVariants && !variant;
  /*  `needVariant` KHÔNG nằm trong `canAdd` nữa (R-03): nút vẫn bấm được, việc
      của nó lúc đó là chỉ chỗ chọn loại chứ không phải im lặng. */
  const canAdd = !quoteOnly && !outOfStock && !shopClosed && !shopPaused;
  const isFav = fav.has(product.id);

  const addLabel = outOfStock
    ? "Hết hàng"
    : shopClosed
      ? "Shop đang tạm đóng"
      : shopPaused
        ? "Shop đang tạm nghỉ"
        : needVariant
          ? "Chọn loại"
          : "Thêm vào giỏ";

  const onAdd = () => {
    if (needVariant) {
      variantRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
      setVariantHint(true);
      return;
    }
    const r = cart.add(product.id, hasVariants ? variant : undefined, qty);
    setNote(
      r === "ok"
        ? `Đã thêm ${qty} ${product.unit} vào giỏ`
        : r === "gio_day"
          ? "Giỏ đầy rồi — bỏ bớt món cũ rồi thêm lại."
          : "Máy hết chỗ — CHƯA lưu được giỏ.",
    );
  };

  const onFav = () => {
    if (!cart.signedIn) {
      setGate(true);
      return;
    }
    fav.toggle({
      productId: product.id,
      savedAt: Date.now(),
      snapshot: {
        title: product.title,
        priceVnd: product.priceVnd,
        ...(product.images[0] ? { image: product.images[0] } : {}),
        shopName: product.shopName,
      },
    });
  };

  const openAllReviews = async () => {
    setReviewsOpen(true);
    if (allReviews) return;
    const res = await marketGet<{ items: Review[]; total: number }>(`/api/cho/san-pham/${product.id}/danh-gia?page=1`);
    setAllReviews(res.ok ? res.data.items : []);
  };

  return (
    <div className="pb-[8rem]">
      {/* ── Ảnh cuộn ngang ────────────────────────────────────────────── */}
      <div className="relative">
        {product.images.length > 0 ? (
          <ul
            className="flex snap-x snap-mandatory overflow-x-auto"
            onScroll={(e) => {
              const el = e.currentTarget;
              if (el.clientWidth > 0) setImgIdx(Math.round(el.scrollLeft / el.clientWidth));
            }}
          >
            {product.images.map((src, i) => (
              <li key={`${src}-${i}`} className="w-full shrink-0 snap-center">
                {/* eslint-disable-next-line @next/next/no-img-element -- ảnh sàn: bucket public / data-URI seed, không qua optimizer */}
                <img src={src} alt={`${product.title} — ảnh ${i + 1}`} className="aspect-[4/3] w-full object-contain bg-card" />
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex aspect-[4/3] w-full items-center justify-center bg-field text-foreground/40">
            <CartIcon className="h-16 w-16" />
          </div>
        )}
        {product.images.length > 1 && (
          <>
            <div className="pointer-events-none absolute bottom-3 left-0 right-0 flex justify-center gap-1.5" aria-hidden>
              {product.images.map((s, i) => (
                <span key={`${s}-dot-${i}`} className={`h-2 w-2 rounded-full ${i === imgIdx ? "bg-navy" : "bg-navy/40"}`} />
              ))}
            </div>
            <span
              className="pointer-events-none absolute bottom-3 right-3 rounded-full px-2.5 py-0.5 text-[0.875rem] font-bold"
              style={{ backgroundColor: "var(--navy)", color: "var(--card)" }}
              aria-live="polite"
            >
              {Math.min(imgIdx + 1, product.images.length)}/{product.images.length}
            </span>
          </>
        )}
      </div>

      <div className="px-4 pt-4">
        {/*  Mốc là lúc THẺ được ghi ở danh sách, không phải giờ mở màn. */}
        {stale && peek && (
          <p className="mb-3 text-[1rem] font-semibold text-foreground/65">
            Giá lúc {clockVN(peek.at)} — có sóng sẽ tra lại.
          </p>
        )}
        {shopClosed && (
          <div className="mb-3 overflow-hidden rounded-2xl">
            <StatusBanner level="danger">Shop này đang tạm đóng.</StatusBanner>
          </div>
        )}
        {!shopClosed && shopPaused && (
          <div className="mb-3 overflow-hidden rounded-2xl">
            <StatusBanner level="warn">Shop đang tạm nghỉ, mở lại sau.</StatusBanner>
          </div>
        )}

        {/* ── Tên + giá ─────────────────────────────────────────────────── */}
        <div className="flex items-start gap-3">
          <h2 className="display min-w-0 flex-1 text-[1.375rem] font-bold leading-snug text-navy">{product.title}</h2>
          <button
            type="button"
            onClick={onFav}
            aria-pressed={isFav}
            aria-label={isFav ? "Bỏ khỏi món đã lưu" : "Lưu món này"}
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-field"
            style={{ color: isFav ? "var(--trim)" : "var(--foreground)" }}
          >
            <StarIcon className={`h-7 w-7 ${isFav ? "fill-current" : ""}`} />
          </button>
        </div>

        <div className="mt-2 flex flex-wrap items-baseline gap-2">
          <PriceText priceVnd={unitPrice} compareAtVnd={product.compareAtVnd} size="lg" />
          {pct != null && (
            <span
              className="rounded-full px-2 py-0.5 text-[0.875rem] font-bold"
              style={{ backgroundColor: "var(--trim)", color: "var(--card)" }}
            >
              -{pct}%
            </span>
          )}
          {/* "Liên hệ báo giá / bộ" đọc không ra câu — đơn vị chỉ có nghĩa khi có giá. */}
          {!quoteOnly && <span className="text-[1rem] text-foreground/65">/ {product.unit}</span>}
        </div>

        {/*  F-14: một dòng như Shopee "★ 4.5 (2) · Đã bán 11 · Còn 5" — chưa có
             đánh giá thì nói thẳng, không để trống. */}
        <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[1rem] text-foreground/65">
          {product.ratingCount > 0 ? (
            <span className="inline-flex items-center gap-1">
              <span style={{ color: "var(--sun)" }} aria-hidden><StarIcon className="h-4 w-4 fill-current" /></span>
              <span className="font-bold text-navy">{product.ratingAvg.toFixed(1)}</span>
              <span>({product.ratingCount})</span>
            </span>
          ) : (
            <span>Chưa có đánh giá</span>
          )}
          <span aria-hidden>·</span>
          <span>Đã bán {product.soldCount}</span>
          {/* Món liên hệ báo giá không đếm kho — im chỗ này còn hơn nói "Hết hàng" sai. */}
          {!quoteOnly && (
            <>
              <span aria-hidden>·</span>
              <span>{outOfStock ? "Hết hàng" : product.stock <= 20 ? `Còn ${product.stock} ${product.unit}` : "Còn hàng"}</span>
            </>
          )}
        </p>

        {gate && <LoginInvite verb="lưu món" online={online} onClose={() => setGate(false)} />}

        {/* ── Biến thể ─────────────────────────────────────────────────── */}
        {hasVariants && (
          <div
            ref={variantRef}
            className="-mx-2 mt-2 rounded-2xl px-2 py-2 transition-shadow"
            style={variantHint ? { boxShadow: "0 0 0 3px var(--trim)" } : undefined}
          >
            <p className="mb-1.5 text-[1rem] font-bold text-navy">Chọn loại / cỡ</p>
            <div className="flex flex-wrap gap-2">
              {product.variants.map((v) => (
                <button
                  key={v.label}
                  type="button"
                  onClick={() => setVariant(v.label)}
                  aria-pressed={variant === v.label}
                  className="min-h-[3.5rem] rounded-full px-4 text-[1rem] font-bold"
                  style={{
                    backgroundColor: variant === v.label ? "var(--t3)" : "var(--field)",
                    color: variant === v.label ? "var(--card)" : "var(--navy)",
                  }}
                >
                  {v.label}
                </button>
              ))}
            </div>
            {variantHint && (
              <p role="status" className="mt-1.5 text-[1rem] font-bold text-trim">
                Chọn loại/cỡ trước rồi bấm lại giúp.
              </p>
            )}
          </div>
        )}

        {/* ── Số lượng ─────────────────────────────────────────────────── */}
        {/*  Món liên hệ báo giá không đặt được ở đây ⇒ không hỏi số lượng. Số
             lượng bà con chốt với shop lúc gọi. */}
        {!quoteOnly && (
          <>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-[1rem] font-bold text-navy">Số lượng</span>
              <QtyStepper
                qty={qty}
                onChange={(n) => setQty(Math.max(1, Math.min(product.stock > 0 ? product.stock : 1, n)))}
                label={product.title}
              />
            </div>
            {!outOfStock && qty >= product.stock && product.stock <= 20 && (
              <p className="mt-1 text-right text-[1rem] font-semibold text-warn">Chỉ còn {product.stock}</p>
            )}
          </>
        )}
        {quoteOnly && (
          <p className="mt-4 text-[1rem] leading-snug text-foreground/75">
            Món này shop báo giá theo từng tàu nên chưa để giá sẵn. Bà con gọi hỏi
            giá, shop tư vấn loại hợp tàu mình rồi chốt.
          </p>
        )}

        <CartFeedback note={note} count={cart.count} />

        {/* ── Shop ─────────────────────────────────────────────────────── */}
        <div className="surface mt-4 flex items-center gap-3 px-4 py-3">
          <Link href={`/cho/shop/${product.shopSlug}`} className="flex min-h-[3.5rem] min-w-0 flex-1 flex-col justify-center">
            <ShopBadge
              name={product.shopName}
              province={product.shopProvince}
              ratingAvg={shop?.ratingAvg}
              paused={shopPaused}
              className="text-[1rem]"
            />
            <span className="mt-0.5 flex items-center gap-1 text-[0.9375rem] font-bold text-t3">
              Xem shop <ChevronRightIcon className="h-4 w-4" />
            </span>
          </Link>
          {/*  "Gọi shop" chỉ ở thanh đáy dính (F-14) — hai nút cùng tên một màn là thừa. */}
          <ChevronRightIcon className="h-5 w-5 shrink-0 text-foreground/40" />
        </div>

        {/* ── Mô tả ────────────────────────────────────────────────────── */}
        {product.description && (
          <section className="mt-4">
            <h3 className="text-[1.125rem] font-bold text-navy">Mô tả</h3>
            <p ref={descRef} className={`mt-1 whitespace-pre-line text-[1.0625rem] leading-relaxed ${descOpen ? "" : "line-clamp-4"}`}>
              {product.description}
            </p>
            {(descOpen || descClamped) && (
              <button
                type="button"
                onClick={() => setDescOpen((v) => !v)}
                className="mt-1 min-h-[3.5rem] text-[1rem] font-bold text-t3"
              >
                {descOpen ? "Thu gọn" : "Xem thêm"}
              </button>
            )}
          </section>
        )}

        {/* ── Đánh giá ─────────────────────────────────────────────────── */}
        <section className="mt-4">
          <h3 className="text-[1.125rem] font-bold text-navy">Đánh giá</h3>
          {data && data.reviews.count > 0 ? (
            <>
              <p className="mt-1 flex items-center gap-2 text-[1rem] text-foreground/70">
                <RatingStars value={data.reviews.avg} size="lg" />
                <span className="font-bold text-navy">{data.reviews.avg.toFixed(1)}</span>
                <span>({data.reviews.count} đánh giá)</span>
              </p>
              <ul className="mt-2 flex flex-col gap-2">
                {data.reviews.latest.map((r) => (
                  <li key={r.id} className="surface px-4 py-3">
                    <RatingStars value={r.rating} />
                    <p className="mt-1 text-[1rem] leading-snug">{r.comment || "Không ghi nhận xét."}</p>
                    <p className="mt-0.5 text-[0.875rem] text-foreground/60">{r.buyerPhoneMasked}</p>
                  </li>
                ))}
              </ul>
              {data.reviews.count > data.reviews.latest.length && (
                <button
                  type="button"
                  onClick={() => void openAllReviews()}
                  className="mt-2 min-h-[3.5rem] text-[1rem] font-bold text-t3"
                >
                  Xem tất cả đánh giá
                </button>
              )}
            </>
          ) : (
            <p className="mt-1 text-[1rem] text-foreground/65">Món này chưa có đánh giá nào.</p>
          )}
        </section>
      </div>

      {/* ── Thanh đáy dính: Gọi shop + Thêm vào giỏ ───────────────────── */}
      <div
        /*  NGAY TRÊN DOCK, không đè lên nó: dock là `fixed bottom:0` cao
            `--dock-total` (globals.css) và vẽ SAU nội dung — thanh này để
            `bottom:0` là bà con bấm vào dock chứ không bấm được nút. */
        className="market-purchase-bar fixed inset-x-0 z-20 mx-auto flex max-w-[480px] items-center gap-3 border-t px-4 py-3"
        style={{
          bottom: "var(--dock-total)",
          backgroundColor: "var(--card)",
          borderColor: "var(--line)",
        }}
      >
        {/*  MÓN LIÊN HỆ BÁO GIÁ: cả thanh chỉ còn MỘT việc — gọi shop hỏi giá.
             Không để nút "Thêm vào giỏ" mờ nằm cạnh: nút mờ là hướng dẫn mù
             (R-03), bà con bấm mãi không hiểu vì sao không được. Shop chưa khai
             số thì đưa về trang shop để còn đường hỏi. */}
        {quoteOnly ? (
          shop?.phone ? (
            <CallButton phone={shop.phone} label="Gọi hỏi giá" className="flex-1" />
          ) : (
            <Link
              href={`/cho/shop/${product.shopSlug}`}
              className="flex min-h-[3.5rem] flex-1 items-center justify-center gap-1.5 rounded-full px-4 text-[1rem] font-bold"
              style={{ backgroundColor: "var(--trim)", color: "var(--card)" }}
            >
              Xem shop để hỏi giá
            </Link>
          )
        ) : (
          <>
            {shop?.phone ? (
              <CallButton phone={shop.phone} label="Gọi shop" />
            ) : (
              <Link
                href={`/cho/shop/${product.shopSlug}`}
                className="flex min-h-[3.5rem] shrink-0 items-center gap-1.5 rounded-full px-4 text-[1rem] font-bold"
                style={{ backgroundColor: "var(--field)", color: "var(--navy)" }}
              >
                Xem shop
              </Link>
            )}
            <PrimaryButton onClick={onAdd} disabled={!canAdd} className="flex-1">
              <CartIcon className="h-6 w-6" />
              {addLabel}
            </PrimaryButton>
          </>
        )}
      </div>

      {reviewsOpen && (
        <BottomSheet title="Tất cả đánh giá" onClose={() => setReviewsOpen(false)}>
          {allReviews === null ? (
            <p role="status" className="py-6 text-center text-[1.125rem] text-foreground/65">Đang tải…</p>
          ) : allReviews.length === 0 ? (
            <p className="py-6 text-center text-[1.125rem] text-foreground/65">
              Chưa tải được đánh giá — thử lại khi có sóng.
            </p>
          ) : (
            <ul className="flex flex-col gap-2 pb-3">
              {allReviews.map((r) => (
                <li key={r.id} className="rounded-2xl bg-field px-4 py-3">
                  <RatingStars value={r.rating} />
                  <p className="mt-1 text-[1rem] leading-snug">{r.comment || "Không ghi nhận xét."}</p>
                  <p className="mt-0.5 text-[0.875rem] text-foreground/60">{r.buyerPhoneMasked}</p>
                </li>
              ))}
            </ul>
          )}
        </BottomSheet>
      )}
    </div>
  );
}
