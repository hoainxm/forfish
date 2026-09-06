import { MarketCart } from "@/components/market/buyer/market-cart";
import { PageHeader } from "@/components/page-header";

export const metadata = { title: "Giỏ hàng — SDFish" };

// Giỏ XEM ĐƯỢC khi chưa đăng nhập (11 §5.5) — LoginGate chỉ chặn nút Đặt hàng.
export default function GioPage() {
  return (
    <div>
      <PageHeader kicker="Chợ vật tư" title="Giỏ hàng" toColor="var(--t3)" />
      <MarketCart />
    </div>
  );
}
