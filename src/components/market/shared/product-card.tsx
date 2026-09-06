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
 * Thẻ sản phẩm ở danh sách (12 §8.1) — GỌN như Shopee (F-04, 2026-09-06): ảnh
 * vuông (badge -N% + ♡ đè góc) · tên 2 dòng · giá · MỘT dòng "Đã bán N · ★x.x ·
 * shop · tỉnh". CHẠM CẢ THẺ → trang món; KHÔNG còn "+ Giỏ"/"Chọn" trong lưới
 * (thêm giỏ là việc của trang món — ở đó mới chọn loại/số lượng được).
 *
 * ♡ là nút riêng ĐÈ LÊN ảnh (không lồng trong `<a>`): vùng chạm 2.75rem = ngoại
 * lệ có chủ đích so với sàn 3.5rem — nó nằm trên ảnh lớn, không cạnh nút nào
 * khác nên chạm hụt không bấm nhầm việc khác (03-design-system ghi ngoại lệ).
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
  const out = product.stock <= 0 || product.status !== "dang_ban";
  const image = product.images[0];

  return (
    <article className="surface relative flex h-full flex-col overflow-hidden">
      <Link href={href} className="flex h-full min-h-[3.5rem] flex-col" aria-label={product.title}>
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
          {product.shopPaused && !out && (
            <span
              className="absolute bottom-2 left-2 rounded-full px-2 py-0.5 text-[0.75rem] font-bold"
              style={{ backgroundColor: "var(--warn-bg)", color: "var(--warn)" }}
            >
              Tạm nghỉ
            </span>
          )}
        </div>
        {/*  THÂN THẺ GỌN (R-05, 2026-09-06): bỏ `mt-auto` (nó giữ chỗ 2 dòng tên
             cho thẻ tên 1 dòng ⇒ khoảng trống lớn) và gộp "Đã bán · shop · tỉnh"
             về MỘT dòng ⇒ thẻ 334px xuống ~300px, gần Shopee (~260) mà không
             mất chữ nào. Ảnh vuông + tên 2 dòng giữ nguyên. */}
        <div className="flex flex-1 flex-col px-2.5 pb-2 pt-1.5">
          <p className="line-clamp-2 text-[1rem] font-bold leading-snug text-navy">{product.title}</p>
          <PriceText priceVnd={product.priceVnd} compareAtVnd={product.compareAtVnd} className="mt-1" />
          <p className="mt-0.5 truncate text-[0.875rem] text-foreground/65">
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
            {" · "}
            <span className="font-semibold text-navy/80">{product.shopName}</span>
            {product.shopProvince ? ` · ${product.shopProvince}` : ""}
          </p>
        </div>
      </Link>
      {onFav && (
        <button
          type="button"
          onClick={onFav}
          aria-pressed={!!fav}
          aria-label={fav ? "Bỏ yêu thích" : "Yêu thích"}
          className="absolute right-1.5 top-1.5 flex h-11 w-11 items-center justify-center rounded-full bg-card/90 shadow-sm transition active:scale-95"
          style={{ color: fav ? "var(--trim)" : "var(--navy)" }}
        >
          <StarIcon className={`h-6 w-6 ${fav ? "fill-current" : ""}`} />
        </button>
      )}
    </article>
  );
}
