"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useExitTransition } from "@/lib/use-exit-transition";
import { tapFeedback } from "@/lib/haptics";
import { focusablesIn, lockBodyScroll, unlockBodyScroll, useLichSuDong, vongFocus } from "@/lib/dialog-focus";

/*
  ConfirmDialog dùng chung — thay 4 bản copy-paste (xác nhận xóa…), kèm a11y:
  role=alertdialog, Escape/scrim đóng, trả focus, focus nút an toàn trước.
  Đóng có animation (scrim mờ + card pop); confirm rung nhẹ (haptics).
*/
export function ConfirmDialog({
  icon,
  title,
  message,
  children,
  cancelLabel = "Không",
  confirmLabel = "Xác nhận xóa",
  danger = true,
  onCancel,
  onConfirm,
}: {
  icon?: React.ReactNode;
  title: string;
  message?: string;
  /** nội dung phụ (vd: chọn kỳ hạn) chèn giữa lời nhắn và hai nút */
  children?: React.ReactNode;
  cancelLabel?: string;
  confirmLabel?: string;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const { closing, requestClose } = useExitTransition(onCancel);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  /*  BACK CỦA MÁY ĐÓNG HỘP TRƯỚC (rà FB 2026-10-25): hộp chiếm một mục lịch sử; back = "Không". Hai nút cũng đi
      qua `dongTay` (lùi lịch sử rồi popstate mới đóng) để lần back sau không "chết" một nhịp; nút xác nhận gửi việc
      cần làm qua `ket` vì popstate chỉ biết gọi một hàm đóng. */
  const ket = useRef<(() => void) | null>(null);
  const { dongTay } = useLichSuDong(() => {
    const k = ket.current;
    ket.current = null;
    requestClose(k ?? undefined);
  });

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    // khoá cuộn nền + GIỮ FOCUS trong hộp (rà bố cục 2026-10-22 — trước đây Tab chạy ra
    // trang dưới nền mờ, cuộn được trang sau lưng hộp). Dùng chung với BottomSheet.
    lockBodyScroll();
    cancelRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation(); // hộp nằm TRÊN sheet: Escape chỉ đóng hộp, không đóng luôn sheet
        dongTay();
        return;
      }
      if (e.key !== "Tab") return;
      // hộp mở TỪ TRONG sheet: chặn để bẫy focus của sheet bên dưới không giành focus lại
      e.stopImmediatePropagation();
      const next = vongFocus(focusablesIn(cardRef.current), document.activeElement, e.shiftKey);
      if (next) {
        e.preventDefault();
        next.focus();
      }
    }
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      unlockBodyScroll();
      opener?.focus?.();
    };
  }, [dongTay]);

  if (!mounted) return null;

  // PORTAL ra body — thoát stacking context của tổ tiên (vd nút Xóa nằm trong
  // card `relative z-10`) để dialog z-40 luôn nổi trên bottom-nav/sheet.
  return createPortal(
    <div
      /* touch-none: iOS bỏ qua overflow:hidden trên body — vuốt trên nền mờ không trôi trang sau (VO-APP-09) */
      className={`fixed inset-0 z-40 flex touch-none items-center justify-center bg-black/50 px-6 ${
        closing ? "anim-scrim-out" : "anim-scrim-in"
      }`}
      onClick={dongTay}
    >
      <div
        ref={cardRef}
        role="alertdialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        /* giới hạn cao + cuộn trong (rà bố cục 2026-10-22): lời nhắn dài / nội dung phụ
           (chọn kỳ hạn…) trước đây tràn khỏi màn, không tới được hai nút */
        className={`max-h-[85dvh] w-full max-w-[25rem] overflow-y-auto surface p-5 text-center [overscroll-behavior:contain] ${
          closing ? "anim-pop-out" : "anim-pop-in"
        }`}
      >
        {icon && <div className="mx-auto mb-3 w-fit">{icon}</div>}
        <p className="display text-[1.25rem] font-semibold text-navy">{title}</p>
        {message && (
          <p className="mt-1 text-[1rem] text-foreground/70">{message}</p>
        )}
        {children}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            ref={cancelRef}
            onClick={dongTay}
            className="min-h-[3.5rem] rounded-2xl bg-field text-[1.125rem] font-semibold text-foreground/70"
          >
            {cancelLabel}
          </button>
          <button
            onClick={() => {
              tapFeedback();
              ket.current = onConfirm;
              dongTay();
            }}
            className={`min-h-[3.5rem] rounded-2xl text-[1.125rem] font-semibold text-white ${
              danger ? "bg-danger" : "bg-sea"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
