import { ShopPage } from "@/components/market/buyer/shop-page";
import { MarketHeader } from "@/components/market/shared/market-header";

export const metadata = { title: "Gian hàng — SDFish" };

export default async function ShopRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <div>
      <MarketHeader title="Gian hàng" fallback="/cho" />
      <ShopPage slug={slug} />
    </div>
  );
}
