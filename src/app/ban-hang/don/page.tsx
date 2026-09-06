import { PageHeader } from "@/components/page-header";
import { RequireLogin } from "@/components/require-login";
import { ShopOrders } from "@/components/market/seller/shop-orders";

export const metadata = { title: "Đơn hàng của shop — SDFish" };

export default function SellerOrdersPage() {
  return (
    <div>
      <PageHeader
        kicker="Kênh người bán"
        title="Đơn hàng"
        sub="Xác nhận sớm để bà con còn kịp chuyến biển."
        toColor="var(--t3)"
      />
      <RequireLogin what="kênh người bán">
        <div className="mt-4">
          <ShopOrders />
        </div>
      </RequireLogin>
    </div>
  );
}
