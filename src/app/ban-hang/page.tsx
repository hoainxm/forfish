import { MarketHeader } from "@/components/market/shared/market-header";
import { RequireLogin } from "@/components/require-login";
import { SellerHome } from "@/components/market/seller/seller-home";

export const metadata = { title: "Kênh người bán — SDFish" };

// Vỏ máy chủ (12 §8): thanh đầu màn + client component, để trang prerender được.
// Khu /ban-hang dùng chung khung mobile + dock — người bán ở đại lý cũng là
// người dùng SDFish, không thoát khung như /quan-tri.
export default function BanHangPage() {
  return (
    <div>
      <MarketHeader title="Gian hàng của tôi" fallback="/" />
      <RequireLogin what="kênh người bán">
        <div className="mt-4">
          <SellerHome />
        </div>
      </RequireLogin>
    </div>
  );
}
