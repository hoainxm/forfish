import { clockVN } from "@/lib/day-labels";
import { isOrderStatus, ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL } from "@/lib/market/order-state";
import type { TimelineEntry } from "@/lib/market/types";

const BY_LABEL: Record<string, string> = { buyer: "Người mua", seller: "Shop", system: "Hệ thống" };

function byLabel(by: string): string {
  if (by.startsWith("admin")) return "SDVICO";
  return BY_LABEL[by] ?? by;
}

function when(at: string): string {
  const ms = Date.parse(at);
  if (!Number.isFinite(ms)) return "";
  return clockVN(ms); // "07:15 ngày 20/7" (giờ VN)
}

/**
 * Dòng thời gian dọc của đơn: mục trạng thái ĐƠN và THANH TOÁN xen kẽ theo
 * thứ tự ghi. `by` bắt đầu `admin:` ⇒ nhãn "SDVICO". Đang giao kèm cách giao / mã.
 */
export function OrderTimeline({
  timeline,
  carrier,
  trackingCode,
  className = "",
}: {
  timeline: TimelineEntry[];
  carrier?: string;
  trackingCode?: string;
  className?: string;
}) {
  if (timeline.length === 0) {
    return <p className={`text-[1rem] text-foreground/65 ${className}`}>Chưa có bước nào.</p>;
  }
  return (
    <ol className={`flex flex-col gap-0 ${className}`}>
      {timeline.map((t, i) => {
        const label = isOrderStatus(t.status) ? ORDER_STATUS_LABEL[t.status] : PAYMENT_STATUS_LABEL[t.status];
        const last = i === timeline.length - 1;
        const extra =
          t.status === "dang_giao" && (carrier || trackingCode)
            ? [carrier, trackingCode ? `mã ${trackingCode}` : ""].filter(Boolean).join(" · ")
            : "";
        return (
          <li key={`${t.status}-${t.at}-${i}`} className="relative flex min-h-(--row-h) gap-3 pl-1">
            <span className="flex flex-col items-center">
              <span
                className="mt-1.5 h-3.5 w-3.5 shrink-0 rounded-full"
                style={{ backgroundColor: last ? "var(--sea)" : "var(--line)" }}
              />
              {!last && <span className="w-0.5 flex-1" style={{ backgroundColor: "var(--line)" }} />}
            </span>
            <div className="pb-3">
              <p className={`text-[1rem] ${last ? "font-bold text-navy" : "text-foreground/80"}`}>
                {label}
                {extra && <span className="text-foreground/65"> ({extra})</span>}
              </p>
              <p className="text-[0.875rem] text-foreground/65">
                {when(t.at)} · {byLabel(t.by)}
              </p>
              {t.note && <p className="mt-0.5 text-[0.9375rem] text-foreground/80">{t.note}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
