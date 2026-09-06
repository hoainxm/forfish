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
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { EmptyState } from "@/components/ui/primitives";
import { isProductCategory } from "@/lib/market/categories";
import { marketGet } from "@/lib/market/client";
import type { ProductCard, ProductQuery } from "@/lib/market/types";
import { useOnlineRefetch } from "@/lib/market/use-online";
import { loadHome } from "@/lib/region";
import { CartFeedback, ErrorBlock, GridSkeleton, MarketTopBar, ProductGrid } from "./ui";
import { isOpenOrder, useCachedOrders, useFavorites, useMarketCart, useSeenLabel } from "./hooks";

type Sort = NonNullable<ProductQuery["sort"]>;
type ListRes = { items: ProductCard[]; total: number };

const SORT_LABEL: Record<Sort, string> = {
  moi: "Mới nhất",
  ban_chay: "Bán chạy",
  gia_tang: "Giá thấp → cao",
  gia_giam: "Giá cao → thấp",
};
const SORTS: Sort[] = ["moi", "ban_chay", "gia_tang", "gia_giam"];

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
  const [sortOpen, setSortOpen] = useState(false);

  const [items, setItems] = useState<ProductCard[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<"loading" | "ok" | "error" | "offline">("loading");
  const [moreError, setMoreError] = useState<"error" | "offline" | null>(null);
  const [note, setNote] = useState<string | null>(null);
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
    <div className="pb-8">
      <MarketTopBar
        q={q}
        onQ={setQ}
        onSubmit={() => void fetchPage(1, true)}
        cartCount={cart.count}
        openOrders={openOrders}
      />

      <CategoryChips value={category} onChange={setCategory} />

      <div className="mb-3 flex items-center gap-2 px-4">
        {homeProvince && (
          <button
            type="button"
            onClick={() => setNearOn((v) => !v)}
            aria-pressed={nearOn}
            className="min-h-[3.5rem] shrink-0 rounded-full px-4 text-[1rem] font-bold"
            style={{
              backgroundColor: nearOn ? "var(--t3)" : "var(--field)",
              color: nearOn ? "var(--card)" : "var(--navy)",
            }}
          >
            Gần tôi · {homeProvince}
          </button>
        )}
        <button
          type="button"
          onClick={() => setSortOpen(true)}
          className="ml-auto min-h-[3.5rem] shrink-0 rounded-full bg-field px-4 text-[1rem] font-bold text-navy"
        >
          Sắp xếp: {SORT_LABEL[sort]}
        </button>
      </div>

      {status === "ok" && moreError === "offline" && (
        <NetChip state="offline" text="Không có sóng — đang xem kết quả đã tải" />
      )}

      <div className="px-4">
        <CartFeedback note={note} count={cart.count} />

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
            <ProductGrid items={items} isFav={fav.has} onFav={onFav} onAdd={add} />
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

      {sortOpen && (
        <BottomSheet title="Sắp xếp" onClose={() => setSortOpen(false)}>
          <ul className="flex flex-col gap-1 pb-2">
            {SORTS.map((s) => (
              <li key={s}>
                <button
                  type="button"
                  onClick={() => {
                    setSort(s);
                    setSortOpen(false);
                  }}
                  aria-pressed={s === sort}
                  className="flex min-h-[3.5rem] w-full items-center rounded-2xl px-4 text-[1.125rem] font-bold"
                  style={{
                    backgroundColor: s === sort ? "var(--t3-bg)" : "transparent",
                    color: s === sort ? "var(--t3)" : "var(--navy)",
                  }}
                >
                  {SORT_LABEL[s]}
                </button>
              </li>
            ))}
          </ul>
        </BottomSheet>
      )}
    </div>
  );
}
