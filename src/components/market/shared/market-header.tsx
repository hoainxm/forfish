"use client";

// ĐẦU MÀN PHỤ — MỘT KIỂU CHO CẢ APP (rà bố cục 2026-10-22, anh Long: "xử lý theo các app hiện
// đại nhất, đông user nhất"). Màn GỐC của dock dùng tiêu đề lớn `ManHeader` (24px, như "large
// title" iOS); màn PHỤ (đẩy vào từ màn gốc) dùng thanh SÁNG một hàng `[‹ 2.75rem] [tiêu đề 20px]`
// như Shopee · Grab · Facebook. ‹ = MỘT cỡ với mọi control hàng header (×, icon, avatar): vùng chạm
// 2.75rem, glyph 1.5rem (quyết định L rà FB 2026-10-25, 03 §6 mục 5). Trước đây có ba kiểu: thanh navy đặc (chợ), dải gradient bo đáy
// có nhãn nhỏ trên tiêu đề (`PageHeader` — đăng nhập, cảng, quyền riêng tư) và ManHeader.
// Tên file giữ (17 màn chợ import) — `PageHeader` cũng dựng trên component này.
// Mọi màn phụ có nút Quay lại — dock không phải "trang trước"; back của trình duyệt bà con
// không tìm (F-08/F-09 vòng fix UX 2026-09-06).
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { ChevronLeftIcon } from "@/components/icons";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

/*  FORM TRANG GÕ DỞ MÀ CHẠM "‹" (BH-10, 2026-10-25). `BottomSheet kieu="form"` đã có
    luật hỏi "Bỏ phần đang ghi?" (03 §6 mục 4); form TRANG (đăng ký shop, món, cài đặt)
    thì chưa — gõ 8 ô rồi chạm "‹" là mất sạch, không một lời. Header nằm ở page
    (server) còn chữ đang gõ nằm trong form (client) nên không truyền prop được: form
    gọi `useLeaveGuard(dirty)`, header hỏi lại cái cờ này lúc bấm. Một màn một
    header ⇒ một cờ là đủ; form gỡ khỏi màn là cờ tự hạ. KHÔNG lưu nháp — chỉ hỏi. */
const guard = { dirty: false };

/** Form trang báo "đang có chữ chưa lưu" — "‹" sẽ hỏi trước khi bỏ; đóng tab/tải lại cũng hỏi (beforeunload). */
export function useLeaveGuard(dirty: boolean): void {
  useEffect(() => {
    guard.dirty = dirty;
    if (!dirty) return;
    const hoi = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = ""; // Chrome cũ cần chuỗi mới hiện hộp
    };
    window.addEventListener("beforeunload", hoi);
    return () => {
      window.removeEventListener("beforeunload", hoi);
      guard.dirty = false;
    };
  }, [dirty]);
}

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
  const [hoiBo, setHoiBo] = useState(false);
  const go = () => {
    // history.length ≤ 1 = mở thẳng vào màn này, back sẽ rời app ⇒ về màn cha
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push(fallback);
  };
  const back = () => {
    if (guard.dirty) setHoiBo(true);
    else go();
  };
  return (
    <>
    {hoiBo && (
      <ConfirmDialog
        title="Bỏ phần đang ghi?"
        message="Chữ vừa gõ sẽ mất, không lưu lại."
        cancelLabel="Ghi tiếp"
        confirmLabel="Bỏ"
        onCancel={() => setHoiBo(false)}
        onConfirm={() => {
          guard.dirty = false;
          setHoiBo(false);
          go();
        }}
      />
    )}
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
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-navy transition active:bg-field"
      >
        <ChevronLeftIcon className="h-6 w-6" />
      </button>
      {title != null && title !== "" && (
        <h1 className="display min-w-0 flex-1 text-[1.25rem] font-bold leading-snug">{title}</h1>
      )}
      {right && <div className="ml-auto shrink-0">{right}</div>}
    </header>
    </>
  );
}
