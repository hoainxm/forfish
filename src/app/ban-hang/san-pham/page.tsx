import { PageHeader } from "@/components/page-header";
import { RequireLogin } from "@/components/require-login";
import { SellerProductList } from "@/components/market/seller/product-list";

export const metadata = { title: "Sản phẩm của shop — SDFish" };

export default function SellerProductsPage() {
  return (
    <div>
      <PageHeader
        kicker="Kênh người bán"
        title="Sản phẩm"
        sub="Thêm món, sửa giá, sửa tồn kho."
        toColor="var(--t3)"
      />
      <RequireLogin what="kênh người bán">
        <div className="mt-4">
          <SellerProductList />
        </div>
      </RequireLogin>
    </div>
  );
}
