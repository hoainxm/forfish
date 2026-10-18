import { MyRequests } from "@/components/market/buyer/market-requests";
import { MarketHeader } from "@/components/market/shared/market-header";
import { RequireLogin } from "@/components/require-login";

export const metadata = { title: "Yêu cầu đặt hàng — SDFish" };

export default function YeuCauPage() {
  return (
    <div>
      <MarketHeader title="Yêu cầu đặt hàng" fallback="/cho" />
      <RequireLogin what="yêu cầu đặt hàng">
        <MyRequests />
      </RequireLogin>
    </div>
  );
}
