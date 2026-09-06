import { MarketHome } from "@/components/market/buyer/market-home";
import { MarketHeader } from "@/components/market/shared/market-header";

export const metadata = { title: "Chợ vật tư — SDFish" };

// Chợ vật tư tàu cá — sàn NHIỀU đại lý (trục 3 "Vận hành rẻ hơn").
// KHÁCH LẠ XEM ĐƯỢC (LEAD §5 #8): không bọc RequireLogin. Cần tài khoản ở đúng
// điểm chạm — Đặt hàng, ♡, Đánh giá — bằng LoginGate tại chỗ.
// Đầu màn là `MarketHeader` gọn (F-08): hero 330px cũ ăn 40% màn đầu; Quay lại
// của trang gốc chợ về /tien (lối vào chính).
export default function ChoPage() {
  return (
    <div>
      <MarketHeader title="Chợ vật tư tàu cá" fallback="/tien" />
      <MarketHome />
    </div>
  );
}
