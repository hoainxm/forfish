import { MarketHeader } from "@/components/market/shared/market-header";
import { RequireLogin } from "@/components/require-login";
import { SellerProductForm } from "@/components/market/seller/product-form";

export const metadata = { title: "Món hàng — SDFish" };

// `id = "moi"` là thêm mới (12 §8.3) — cùng một màn, không đẻ route thứ hai.
export default async function SellerProductFormPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div>
      <MarketHeader title={id === "moi" ? "Thêm món hàng" : "Sửa món hàng"} fallback="/ban-hang/san-pham" />
      <RequireLogin what="kênh người bán">
        <div className="mt-4">
          <SellerProductForm id={id} />
        </div>
      </RequireLogin>
    </div>
  );
}
