"use client";

// `/cho/shop/[slug]` — TRANG SHOP (11 §5.4). Shop chưa duyệt / bị khoá / bị từ
// chối ⇒ route trả 403 và màn chỉ nói "Shop này đang tạm đóng." — KHÔNG lộ lý
// do (đó là chuyện giữa shop và SDVICO).
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AlertIcon } from "@/components/icons";
import { CategoryChips, type CategoryChipValue } from "@/components/market/shared/category-chips";
import { EmptyNet } from "@/components/market/shared/empty-net";
import { NetChip } from "@/components/market/shared/net-chip";
import { RatingStars } from "@/components/market/shared/rating-stars";
import { CallButton, EmptyState } from "@/components/ui/primitives";
import { StatusBanner } from "@/components/ui/status-banner";
import { formatVnd } from "@/lib/format";
import { NHAN } from "@/lib/labels";
import { isProductCategory } from "@/lib/market/categories";
import { marketGet } from "@/lib/market/client";
import { saveListState, takeListState } from "@/lib/market/list-state";
import type { Page, ProductCard, ProductQuery, ShopPublic } from "@/lib/market/types";
import { useOnlineRefetch } from "@/lib/market/use-online";
import { SORT_LABEL, SORTS, SortChip } from "./market-search";
import { ErrorBlock, GridSkeleton, ProductGrid, primaryLinkClass } from "./ui";
import { useFavorites, useKhoiPhucCuon, useMarketCart, useNhoCuon } from "./hooks";

type Sort = NonNullable<ProductQuery["sort"]>;

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
  const [sort, setSort] = useState<Sort>("moi"); // F-24: sắp xếp trong shop (route đã nhận `?sort`)
  const [status, setStatus] = useState<"loading" | "ok" | "error" | "offline" | "closed" | "gone">("loading");
  const [descOpen, setDescOpen] = useState(false);
  /*  "Xem thêm" CHỈ khi mô tả thật sự bị cắt (VT-22, cùng khuôn F-17 trang món): đo
      `scrollHeight > clientHeight` sau khi vẽ — bản cũ luôn hiện nút dù mô tả 2 dòng. */
  const [descClamped, setDescClamped] = useState(false);
  const descRef = useRef<HTMLParagraphElement>(null);
  /** mất sóng / lỗi khi đổi chip mà đang có món ⇒ giữ lưới + chip báo (VT-08) */
  const [netNote, setNetNote] = useState<{ state: "offline" | "error"; text: string } | null>(null);
  const [ready, setReady] = useState(false);

  /*  QUAY LẠI ĐÚNG CHỖ (VT-03, cùng khuôn `/cho/tim` 11 §5b.2): bản chụp giữ thẻ shop, món
      đã tải, trang, nhóm, sắp xếp, vị trí cuộn trong `sessionStorage` ≤10 phút. */
  const LIST_ID = `cho-shop:${slug}`;
  const khoiPhuc = useRef<number | null>(null);
  const vuaKhoiPhuc = useRef(false);
  const daAp = useRef<{ category: CategoryChipValue; sort: Sort } | null>(null);
  const dangHoan = useRef(false);
  const itemsRef = useRef<ProductCard[]>([]);
  const cuonRef = useNhoCuon();
  useKhoiPhucCuon(khoiPhuc, items.length);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    const cu = takeListState<ProductCard>(LIST_ID);
    const shop = cu?.extra?.shop as ShopPublic | undefined;
    if (cu && shop) {
      const f = cu.filters;
      if (typeof f.category === "string" && isProductCategory(f.category)) setCategory(f.category);
      if (typeof f.sort === "string" && (SORTS as readonly string[]).includes(f.sort)) setSort(f.sort as Sort);
      setData({ shop, products: { items: cu.items, total: cu.total, page: cu.page, pageSize: cu.items.length } });
      setItems(cu.items);
      setPage(cu.page);
      setStatus("ok");
      khoiPhuc.current = cu.scrollY;
      vuaKhoiPhuc.current = true;
    }
    setReady(true);
  }, [LIST_ID]);

  // Ghi bản chụp trước khi rời màn (pagehide + unmount) — chỉ khi đang có món để quay lại
  useEffect(() => {
    const ghi = () => {
      if (status !== "ok" || items.length === 0 || !data) return;
      saveListState<ProductCard>(LIST_ID, {
        q: "",
        filters: { category, sort },
        items,
        total: data.products.total,
        page,
        scrollY: cuonRef.current,
        extra: { shop: data.shop },
      });
    };
    window.addEventListener("pagehide", ghi);
    return () => {
      window.removeEventListener("pagehide", ghi);
      ghi();
    };
  }, [LIST_ID, status, items, data, category, sort, page, cuonRef]);

  const load = useCallback(
    async (p: number, replace: boolean) => {
      // đã có món ⇒ không thay lưới bằng skeleton khi đổi chip (cùng luật VT-07 ở /cho/tim)
      if (replace && itemsRef.current.length === 0) setStatus("loading");
      const sp = new URLSearchParams({ page: String(p), sort });
      if (category !== "tat_ca") sp.set("category", category);
      const res = await marketGet<ShopRes>(`/api/cho/shop/${encodeURIComponent(slug)}?${sp.toString()}`);
      if (!res.ok) {
        if (res.code === "shop_not_active") setStatus("closed");
        else if (res.status === 404) setStatus("gone");
        else if (replace) {
          const loai = res.offline ? "offline" : "error";
          /*  VT-08: đang có món mà mất sóng ⇒ giữ lưới, báo một chip, hoàn chip sắp xếp/nhóm
              về bộ của lần tải được gần nhất — bản cũ thay cả lưới bằng khối mất sóng. */
          if (itemsRef.current.length > 0 && daAp.current) {
            setNetNote({
              state: loai,
              text: loai === "offline" ? "Không có sóng — đang xem món đã tải" : "Chợ trục trặc — đang xem món đã tải",
            });
            const cu = daAp.current;
            if (cu.category !== category || cu.sort !== sort) {
              dangHoan.current = true;
              setCategory(cu.category);
              setSort(cu.sort);
            }
          } else setStatus(loai);
        }
        return;
      }
      daAp.current = { category, sort };
      setNetNote(null);
      setData(res.data);
      setItems((prev) => (replace ? res.data.products.items : [...prev, ...res.data.products.items]));
      setPage(p);
      setStatus("ok");
    },
    [slug, category, sort],
  );

  useEffect(() => {
    if (!ready) return;
    if (vuaKhoiPhuc.current) {
      vuaKhoiPhuc.current = false; // bản chụp vừa khôi phục là kết quả của đúng bộ lọc này
      daAp.current = { category, sort };
      return;
    }
    if (dangHoan.current) {
      dangHoan.current = false; // lượt này do hoàn chip gây ra
      return;
    }
    void load(1, true);
  }, [ready, load, category, sort]);
  useOnlineRefetch(() => void load(1, true));

  const moTa = data?.shop?.description;
  useLayoutEffect(() => {
    if (descOpen) return;
    const el = descRef.current;
    setDescClamped(el ? el.scrollHeight > el.clientHeight + 1 : false);
  }, [moTa, descOpen]);

  const onFav = (p: ProductCard) => {
    if (!cart.signedIn) {
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
        <p className="text-[1rem] font-semibold text-navy">
          {status === "closed" ? "Shop này đang tạm đóng." : "Không tìm thấy shop này."}
        </p>
        {/*  F-09: màn cụt phải có đường ra — trước đây chỉ có câu, không nút. */}
        <Link href="/cho" className={`${primaryLinkClass} mx-auto mt-4 max-w-[15rem]`}>
          Về cửa hàng
        </Link>
      </div>
    );
  }

  const shop = data?.shop;

  return (
    <div className="pb-[7rem]">
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
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-field text-[1.5rem] font-semibold text-navy">
                {shop.name.slice(0, 1)}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <h2 className="display text-[1rem] font-semibold leading-snug text-navy">{shop.name}</h2>
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
              <p ref={descRef} className={`text-[1rem] leading-relaxed ${descOpen ? "" : "line-clamp-3"}`}>{shop.description}</p>
              {(descClamped || descOpen) && (
                <button
                  type="button"
                  onClick={() => setDescOpen((v) => !v)}
                  className="min-h-(--row-h) text-[1rem] font-semibold text-t3"
                >
                  {descOpen ? NHAN.thuGon : NHAN.xemThem}
                </button>
              )}
            </div>
          )}
        </>
      )}

      <div className="pt-2">
        <CategoryChips value={category} onChange={setCategory} />
      </div>
      <div className="mb-2 flex items-center gap-1.5 overflow-x-auto cuon-an px-4" role="group" aria-label="Sắp xếp">
        {SORTS.map((s) => (
          <SortChip key={s} on={s === sort} onClick={() => setSort(s)}>
            {SORT_LABEL[s]}
          </SortChip>
        ))}
      </div>
      {/* "N món" DÒNG RIÊNG dưới dải chip (VT-09, như R-02 ở /cho/tim) — trong dải cuộn ngang
          nó nằm ở x=435, ngoài màn 390px */}
      {data && status === "ok" && (
        <p className="mb-3 px-4 text-[1rem] font-semibold text-foreground/65" aria-live="polite">
          {data.products.total} món
        </p>
      )}
      {status === "ok" && netNote && <NetChip state={netNote.state} text={netNote.text} />}

      <div className="px-4">
        {status === "loading" && <GridSkeleton n={4} />}
        {status === "error" && <ErrorBlock what="shop này" onRetry={() => void load(1, true)} />}
        {status === "offline" && <EmptyNet what="trang shop" onRetry={() => void load(1, true)} />}
        {status === "ok" && items.length === 0 && (
          <EmptyState>{category === "tat_ca" ? "Shop chưa đăng món nào." : "Shop chưa có món trong nhóm này."}</EmptyState>
        )}
        {status === "ok" && items.length > 0 && (
          <>
            <ProductGrid items={items} isFav={fav.has} onFav={onFav} />
            {data && items.length < data.products.total && (
              <button
                type="button"
                onClick={() => void load(page + 1, false)}
                className="sq-btn mx-auto mt-3 flex bg-field text-navy"
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
