import { ProductDetail } from "@/components/market/buyer/product-detail";
import { MarketHeader } from "@/components/market/shared/market-header";

export const metadata = { title: "Món trên chợ — SDFish" };

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div>
      <MarketHeader title="Món hàng" fallback="/cho" />
      <ProductDetail id={id} />
    </div>
  );
}
