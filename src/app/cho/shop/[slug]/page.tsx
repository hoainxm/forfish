import { ShopPage } from "@/components/market/buyer/shop-page";
import { PageHeader } from "@/components/page-header";

export const metadata = { title: "Gian hàng — SDFish" };

export default async function ShopRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <div>
      <PageHeader kicker="Chợ vật tư" title="Gian hàng" toColor="var(--t3)" />
      <ShopPage slug={slug} />
    </div>
  );
}
