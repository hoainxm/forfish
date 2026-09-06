import { PageHeader } from "@/components/page-header";
import { RequireLogin } from "@/components/require-login";
import { SellerProductForm } from "@/components/market/seller/product-form";

export const metadata = { title: "Món hàng — SDFish" };

// `id = "moi"` là thêm mới (12 §8.3) — cùng một màn, không đẻ route thứ hai.
export default async function SellerProductFormPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div>
      <PageHeader
        kicker="Kênh người bán"
        title={id === "moi" ? "Thêm món hàng" : "Sửa món hàng"}
        sub="Ảnh rõ, tên đủ loại–cỡ–hãng thì bà con dễ tìm ra."
        toColor="var(--t3)"
      />
      <RequireLogin what="kênh người bán">
        <div className="mt-4">
          <SellerProductForm id={id} />
        </div>
      </RequireLogin>
    </div>
  );
}
