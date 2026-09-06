import { PageHeader } from "@/components/page-header";
import { RequireLogin } from "@/components/require-login";
import { SellerHome } from "@/components/market/seller/seller-home";

export const metadata = { title: "Kênh người bán — SDFish" };

// Vỏ máy chủ (12 §8): PageHeader + client component, để trang prerender được.
// Khu /ban-hang dùng chung khung mobile + dock — người bán ở đại lý cũng là
// người dùng SDFish, không thoát khung như /quan-tri.
export default function BanHangPage() {
  return (
    <div>
      <PageHeader
        kicker="Kênh người bán"
        title="Gian hàng của tôi"
        sub="Đăng món, nhận đơn, xem tiền về — bán thẳng cho tàu cá cả nước."
        toColor="var(--t3)"
      />
      <RequireLogin what="kênh người bán">
        <div className="mt-4">
          <SellerHome />
        </div>
      </RequireLogin>
    </div>
  );
}
