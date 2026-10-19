"use client";

// MẢNH DÙNG CHUNG của 8 màn người mua — thanh trên (tìm + giỏ + đơn), lưới món,
// khung xương lúc tải, khối lỗi có nút Thử lại, dòng báo "đã thêm vào giỏ",
// lời mời đăng nhập tại điểm chạm. Chỉ những thứ ≥ 2 màn dùng mới nằm ở đây.
import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertIcon, CartIcon, CloseIcon, DocIcon, SearchIcon } from "@/components/icons";
import { LoginGate } from "@/components/login-gate";
import { MarketProductCard } from "@/components/market/shared/product-card";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import type { ProductCard } from "@/lib/market/types";
import { rememberPeek } from "./product-peek";

/** Chấm số trên nút — giỏ / đơn chưa xong. Không hiện khi 0. */
function Dot({ n }: { n: number }) {
  if (n <= 0) return null;
  return (
    <span
      className="absolute -right-0.5 -top-0.5 min-w-[1.375rem] rounded-full px-1 text-center text-[0.75rem] font-semibold leading-[1.375rem]"
      style={{ backgroundColor: "var(--trim)", color: "var(--card)" }}
    >
      {n > 99 ? "99+" : n}
    </span>
  );
}

/**
 * Thanh trên DÍNH của khu chợ: ô tìm (1 chạm vào bàn phím) + nút Giỏ có chấm số
 * + nút Đơn hàng. Giỏ và Đơn bấm được cả khi mất sóng (đọc từ máy) — chỉ tìm
 * mới cần mạng.
 */
export function MarketTopBar({
  q,
  onQ,
  onSubmit,
  cartCount,
  openOrders,
  embedded = false,
  placeholder = "Bác cần mua gì?",
}: {
  q: string;
  onQ: (v: string) => void;
  onSubmit: () => void;
  cartCount: number;
  openOrders: number;
  embedded?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="market-search-bar sticky top-0 z-20 bg-background px-4 pb-3 pt-2">
      <form
        className="flex min-w-0 items-center gap-2 rounded-2xl bg-card pl-4 pr-1 shadow-sm"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        role="search"
      >
        <SearchIcon className="h-6 w-6 shrink-0 text-navy" />
        <input
          value={q}
          onChange={(e) => onQ(e.target.value)}
          placeholder={placeholder}
          aria-label="Tìm món trong cửa hàng"
          enterKeyHint="search"
          className="min-h-(--row-h) min-w-0 flex-1 border-0 bg-transparent text-[1rem] focus:outline-none focus-visible:ring-2 focus-visible:ring-sea rounded-xl"
        />
        {q && (
          <button
            type="button"
            onClick={() => onQ("")}
            aria-label="Xoá chữ đang tìm"
            className="-mr-2 flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-foreground/60 active:bg-card"
          >
            <CloseIcon className="h-6 w-6" />
          </button>
        )}
        <button type="submit" className="flex min-h-(--row-h) shrink-0 items-center justify-center rounded-xl bg-navy px-4 text-[1rem] font-semibold text-white">Tìm</button>
      </form>
      <nav aria-label="Mua hàng" className={`mt-2 grid gap-2 ${embedded ? "grid-cols-1" : "grid-cols-2"}`}>
      <Link
        href="/cho/gio"
        aria-label={`Giỏ hàng, ${cartCount} món`}
        className="relative flex min-h-(--row-h) items-center justify-center gap-2 rounded-2xl bg-field px-3 text-[1rem] font-semibold text-navy"
      >
        <CartIcon className="h-6 w-6" />
        <span>Giỏ hàng</span>
        <Dot n={cartCount} />
      </Link>
      {!embedded && <Link
        href="/cho/don"
        aria-label={`Đơn hàng của tôi, ${openOrders} đơn đang chạy`}
        className="relative flex min-h-(--row-h) items-center justify-center gap-2 rounded-2xl bg-field px-3 text-[1rem] font-semibold text-navy"
      >
        <DocIcon className="h-6 w-6" />
        <span>Đơn hàng</span>
        <Dot n={openOrders} />
      </Link>}
      </nav>
    </div>
  );
}

/**
 * Lưới 2 cột, mỗi hàng cao theo nội dung; màn hẹp dùng một cột qua CSS.
 * Ghi lại "bản thẻ" để mở món lúc
 * mất sóng còn thấy gì đó.
 */
export function ProductGrid({
  items,
  isFav,
  onFav,
}: {
  items: ProductCard[];
  isFav?: (id: string) => boolean;
  onFav?: (p: ProductCard) => void;
}) {
  useEffect(() => {
    for (const p of items) rememberPeek(p);
  }, [items]);
  return (
    <div className="market-product-grid grid grid-cols-2 gap-3">
      {items.map((p) => (
        <MarketProductCard
          key={p.id}
          product={p}
          href={`/cho/sp/${p.id}`}
          fav={isFav?.(p.id)}
          {...(onFav ? { onFav: () => onFav(p) } : {})}
        />
      ))}
    </div>
  );
}

/** Khung xương — KHÔNG BAO GIỜ vẽ null lúc đang tải (11 §5 quy ước). */
export function GridSkeleton({ n = 6 }: { n?: number }) {
  return (
    <div className="market-product-grid grid grid-cols-2 gap-3" role="status" aria-label="Đang tải danh sách món">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="surface overflow-hidden">
          <div className="aspect-square w-full animate-pulse bg-field" />
          <div className="space-y-2 p-3">
            <div className="h-4 w-full animate-pulse rounded bg-field" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-field" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Lỗi máy chủ / hết giờ chờ (có sóng mà không tải được) — nói thật + Thử lại. */
export function ErrorBlock({
  what = "cửa hàng",
  onRetry,
}: {
  what?: string;
  onRetry: () => void;
}) {
  return (
    <div className="rounded-2xl bg-danger-bg px-4 py-8 text-center" role="alert">
      <div className="mx-auto mb-3 w-fit text-danger">
        <AlertIcon className="h-8 w-8" />
      </div>
      <p className="text-[1rem] font-semibold text-danger">
        {what === "cửa hàng" ? "Cửa hàng đang trục trặc, chưa tải được." : `Chưa tải được ${what}.`} Thử lại giúp.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="display mx-auto mt-4 flex min-h-(--row-h) w-full max-w-[15rem] items-center justify-center rounded-full bg-trim text-[1rem] font-semibold text-white "
      >
        Thử lại
      </button>
    </div>
  );
}

/**
 * Dòng "đã thêm vào giỏ" — 3 s rồi tự tắt, kèm đường sang giỏ. Không toast
 * (07 §12): xác nhận nằm ngay chỗ vừa bấm.
 */
export function CartFeedback({ note, count }: { note: string | null; count: number }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!note) return;
    setShown(true);
    const t = setTimeout(() => setShown(false), 3000);
    return () => clearTimeout(t);
  }, [note]);
  if (!note || !shown) return null;
  const good = note.startsWith("Đã thêm");
  return (
    <div
      role="status"
      className="mb-3 flex items-center justify-between gap-3 rounded-2xl px-3.5 py-2.5"
      style={{
        backgroundColor: good ? "var(--ok-bg)" : "var(--danger-bg)",
        color: good ? "var(--ok)" : "var(--danger)",
      }}
    >
      <span className="min-w-0 text-[1rem] font-semibold leading-snug">{note}</span>
      {good && (
        <Link href="/cho/gio" className="shrink-0 text-[1rem] font-semibold underline">
          Xem giỏ ({count})
        </Link>
      )}
    </div>
  );
}

/**
 * Lời mời đăng nhập TẠI ĐIỂM CHẠM (11 §5): một lời mời/màn, và **ẩn khi mất
 * sóng** (07 §12 tầng 5 — bấm cũng không vào được thì đừng mời).
 *
 * Là BOTTOM SHEET (F-01, 2026-09-06): bản cũ vẽ thẻ inline DƯỚI danh sách /
 * dưới thanh dính ⇒ bấm Đặt hàng xong màn không đổi gì, bà con tưởng nút hỏng.
 * Sheet đè lên ngay chỗ đang nhìn, không phải cuộn đi tìm. `verb` = việc bị
 * khoá ("đặt hàng", "lưu món") — câu thành "Đăng nhập để đặt hàng" (F-20).
 */
export function LoginInvite({
  verb,
  online,
  onClose,
}: {
  verb: string;
  online: boolean;
  onClose: () => void;
}) {
  if (!online) return null;
  return (
    <BottomSheet title="Cần tài khoản" onClose={onClose}>
      <LoginGate feature="" verb={verb} blurb="Tài khoản do SDVICO cấp — gọi SDVICO để được mở." accent="t3">
        <span />
      </LoginGate>
      <button
        type="button"
        onClick={onClose}
        className="mx-auto mt-2 flex min-h-(--row-h) items-center justify-center px-4 text-[1rem] font-semibold text-foreground/65"
      >
        Để sau
      </button>
    </BottomSheet>
  );
}
