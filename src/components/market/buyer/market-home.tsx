"use client";

// `/cho` — TRANG CHỦ CHỢ (11 §5.1). Vào là tìm/chọn được ngay, và nhìn thấy đơn
// đang chạy. Thứ tự khối cố ý: việc đang dở (đơn đang tới, mua lại) → món gần
// bà con → món mới → yêu thích.
//
// MẤT SÓNG: Giỏ, Đơn hàng, Mua lại, Yêu thích VẪN dùng được (đọc từ máy) — chỉ
// hai lưới món cần mạng, và lúc đó nói thật + nút Thử lại + đường sang đơn.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { CartIcon, ChevronRightIcon, StarIcon } from "@/components/icons";
import { CategoryChips, type CategoryChipValue } from "@/components/market/shared/category-chips";
import { EmptyNet } from "@/components/market/shared/empty-net";
import { OrderStatusChip } from "@/components/market/shared/order-status-chip";
import { PriceText } from "@/components/market/shared/price-text";
import { EmptyState, SectionHeader } from "@/components/ui/primitives";
import { marketGet } from "@/lib/market/client";
import type { ProductCard } from "@/lib/market/types";
import { useOnlineRefetch } from "@/lib/market/use-online";
import { loadHome } from "@/lib/region";
import { CartFeedback, ErrorBlock, GridSkeleton, MarketTopBar, ProductGrid } from "./ui";
import { isOpenOrder, useCachedOrders, useFavorites, useMarketCart } from "./hooks";

type ListRes = { items: ProductCard[]; total: number };
type Status = "loading" | "ok" | "error" | "offline";

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

  useEffect(() => setProvince(loadHome().province ?? null), []);

  const load = useCallback(async () => {
    setStatus("loading");
    const home = loadHome().province ?? "";
    const [freshRes, nearRes] = await Promise.all([
      marketGet<ListRes>("/api/cho/san-pham?sort=moi&pageSize=20"),
      home
        ? marketGet<ListRes>(`/api/cho/san-pham?sort=moi&pageSize=10&province=${encodeURIComponent(home)}`)
        : Promise.resolve(null),
    ]);
    if (!freshRes.ok) {
      setStatus(freshRes.offline ? "offline" : "error");
      return;
    }
    setFresh(freshRes.data.items);
    setNear(nearRes && nearRes.ok ? nearRes.data.items : []);
    setStatus("ok");
  }, []);

  useEffect(() => {
    void load();
  }, [load]);
  useOnlineRefetch(() => void load());

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
        <CartFeedback note={note} count={cart.count} />

        {cart.saveFailed && (
          <p
            role="alert"
            className="mb-3 rounded-2xl px-3.5 py-2.5 text-[1rem] font-bold"
            style={{ backgroundColor: "var(--danger-bg)", color: "var(--danger)" }}
          >
            Máy hết chỗ — CHƯA lưu được giỏ. Xoá bớt ảnh/ứng dụng rồi chọn lại giúp.
          </p>
        )}

        {/* ── Đơn đang tới (từ bản lưu — không gọi mạng) ───────────────── */}
        {coming && (
          <Link href={`/cho/don/${coming.id}`} className="surface mb-4 flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-[1rem] font-bold text-navy">Đơn đang tới · {coming.code}</p>
              <p className="mt-0.5 truncate text-[0.9375rem] text-foreground/65">
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
            <SectionHeader className="px-0">Mua lại</SectionHeader>
            <ul className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
              {rebuy.map((l) => (
                <li key={`${l.productId}-${l.variantLabel ?? ""}`} className="surface w-[10.5rem] shrink-0 p-2">
                  <Link href={`/cho/sp/${l.productId}`} className="block">
                    <p className="line-clamp-2 min-h-[2.75rem] text-[0.9375rem] font-bold leading-snug text-navy">
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
                    className="mt-2 flex min-h-[3.5rem] w-full items-center justify-center gap-1.5 rounded-full text-[1rem] font-bold"
                    style={{ backgroundColor: "var(--t3-bg)", color: "var(--t3)" }}
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
              <Link
                href="/cho/don"
                className="inline-flex min-h-[3.5rem] items-center justify-center rounded-full bg-field px-5 text-[1rem] font-bold text-navy"
              >
                Xem đơn của tôi
              </Link>
            }
          />
        )}

        {status === "ok" && (
          <>
            {/* ĐẶT BẤT KỲ MÓN GÌ — chợ chưa bán thì chủ sàn tìm, báo giá (2026-10-18) */}
            <Link href="/cho/yeu-cau/moi" className="surface mb-5 flex min-h-[3.5rem] items-center gap-3 px-4 py-3">
              <span className="min-w-0 flex-1">
                <span className="block text-[1.0625rem] font-bold text-navy">Cần món chợ chưa có?</span>
                <span className="block text-[0.9375rem] text-foreground/75">Ghi món cần — chủ sàn tìm hàng, báo giá, hẹn ngày giao</span>
              </span>
              <span className="shrink-0 rounded-full bg-trim px-4 py-2 text-[1rem] font-bold text-white">Đặt</span>
            </Link>
            {near.length > 0 && (
              <section className="mb-5">
                <SectionHeader className="px-0">Gần bà con — {province}</SectionHeader>
                <ProductGrid items={near} isFav={fav.has} onFav={onFav} />
              </section>
            )}

            <section className="mb-5">
              <SectionHeader className="px-0">Món mới về</SectionHeader>
              {fresh.length === 0 ? (
                <EmptyState>Cửa hàng chưa có món nào. SDVICO đang mời các đại lý lên sàn.</EmptyState>
              ) : (
                <ProductGrid items={fresh} isFav={fav.has} onFav={onFav} />
              )}
            </section>
          </>
        )}

        {/* ── Yêu thích (bản lưu trong máy — không cần mạng) ───────────── */}
        {fav.items.length > 0 && (
          <section className="mb-2">
            <SectionHeader className="px-0">
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
                      <p className="line-clamp-2 text-[1rem] font-bold leading-snug text-navy">{f.snapshot.title}</p>
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
