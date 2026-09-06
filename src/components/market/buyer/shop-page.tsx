"use client";

// `/cho/shop/[slug]` — TRANG SHOP (11 §5.4). Shop chưa duyệt / bị khoá / bị từ
// chối ⇒ route trả 403 và màn chỉ nói "Shop này đang tạm đóng." — KHÔNG lộ lý
// do (đó là chuyện giữa shop và SDVICO).
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AlertIcon } from "@/components/icons";
import { CategoryChips, type CategoryChipValue } from "@/components/market/shared/category-chips";
import { EmptyNet } from "@/components/market/shared/empty-net";
import { RatingStars } from "@/components/market/shared/rating-stars";
import { CallButton, EmptyState } from "@/components/ui/primitives";
import { StatusBanner } from "@/components/ui/status-banner";
import { formatVnd } from "@/lib/format";
import { marketGet } from "@/lib/market/client";
import type { Page, ProductCard, ShopPublic } from "@/lib/market/types";
import { useOnlineRefetch } from "@/lib/market/use-online";
import { CartFeedback, ErrorBlock, GridSkeleton, ProductGrid } from "./ui";
import { useFavorites, useMarketCart } from "./hooks";

interface ShopRes {
  shop: ShopPublic;
  products: Page<ProductCard>;
}

/** "Giao: miễn phí" · "Giao: 30.000đ · miễn phí từ 2.000.000đ" */
function shippingLabel(s: ShopPublic): string {
  if (s.shippingFlatVnd <= 0) return "Giao: miễn phí";
  const base = `Giao: ${formatVnd(s.shippingFlatVnd)}`;
  return s.freeShipFromVnd != null ? `${base} · miễn phí từ ${formatVnd(s.freeShipFromVnd)}` : base;
}

export function ShopPage({ slug }: { slug: string }) {
  const router = useRouter();
  const cart = useMarketCart();
  const fav = useFavorites();

  const [data, setData] = useState<ShopRes | null>(null);
  const [items, setItems] = useState<ProductCard[]>([]);
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState<CategoryChipValue>("tat_ca");
  const [status, setStatus] = useState<"loading" | "ok" | "error" | "offline" | "closed" | "gone">("loading");
  const [note, setNote] = useState<string | null>(null);
  const [descOpen, setDescOpen] = useState(false);

  const load = useCallback(
    async (p: number, replace: boolean) => {
      if (replace) setStatus("loading");
      const sp = new URLSearchParams({ page: String(p) });
      if (category !== "tat_ca") sp.set("category", category);
      const res = await marketGet<ShopRes>(`/api/cho/shop/${encodeURIComponent(slug)}?${sp.toString()}`);
      if (!res.ok) {
        if (res.code === "shop_not_active") setStatus("closed");
        else if (res.status === 404) setStatus("gone");
        else if (replace) setStatus(res.offline ? "offline" : "error");
        return;
      }
      setData(res.data);
      setItems((prev) => (replace ? res.data.products.items : [...prev, ...res.data.products.items]));
      setPage(p);
      setStatus("ok");
    },
    [slug, category],
  );

  useEffect(() => {
    void load(1, true);
  }, [load]);
  useOnlineRefetch(() => void load(1, true));

  const add = (p: ProductCard) => {
    const r = cart.add(p.id, undefined, 1);
    setNote(
      r === "ok"
        ? `Đã thêm ${p.title} vào giỏ`
        : r === "gio_day"
          ? "Giỏ đầy rồi — bỏ bớt món cũ rồi thêm lại."
          : "Máy hết chỗ — CHƯA lưu được giỏ.",
    );
  };
  const onFav = (p: ProductCard) => {
    if (!cart.phone) {
      router.push(`/cho/sp/${p.id}`);
      return;
    }
    fav.toggle({
      productId: p.id,
      savedAt: Date.now(),
      snapshot: {
        title: p.title,
        priceVnd: p.priceVnd,
        ...(p.images[0] ? { image: p.images[0] } : {}),
        shopName: p.shopName,
      },
    });
  };

  if (status === "closed" || status === "gone") {
    return (
      <div className="px-4 py-8 text-center">
        <div className="mx-auto mb-3 w-fit text-foreground/50">
          <AlertIcon className="h-8 w-8" />
        </div>
        <p className="text-[1.125rem] font-bold text-navy">
          {status === "closed" ? "Shop này đang tạm đóng." : "Không tìm thấy shop này."}
        </p>
      </div>
    );
  }

  const shop = data?.shop;

  return (
    <div className="pb-8">
      {shop && (
        <>
          {shop.paused && (
            <StatusBanner level="warn">Shop đang tạm nghỉ, mở lại sau.</StatusBanner>
          )}
          <div className="surface mx-4 mt-3 flex items-start gap-3 px-4 py-4">
            {shop.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- ảnh sàn, không qua optimizer
              <img src={shop.logoUrl} alt="" className="h-16 w-16 shrink-0 rounded-2xl object-cover" />
            ) : (
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-field text-[1.5rem] font-bold text-navy">
                {shop.name.slice(0, 1)}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <h2 className="display text-[1.25rem] font-bold leading-snug text-navy">{shop.name}</h2>
              <p className="mt-0.5 text-[1rem] text-foreground/65">
                {[shop.province, shop.address].filter(Boolean).join(" · ")}
              </p>
              {shop.ratingCount > 0 && (
                <RatingStars value={shop.ratingAvg} count={shop.ratingCount} className="mt-0.5" />
              )}
              <p className="mt-0.5 text-[1rem] font-semibold text-navy">{shippingLabel(shop)}</p>
            </div>
            {shop.phone && <CallButton phone={shop.phone} label="Gọi" />}
          </div>
          {shop.description && (
            <div className="px-4 pt-3">
              <p className={`text-[1.0625rem] leading-relaxed ${descOpen ? "" : "line-clamp-3"}`}>{shop.description}</p>
              <button
                type="button"
                onClick={() => setDescOpen((v) => !v)}
                className="min-h-[3.5rem] text-[1rem] font-bold text-t3"
              >
                {descOpen ? "Thu gọn" : "Xem thêm"}
              </button>
            </div>
          )}
        </>
      )}

      <div className="pt-2">
        <CategoryChips value={category} onChange={setCategory} />
      </div>

      <div className="px-4">
        <CartFeedback note={note} count={cart.count} />
        {status === "loading" && <GridSkeleton n={4} />}
        {status === "error" && <ErrorBlock what="shop này" onRetry={() => void load(1, true)} />}
        {status === "offline" && <EmptyNet what="trang shop" onRetry={() => void load(1, true)} />}
        {status === "ok" && items.length === 0 && (
          <EmptyState>{category === "tat_ca" ? "Shop chưa đăng món nào." : "Shop chưa có món trong nhóm này."}</EmptyState>
        )}
        {status === "ok" && items.length > 0 && (
          <>
            <ProductGrid items={items} isFav={fav.has} onFav={onFav} onAdd={add} />
            {data && items.length < data.products.total && (
              <button
                type="button"
                onClick={() => void load(page + 1, false)}
                className="display mx-auto mt-3 flex min-h-[3.5rem] w-full max-w-[17.5rem] items-center justify-center rounded-full bg-field text-[1.125rem] font-bold text-navy"
              >
                Xem thêm
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
