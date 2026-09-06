import { MarketHeader } from "@/components/market/shared/market-header";
import { RequireLogin } from "@/components/require-login";
import { ShopRegister } from "@/components/market/seller/shop-register";

export const metadata = { title: "Đăng ký gian hàng — SDFish" };

export default function DangKyShopPage() {
  return (
    <div>
      <MarketHeader title="Đăng ký gian hàng" fallback="/ban-hang" />
      <RequireLogin what="kênh người bán">
        <div className="mt-4">
          <ShopRegister />
        </div>
      </RequireLogin>
    </div>
  );
}
