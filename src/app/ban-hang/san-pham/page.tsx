import { MarketHeader } from "@/components/market/shared/market-header";
import { RequireLogin } from "@/components/require-login";
import { SellerProductList } from "@/components/market/seller/product-list";

export const metadata = { title: "Sản phẩm của shop — SDFish" };

export default function SellerProductsPage() {
  return (
    <div>
      <MarketHeader title="Sản phẩm" fallback="/ban-hang" />
      <RequireLogin what="kênh người bán">
        <div className="mt-4">
          <SellerProductList />
        </div>
      </RequireLogin>
    </div>
  );
}
