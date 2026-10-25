"use client";

// `/cho/tim` — TÌM / DANH SÁCH (11 §5.2). 20 món một trang, "Xem thêm" bấm tay
// (không cuộn vô tận — tiết kiệm pin và mạng của bà con ngoài bến).
//
// Đọc `?q&category&province` SAU KHI MOUNT từ `location.search` (khuôn `Tabs
// paramKey`) chứ không `useSearchParams`: trang này là vỏ tĩnh, hook kia bắt
// phải bọc Suspense và làm cả màn nhấp nháy.
import Link from "next/link";
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
import { isOpenOrder, useCachedOrders, useFavorites, useKhoiPhucCuon, useMarketCart, useNhoCuon, useSeenLabel } from "./hooks";

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

/** Chip sắp xếp — CÙNG HÌNH `ChipRow` tầng 1 (navy, bậc chip 03 §0; VT-15). Giữ component riêng
 *  vì chip "Gần tôi · Tỉnh" là công tắc đứng chung hàng, không phải một giá trị của ChipRow. */
export function SortChip({ on, onClick, children, pressed = true }: { on: boolean; onClick: () => void; children: React.ReactNode; pressed?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed ? on : undefined}
      className={`inline-flex h-(--h-chip) min-w-[5.5rem] shrink-0 items-center justify-center rounded-full border px-3 text-[0.875rem] font-semibold transition active:scale-[0.97] ${
        on ? "border-navy bg-navy text-white" : "border-line bg-card text-foreground/75"
      }`}
    >
      {children}
    </button>
  );
}

/** Gõ xong 400 ms mới hỏi máy chủ (VT-07) — trước là một request mỗi phím. */
const GO_CHO_MS = 400;

/** Ngăn riêng của màn này trong sổ bản chụp (11 §5b.2). */
const LIST_ID = "cho-tim";

export function MarketSearch() {
  const router = useRouter();
  const cart = useMarketCart();
  const fav = useFavorites();
  const cache = useCachedOrders();

  const [q, setQ] = useState("");
  /** chữ tìm ĐÃ ÁP (sau 400 ms im hay bấm Tìm/Enter) — fetch theo cái này, không theo `q` */
  const [qApplied, setQApplied] = useState("");
  const [category, setCategory] = useState<CategoryChipValue>("tat_ca");
  const [nearOn, setNearOn] = useState(false);
  const [homeProvince, setHomeProvince] = useState<string>("");
  const [sort, setSort] = useState<Sort>("moi");

  const [items, setItems] = useState<ProductCard[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<"loading" | "ok" | "error" | "offline">("loading");
  const [moreError, setMoreError] = useState<"error" | "offline" | null>(null);
  /** đang tải lại trang 1 mà ĐÃ có kết quả ⇒ lưới mờ, không thay bằng skeleton (VT-07) */
  const [refreshing, setRefreshing] = useState(false);
  /** mất sóng / lỗi khi đổi chữ, chip mà đang có kết quả ⇒ giữ lưới + một chip báo (VT-08) */
  const [netNote, setNetNote] = useState<{ state: "offline" | "error"; text: string } | null>(null);
  const [ready, setReady] = useState(false);
  /** vị trí cuộn lấy từ bản chụp, chờ danh sách vẽ xong mới nhảy tới */
  const khoiPhuc = useRef<number | null>(null);
  /** vừa khôi phục từ bản chụp ⇒ bỏ lượt tải tự động đầu tiên (bản chụp ≤10 phút, giữ đủ trang đã tải) */
  const vuaKhoiPhuc = useRef(false);
  /** bộ lọc của lần tải THÀNH CÔNG gần nhất — mất sóng thì hoàn chip về đây (VT-08) */
  const daAp = useRef<{ category: CategoryChipValue; nearOn: boolean; sort: Sort } | null>(null);
  /** đang hoàn chip về bộ lọc cũ ⇒ bỏ lượt fetch do chính việc hoàn đó gây ra */
  const dangHoan = useRef(false);
  const itemsRef = useRef<ProductCard[]>([]);
  const cuonRef = useNhoCuon();

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
      setQApplied(cu.q);
      const f = cu.filters;
      if (typeof f.category === "string" && isProductCategory(f.category)) setCategory(f.category);
      setNearOn(f.nearOn === true && !!home);
      if (typeof f.sort === "string" && (SORTS as readonly string[]).includes(f.sort)) setSort(f.sort as Sort);
      setItems(cu.items);
      setTotal(cu.total);
      setPage(cu.page);
      setStatus("ok");
      khoiPhuc.current = cu.scrollY;
      vuaKhoiPhuc.current = true;
      setReady(true);
      return;
    }

    setQ(sp.get("q") ?? "");
    setQApplied(sp.get("q") ?? "");
    if (c && isProductCategory(c)) setCategory(c);
    if (sp.get("province") && home) setNearOn(true);
    setReady(true);
  }, []);

  useKhoiPhucCuon(khoiPhuc, items.length);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // gõ ⇒ chờ 400 ms im mới áp (VT-07); Tìm/Enter áp ngay ở `onSubmit`
  useEffect(() => {
    if (q === qApplied) return;
    const t = setTimeout(() => setQApplied(q), GO_CHO_MS);
    return () => clearTimeout(t);
  }, [q, qApplied]);

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
  }, [q, category, nearOn, sort, items, total, page, cuonRef]);

  const fetchPage = useCallback(
    async (p: number, replace: boolean) => {
      const sp = new URLSearchParams();
      if (qApplied.trim()) sp.set("q", qApplied.trim());
      if (category !== "tat_ca") sp.set("category", category);
      if (nearOn && homeProvince) sp.set("province", homeProvince);
      sp.set("sort", sort);
      sp.set("page", String(p));
      const res = await marketGet<ListRes>(`/api/cho/san-pham?${sp.toString()}`);
      setRefreshing(false);
      if (!res.ok) {
        const loai = res.offline ? "offline" : "error";
        if (!replace) {
          setMoreError(loai);
          return;
        }
        /*  VT-08: đang có kết quả mà mất sóng ⇒ GIỮ lưới đang xem, báo một chip, hoàn chip
            lọc về bộ của lần tải được gần nhất — bản cũ thay cả lưới bằng "tìm món cần mạng". */
        if (itemsRef.current.length > 0 && daAp.current) {
          setNetNote({
            state: loai,
            text: loai === "offline" ? "Không có sóng — đang xem kết quả đã tải" : "Chợ trục trặc — đang xem kết quả đã tải",
          });
          const cu = daAp.current;
          if (cu.category !== category || cu.nearOn !== nearOn || cu.sort !== sort) {
            dangHoan.current = true;
            setCategory(cu.category);
            setNearOn(cu.nearOn);
            setSort(cu.sort);
          }
          return;
        }
        setStatus(loai);
        return;
      }
      daAp.current = { category, nearOn, sort };
      setNetNote(null);
      setTotal(res.data.total);
      setItems((prev) => (replace ? res.data.items : [...prev, ...res.data.items]));
      setPage(p);
      setMoreError(null);
      setStatus("ok");
    },
    [qApplied, category, nearOn, homeProvince, sort],
  );

  // Đổi chữ tìm (đã áp) / nhóm / Gần tôi / sắp xếp ⇒ về trang 1.
  useEffect(() => {
    if (!ready) return;
    if (vuaKhoiPhuc.current) {
      // bản chụp vừa khôi phục chính là kết quả của bộ lọc này — không tải lại
      vuaKhoiPhuc.current = false;
      daAp.current = { category, nearOn, sort };
      return;
    }
    if (dangHoan.current) {
      dangHoan.current = false; // lượt này do hoàn chip gây ra, không hỏi máy chủ lần nữa
      return;
    }
    // đã có kết quả ⇒ lưới mờ thay vì skeleton (VT-07) — không xoá thứ đang xem để chờ
    if (itemsRef.current.length > 0) setRefreshing(true);
    else setStatus("loading");
    void fetchPage(1, true);
  }, [ready, fetchPage, category, nearOn, sort]);

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
        onSubmit={() => (q === qApplied ? void fetchPage(1, true) : setQApplied(q))}
        cartCount={cart.count}
        openOrders={openOrders}
      />

      <CategoryChips value={category} onChange={setCategory} />

      <div className="mb-2 flex items-center gap-1.5 overflow-x-auto cuon-an px-4" role="group" aria-label="Sắp xếp">
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

      {status === "ok" && moreError === "offline" && !netNote && (
        <NetChip state="offline" text="Không có sóng — đang xem kết quả đã tải" />
      )}
      {status === "ok" && netNote && <NetChip state={netNote.state} text={netNote.text} />}

      <div className={`px-4 transition-opacity ${refreshing ? "opacity-60" : ""}`} aria-busy={refreshing || undefined}>
        {status === "loading" && <GridSkeleton />}
        {status === "error" && <ErrorBlock onRetry={() => void fetchPage(1, true)} />}
        {status === "offline" && <EmptyNet what="tìm món" onRetry={() => void fetchPage(1, true)} />}

        {status === "ok" && items.length === 0 && (
          <EmptyState>
            Không thấy món nào cho “{q.trim() || "cửa hàng"}”. Thử chữ ngắn hơn (vd: “lọc dầu”) hay chọn nhóm hàng
            {nearOn ? ", hoặc tắt Gần tôi" : ""}.
          </EmptyState>
        )}
        {/* không có trên chợ ⇒ nhờ chủ sàn tìm (2026-10-18) — đi kèm cả khi có kết quả nhưng chưa đúng ý */}
        {status === "ok" && q.trim() && (
          <Link
            href={`/cho/yeu-cau/moi?ten=${encodeURIComponent(q.trim())}`}
            className="surface mt-3 flex min-h-(--row-h) items-center justify-center px-4 py-3 text-center text-[1rem] font-semibold text-navy"
          >
            Không thấy đúng món? Nhờ chủ sàn tìm “{q.trim()}”
          </Link>
        )}

        {status === "ok" && items.length > 0 && (
          <>
            <ProductGrid items={items} isFav={fav.has} onFav={onFav} />
            {seen && <p className="mt-3 text-center text-[1rem] text-foreground/65">{seen}</p>}
            {moreError === "error" && (
              <p role="alert" className="mt-2 text-center text-[1rem] font-semibold text-danger">
                Chưa tải thêm được — thử lại giúp.
              </p>
            )}
            {items.length < total && (
              <button
                type="button"
                onClick={() => void fetchPage(page + 1, false)}
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
