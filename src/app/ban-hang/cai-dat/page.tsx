import { MarketHeader } from "@/components/market/shared/market-header";
import { RequireLogin } from "@/components/require-login";
import { ShopSettings } from "@/components/market/seller/shop-settings";

export const metadata = { title: "Cài đặt shop — SDFish" };

export default function ShopSettingsPage() {
  return (
    <div>
      <MarketHeader title="Cài đặt shop" fallback="/ban-hang" />
      <RequireLogin what="kênh người bán">
        <div className="mt-4">
          <ShopSettings />
        </div>
      </RequireLogin>
    </div>
  );
}
