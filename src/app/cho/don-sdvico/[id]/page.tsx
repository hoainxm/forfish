import { SdvicoOrderDetail } from "@/components/market/buyer/sdvico-order-detail";
import { MarketHeader } from "@/components/market/shared/market-header";
import { RequireLogin } from "@/components/require-login";

export const metadata = { title: "Đơn SDVICO — SDFish" };

export default async function SdvicoOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div>
      <MarketHeader title="Chi tiết đơn" fallback="/cho/don" />
      <RequireLogin what="đơn hàng">
        <SdvicoOrderDetail id={id} />
      </RequireLogin>
    </div>
  );
}
