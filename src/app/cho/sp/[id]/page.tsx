import { ProductDetail } from "@/components/market/buyer/product-detail";
import { MarketHeader } from "@/components/market/shared/market-header";

export const metadata = { title: "Món trong cửa hàng — SDFish" };

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div>
      {/* KHÔNG tiêu đề chung "Món hàng" — tên món là tiêu đề chính ngay dưới ảnh (như Shopee,
          rà bố cục 2026-10-22) */}
      <MarketHeader fallback="/cho" />
      <ProductDetail id={id} />
    </div>
  );
}
