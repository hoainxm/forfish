"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CartIcon, CheckIcon, PhoneIcon } from "@/components/icons";
import { SdvicoRequestButton } from "@/components/sdvico-request";
import { ProductInquiryButton } from "@/components/product-inquiry-button";
import { CartSheet, QtyStepper } from "@/components/cart-sheet";
import { ChipRow } from "@/components/ui/chip-row";
import { apiUrl } from "@/lib/api-base";
import { type CatalogGroup } from "@/lib/sdvico-catalog";
import {
  fetchProductListings,
  loadCachedCatalog,
  type ProductListing,
} from "@/lib/product-catalog";
import {
  CATALOG_GROUPS,
  GROUP_LABELS,
  GROUP_OTHER_LABEL,
} from "@/lib/catalog-groups";
import {
  addToCart,
  cartCount,
  CART_EVENT,
  loadCart,
  saveCart,
  type CartLine,
} from "@/lib/cart";
import { useAuthUser } from "@/lib/use-auth";
import { savedAgoLabel } from "@/lib/forecast-cache";
import { formatVnd } from "@/lib/format";
import {
  SDVICO_HOTLINE,
  SDVICO_HOTLINE_DISPLAY,
  SDVICO_SHOWCASE,
} from "@/data/sdvico-showcase";
import { timeoutSignal } from "@/lib/abort";

/*
  CỬA HÀNG (2026-08-11) — nâng cấp thành CHỢ ĐẶT HÀNG. Hai khu tách bạch:

  · HÀNG ĐẶT ĐƯỢC (orderable) — gom 3 nhóm điện tử / cơ điện / nhu yếu phẩm
    (nhóm null gom "Khác"). Mỗi thẻ có giá + đơn vị, bộ đếm số lượng, nút
    "Thêm vào giỏ". Nút giỏ nổi mở CartSheet để đặt (online-only).
  · HỎI MUA / TƯ VẤN (không orderable) — giữ NGUYÊN hành vi cũ: SDVICO →
    SdvicoRequestButton (hộp tư vấn CRM), đơn vị NGOÀI → gọi + ProductInquiry.

  DANH MỤC ADMIN QUẢN LÝ: đọc từ Supabase `product_listings` (admin ẩn/hiện/
  xóa/thêm trong /quan-tri, áp dụng NGAY). Chưa cấu hình / lỗi mạng → rơi về
  SDVICO_SHOWCASE tĩnh (demo mode, tất cả đều KHÔNG orderable).
*/

function fromStaticShowcase(): ProductListing[] {
  return SDVICO_SHOWCASE.map((p, i) => ({
    id: p.id,
    vendorKind: "sdvico" as const,
    title: p.title,
    category: p.category,
    description: p.desc,
    features: p.features,
    imageUrl: p.image,
    line: p.line,
    orderable: false,
    visible: true,
    sortOrder: i,
    createdAt: "",
  }));
}

/** Món có thể đặt hàng (đủ giá số > 0 + đơn vị). Khớp buildOrderLines/cart. */
function isOrderableListing(p: ProductListing): boolean {
  return (
    p.orderable &&
    p.priceVnd != null &&
    p.priceVnd > 0 &&
    Boolean(p.unit)
  );
}

export function SdvicoCatalog({
  ownedProductNames = [],
}: {
  /** Tên sản phẩm khách đã mua (từ đồng bộ) — để biết dòng nào đang dùng */
  ownedProductNames?: string[];
}) {
  const { phone, signedIn } = useAuthUser();
  const [groups, setGroups] = useState<CatalogGroup[] | null>(null);
  const [listings, setListings] = useState<ProductListing[]>(
    fromStaticShowcase(),
  );
  /** mốc lưu của BẢN TRONG MÁY đang hiện (null = đang xem bản vừa tải/tĩnh) */
  const [cachedAt, setCachedAt] = useState<number | null>(null);

  // ── Giỏ hàng (local, keyed theo SĐT) ─────────────────────────────────
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartOpen, setCartOpen] = useState(false);

  useEffect(() => {
    setCart(loadCart(phone));
  }, [phone]);

  // nghe CART_EVENT để số trên nút giỏ khớp mọi thay đổi (kể cả từ CartSheet)
  useEffect(() => {
    const sync = () => setCart(loadCart(phone));
    window.addEventListener(CART_EVENT, sync);
    return () => window.removeEventListener(CART_EVENT, sync);
  }, [phone]);

  const updateCart = useCallback(
    (next: CartLine[]) => {
      setCart(next);
      saveCart(phone, next); // saveCart tự bắn CART_EVENT
    },
    [phone],
  );

  /*  DANH MỤC: tải lúc mở màn VÀ TẢI LẠI KHI SÓNG VỀ (2026-08-17, ADR 0004 bất
      biến 6 — chủ dự án: "có mạng thì tự chạy tự đồng bộ lại chứ yêu cầu gì").

      LỖI ĐÃ SỬA: hàm này gọi ĐÚNG MỘT LẦN lúc mount (`[]`) và mất sóng thì
      `rows === null` ⇒ giữ `SDVICO_SHOWCASE` tĩnh — mọi món `orderable: false`
      ⇒ nút giỏ ẩn, không xem được giá. Vào màn đúng lúc mất sóng là **kẹt bản
      tĩnh suốt phiên**, kể cả khi sóng đã về từ lâu, mà màn này không có nút
      Thử lại nào. Nay sóng về là tự lấy danh mục thật.
      Danh mục KHÔNG cache xuống máy (đúng phạm vi offline: đây là chuyện ở bờ). */
  useEffect(() => {
    let alive = true;
    let dangTai = false;
    /*  BẢN TRONG MÁY HIỆN NGAY (2026-08-18, chủ dự án: "cửa hàng nó ít đổi món
        và đơn, nên cứ xem bình thường, online lại thì tự động tải mới"): danh
        mục đổi vài lần một tháng nên bản đã tải vẫn dùng được — hiện luôn, đừng
        bắt bà con nhìn danh mục tĩnh không giá, không nút giỏ. */
    const luu = loadCachedCatalog();
    if (luu) {
      setListings(luu.items);
      setCachedAt(luu.savedAt);
    }
    const tai = () => {
      if (dangTai) return; // chống chạy chồng lúc sóng nhấp nháy ven bờ
      dangTai = true;
      fetchProductListings()
        .then((rows) => {
          // rows === null (chưa cấu hình/lỗi mạng) → GIỮ bản đang hiện
          // (bản trong máy, hoặc SDVICO_SHOWCASE tĩnh nếu máy chưa từng tải)
          if (alive && rows !== null) {
            setListings(rows);
            setCachedAt(null); // vừa tải xong = bản mới, không phải bản lưu
          }
        })
        .finally(() => {
          dangTai = false;
        });
    };
    tai();
    window.addEventListener("online", tai);
    return () => {
      alive = false;
      window.removeEventListener("online", tai);
    };
  }, []);

  useEffect(() => {
    if (ownedProductNames.length === 0) return; // khách chưa có đồ → khỏi tải
    let alive = true;
    fetch(apiUrl("/api/sdvico/catalog"), { signal: timeoutSignal(20000) })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (alive && j?.ok && Array.isArray(j.groups)) setGroups(j.groups);
      })
      .catch(() => {
        // không nhận diện được dòng đang dùng — vẫn hiện showcase bình thường
      });
    return () => {
      alive = false;
    };
  }, [ownedProductNames.length]);

  // dòng nào có sản phẩm trùng tên đồ đã mua → "đang dùng"
  const ownedLines = useMemo(() => {
    if (!groups || ownedProductNames.length === 0) return new Set<string>();
    const ownedLower = new Set(ownedProductNames.map((n) => n.toLowerCase()));
    const set = new Set<string>();
    for (const g of groups) {
      if (g.products.some((p) => ownedLower.has(p.name.toLowerCase()))) {
        set.add(g.id);
      }
    }
    return set;
  }, [groups, ownedProductNames]);

  // dòng đang dùng xếp LÊN ĐẦU (mua thêm vật tư dễ hơn mua máy mới)
  const showcase = useMemo(() => {
    if (ownedLines.size === 0) return listings;
    return [...listings].sort(
      (a, b) =>
        (a.line && ownedLines.has(a.line) ? 0 : 1) -
        (b.line && ownedLines.has(b.line) ? 0 : 1),
    );
  }, [ownedLines, listings]);

  // Gom TẤT CẢ hàng (đặt được LẪN hỏi mua) theo nhóm điện tử → cơ điện → nhu
  // yếu phẩm → Khác. Trong mỗi nhóm: SDVICO lên TRƯỚC (hàng chính hãng ưu tiên),
  // rồi hàng đặt được trước hàng chỉ-hỏi-mua. Không còn khu "Hỏi mua" tách riêng.
  const grouped = useMemo(() => {
    const rank = (p: ProductListing) =>
      (p.vendorKind === "sdvico" ? 0 : 2) + (isOrderableListing(p) ? 0 : 1);
    const order = [...CATALOG_GROUPS, null] as const;
    return order
      .map((g) => ({
        id: g,
        label: g ? GROUP_LABELS[g] : GROUP_OTHER_LABEL,
        items: showcase
          .filter((p) => (p.group ?? null) === g)
          .sort((a, b) => rank(a) - rank(b)),
      }))
      .filter((grp) => grp.items.length > 0);
  }, [showcase]);
  const hasOrderable = useMemo(
    () => showcase.some(isOrderableListing),
    [showcase],
  );

  const qtyInCart = useCallback(
    (id: string) => cart.find((l) => l.listingId === id)?.qty ?? 0,
    [cart],
  );
  const count = cartCount(cart);

  // ── LỌC NHÓM: chọn thẳng "Nhu yếu phẩm" là thấy ngay, không kéo ────────
  // Chip: Tất cả · <mỗi nhóm có hàng>. Chọn một nhóm → chỉ hiện nhóm đó.
  const [activeGroup, setActiveGroup] = useState<string>("all");
  const filterOptions = useMemo(() => {
    const opts: { id: string; label: string }[] = [{ id: "all", label: "Tất cả" }];
    for (const grp of grouped) opts.push({ id: grp.id ?? "khac", label: grp.label });
    return opts;
  }, [grouped]);
  // chip đang chọn còn hợp lệ không (dữ liệu đổi thì lùi về "Tất cả")
  const active = filterOptions.some((o) => o.id === activeGroup)
    ? activeGroup
    : "all";
  const visibleGroups =
    active === "all"
      ? grouped
      : grouped.filter((g) => (g.id ?? "khac") === active);

  return (
    <div>
      <h3 className="display mb-1 px-1 text-[1.125rem] font-bold text-navy">
        Cửa hàng
      </h3>
      <p className="mb-3 px-1 text-[0.9375rem] text-foreground/70">
        Chọn hàng, thêm vào giỏ rồi đặt — nhà cung cấp giao tận nơi. Không thanh
        toán trong app.
      </p>

      {/* ĐANG XEM BẢN TRONG MÁY — nói thật mà KHÔNG cản việc xem (2026-08-18).
          Danh mục ít đổi nên bản lưu vẫn dùng được; chỉ cần bà con biết giá có
          thể đã đổi, và biết là máy sẽ tự lấy bản mới khi có sóng. */}
      {cachedAt != null && (
        <p className="mb-3 px-1 text-[0.9375rem] font-semibold text-[var(--warn)]">
          Đang xem danh mục đã lưu trong máy ({savedAgoLabel(cachedAt)}) — giá và
          món có thể đã đổi. Có sóng lại là máy tự tải bản mới.
        </p>
      )}

      {/* Lọc nhóm — cần điện tử bấm Điện tử, cần nhu yếu phẩm bấm Nhu yếu phẩm */}
      {filterOptions.length > 2 && (
        <ChipRow
          options={filterOptions}
          value={active}
          onChange={setActiveGroup}
          accent="t3"
          level={2}
          ariaLabel="Lọc nhóm hàng"
        />
      )}

      {showcase.length === 0 && (
        <p className="surface px-4 py-8 text-center text-[1rem] text-foreground/65">
          Chưa có sản phẩm nào — gọi hotline bên dưới để được tư vấn trực tiếp.
        </p>
      )}

      {/* ════ MỖI NHÓM: SDVICO trước; món đặt được → thẻ giỏ, còn lại → hỏi mua ══ */}
      {visibleGroups.map((grp) => (
        <section key={grp.id ?? "khac"} className="mb-5">
          <h4 className="display mb-2 px-1 text-[1.0625rem] font-bold text-t3">
            {grp.label}
          </h4>
          <ul className="space-y-3">
            {grp.items.map((p) =>
              isOrderableListing(p) ? (
                <OrderableCard
                  key={p.id}
                  p={p}
                  inCartQty={qtyInCart(p.id)}
                  onAdd={(qty) => updateCart(addToCart(cart, p.id, qty))}
                />
              ) : (
                <InquiryCard
                  key={p.id}
                  p={p}
                  owned={Boolean(p.line && ownedLines.has(p.line))}
                />
              ),
            )}
          </ul>
        </section>
      ))}

      {/* hotline = khối bấm được tử tế, không phải dòng chữ mờ cuối trang */}
      <a
        href={`tel:${SDVICO_HOTLINE}`}
        className="mt-4 flex min-h-[3.75rem] w-full items-center justify-center gap-2.5 rounded-full bg-navy text-[1.0625rem] font-bold text-white transition active:scale-[0.98]"
      >
        <PhoneIcon className="h-5 w-5" />
        Gọi SDVICO {SDVICO_HOTLINE_DISPLAY}
      </a>
      <p className="py-3 text-center text-[0.875rem] text-foreground/65">
        Giá và model hợp tàu — nhân viên tư vấn trực tiếp.
      </p>

      {/* ── Nút giỏ nổi + CartSheet (chỉ khi có hàng đặt được) ──────────── */}
      {hasOrderable && (
        <button
          type="button"
          onClick={() => setCartOpen(true)}
          aria-label={`Mở giỏ hàng${count > 0 ? ` (${count} món)` : ""}`}
          className="fixed right-4 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-20 flex h-16 w-16 items-center justify-center rounded-full bg-trim text-white shadow-trim-fab transition active:scale-[0.95]"
        >
          <CartIcon className="h-7 w-7" />
          {count > 0 && (
            <span className="absolute -right-1 -top-1 flex h-7 min-w-7 items-center justify-center rounded-full border-2 border-background bg-navy px-1.5 text-[0.8125rem] font-bold text-white">
              {count > 99 ? "99+" : count}
            </span>
          )}
        </button>
      )}

      {cartOpen && (
        <CartSheet
          phone={phone}
          signedIn={signedIn}
          items={cart}
          catalog={listings}
          onClose={() => setCartOpen(false)}
          onItemsChange={updateCart}
          onOrdered={() => updateCart([])}
        />
      )}
    </div>
  );
}

// ── Thẻ hàng đặt được ────────────────────────────────────────────────────

function OrderableCard({
  p,
  inCartQty,
  onAdd,
}: {
  p: ProductListing;
  inCartQty: number;
  onAdd: (qty: number) => void;
}) {
  const [qty, setQty] = useState(1);
  return (
    <li className="overflow-hidden surface">
      <div className="flex gap-3 p-3.5">
        {/* ảnh vuông nhỏ (bỏ qua nếu chưa có) */}
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-field">
          {p.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={p.imageUrl}
              alt={p.title}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[0.75rem] font-semibold text-foreground/40">
              {p.category || "Hàng"}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="display text-[1.125rem] font-bold leading-snug text-navy">
            {p.title}
          </p>
          {p.description && (
            <p className="mt-0.5 line-clamp-2 text-[0.875rem] leading-snug text-foreground/70">
              {p.description}
            </p>
          )}
          <p className="mt-1 text-[1.0625rem] font-bold text-t3">
            {formatVnd(p.priceVnd ?? 0)}
            <span className="text-[0.875rem] font-semibold text-foreground/60">
              {" "}
              / {p.unit}
            </span>
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-line px-3.5 py-3">
        <QtyStepper
          qty={qty}
          onChange={(q) => setQty(Math.max(1, q))}
          label={p.title}
        />
        <button
          type="button"
          onClick={() => onAdd(qty)}
          className="flex min-h-[3.5rem] flex-1 items-center justify-center gap-2 rounded-full bg-trim px-4 text-[1.0625rem] font-bold text-white shadow-trim-btn transition active:scale-[0.97]"
        >
          <CartIcon className="h-5 w-5" />
          {inCartQty > 0 ? `Đã thêm (${inCartQty})` : "Thêm vào giỏ"}
        </button>
      </div>
    </li>
  );
}

// ── Thẻ HỎI MUA (chưa niêm yết giá số) — cùng khuôn gọn với thẻ đặt được, nằm
//    TRONG khối nhóm. SDVICO → hộp tư vấn CRM; đơn vị ngoài → gọi + để lại yêu cầu.
function InquiryCard({ p, owned }: { p: ProductListing; owned: boolean }) {
  const external = p.vendorKind === "external";
  return (
    <li className="overflow-hidden surface">
      <div className="flex gap-3 p-3.5">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-field">
          {p.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={p.imageUrl}
              alt={p.title}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[0.75rem] font-semibold text-foreground/40">
              {p.category || "Hàng"}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          {external ? (
            <p className="text-[0.75rem] font-bold uppercase tracking-wide text-t3">
              Đơn vị: {p.vendorName}
            </p>
          ) : (
            owned && (
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.6875rem] font-bold" style={{ backgroundColor: "var(--ok-bg)", color: "var(--ok)" }}>
                <CheckIcon className="h-3 w-3" />
                Đang dùng
              </span>
            )
          )}
          <p className="display text-[1.125rem] font-bold leading-snug text-navy">
            {p.title}
          </p>
          {p.description && (
            <p className="mt-0.5 line-clamp-2 text-[0.875rem] leading-snug text-foreground/70">
              {p.description}
            </p>
          )}
          <p className="mt-1 text-[0.8125rem] font-semibold text-foreground/60">
            {p.priceText
              ? `Giá tham khảo: ${p.priceText}`
              : external
                ? "Liên hệ đơn vị để biết giá."
                : "Giá báo theo tàu — hỏi là nhân viên gọi lại."}
          </p>
        </div>
      </div>

      <div className="border-t border-line px-3.5 py-3">
        {external ? (
          <div className="flex flex-wrap items-center gap-2">
            {p.contactPhone && (
              <a
                href={`tel:${p.contactPhone}`}
                className="flex min-h-[3rem] shrink-0 items-center gap-1.5 rounded-full bg-t3 px-4 text-[0.9375rem] font-bold text-white transition active:scale-[0.97]"
              >
                <PhoneIcon className="h-4 w-4" />
                Gọi {p.contactPhone}
              </a>
            )}
            <ProductInquiryButton
              listingId={p.id}
              listingTitle={p.title}
              vendorKind="external"
            />
            {p.contactNote && (
              <p className="w-full text-[0.8125rem] text-foreground/65">
                {p.contactNote}
              </p>
            )}
          </div>
        ) : (
          <SdvicoRequestButton
            variant="chip"
            topic="mua"
            productName={p.title}
            label={owned ? "Mua thêm / vật tư thay" : "Hỏi mua / tư vấn"}
          />
        )}
      </div>
    </li>
  );
}
