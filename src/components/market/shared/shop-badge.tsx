import { StarIcon } from "@/components/icons";

/** Dòng nhỏ dưới tên món: tên shop · tỉnh · sao · chip "Tạm nghỉ" khi `paused`. */
export function ShopBadge({
  name,
  province,
  ratingAvg,
  paused,
  className = "",
}: {
  name: string;
  province?: string;
  ratingAvg?: number;
  paused?: boolean;
  className?: string;
}) {
  return (
    <span className={`inline-flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[0.875rem] text-foreground/65 ${className}`}>
      <span className="truncate font-semibold text-navy/80">{name}</span>
      {province && <span>· {province}</span>}
      {ratingAvg != null && ratingAvg > 0 && (
        <span className="inline-flex items-center gap-0.5" style={{ color: "var(--sun)" }}>
          <StarIcon className="h-3.5 w-3.5 fill-current" />
          <span className="text-foreground/65">{ratingAvg.toFixed(1)}</span>
        </span>
      )}
      {paused && (
        <span
          className="rounded-full px-2 py-0.5 text-[0.75rem] font-semibold"
          style={{ backgroundColor: "var(--warn-bg)", color: "var(--warn)" }}
        >
          Tạm nghỉ
        </span>
      )}
    </span>
  );
}
