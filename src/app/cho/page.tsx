import { MarketHome } from "@/components/market/buyer/market-home";
import { ManHeader } from "@/components/man-header";

export const metadata = { title: "Vật tư — SDFish" };

// Chợ vật tư tàu cá — sàn NHIỀU đại lý (trục 3 "Vận hành rẻ hơn").
// KHÁCH LẠ XEM ĐƯỢC (LEAD §5 #8): không bọc RequireLogin. Cần tài khoản ở đúng
// điểm chạm — Đặt hàng, ♡, Đánh giá — bằng LoginGate tại chỗ.
// Từ 2026-10-19 là MỤC DOCK "Vật tư" (một việc một chỗ — không còn nằm trong Tàu
// cá hay sau Giao dịch) ⇒ trang gốc dùng đầu màn chung `ManHeader`, KHÔNG nút Quay
// lại (đây là gốc, không có "trang trước"). Màn con /cho/** vẫn `MarketHeader` có ‹.
export default function ChoPage() {
  return (
    <div>
      <ManHeader title="Vật tư" />
      <MarketHome />
    </div>
  );
}
