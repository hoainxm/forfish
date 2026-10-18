import { MarketHeader } from "@/components/market/shared/market-header";
import { RequireLogin } from "@/components/require-login";
import { ShopOrderDetail } from "@/components/market/seller/shop-order-detail";

export const metadata = { title: "Đơn hàng — SDFish" };

export default async function SellerOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div>
      <MarketHeader title="Chi tiết đơn" fallback="/ban-hang/don" />
      <RequireLogin what="kênh người bán">
        <div className="mt-4">
          <ShopOrderDetail id={id} />
        </div>
      </RequireLogin>
    </div>
  );
}
