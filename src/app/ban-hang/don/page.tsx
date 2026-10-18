import { MarketHeader } from "@/components/market/shared/market-header";
import { RequireLogin } from "@/components/require-login";
import { ShopOrders } from "@/components/market/seller/shop-orders";

export const metadata = { title: "Đơn hàng của shop — SDFish" };

export default function SellerOrdersPage() {
  return (
    <div>
      <MarketHeader title="Đơn hàng" fallback="/ban-hang" />
      <RequireLogin what="kênh người bán">
        <div className="mt-4">
          <ShopOrders />
        </div>
      </RequireLogin>
    </div>
  );
}
