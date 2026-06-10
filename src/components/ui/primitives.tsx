import type { ReactNode } from "react";

/*
  Primitives dùng chung — chốt chuẩn các atom hay bị copy-paste lệch nhau
  (audit 02). Gom nhỏ vào một file cho dễ import.
*/

/** Thẻ nền trắng bo 12px viền mảnh — khối nội dung mặc định. */
export function Card({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`rounded-xl bg-card shadow-sm ring-1 ring-line ${className}`}
    >
      {children}
    </div>
  );
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
      className={`display px-4 pb-2 text-[20px] font-bold text-navy ${className}`}
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
      <span className="mb-1.5 block text-[16px] font-bold text-navy">
        {label}
      </span>
      {children}
    </label>
  );
}

/** Class chuẩn cho ô nhập 1 dòng / select / textarea (rounded-lg, 17px). */
export const inputClass =
  "w-full rounded-lg border-2 border-line bg-card px-4 py-3.5 text-[17px] focus:border-sea focus:outline-none";

/** Nút chính (cam trim) — tap ≥60px, bo 12px. */
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
      className={`display flex min-h-[60px] w-full items-center justify-center gap-2.5 rounded-xl bg-trim text-[19px] font-bold text-white shadow-sm transition active:scale-[0.98] disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  );
}

/** Trạng thái rỗng — icon + lời nhắc thân thiện. */
export function EmptyState({
  icon,
  children,
}: {
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border-2 border-dashed border-line bg-card px-4 py-12 text-center">
      {icon && <div className="mx-auto mb-3 w-fit text-foreground/40">{icon}</div>}
      <p className="text-[17px] text-foreground/70">{children}</p>
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
      className="rounded-lg px-3 py-2.5 text-[14px] font-semibold leading-snug"
      style={{ color: tone, backgroundColor: bg }}
    >
      {children}
    </p>
  );
}
