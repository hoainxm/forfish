import { PageHeader } from "@/components/page-header";
import { RequireLogin } from "@/components/require-login";
import { ShopOrderDetail } from "@/components/market/seller/shop-order-detail";

export const metadata = { title: "Đơn hàng — SDFish" };

export default async function SellerOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div>
      <PageHeader
        kicker="Kênh người bán"
        title="Chi tiết đơn"
        sub="Xác nhận · giao hàng · tiền nong — mỗi bước một dòng trong đơn."
        toColor="var(--t3)"
      />
      <RequireLogin what="kênh người bán">
        <div className="mt-4">
          <ShopOrderDetail id={id} />
        </div>
      </RequireLogin>
    </div>
  );
}
