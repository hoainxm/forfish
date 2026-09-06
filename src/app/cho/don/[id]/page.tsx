import { MarketOrderDetail } from "@/components/market/buyer/market-order-detail";
import { MarketHeader } from "@/components/market/shared/market-header";
import { RequireLogin } from "@/components/require-login";

export const metadata = { title: "Chi tiết đơn — SDFish" };

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div>
      <MarketHeader title="Chi tiết đơn" fallback="/cho/don" />
      <RequireLogin what="đơn hàng">
        <MarketOrderDetail id={id} />
      </RequireLogin>
    </div>
  );
}
