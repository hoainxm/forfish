import { ComingSoon } from "@/components/coming-soon";

export const metadata = { title: "Vận hành rẻ hơn — ForFish" };

export default function VanHanhPage() {
  return (
    <ComingSoon
      tone="t3"
      truc={3}
      emoji="⚙️"
      title="Vận hành rẻ hơn"
      promise="Giữ tàu chạy bền, tốn ít tiền hơn mỗi chuyến."
      features={[
        "Chợ vật tư vận hành ngay trong app: dầu nhờn, lọc dầu, phụ gia, thiết bị lọc nước.",
        "Nhắc bảo dưỡng và thay thế định kỳ theo tình trạng tàu, tránh hỏng đột xuất.",
        "Báo hỏng và yêu cầu bảo hành ngay trên app, có người tiếp nhận xử lý.",
      ]}
      dataNote="Đặt hàng đổ thẳng vào SDWork, gắn đại lý phụ trách, thanh toán QR có sẵn, bảo hành đi vào quy trình sửa chữa có sẵn."
    />
  );
}
