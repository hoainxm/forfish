import Link from "next/link";
import { ManHeader } from "@/components/man-header";
import { RequireLogin } from "@/components/require-login";
import { LoTrinhView } from "@/components/lo-trinh/lo-trinh-view";
import { ChevronLeftIcon } from "@/components/icons";

export const metadata = { title: "Chuyến biển — SDFish" };

// ĐỀ XUẤT LỘ TRÌNH CHUYẾN BIỂN NHIỀU NGÀY (09-ba-spec §4/§5c, 07 §5 hàng 2b). Route RIÊNG — KHÔNG nhét
// vào fishing-map-view. Lối vào: khay ⋯ của bản đồ (mục "Chuyến biển"). Vỏ màn nằm trong SHELL của
// sw.js ⇒ mất sóng vẫn mở được, xem lại lộ trình đã lưu + so vị trí bằng GPS.
// Disclaimer CỐ ĐỊNH ngay đầu màn (09 §4): là `sub` của ManHeader, luôn hiện.
export default function LoTrinhPage() {
  return (
    <div>
      <ManHeader
        title="Chuyến biển"
        sub="Gợi ý tham khảo — thuyền trưởng quyết định. Luôn nghe dự báo chính thức và tin từ tàu bạn."
        right={
          <Link
            href="/ngu-truong"
            aria-label="Về bản đồ"
            className="flex h-(--h-ctl) w-(--h-ctl) items-center justify-center rounded-full text-navy active:bg-field"
          >
            <ChevronLeftIcon className="h-6 w-6" />
          </Link>
        }
      />
      <RequireLogin what="đề xuất lộ trình">
        <LoTrinhView />
      </RequireLogin>
    </div>
  );
}
