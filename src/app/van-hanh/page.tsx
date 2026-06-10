import { ComingSoon } from "@/components/coming-soon";

export const metadata = { title: "Vật tư & máy — ForFish" };

export default function VanHanhPage() {
  return (
    <ComingSoon
      tone="t3"
      emoji="🔧"
      title="Vật tư & máy"
      promise="Giữ tàu chạy bền, tốn ít tiền hơn mỗi chuyến."
      features={[
        "Mua dầu nhờn, lọc dầu, phụ tùng ngay trên app — giá rõ ràng, giao tận nơi.",
        "App nhắc khi tới kỳ bảo dưỡng máy, khỏi hỏng đột xuất giữa biển.",
        "Máy hỏng? Báo trên app, có người gọi lại lo cho mình.",
      ]}
    />
  );
}
