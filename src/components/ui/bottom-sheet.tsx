"use client";

import { useEffect, useId, useRef } from "react";

/*
  BottomSheet dùng chung — thay 5 bản copy-paste, kèm a11y đầy đủ (audit 04):
  · role="dialog" aria-modal, có tiêu đề liên kết
  · bẫy focus trong sheet, Escape để đóng, trả focus về nút mở
  · khóa cuộn nền + overscroll-behavior:contain (không kéo trôi trang dưới)
  · chạm nền tối (scrim) để đóng
*/
export function BottomSheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // focus phần tử đầu tiên trong sheet
    const focusables = () =>
      panelRef.current
        ? Array.from(
            panelRef.current.querySelectorAll<HTMLElement>(
              'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
            ),
          ).filter((el) => !el.hasAttribute("disabled"))
        : [];
    focusables()[0]?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      opener?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-30 flex items-end justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92dvh] w-full max-w-[480px] overflow-y-auto rounded-t-[1.75rem] bg-background p-5 pb-8 [overscroll-behavior:contain]"
      >
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-line" aria-hidden />
        <h3 id={titleId} className="display mb-4 text-[1.3125rem] font-bold text-navy">
          {title}
        </h3>
        {children}
      </div>
    </div>
  );
}
