"use client";

// `/cho` — TRANG CHỦ CHỢ (11 §5.1). Vào là tìm/chọn được ngay, và nhìn thấy đơn
// đang chạy. Thứ tự khối cố ý: việc đang dở (đơn đang tới, mua lại) → món gần
// bà con → món mới → yêu thích.
//
// MẤT SÓNG: Giỏ, Đơn hàng, Mua lại, Yêu thích VẪN dùng được (đọc từ máy) — chỉ
// hai lưới món cần mạng, và lúc đó nói thật + nút Thử lại + đường sang đơn.
import Link from "next/link";
import { KhuyenMaiCard } from "@/components/khuyen-mai-card";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { CartIcon, ChevronRightIcon, StarIcon } from "@/components/icons";
import { CategoryChips, type CategoryChipValue } from "@/components/market/shared/category-chips";
import { EmptyNet } from "@/components/market/shared/empty-net";
import { NetChip } from "@/components/market/shared/net-chip";
import { OrderStatusChip } from "@/components/market/shared/order-status-chip";
import { PriceText } from "@/components/market/shared/price-text";
import { EmptyState, SectionHeader } from "@/components/ui/primitives";
import { KeoLamMoiChi, useKeoLamMoi } from "@/components/ui/use-keo-lam-moi";
import { marketGet } from "@/lib/market/client";
import { saveListState, takeListState } from "@/lib/market/list-state";
import type { ProductCard } from "@/lib/market/types";
import { useOnlineRefetch } from "@/lib/market/use-online";
import { loadHome } from "@/lib/region";
import { CartFeedback, ErrorBlock, GridSkeleton, MarketTopBar, ProductGrid } from "./ui";
import { isOpenOrder, useCachedOrders, useFavorites, useKhoiPhucCuon, useMarketCart, useNhoCuon } from "./hooks";

type ListRes = { items: ProductCard[]; total: number };
type Status = "loading" | "ok" | "error" | "offline";

/** Ngăn của màn này trong sổ bản chụp (11 §5b.2) — VT-03: ‹ từ trang món về đúng chỗ, không tải lại. */
const LIST_ID = "cho-home";

export function MarketHome({ embedded = false }: { embedded?: boolean }) {
  const router = useRouter();
  const cart = useMarketCart();
  const fav = useFavorites();
  const cache = useCachedOrders();

  const [q, setQ] = useState("");
  const [province, setProvince] = useState<string | null>(null);
  const [near, setNear] = useState<ProductCard[]>([]);
  const [fresh, setFresh] = useState<ProductCard[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [note, setNote] = useState<string | null>(null);
  /** chip báo khi KÉO LÀM MỚI mà mất sóng/lỗi — giữ hai lưới đang xem (VT-18) */
  const [netNote, setNetNote] = useState<{ state: "offline" | "error"; text: string } | null>(null);
  const khoiPhuc = useRef<number | null>(null);
  /** vừa khôi phục bản chụp ⇒ bỏ lượt tải đầu (bản chụp ≤10 phút) */
  const vuaKhoiPhuc = useRef(false);
  /** đã đọc xong bản chụp (hay biết là không có) — chặn lượt tải khi chưa đọc; Strict Mode dev
      chạy effect mount hai lần, không gác thì cờ `vuaKhoiPhuc` bị tiêu ở lượt đầu rồi lượt hai tải lại */
  const [ready, setReady] = useState(false);
  const cuonRef = useNhoCuon();
  useKhoiPhucCuon(khoiPhuc, fresh.length);

  useEffect(() => {
    setProvince(loadHome().province ?? null);
    /*  QUAY LẠI ĐÚNG CHỖ (VT-03): cuộn 900px, chạm một món, bấm ‹ ⇒ bản cũ về y≈239 và hai lưới
        tải lại từ đầu; `/cho/tim` kề bên thì về đúng chỗ. Cùng một khuôn `list-state`. */
    const cu = takeListState<ProductCard>(LIST_ID);
    if (cu) {
      const near = cu.extra?.near;
      setFresh(cu.items);
      setNear(Array.isArray(near) ? (near as ProductCard[]) : []);
      setStatus("ok");
      khoiPhuc.current = cu.scrollY;
      vuaKhoiPhuc.current = true;
    }
    setReady(true);
  }, []);

  // Ghi bản chụp trước khi rời màn (pagehide + unmount) — chỉ khi hai lưới đã tải được
  useEffect(() => {
    const ghi = () => {
      if (status !== "ok" || fresh.length === 0) return;
      saveListState<ProductCard>(LIST_ID, {
        q: "",
        filters: {},
        items: fresh,
        total: fresh.length,
        page: 1,
        scrollY: cuonRef.current,
        extra: { near },
      });
    };
    window.addEventListener("pagehide", ghi);
    return () => {
      window.removeEventListener("pagehide", ghi);
      ghi();
    };
  }, [status, fresh, near, cuonRef]);

  /** `im` = làm mới lặng (kéo xuống): không skeleton lại cả màn, hỏng thì giữ lưới + một chip */
  const load = useCallback(async (im = false) => {
    if (!im) setStatus("loading");
    const home = loadHome().province ?? "";
    const [freshRes, nearRes] = await Promise.all([
      marketGet<ListRes>("/api/cho/san-pham?sort=moi&pageSize=20"),
      home
        ? marketGet<ListRes>(`/api/cho/san-pham?sort=moi&pageSize=10&province=${encodeURIComponent(home)}`)
        : Promise.resolve(null),
    ]);
    if (!freshRes.ok) {
      if (im) {
        setNetNote({ state: freshRes.offline ? "offline" : "error", text: freshRes.offline ? "Không có sóng — đang xem món đã tải" : "Chợ trục trặc — đang xem món đã tải" });
        return;
      }
      setStatus(freshRes.offline ? "offline" : "error");
      return;
    }
    setNetNote(null);
    setFresh(freshRes.data.items);
    setNear(nearRes && nearRes.ok ? nearRes.data.items : []);
    setStatus("ok");
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (vuaKhoiPhuc.current) {
      vuaKhoiPhuc.current = false; // bản chụp là đủ cho lượt quay lại này
      return;
    }
    void load();
  }, [ready, load]);
  useOnlineRefetch(() => void load());
  // kéo xuống ở đầu trang ⇒ làm mới lặng (VT-18, như FB/Shopee); đang tải lần đầu thì không bắt
  const lamMoi = useKeoLamMoi(() => load(true), { disabled: status === "loading" });

  const onFav = (p: ProductCard) => {
    if (!cart.signedIn) {
      setNote(null);
      router.push(`/cho/sp/${p.id}`); // ♡ cần tài khoản — LoginGate nằm ở trang món
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

  const openOrders = (cache?.orders ?? []).filter(isOpenOrder);
  const coming = openOrders.find((o) => o.status === "da_giao") ?? openOrders.find((o) => o.status === "dang_giao");
  const rebuy = (cache?.orders ?? [])
    .filter((o) => o.status === "hoan_thanh")
    .flatMap((o) => o.items)
    .slice(0, 6);

  return (
    <div className="pb-[7rem]">
      <MarketTopBar
        embedded={embedded}
        q={q}
        onQ={setQ}
        onSubmit={() => router.push(`/cho/tim?q=${encodeURIComponent(q.trim())}`)}
        cartCount={cart.count}
        openOrders={openOrders.length}
      />

      <div className="-mx-0 pt-1">
        <CategoryChips
          value={"tat_ca" as CategoryChipValue}
          onChange={(c) => router.push(c === "tat_ca" ? "/cho/tim" : `/cho/tim?category=${c}`)}
        />
      </div>

      <div className="px-4">
        {netNote && <NetChip state={netNote.state} text={netNote.text} />}
        <KeoLamMoiChi {...lamMoi.chi} />
        <CartFeedback note={note} count={cart.count} />
        {/* Ưu đãi SDVICO (2026-10-26) — đầu Vật tư, cùng thẻ với Trang chủ. */}
        <KhuyenMaiCard className="mb-4" />

        {cart.saveFailed && (
          <p
            role="alert"
            className="mb-3 rounded-2xl px-3.5 py-2.5 text-[1rem] font-semibold"
            style={{ backgroundColor: "var(--danger-bg)", color: "var(--danger)" }}
          >
            Máy hết chỗ — CHƯA lưu được giỏ. Xoá bớt ảnh/ứng dụng rồi chọn lại giúp.
          </p>
        )}

        {/* ── Đơn đang tới (từ bản lưu — không gọi mạng) ───────────────── */}
        {coming && (
          <Link href={`/cho/don/${coming.id}`} className="surface mb-4 flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-[1rem] font-semibold text-navy">Đơn đang tới · {coming.code}</p>
              <p className="mt-0.5 truncate text-[0.875rem] text-foreground/65">
                {coming.shopName ?? "Shop"} ·{" "}
                {coming.status === "da_giao" ? "Đã giao — bấm Đã nhận hàng" : "Shop đang giao"}
              </p>
            </div>
            <OrderStatusChip status={coming.status} />
            <ChevronRightIcon className="h-5 w-5 shrink-0 text-foreground/40" />
          </Link>
        )}

        {/* ── Mua lại (từ đơn đã hoàn thành trong máy) ─────────────────── */}
        {rebuy.length > 0 && (
          <section className="mb-5">
            <SectionHeader>Mua lại</SectionHeader>
            <ul className="-mx-4 flex gap-3 overflow-x-auto cuon-an px-4 pb-1">
              {rebuy.map((l) => (
                <li key={`${l.productId}-${l.variantLabel ?? ""}`} className="surface w-[10.5rem] shrink-0 p-2">
                  <Link href={`/cho/sp/${l.productId}`} className="block">
                    <p className="line-clamp-2 min-h-[2.75rem] text-[0.875rem] font-semibold leading-snug text-navy">
                      {l.title}
                    </p>
                    <PriceText priceVnd={l.priceVnd} className="mt-1" />
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      const r = cart.add(l.productId, l.variantLabel, l.qty);
                      setNote(
                        r === "ok"
                          ? `Đã thêm ${l.title} vào giỏ`
                          : r === "gio_day"
                            ? "Giỏ đầy rồi — bỏ bớt món cũ rồi thêm lại."
                            : "Máy hết chỗ — CHƯA lưu được giỏ.",
                      );
                    }}
                    /*  Nút thường bấm ⇒ KHÔNG SQ_BTN (F-07: chế độ gọn hạ nó
                        xuống 37px/11px). */
                    className="mt-2 flex h-(--h-ctl) w-full items-center justify-center gap-1.5 rounded-full bg-field text-[0.9375rem] font-semibold text-navy"
                    aria-label={`Mua lại ${l.title}`}
                  >
                    <CartIcon className="h-5 w-5" />
                    Mua lại
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ── Hai lưới món (cần mạng) ──────────────────────────────────── */}
        {status === "loading" && <GridSkeleton />}
        {status === "error" && <ErrorBlock onRetry={() => void load()} />}
        {status === "offline" && (
          <EmptyNet
            what="cửa hàng"
            onRetry={() => void load()}
            extra={
              <Link href="/cho/don" className="sq-btn bg-field text-navy">
                Đơn hàng
              </Link>
            }
          />
        )}

        {status === "ok" && (
          <>
            {near.length > 0 && (
              <section className="mb-5">
                <SectionHeader>Gần bà con — {province}</SectionHeader>
                <ProductGrid items={near} isFav={fav.has} onFav={onFav} />
              </section>
            )}

            <section className="mb-5">
              <SectionHeader>Món mới về</SectionHeader>
              {fresh.length === 0 ? (
                <EmptyState>Cửa hàng chưa có món nào. SDVICO đang mời các đại lý lên sàn.</EmptyState>
              ) : (
                <ProductGrid items={fresh} isFav={fav.has} onFav={onFav} />
              )}
            </section>

            {/* ĐẶT BẤT KỲ MÓN GÌ — chợ chưa bán thì chủ sàn tìm, báo giá (2026-10-18).
                Rà design Codex lần 2 (2026-10-19): dời XUỐNG SAU lưới món (trước nó
                chặn ngay đầu màn, nút "Đặt" cam tranh với hàng hoá) và thành một
                hàng nhẹ "Nhờ tìm" — lối phụ, không phải hành động chính của màn. */}
            <Link href="/cho/yeu-cau/moi" className="surface mb-5 flex min-h-(--h-row) items-center gap-3 px-4 py-3">
              <span className="min-w-0 flex-1">
                <span className="block text-[1rem] font-semibold text-navy">Cần món chợ chưa có?</span>
                <span className="block text-[0.8125rem] text-foreground/65">Chủ sàn tìm hàng, báo giá, hẹn ngày giao</span>
              </span>
              <span className="shrink-0 text-[0.9375rem] font-semibold text-sea">Nhờ tìm</span>
              <ChevronRightIcon className="h-4 w-4 shrink-0 text-foreground/40" />
            </Link>
          </>
        )}

        {/* ── Yêu thích (bản lưu trong máy — không cần mạng) ───────────── */}
        {fav.items.length > 0 && (
          <section className="mb-2">
            <SectionHeader>
              <span className="inline-flex items-center gap-1.5">
                <span style={{ color: "var(--sun)" }} aria-hidden>
                  <StarIcon className="h-5 w-5 fill-current" />
                </span>
                Món đã lưu
              </span>
            </SectionHeader>
            <ul className="flex flex-col gap-2">
              {fav.items.map((f) => (
                <li key={f.productId}>
                  <Link href={`/cho/sp/${f.productId}`} className="surface flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-[1rem] font-semibold leading-snug text-navy">{f.snapshot.title}</p>
                      <p className="mt-0.5 text-[0.875rem] text-foreground/65">{f.snapshot.shopName}</p>
                    </div>
                    <PriceText priceVnd={f.snapshot.priceVnd} />
                    <ChevronRightIcon className="h-5 w-5 shrink-0 text-foreground/40" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
