"use client";

import Link from "next/link";
import type { ComponentType } from "react";
import {
  BasketIcon, BoxIcon, CartIcon, EngineIcon, FuelIcon, GearIcon, IceIcon, LifebuoyIcon, NetIcon, RadarIcon, StarIcon,
} from "@/components/icons";
import { SQ_BTN } from "@/components/ui/sq-btn";
import { CATEGORY_ICON } from "@/lib/market/categories";
import { discountPercent } from "@/lib/market/pricing";
import type { ProductCard, ProductCategory } from "@/lib/market/types";
import { PriceText } from "./price-text";
import { ShopBadge } from "./shop-badge";
import { useState } from "react";

type IconProps = { className?: string };
const ICONS: Record<string, ComponentType<IconProps>> = {
  EngineIcon, RadarIcon, NetIcon, FuelIcon, IceIcon, BasketIcon, LifebuoyIcon, GearIcon, BoxIcon,
};

/** Icon nhóm hàng theo `CATEGORY_ICON` (tên trong icons.tsx). */
export function CategoryIcon({ category, className }: { category: ProductCategory; className?: string }) {
  const Icon = ICONS[CATEGORY_ICON[category]] ?? BoxIcon;
  return <Icon className={className} />;
}

/**
 * Thẻ sản phẩm ở danh sách (12 §8.1). Tên có tiền tố `Market` để không trùng
 * type `ProductCard`. Tap cả thẻ ≥ 3.5rem; nút "+ Giỏ" (SQ_BTN) chỉ khi không
 * biến thể, có biến thể ⇒ "Chọn" (mở trang món).
 */
export function MarketProductCard({
  product,
  href,
  fav,
  onFav,
  onAdd,
}: {
  product: ProductCard;
  href: string;
  fav?: boolean;
  onFav?: () => void;
  onAdd?: () => void;
}) {
  const [imgBroken, setImgBroken] = useState(false);
  const pct = discountPercent(product);
  const out = product.stock <= 0 || product.status !== "dang_ban";
  const hasVariants = product.variants.length > 0;
  const image = product.images[0];

  return (
    <article className="surface relative flex flex-col overflow-hidden">
      <Link href={href} className="block min-h-[3.5rem]" aria-label={product.title}>
        <div className="relative aspect-square w-full bg-field">
          {image && !imgBroken ? (
            // eslint-disable-next-line @next/next/no-img-element -- ảnh sàn: bucket public Supabase / data-URI seed, không qua optimizer (băng thông có đo đếm)
            <img
              src={image}
              alt={product.title}
              loading="lazy"
              className="h-full w-full object-cover"
              onError={() => setImgBroken(true)}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-foreground/40">
              <CategoryIcon category={product.category} className="h-12 w-12" />
            </div>
          )}
          {pct != null && (
            <span
              className="absolute left-2 top-2 rounded-full px-2 py-0.5 text-[0.8125rem] font-bold"
              style={{ backgroundColor: "var(--trim)", color: "var(--card)" }}
            >
              -{pct}%
            </span>
          )}
          {out && (
            <div className="absolute inset-0 flex items-center justify-center bg-navy/60">
              <span className="rounded-full bg-card px-3 py-1 text-[1rem] font-bold text-navy">Hết hàng</span>
            </div>
          )}
        </div>
        <div className="px-3 pt-2">
          <p className="line-clamp-2 text-[1rem] font-bold leading-snug text-navy">{product.title}</p>
          <PriceText priceVnd={product.priceVnd} compareAtVnd={product.compareAtVnd} className="mt-1" />
          <p className="mt-0.5 text-[0.875rem] text-foreground/65">
            Đã bán {product.soldCount}
            {product.ratingCount > 0 && (
              <>
                {" · "}
                <span className="inline-flex items-center gap-0.5 align-middle" style={{ color: "var(--sun)" }}>
                  <StarIcon className="h-3.5 w-3.5 fill-current" />
                </span>{" "}
                {product.ratingAvg.toFixed(1)}
              </>
            )}
          </p>
          <ShopBadge name={product.shopName} province={product.shopProvince} paused={product.shopPaused} className="mt-0.5" />
        </div>
      </Link>
      <div className="flex items-center justify-between gap-2 px-3 pb-3 pt-2">
        {onFav ? (
          <button
            type="button"
            onClick={onFav}
            aria-pressed={!!fav}
            aria-label={fav ? "Bỏ yêu thích" : "Yêu thích"}
            className="flex h-14 w-14 items-center justify-center rounded-full transition active:scale-95"
            style={{ color: fav ? "var(--trim)" : "var(--foreground)", backgroundColor: "var(--field)" }}
          >
            <StarIcon className={`h-6 w-6 ${fav ? "fill-current" : ""}`} />
          </button>
        ) : (
          <span />
        )}
        {hasVariants || !onAdd ? (
          <Link
            href={href}
            className={SQ_BTN}
            style={{ backgroundColor: "var(--t3-bg)", color: "var(--t3)" }}
            aria-label={`Chọn loại ${product.title}`}
          >
            <CartIcon className="h-6 w-6" />
            Chọn
          </Link>
        ) : (
          <button
            type="button"
            onClick={onAdd}
            disabled={out || product.shopPaused}
            className={`${SQ_BTN} disabled:opacity-40`}
            style={{ backgroundColor: "var(--t3-bg)", color: "var(--t3)" }}
            aria-label={`Thêm ${product.title} vào giỏ`}
          >
            <CartIcon className="h-6 w-6" />
            + Giỏ
          </button>
        )}
      </div>
    </article>
  );
}
