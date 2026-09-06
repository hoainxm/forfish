"use client";

// MẢNH DÙNG CHUNG của 8 màn người mua — thanh trên (tìm + giỏ + đơn), lưới món,
// khung xương lúc tải, khối lỗi có nút Thử lại, dòng báo "đã thêm vào giỏ",
// lời mời đăng nhập tại điểm chạm. Chỉ những thứ ≥ 2 màn dùng mới nằm ở đây.
import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertIcon, CartIcon, DocIcon, SearchIcon } from "@/components/icons";
import { LoginGate } from "@/components/login-gate";
import { MarketProductCard } from "@/components/market/shared/product-card";
import type { ProductCard } from "@/lib/market/types";
import { rememberPeek } from "./product-peek";

/** Chấm số trên nút — giỏ / đơn chưa xong. Không hiện khi 0. */
function Dot({ n }: { n: number }) {
  if (n <= 0) return null;
  return (
    <span
      className="absolute -right-0.5 -top-0.5 min-w-[1.375rem] rounded-full px-1 text-center text-[0.75rem] font-bold leading-[1.375rem]"
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
  placeholder = "Tìm máy, ngư cụ, dầu nhớt…",
}: {
  q: string;
  onQ: (v: string) => void;
  onSubmit: () => void;
  cartCount: number;
  openOrders: number;
  placeholder?: string;
}) {
  return (
    <div className="sticky top-0 z-20 flex items-center gap-2 bg-background/95 px-4 py-2 backdrop-blur">
      <form
        className="flex min-w-0 flex-1 items-center gap-2 rounded-full bg-field px-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        role="search"
      >
        <SearchIcon className="h-5 w-5 shrink-0 text-foreground/50" />
        <input
          value={q}
          onChange={(e) => onQ(e.target.value)}
          placeholder={placeholder}
          aria-label="Tìm món trên chợ"
          enterKeyHint="search"
          className="min-h-[3.5rem] w-full border-0 bg-transparent text-[1.0625rem] focus:outline-none focus-visible:ring-2 focus-visible:ring-sea rounded-xl"
        />
        {q && (
          <button
            type="button"
            onClick={() => onQ("")}
            aria-label="Xoá chữ đang tìm"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-foreground/60"
          >
            ✕
          </button>
        )}
      </form>
      <Link
        href="/cho/gio"
        aria-label={`Giỏ hàng, ${cartCount} món`}
        className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-field text-navy"
      >
        <CartIcon className="h-6 w-6" />
        <Dot n={cartCount} />
      </Link>
      <Link
        href="/cho/don"
        aria-label={`Đơn hàng của tôi, ${openOrders} đơn đang chạy`}
        className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-field text-navy"
      >
        <DocIcon className="h-6 w-6" />
        <Dot n={openOrders} />
      </Link>
    </div>
  );
}

/** Lưới 2 cột thẻ món. Ghi lại "bản thẻ" để mở món lúc mất sóng còn thấy gì đó. */
export function ProductGrid({
  items,
  isFav,
  onFav,
  onAdd,
}: {
  items: ProductCard[];
  isFav?: (id: string) => boolean;
  onFav?: (p: ProductCard) => void;
  onAdd?: (p: ProductCard) => void;
}) {
  useEffect(() => {
    for (const p of items) rememberPeek(p);
  }, [items]);
  return (
    <div className="grid grid-cols-2 gap-3">
      {items.map((p) => (
        <MarketProductCard
          key={p.id}
          product={p}
          href={`/cho/sp/${p.id}`}
          fav={isFav?.(p.id)}
          {...(onFav ? { onFav: () => onFav(p) } : {})}
          {...(onAdd ? { onAdd: () => onAdd(p) } : {})}
        />
      ))}
    </div>
  );
}

/** Khung xương — KHÔNG BAO GIỜ vẽ null lúc đang tải (11 §5 quy ước). */
export function GridSkeleton({ n = 6 }: { n?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3" role="status" aria-label="Đang tải danh sách món">
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
  what = "chợ",
  onRetry,
}: {
  what?: string;
  onRetry: () => void;
}) {
  return (
    <div className="rounded-[1.25rem] bg-danger-bg px-4 py-8 text-center" role="alert">
      <div className="mx-auto mb-3 w-fit text-danger">
        <AlertIcon className="h-8 w-8" />
      </div>
      <p className="text-[1.125rem] font-bold text-danger">
        {what === "chợ" ? "Chợ đang trục trặc, chưa tải được." : `Chưa tải được ${what}.`} Thử lại giúp.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="display mx-auto mt-4 flex min-h-[3.5rem] w-full max-w-[15rem] items-center justify-center rounded-full bg-trim text-[1.125rem] font-bold text-white shadow-trim-cta"
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
      <span className="min-w-0 text-[1rem] font-bold leading-snug">{note}</span>
      {good && (
        <Link href="/cho/gio" className="shrink-0 text-[1rem] font-bold underline">
          Xem giỏ ({count})
        </Link>
      )}
    </div>
  );
}

/**
 * Lời mời đăng nhập TẠI ĐIỂM CHẠM (11 §5): một lời mời/màn, và **ẩn khi mất
 * sóng** (07 §12 tầng 5 — bấm cũng không vào được thì đừng mời).
 */
export function LoginInvite({
  feature,
  online,
  onClose,
}: {
  feature: string;
  online: boolean;
  onClose?: () => void;
}) {
  if (!online) return null;
  return (
    <div className="mb-3">
      <LoginGate feature={feature} blurb="Tài khoản do SDVICO cấp — gọi SDVICO để được mở." accent="t3">
        <span />
      </LoginGate>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="mx-auto mt-2 flex min-h-[3.5rem] items-center justify-center px-4 text-[1rem] font-bold text-foreground/65"
        >
          Để sau
        </button>
      )}
    </div>
  );
}
