import { CheckIcon } from "@/components/icons";
import { NHAN } from "@/lib/labels";

/*  DẤU "XÁC MINH" (spec 17 §5) — người thu mua SDVICO đã xác minh (customers.vai_xac_minh_at, chỉ nhân viên gán).
    MỘT khuôn cho cả ba chỗ: hàng Đầu mối, thẻ tin mua ở Mua bán, màn Hồ sơ vựa. Màu kèm icon + chữ (03: màu
    không đứng một mình). Nhãn ≤2 chữ từ NHAN. */
export function XacMinhBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-0.5 rounded-full bg-ok-bg px-1.5 py-0.5 align-middle text-[0.75rem] font-semibold leading-none text-ok ${className}`}
    >
      <CheckIcon className="h-3 w-3" />
      {NHAN.xacMinh}
    </span>
  );
}
