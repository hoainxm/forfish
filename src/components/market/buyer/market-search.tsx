"use client";

// `/cho/tim` — TÌM / DANH SÁCH (11 §5.2). 20 món một trang, "Xem thêm" bấm tay
// (không cuộn vô tận — tiết kiệm pin và mạng của bà con ngoài bến).
//
// Đọc `?q&category&province` SAU KHI MOUNT từ `location.search` (khuôn `Tabs
// paramKey`) chứ không `useSearchParams`: trang này là vỏ tĩnh, hook kia bắt
// phải bọc Suspense và làm cả màn nhấp nháy.
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { CategoryChips, type CategoryChipValue } from "@/components/market/shared/category-chips";
import { EmptyNet } from "@/components/market/shared/empty-net";
import { NetChip } from "@/components/market/shared/net-chip";
import { EmptyState } from "@/components/ui/primitives";
import { isProductCategory } from "@/lib/market/categories";
import { marketGet } from "@/lib/market/client";
import type { ProductCard, ProductQuery } from "@/lib/market/types";
import { useOnlineRefetch } from "@/lib/market/use-online";
import { loadHome } from "@/lib/region";
import { ErrorBlock, GridSkeleton, MarketTopBar, ProductGrid } from "./ui";
import { isOpenOrder, useCachedOrders, useFavorites, useMarketCart, useSeenLabel } from "./hooks";

type Sort = NonNullable<ProductQuery["sort"]>;
type ListRes = { items: ProductCard[]; total: number };

/*  Hàng chip sắp xếp NGANG (F-10): bản cũ 1 nút mở sheet 4 lựa chọn = 2 chạm.
    Nhãn ngắn để 4 chip + "Gần tôi" nằm một hàng cuộn; "N món" ở DÒNG RIÊNG dưới
    dải chip (R-02) chứ không cuối hàng cuộn — nằm trong đó là ra ngoài màn. */
export const SORT_LABEL: Record<Sort, string> = {
  moi: "Mới nhất",
  ban_chay: "Bán chạy",
  gia_tang: "Giá tăng",
  gia_giam: "Giá giảm",
};
export const SORTS: Sort[] = ["moi", "ban_chay", "gia_tang", "gia_giam"];

/** Chip 3.5rem đặc/tonal — cùng hình với chip "Gần tôi" (không phải ChipRow tầng 2 = 52px). */
export function SortChip({ on, onClick, children, pressed = true }: { on: boolean; onClick: () => void; children: React.ReactNode; pressed?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed ? on : undefined}
      className="min-h-[3.5rem] shrink-0 rounded-full px-4 text-[1rem] font-bold"
      style={{
        backgroundColor: on ? "var(--t3)" : "var(--field)",
        color: on ? "var(--card)" : "var(--navy)",
      }}
    >
      {children}
    </button>
  );
}

export function MarketSearch() {
  const router = useRouter();
  const cart = useMarketCart();
  const fav = useFavorites();
  const cache = useCachedOrders();

  const [q, setQ] = useState("");
  const [category, setCategory] = useState<CategoryChipValue>("tat_ca");
  const [nearOn, setNearOn] = useState(false);
  const [homeProvince, setHomeProvince] = useState<string>("");
  const [sort, setSort] = useState<Sort>("moi");

  const [items, setItems] = useState<ProductCard[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<"loading" | "ok" | "error" | "offline">("loading");
  const [moreError, setMoreError] = useState<"error" | "offline" | null>(null);
  const [ready, setReady] = useState(false);

  // ── đọc tham số URL sau mount ──────────────────────────────────────────
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const c = sp.get("category");
    setQ(sp.get("q") ?? "");
    if (c && isProductCategory(c)) setCategory(c);
    const home = loadHome().province ?? "";
    setHomeProvince(home);
    if (sp.get("province") && home) setNearOn(true);
    setReady(true);
  }, []);

  const fetchPage = useCallback(
    async (p: number, replace: boolean) => {
      const sp = new URLSearchParams();
      if (q.trim()) sp.set("q", q.trim());
      if (category !== "tat_ca") sp.set("category", category);
      if (nearOn && homeProvince) sp.set("province", homeProvince);
      sp.set("sort", sort);
      sp.set("page", String(p));
      const res = await marketGet<ListRes>(`/api/cho/san-pham?${sp.toString()}`);
      if (!res.ok) {
        if (replace) setStatus(res.offline ? "offline" : "error");
        else setMoreError(res.offline ? "offline" : "error");
        return;
      }
      setTotal(res.data.total);
      setItems((prev) => (replace ? res.data.items : [...prev, ...res.data.items]));
      setPage(p);
      setMoreError(null);
      setStatus("ok");
    },
    [q, category, nearOn, homeProvince, sort],
  );

  // Đổi chữ tìm / nhóm / Gần tôi / sắp xếp ⇒ về trang 1.
  useEffect(() => {
    if (!ready) return;
    setStatus("loading");
    void fetchPage(1, true);
  }, [ready, fetchPage]);

  useOnlineRefetch(() => {
    if (items.length === 0) void fetchPage(1, true);
  });

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

  const seen = useSeenLabel(items.length, total);
  const openOrders = (cache?.orders ?? []).filter(isOpenOrder).length;

  return (
    <div className="pb-[7rem]">
      <MarketTopBar
        q={q}
        onQ={setQ}
        onSubmit={() => void fetchPage(1, true)}
        cartCount={cart.count}
        openOrders={openOrders}
      />

      <CategoryChips value={category} onChange={setCategory} />

      <div className="mb-2 flex items-center gap-1.5 overflow-x-auto px-4" role="group" aria-label="Sắp xếp">
        {SORTS.map((s) => (
          <SortChip key={s} on={s === sort} onClick={() => setSort(s)}>
            {SORT_LABEL[s]}
          </SortChip>
        ))}
        {homeProvince && (
          <SortChip on={nearOn} onClick={() => setNearOn((v) => !v)}>
            Gần tôi · {homeProvince}
          </SortChip>
        )}
      </div>

      {/*  SỐ KẾT QUẢ Ở DÒNG RIÊNG (R-02, 2026-09-06): trong dải chip nó bị đẩy ra
           x=437 — ngoài màn 390px, phải cuộn ngang mới thấy. Số món tìm được là
           thứ bà con đọc đầu tiên, không được nằm chỗ phải đi tìm. */}
      {status === "ok" && (
        <p className="mb-3 px-4 text-[1rem] font-semibold text-foreground/65" aria-live="polite">
          {total} món
        </p>
      )}

      {status === "ok" && moreError === "offline" && (
        <NetChip state="offline" text="Không có sóng — đang xem kết quả đã tải" />
      )}

      <div className="px-4">
        {status === "loading" && <GridSkeleton />}
        {status === "error" && <ErrorBlock onRetry={() => void fetchPage(1, true)} />}
        {status === "offline" && <EmptyNet what="tìm món" onRetry={() => void fetchPage(1, true)} />}

        {status === "ok" && items.length === 0 && (
          <EmptyState>
            Không thấy món nào cho “{q.trim() || "chợ"}”. Thử chữ ngắn hơn (vd: “lọc dầu”) hay chọn nhóm hàng
            {nearOn ? ", hoặc tắt Gần tôi" : ""}.
          </EmptyState>
        )}

        {status === "ok" && items.length > 0 && (
          <>
            <ProductGrid items={items} isFav={fav.has} onFav={onFav} />
            {seen && <p className="mt-3 text-center text-[1rem] text-foreground/65">{seen}</p>}
            {moreError === "error" && (
              <p role="alert" className="mt-2 text-center text-[1rem] font-bold text-danger">
                Chưa tải thêm được — thử lại giúp.
              </p>
            )}
            {items.length < total && (
              <button
                type="button"
                onClick={() => void fetchPage(page + 1, false)}
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
