"use client";

import { useEffect, useRef } from "react";

/*
  ConfirmDialog dùng chung — thay 4 bản copy-paste (xác nhận xóa…), kèm a11y:
  role=alertdialog, Escape/scrim đóng, trả focus, focus nút an toàn trước.
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

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      opener?.focus?.();
    };
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 px-6"
      onClick={onCancel}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[400px] rounded-xl bg-card p-5 text-center"
      >
        {icon && <div className="mx-auto mb-3 w-fit">{icon}</div>}
        <p className="display text-[20px] font-bold text-navy">{title}</p>
        {message && (
          <p className="mt-1 text-[16px] text-foreground/70">{message}</p>
        )}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            ref={cancelRef}
            onClick={onCancel}
            className="min-h-[56px] rounded-lg border-2 border-line text-[18px] font-bold text-foreground/70"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`min-h-[56px] rounded-lg text-[18px] font-bold text-white ${
              danger ? "bg-danger" : "bg-sea"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
