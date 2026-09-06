import { MarketSearch } from "@/components/market/buyer/market-search";
import { PageHeader } from "@/components/page-header";

export const metadata = { title: "Tìm vật tư — SDFish" };

export default function ChoTimPage() {
  return (
    <div>
      <PageHeader kicker="Chợ vật tư" title="Tìm món" toColor="var(--t3)" />
      <MarketSearch />
    </div>
  );
}
