import { Checkout } from "@/components/market/buyer/checkout";
import { PageHeader } from "@/components/page-header";
import { RequireLogin } from "@/components/require-login";

export const metadata = { title: "Đặt hàng — SDFish" };

export default function ThanhToanPage() {
  return (
    <div>
      <PageHeader kicker="Chợ vật tư" title="Đặt hàng" toColor="var(--t3)" />
      <RequireLogin what="đơn hàng">
        <Checkout />
      </RequireLogin>
    </div>
  );
}
