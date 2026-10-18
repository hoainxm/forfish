import { RequestDetail } from "@/components/market/buyer/market-requests";
import { MarketHeader } from "@/components/market/shared/market-header";
import { RequireLogin } from "@/components/require-login";

export const metadata = { title: "Yêu cầu đặt hàng — SDFish" };

export default async function YeuCauChiTietPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div>
      <MarketHeader title="Yêu cầu đặt hàng" fallback="/cho/yeu-cau" />
      <RequireLogin what="yêu cầu đặt hàng">
        <RequestDetail id={id} />
      </RequireLogin>
    </div>
  );
}
