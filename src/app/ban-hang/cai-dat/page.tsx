import { PageHeader } from "@/components/page-header";
import { RequireLogin } from "@/components/require-login";
import { ShopSettings } from "@/components/market/seller/shop-settings";

export const metadata = { title: "Cài đặt shop — SDFish" };

export default function ShopSettingsPage() {
  return (
    <div>
      <PageHeader
        kicker="Kênh người bán"
        title="Cài đặt shop"
        sub="Hồ sơ shop, số tài khoản, phí giao và tạm nghỉ bán."
        toColor="var(--t3)"
      />
      <RequireLogin what="kênh người bán">
        <div className="mt-4">
          <ShopSettings />
        </div>
      </RequireLogin>
    </div>
  );
}
