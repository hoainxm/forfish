"use client";

import { StarIcon } from "@/components/icons";

/**
 * 5 sao từ `StarIcon`. `interactive` ⇒ mỗi sao là nút tap ≥ 3.5rem (chọn số sao
 * khi đánh giá). Không interactive ⇒ chỉ hiện, kèm "(N)" khi có `count`.
 */
export function RatingStars({
  value,
  count,
  size = "sm",
  interactive = false,
  onChange,
  className = "",
}: {
  value: number;
  count?: number;
  size?: "sm" | "lg";
  interactive?: boolean;
  onChange?: (v: 1 | 2 | 3 | 4 | 5) => void;
  className?: string;
}) {
  const icon = size === "lg" || interactive ? "h-8 w-8" : "h-4 w-4";
  const rounded = Math.round(value * 2) / 2;
  const stars = [1, 2, 3, 4, 5] as const;
  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`} aria-label={`${value.toFixed(1)} trên 5 sao`}>
      {stars.map((n) => {
        const on = rounded >= n - 0.25;
        const style = { color: on ? "var(--sun)" : "var(--line)" };
        if (interactive) {
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange?.(n)}
              aria-label={`${n} sao`}
              aria-pressed={on}
              className="flex h-14 w-14 items-center justify-center rounded-full transition active:scale-95"
              style={style}
            >
              <StarIcon className={`${icon} ${on ? "fill-current" : ""}`} />
            </button>
          );
        }
        return (
          <span key={n} style={style}>
            <StarIcon className={`${icon} ${on ? "fill-current" : ""}`} />
          </span>
        );
      })}
      {!interactive && count != null && (
        <span className="ml-1 text-[0.875rem] text-foreground/65">({count})</span>
      )}
    </span>
  );
}
