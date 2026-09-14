"use client";

// `/cho/tim` — TÌM / DANH SÁCH (11 §5.2). 20 món một trang, "Xem thêm" bấm tay
// (không cuộn vô tận — tiết kiệm pin và mạng của bà con ngoài bến).
//
// Đọc `?q&category&province` SAU KHI MOUNT từ `location.search` (khuôn `Tabs
// paramKey`) chứ không `useSearchParams`: trang này là vỏ tĩnh, hook kia bắt
// phải bọc Suspense và làm cả màn nhấp nháy.
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { saveListState, takeListState } from "@/lib/market/list-state";
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

/** Ngăn riêng của màn này trong sổ bản chụp (11 §5b.2). */
const LIST_ID = "cho-tim";

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
  /** vị trí cuộn lấy từ bản chụp, chờ danh sách vẽ xong mới nhảy tới */
  const khoiPhuc = useRef<number | null>(null);
  /*  Vị trí cuộn phải NHỚ LIÊN TỤC, không đọc lúc rời màn: đo thật 2026-09-08 —
      khi bấm vào một món, Next đưa cuộn về 0 TRƯỚC khi cleanup chạy, nên bản chụp
      ghi 0 và quay lại vẫn nhảy lên đầu. Ghi qua rAF để cuộn không giật. */
  const cuonRef = useRef(0);
  useEffect(() => {
    let cho = false;
    const theo = () => {
      if (cho) return;
      cho = true;
      requestAnimationFrame(() => {
        cho = false;
        if (window.scrollY > 0) cuonRef.current = window.scrollY;
      });
    };
    window.addEventListener("scroll", theo, { passive: true });
    /*  Chốt thêm ở lúc CHẠM: cuộn có thể do phần tử con xử lý nên sự kiện scroll
        không chắc tới window; còn pointerdown thì luôn tới, và lúc bà con chạm vào
        một món thì trang vẫn đang ở đúng chỗ cần nhớ. */
    const cham = () => {
      if (window.scrollY > 0) cuonRef.current = window.scrollY;
    };
    window.addEventListener("pointerdown", cham, { capture: true, passive: true });
    return () => {
      window.removeEventListener("scroll", theo);
      window.removeEventListener("pointerdown", cham, { capture: true });
    };
  }, []);

  // ── đọc tham số URL sau mount ──────────────────────────────────────────
  /*  QUAY LẠI PHẢI THẤY ĐÚNG CHỖ CŨ (11 §5b.2, chủ dự án 2026-09-08).

      Trước đây mọi thứ nằm trong `useState`: mở một món rồi bấm Quay lại là mất
      chữ tìm, mất nhóm đã chọn, mất mấy lượt "Xem thêm" và mất chỗ đang cuộn.
      Trên tàu, gõ lại một chữ tìm là việc nặng, và tải lại từ trang 1 là tốn sóng.

      `takeListState` đọc XONG LÀ XOÁ: quay lại thì khôi phục, còn vào lại màn này
      từ dock hay từ Sen Biển là việc MỚI — nhả kết quả cũ cho một chữ tìm mới thì
      tệ hơn là không giữ gì. Bản chụp cũ quá 10 phút cũng bỏ, để giá không cũ. */
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const c = sp.get("category");
    const home = loadHome().province ?? "";
    setHomeProvince(home);

    const cu = takeListState<ProductCard>(LIST_ID);
    // Bản chụp chỉ dùng khi URL KHÔNG mang chữ tìm mới — link mới luôn thắng bản cũ
    if (cu && !sp.get("q") && !c) {
      setQ(cu.q);
      const f = cu.filters;
      if (typeof f.category === "string" && isProductCategory(f.category)) setCategory(f.category);
      setNearOn(f.nearOn === true && !!home);
      if (typeof f.sort === "string" && (SORTS as readonly string[]).includes(f.sort)) setSort(f.sort as Sort);
      setItems(cu.items);
      setTotal(cu.total);
      setPage(cu.page);
      setStatus("ok");
      khoiPhuc.current = cu.scrollY;
      setReady(true);
      return;
    }

    setQ(sp.get("q") ?? "");
    if (c && isProductCategory(c)) setCategory(c);
    if (sp.get("province") && home) setNearOn(true);
    setReady(true);
  }, []);

  /*  Cuộn về đúng chỗ SAU khi danh sách đã vẽ xong. Hai khung hình: một để
      React gắn thẻ món, một để trình duyệt tính xong chiều cao ảnh. */
  useEffect(() => {
    const y = khoiPhuc.current;
    if (y == null || items.length === 0) return;
    khoiPhuc.current = null;
    requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, y)));
  }, [items.length]);

  /*  Ghi bản chụp TRƯỚC KHI RỜI MÀN. Không ghi mỗi lần cuộn (tốn), chỉ ghi khi
      màn sắp bị che hoặc bị gỡ — đúng hai lúc bà con rời đi. */
  useEffect(() => {
    const ghi = () => {
      if (items.length === 0) return;
      saveListState<ProductCard>(LIST_ID, {
        q,
        filters: { category, nearOn, sort },
        items,
        total,
        page,
        scrollY: cuonRef.current,
      });
    };
    window.addEventListener("pagehide", ghi);
    return () => {
      window.removeEventListener("pagehide", ghi);
      ghi();
    };
  }, [q, category, nearOn, sort, items, total, page]);

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
            Không thấy món nào cho “{q.trim() || "cửa hàng"}”. Thử chữ ngắn hơn (vd: “lọc dầu”) hay chọn nhóm hàng
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
