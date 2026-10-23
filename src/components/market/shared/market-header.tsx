"use client";

// ĐẦU MÀN PHỤ — MỘT KIỂU CHO CẢ APP (rà bố cục 2026-10-22, anh Long: "xử lý theo các app hiện
// đại nhất, đông user nhất"). Màn GỐC của dock dùng tiêu đề lớn `ManHeader` (24px, như "large
// title" iOS); màn PHỤ (đẩy vào từ màn gốc) dùng thanh SÁNG một hàng `[‹ 3.5rem] [tiêu đề 20px]`
// như Shopee · Grab · Facebook. Trước đây có ba kiểu: thanh navy đặc (chợ), dải gradient bo đáy
// có nhãn nhỏ trên tiêu đề (`PageHeader` — đăng nhập, cảng, quyền riêng tư) và ManHeader.
// Tên file giữ (17 màn chợ import) — `PageHeader` cũng dựng trên component này.
// Mọi màn phụ có nút Quay lại — dock không phải "trang trước"; back của trình duyệt bà con
// không tìm (F-08/F-09 vòng fix UX 2026-09-06).
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { ChevronLeftIcon } from "@/components/icons";

export function MarketHeader({
  title,
  /** về đâu khi máy không có trang trước (mở thẳng từ link/PWA) */
  fallback = "/cho",
  right,
}: {
  /** bỏ trống khi nội dung đã có tiêu đề chính riêng (vd tên món ở trang chi tiết — như Shopee) */
  title?: ReactNode;
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
      className="flex items-center gap-1 bg-background px-2 pb-1 text-navy"
      style={{
        // edge-to-edge: hàng nút luôn dưới status bar / Dynamic Island
        paddingTop: "calc(0.5rem + env(safe-area-inset-top))",
      }}
    >
      <button
        type="button"
        onClick={back}
        aria-label="Quay lại"
        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-navy transition active:bg-field"
      >
        <ChevronLeftIcon className="h-7 w-7" />
      </button>
      {title != null && title !== "" && (
        <h1 className="display min-w-0 flex-1 text-[1.25rem] font-bold leading-snug">{title}</h1>
      )}
      {right && <div className="ml-auto shrink-0">{right}</div>}
    </header>
  );
}
