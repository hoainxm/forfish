import { MyMarketOrders } from "@/components/market/buyer/my-market-orders";
import { PageHeader } from "@/components/page-header";
import { RequireLogin } from "@/components/require-login";

export const metadata = { title: "Đơn hàng của tôi — SDFish" };

export default function DonPage() {
  return (
    <div>
      <PageHeader kicker="Chợ vật tư" title="Đơn hàng của tôi" toColor="var(--t3)" />
      <RequireLogin what="đơn hàng">
        <MyMarketOrders />
      </RequireLogin>
    </div>
  );
}
