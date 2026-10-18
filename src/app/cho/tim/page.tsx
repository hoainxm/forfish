import { MarketSearch } from "@/components/market/buyer/market-search";
import { MarketHeader } from "@/components/market/shared/market-header";

export const metadata = { title: "Tìm vật tư — SDFish" };

export default function ChoTimPage() {
  return (
    <div>
      <MarketHeader title="Tìm món" fallback="/cho" />
      <MarketSearch />
    </div>
  );
}
