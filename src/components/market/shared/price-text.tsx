import { formatVnd } from "@/lib/format";

/** Giá + giá gạch (nếu có). `formatVnd` dùng chung; giá gạch mờ + gạch ngang.
 *
 *  `priceVnd === null` = LIÊN HỆ BÁO GIÁ (món bán qua tư vấn — xem
 *  `Product.priceVnd`). Nói thẳng bằng CHỮ, tuyệt đối không để rơi vào
 *  `formatVnd(0)` ra "0 đ": bà con đọc "0 đ" là hiểu cho không. Chữ giữ đúng
 *  cỡ và màu của giá thật để hàng thẻ không so le. */
export function PriceText({
  priceVnd,
  compareAtVnd,
  size = "sm",
  className = "",
}: {
  priceVnd: number | null;
  compareAtVnd?: number;
  size?: "sm" | "lg";
  className?: string;
}) {
  const main = size === "lg" ? "text-[1.125rem]" : "text-[1rem]";
  if (priceVnd == null) {
    return (
      <span className={`inline-flex flex-wrap items-baseline gap-x-2 ${className}`}>
        <span className={`${main} font-bold text-trim`}>Liên hệ báo giá</span>
      </span>
    );
  }
  return (
    <span className={`inline-flex flex-wrap items-baseline gap-x-2 ${className}`}>
      <span className={`${main} font-bold text-trim`}>{formatVnd(priceVnd)}</span>
      {compareAtVnd != null && compareAtVnd > priceVnd && (
        <span className="text-[0.875rem] text-foreground/50 line-through">{formatVnd(compareAtVnd)}</span>
      )}
    </span>
  );
}

/** Số tiền trần (tổng, phí giao…) — một kiểu chữ cho mọi chỗ, `formatVnd` dùng chung.
 *  LUÔN `whitespace-nowrap` (R-01, 2026-09-06): "360.000 đ" gãy dòng giữa số và
 *  chữ "đ" là số tiền đọc thành hai thứ — đặt ở đây để mọi màn khỏi tự nhớ. */
export function MoneyText({ vnd, bold = true, className = "" }: { vnd: number; bold?: boolean; className?: string }) {
  return (
    <span className={`whitespace-nowrap ${bold ? "font-bold text-navy" : "text-foreground/80"} ${className}`}>
      {formatVnd(vnd)}
    </span>
  );
}
