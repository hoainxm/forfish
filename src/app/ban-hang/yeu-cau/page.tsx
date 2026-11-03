import { MarketHeader } from "@/components/market/shared/market-header";
import { RequireLogin } from "@/components/require-login";
import { SellerRequests } from "@/components/market/seller/shop-requests";

export const metadata = { title: "Yêu cầu đặt hàng — SDFish" };

// Đại lý tự báo giá món bà con cần mà chợ chưa bán (17 §12.5). Vỏ máy chủ + client component (12 §8).
export default function SellerRequestsPage() {
  return (
    <div>
      <MarketHeader title="Yêu cầu đặt" fallback="/ban-hang" />
      <RequireLogin what="kênh người bán">
        <div className="mt-4">
          <SellerRequests />
        </div>
      </RequireLogin>
    </div>
  );
}
