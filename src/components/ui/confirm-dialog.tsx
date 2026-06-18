"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useExitTransition } from "@/lib/use-exit-transition";
import { tapFeedback } from "@/lib/haptics";

/*
  ConfirmDialog dùng chung — thay 4 bản copy-paste (xác nhận xóa…), kèm a11y:
  role=alertdialog, Escape/scrim đóng, trả focus, focus nút an toàn trước.
  Đóng có animation (scrim mờ + card pop); confirm rung nhẹ (haptics).
*/
export function ConfirmDialog({
  icon,
  title,
  message,
  cancelLabel = "Không",
  confirmLabel = "Xóa luôn",
  danger = true,
  onCancel,
  onConfirm,
}: {
  icon?: React.ReactNode;
  title: string;
  message?: string;
  cancelLabel?: string;
  confirmLabel?: string;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const { closing, requestClose } = useExitTransition(onCancel);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        requestClose();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      opener?.focus?.();
    };
  }, [requestClose]);

  if (!mounted) return null;

  // PORTAL ra body — thoát stacking context của tổ tiên (vd nút Xóa nằm trong
  // card `relative z-10`) để dialog z-40 luôn nổi trên bottom-nav/sheet.
  return createPortal(
    <div
      className={`fixed inset-0 z-40 flex items-center justify-center bg-black/50 px-6 ${
        closing ? "anim-scrim-out" : "anim-scrim-in"
      }`}
      onClick={requestClose}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-[400px] surface p-5 text-center ${
          closing ? "anim-pop-out" : "anim-pop-in"
        }`}
      >
        {icon && <div className="mx-auto mb-3 w-fit">{icon}</div>}
        <p className="display text-[1.25rem] font-bold text-navy">{title}</p>
        {message && (
          <p className="mt-1 text-[1rem] text-foreground/70">{message}</p>
        )}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            ref={cancelRef}
            onClick={() => requestClose()}
            className="min-h-[3.5rem] rounded-full bg-field text-[1.125rem] font-bold text-foreground/70"
          >
            {cancelLabel}
          </button>
          <button
            onClick={() => {
              tapFeedback();
              requestClose(onConfirm);
            }}
            className={`min-h-[3.5rem] rounded-xl text-[1.125rem] font-bold text-white ${
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
