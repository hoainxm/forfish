import { ProductDetail } from "@/components/market/buyer/product-detail";
import { CartHeaderLink } from "@/components/market/buyer/ui";
import { MarketHeader } from "@/components/market/shared/market-header";

export const metadata = { title: "Món trong cửa hàng — SDFish" };

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div>
      {/* KHÔNG tiêu đề chung "Món hàng" — tên món là tiêu đề chính ngay dưới ảnh (như Shopee,
          rà bố cục 2026-10-22) */}
      {/* icon giỏ + chấm số ở góc phải như Shopee (VT-04) — đường sang giỏ không phụ thuộc biên nhận 3 s */}
      <MarketHeader fallback="/cho" right={<CartHeaderLink />} />
      <ProductDetail id={id} />
    </div>
  );
}
