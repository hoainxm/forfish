"use client";

/* Mảnh giao diện dùng chung của chế độ Hải đồ (2026-11-04). Màu chỉ qua token
   (đổi theo bảng Ngày/Chiều/Đêm), cỡ rem, vùng chạm ≥ 44 px. */

import { useRef, useState } from "react";

/** Nút tròn cột phải — chỉ icon (luật thẻ nổi 03 §6 mục 8), tên ở aria-label. */
export function NutCot({
  label,
  onClick,
  children,
  active = false,
  nutRef,
  badge,
  canh = false,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  active?: boolean;
  nutRef?: (el: HTMLButtonElement | null) => void;
  /** số nhỏ góc nút (vd số báo động) */
  badge?: number;
  /** tô đỏ (báo động đang kêu) */
  canh?: boolean;
}) {
  return (
    <button
      ref={nutRef}
      type="button"
      aria-label={label}
      aria-pressed={active || undefined}
      onClick={onClick}
      className={`pointer-events-auto relative flex h-(--h-ctl) w-(--h-ctl) items-center justify-center rounded-full transition active:scale-95 ${
        canh ? "bg-danger text-card" : active ? "bg-sea text-card" : "glass text-navy"
      }`}
    >
      {children}
      {badge != null && badge > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[0.6875rem] font-semibold text-card tabular-nums">
          {badge}
        </span>
      )}
    </button>
  );
}

export function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`h-(--h-chip) min-w-[3.5rem] rounded-full px-3 text-[0.875rem] font-semibold tabular-nums transition active:scale-95 ${
        on ? "bg-sea text-card" : "bg-field text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

/**
 * Nút GIỮ để kích (MOB, Đã vớt): tay ướt, tàu lắc — một chạm nhầm không được bật/tắt
 * báo động người rơi. Vòng tô dần trong lúc giữ; nhả sớm là thôi. Bàn phím: Enter giữ
 * cũng được (keydown lặp) — đủ cho trình đọc màn hình.
 */
export function NutGiu({
  label,
  ms,
  onXong,
  className,
  children,
}: {
  label: string;
  ms: number;
  onXong: () => void;
  className: string;
  children: React.ReactNode;
}) {
  const t = useRef<number | null>(null);
  const [giu, setGiu] = useState(false);
  const bat = () => {
    if (t.current != null) return;
    setGiu(true);
    t.current = window.setTimeout(() => {
      t.current = null;
      setGiu(false);
      navigator.vibrate?.(200);
      onXong();
    }, ms);
  };
  const tha = () => {
    if (t.current != null) window.clearTimeout(t.current);
    t.current = null;
    setGiu(false);
  };
  return (
    <button
      type="button"
      aria-label={`${label} — giữ 1 giây`}
      onPointerDown={bat}
      onPointerUp={tha}
      onPointerLeave={tha}
      onPointerCancel={tha}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && bat()}
      onKeyUp={tha}
      onContextMenu={(e) => e.preventDefault()}
      className={`pointer-events-auto relative select-none overflow-hidden transition active:scale-95 ${className}`}
      style={{ touchAction: "none" }}
    >
      <span
        aria-hidden
        className="absolute inset-0 origin-left bg-card/35"
        style={{ transform: `scaleX(${giu ? 1 : 0})`, transition: giu ? `transform ${ms}ms linear` : "none" }}
      />
      <span className="relative">{children}</span>
    </button>
  );
}
