import { MarketOrderDetail } from "@/components/market/buyer/market-order-detail";
import { PageHeader } from "@/components/page-header";
import { RequireLogin } from "@/components/require-login";

export const metadata = { title: "Chi tiết đơn — SDFish" };

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div>
      <PageHeader kicker="Chợ vật tư" title="Chi tiết đơn" toColor="var(--t3)" />
      <RequireLogin what="đơn hàng">
        <MarketOrderDetail id={id} />
      </RequireLogin>
    </div>
  );
}
