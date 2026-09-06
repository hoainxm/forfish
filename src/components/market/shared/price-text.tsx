import { formatVnd } from "@/lib/format";

/** Giá + giá gạch (nếu có). `formatVnd` dùng chung; giá gạch mờ + gạch ngang. */
export function PriceText({
  priceVnd,
  compareAtVnd,
  size = "sm",
  className = "",
}: {
  priceVnd: number;
  compareAtVnd?: number;
  size?: "sm" | "lg";
  className?: string;
}) {
  const main = size === "lg" ? "text-[1.125rem]" : "text-[1rem]";
  return (
    <span className={`inline-flex flex-wrap items-baseline gap-x-2 ${className}`}>
      <span className={`${main} font-bold text-trim`}>{formatVnd(priceVnd)}</span>
      {compareAtVnd != null && compareAtVnd > priceVnd && (
        <span className="text-[0.875rem] text-foreground/50 line-through">{formatVnd(compareAtVnd)}</span>
      )}
    </span>
  );
}

/** Số tiền trần (tổng, phí giao…) — một kiểu chữ cho mọi chỗ, `formatVnd` dùng chung. */
export function MoneyText({ vnd, bold = true, className = "" }: { vnd: number; bold?: boolean; className?: string }) {
  return <span className={`${bold ? "font-bold text-navy" : "text-foreground/80"} ${className}`}>{formatVnd(vnd)}</span>;
}
