"use client";

import Link from "next/link";
import type { ComponentType } from "react";
import {
  BasketIcon, BoxIcon, EngineIcon, FuelIcon, GearIcon, IceIcon, LifebuoyIcon, NetIcon, RadarIcon, StarIcon,
} from "@/components/icons";
import { CATEGORY_ICON } from "@/lib/market/categories";
import { discountPercent } from "@/lib/market/pricing";
import type { ProductCard, ProductCategory } from "@/lib/market/types";
import { PriceText } from "./price-text";
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
 * Thẻ sản phẩm: ảnh 4:3, tên tối đa 3 dòng, giá và shop/tỉnh tách dòng.
 * CHẠM CẢ THẺ → trang món; KHÔNG còn "+ Giỏ"/"Chọn" trong lưới
 * (thêm giỏ là việc của trang món — ở đó mới chọn loại/số lượng được).
 *
 * Nút lưu món riêng trên ảnh, không lồng trong link, vùng chạm 3.5rem.
 * Tên export có tiền tố `Market` để không trùng type `ProductCard`.
 */
export function MarketProductCard({
  product,
  href,
  fav,
  onFav,
}: {
  product: ProductCard;
  href: string;
  fav?: boolean;
  onFav?: () => void;
}) {
  const [imgBroken, setImgBroken] = useState(false);
  const pct = discountPercent(product);
  /*  Món LIÊN HỆ BÁO GIÁ để stock=0 (không theo dõi kho) — KHÔNG được phủ
      "Hết hàng" lên nó: hàng vẫn có, chỉ là hỏi giá rồi mới mua. Thẻ đã nói
      "Liên hệ báo giá" ở dòng giá, thế là đủ. */
  const quoteOnly = product.priceVnd == null;
  const out = product.status !== "dang_ban" || (!quoteOnly && product.stock <= 0);
  const image = product.images[0];

  return (
    <article className="market-product-card surface relative flex h-full flex-col overflow-hidden">
      <Link href={href} className="flex h-full min-h-(--row-h) flex-col" aria-label={product.title}>
        {/*  Khung ảnh GIỮ tỷ lệ 4:3 bất kể cỡ ảnh: ảnh nằm TUYỆT ĐỐI trong khung.
            Trước đây <img h-full> trong khung aspect-ratio để ảnh dọc kéo giãn
            khung (đo 2026-10-19, cùng rộng 173px: cao 289/142/130px) ⇒ hàng
            thẻ lệch tên–giá (rà Codex). shrink-0: flex cột không bóp khung. */}
        <div className="market-product-image relative aspect-[4/3] w-full shrink-0 overflow-hidden bg-field">
          {image && !imgBroken ? (
            // eslint-disable-next-line @next/next/no-img-element -- ảnh sàn: bucket public Supabase / data-URI seed, không qua optimizer (băng thông có đo đếm)
            <img
              src={image}
              alt={product.title}
              loading="lazy"
              className="absolute inset-0 h-full w-full object-contain p-3"
              onError={() => setImgBroken(true)}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-foreground/40">
              <CategoryIcon category={product.category} className="h-12 w-12" />
            </div>
          )}
          {pct != null && (
            <span
              className="absolute left-2 top-2 rounded-full px-2 py-0.5 text-[0.8125rem] font-semibold"
              style={{ backgroundColor: "var(--trim)", color: "var(--card)" }}
            >
              -{pct}%
            </span>
          )}
          {out && (
            <div className="absolute inset-0 flex items-center justify-center bg-navy/60">
              <span className="rounded-full bg-card px-3 py-1 text-[1rem] font-semibold text-navy">Hết hàng</span>
            </div>
          )}
          {product.shopPaused && !out && (
            <span
              className="absolute bottom-2 left-2 rounded-full px-2 py-0.5 text-[0.75rem] font-semibold"
              style={{ backgroundColor: "var(--warn-bg)", color: "var(--warn)" }}
            >
              Tạm nghỉ
            </span>
          )}
        </div>
        {/* Tên/giá trước; shop và tỉnh luôn đọc được, không nhét vào dòng cắt. */}
        <div className="flex flex-1 flex-col p-3">
          <p className="line-clamp-3 text-[1rem] font-semibold leading-snug text-navy">{product.title}</p>
          <PriceText priceVnd={product.priceVnd} compareAtVnd={product.compareAtVnd} className="mt-1" />
          {/* "Đã bán 0" không giúp chọn món ⇒ chưa bán, chưa đánh giá thì bỏ cả dòng (rà Codex 2026-10-19). */}
          {(product.soldCount > 0 || product.ratingCount > 0) && (
            <p className="mt-2 text-[0.875rem] leading-relaxed text-foreground/80">
              {product.soldCount > 0 && <>Đã bán {product.soldCount}</>}
              {product.ratingCount > 0 && (
                <>
                  {product.soldCount > 0 && " · "}
                  <span className="inline-flex items-center gap-0.5 align-middle" style={{ color: "var(--sun)" }}>
                    <StarIcon className="h-3.5 w-3.5 fill-current" />
                  </span>{" "}
                  {product.ratingAvg.toFixed(1)}
                </>
              )}
            </p>
          )}
          <p className="mt-auto pt-2 text-[0.875rem] font-semibold leading-snug text-navy">{product.shopName}</p>
          {product.shopProvince && <p className="mt-1 text-[0.875rem] text-foreground/80">{product.shopProvince}</p>}
        </div>
      </Link>
      {onFav && (
        <button
          type="button"
          onClick={onFav}
          aria-pressed={!!fav}
          aria-label={fav ? "Bỏ yêu thích" : "Yêu thích"}
          className="group absolute right-0 top-0 flex h-14 w-14 items-center justify-center"
          style={{ color: fav ? "var(--trim)" : "var(--navy)" }}
        >
          {/* Vùng chạm giữ 3.5rem; phần VẼ chỉ 2.25rem — hành động phụ không tranh với ảnh và tên món (rà Codex 2026-10-19). */}
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-card/90 shadow-sm transition group-active:scale-95">
            <StarIcon className={`h-5 w-5 ${fav ? "fill-current" : ""}`} />
          </span>
        </button>
      )}
    </article>
  );
}
