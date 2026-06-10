import { ComingSoon } from "@/components/coming-soon";

export const metadata = { title: "Bán cá — ForFish" };

export default function GiaCaPage() {
  return (
    <ComingSoon
      tone="t2"
      title="Bán cá"
      promise="Cá về bờ bán được giá, không bị ép."
      features={[
        "Xem giá từng loại cá ở các cảng gần mình, cập nhật thường xuyên.",
        "Biết ai đang cần mua loại cá mình có, gọi thẳng cho họ.",
        "Sổ ghi lời lỗ từng chuyến — biết chuyến nào lời, bán ở đâu được hơn.",
      ]}
    />
  );
}
