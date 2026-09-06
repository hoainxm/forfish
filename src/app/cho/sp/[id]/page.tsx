import { ProductDetail } from "@/components/market/buyer/product-detail";
import { PageHeader } from "@/components/page-header";

export const metadata = { title: "Món trên chợ — SDFish" };

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div>
      <PageHeader kicker="Chợ vật tư" title="Món hàng" toColor="var(--t3)" />
      <ProductDetail id={id} />
    </div>
  );
}
