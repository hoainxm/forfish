import { ComingSoon } from "@/components/coming-soon";

export const metadata = { title: "Bán được đắt hơn — ForFish" };

export default function GiaCaPage() {
  return (
    <ComingSoon
      tone="t2"
      truc={2}
      emoji="💰"
      title="Bán được đắt hơn"
      promise="Cá về bờ bán được giá, không bị ép."
      features={[
        "Giá thị trường theo loài tại các cảng quanh bà con, cập nhật thường xuyên.",
        "Kết nối đầu mối thu mua, để bà con biết bán cho ai, ở đâu.",
        "Sổ lãi lỗ chuyến biển, để thấy rõ chuyến nào lời, bán ở đâu được hơn.",
      ]}
      dataNote="Giá tại cảng Việt Nam tự thu qua mạng đại lý, cảng cá và cộng tác viên — lợi thế riêng không ai sao chép được."
    />
  );
}
