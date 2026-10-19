"use client";

// ĐẦU MÀN CHỢ — GỌN (≤ 6rem, F-08/F-09 vòng fix UX 2026-09-06): một hàng
// `[‹ Quay lại 3.5rem] [tiêu đề]` trên nền gradient trục 3, thay cho `PageHeader`
// hero 330px (hero + mô tả ăn 40% màn đầu, ô tìm và hàng thẻ đầu chỉ lộ 1/3).
// Mọi màn con chợ có nút Quay lại — dock chỉ về Trang chủ/Giao dịch, không phải
// "trang trước"; back của trình duyệt thì bà con không tìm.
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { ChevronLeftIcon } from "@/components/icons";

export function MarketHeader({
  title,
  /** về đâu khi máy không có trang trước (mở thẳng từ link/PWA) */
  fallback = "/cho",
  right,
}: {
  title: string;
  fallback?: string;
  /** ô phụ bên phải (cùng hàng) — vd nút Giỏ */
  right?: ReactNode;
}) {
  const router = useRouter();
  const back = () => {
    // history.length ≤ 1 = mở thẳng vào màn này, back sẽ rời app ⇒ về màn cha
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push(fallback);
  };
  return (
    <header
      className="flex items-center gap-2 bg-navy px-2 pb-2 text-white"
      style={{
        // edge-to-edge: hàng nút luôn dưới status bar / Dynamic Island
        paddingTop: "calc(0.5rem + env(safe-area-inset-top))",
      }}
    >
      <button
        type="button"
        onClick={back}
        aria-label="Quay lại"
        className="relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-white transition active:bg-white/15"
      >
        <ChevronLeftIcon className="h-7 w-7" />
      </button>
      <h1 className="display relative z-10 min-w-0 flex-1 text-xl font-semibold leading-snug">{title}</h1>
      {right && <div className="relative z-10 shrink-0">{right}</div>}
    </header>
  );
}
