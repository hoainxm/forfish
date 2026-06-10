import { ComingSoon } from "@/components/coming-soon";

export const metadata = { title: "Đánh bắt — ForFish" };

export default function NguTruongPage() {
  return (
    <ComingSoon
      tone="t1"
      emoji="🐟"
      title="Đánh bắt"
      promise="Ra khơi trúng hơn, đỡ tốn dầu tốn công."
      features={[
        "Mỗi sáng cho điểm đi biển từ 1 tới 100 — nhìn một cái biết hôm nay nên đi hay ở.",
        "Chỉ vùng biển đang nhiều cá, gần tàu mình nhất.",
        "Ghi lại chỗ trúng cá của mình, lần sau quay lại đúng chỗ.",
      ]}
    />
  );
}
