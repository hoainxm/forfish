import { MarketCart } from "@/components/market/buyer/market-cart";
import { MarketHeader } from "@/components/market/shared/market-header";

export const metadata = { title: "Giỏ hàng — SDFish" };

// Giỏ XEM ĐƯỢC khi chưa đăng nhập (11 §5.5) — LoginGate chỉ chặn nút Đặt hàng.
export default function GioPage() {
  return (
    <div>
      <MarketHeader title="Giỏ hàng" fallback="/cho" />
      <MarketCart />
    </div>
  );
}
