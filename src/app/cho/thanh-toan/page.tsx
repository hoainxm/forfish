import { Checkout } from "@/components/market/buyer/checkout";
import { MarketHeader } from "@/components/market/shared/market-header";
import { RequireLogin } from "@/components/require-login";

export const metadata = { title: "Đặt hàng — SDFish" };

export default function ThanhToanPage() {
  return (
    <div>
      <MarketHeader title="Đặt hàng" fallback="/cho/gio" />
      <RequireLogin what="đơn hàng">
        <Checkout />
      </RequireLogin>
    </div>
  );
}
