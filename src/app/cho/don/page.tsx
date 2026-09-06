import { MyMarketOrders } from "@/components/market/buyer/my-market-orders";
import { MarketHeader } from "@/components/market/shared/market-header";
import { RequireLogin } from "@/components/require-login";

export const metadata = { title: "Đơn hàng của tôi — SDFish" };

export default function DonPage() {
  return (
    <div>
      <MarketHeader title="Đơn hàng của tôi" fallback="/cho" />
      <RequireLogin what="đơn hàng">
        <MyMarketOrders />
      </RequireLogin>
    </div>
  );
}
