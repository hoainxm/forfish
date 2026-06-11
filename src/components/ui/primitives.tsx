import type { ReactNode } from "react";

/*
  Primitives dùng chung — chốt chuẩn các atom hay bị copy-paste lệch nhau
  (audit 02). Redesign "Mặt nước" 2026-06-10: thẻ không viền bóng mềm,
  input filled, nút pill — hiện đại nhưng vẫn cho tay ướt mắt kém.
*/

/** Thẻ hiện đại không viền — trắng nổi trên nền mist bằng bóng mềm, bo 20px. */
export function Card({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={`surface ${className}`}>{children}</div>;
}

/** Tiêu đề mục — một cỡ (20px) + padding ngang nhất quán. */
export function SectionHeader({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h2
      className={`display px-4 pb-2 text-[1.25rem] font-bold text-navy ${className}`}
    >
      {children}
    </h2>
  );
}

/** Nhãn + ô nhập trong form (chốt cỡ chữ nhãn 16px). */
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="mb-3.5 block">
      <span className="mb-1.5 block text-[1rem] font-bold text-navy">
        {label}
      </span>
      {children}
    </label>
  );
}

/** Class chuẩn cho ô nhập 1 dòng / select / textarea — kiểu FILLED hiện đại. */
export const inputClass =
  "w-full rounded-2xl border-0 bg-field px-4 py-4 text-[1.125rem] focus:bg-card focus:outline-none focus:ring-2 focus:ring-sea";

/** Nút chính (cam trim) — pill, tap ≥60px, bóng màu. */
export function PrimaryButton({
  type = "button",
  onClick,
  disabled,
  className = "",
  children,
}: {
  type?: "button" | "submit";
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`display flex min-h-[3.75rem] w-full items-center justify-center gap-2.5 rounded-full bg-trim text-[1.1875rem] font-bold text-white shadow-[0_10px_24px_-8px_rgba(228,87,46,0.55)] transition active:scale-[0.98] disabled:opacity-40 disabled:shadow-none ${className}`}
    >
      {children}
    </button>
  );
}

/** Trạng thái rỗng — icon + lời nhắc thân thiện, nền tonal nhẹ. */
export function EmptyState({
  icon,
  children,
}: {
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rounded-[1.25rem] bg-field/70 px-4 py-12 text-center">
      {icon && <div className="mx-auto mb-3 w-fit text-foreground/40">{icon}</div>}
      <p className="text-[1.125rem] text-foreground/70">{children}</p>
    </div>
  );
}

/** Dòng ghi chú nguồn / lưu ý "tham khảo" (token màu theo trục truyền vào). */
export function RefNote({
  tone = "var(--warn)",
  bg = "var(--warn-bg)",
  children,
}: {
  tone?: string;
  bg?: string;
  children: ReactNode;
}) {
  return (
    <p
      className="rounded-2xl px-3.5 py-2.5 text-[0.875rem] font-semibold leading-snug"
      style={{ color: tone, backgroundColor: bg }}
    >
      {children}
    </p>
  );
}
