import { MarketHome } from "@/components/market/buyer/market-home";
import { PageHeader } from "@/components/page-header";

export const metadata = { title: "Chợ vật tư — SDFish" };

// Chợ vật tư tàu cá — sàn NHIỀU đại lý (trục 3 "Vận hành rẻ hơn").
// KHÁCH LẠ XEM ĐƯỢC (LEAD §5 #8): không bọc RequireLogin. Cần tài khoản ở đúng
// điểm chạm — Đặt hàng, ♡, Đánh giá — bằng LoginGate tại chỗ.
export default function ChoPage() {
  return (
    <div>
      <PageHeader
        kicker="Chợ vật tư"
        title="Chợ vật tư tàu cá"
        sub="Máy, ngư cụ, dầu nhớt, đá… nhiều đại lý, giao ra cảng."
        toColor="var(--t3)"
      />
      <MarketHome />
    </div>
  );
}
