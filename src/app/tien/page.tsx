import { TradeHub } from "@/components/trade-hub";
import { MoneyInsights } from "@/components/money-insights";
import { PageHeader } from "@/components/page-header";
import { Tabs } from "@/components/ui/tabs";

export const metadata = { title: "Sổ tiền — ForFish" };

// Trục TIỀN — tách ĐÔI (user chốt 2026-06-10):
// · GIAO DỊCH: thông tin được cấp để bán có lợi thế — giá cá hôm nay,
//   "ai đang cần mua" (đầu nậu/nhà máy đăng loài + khối lượng + giá,
//   app bên thu mua đang xây), danh bạ chỗ bán.
// · HIỆU QUẢ: phân tích chuyện làm ăn — thẻ nhìn nhanh + sổ lãi/lỗ +
//   máy chia tiền.
export default function TienPage() {
  return (
    <div>
      <PageHeader
        kicker="Sổ tiền"
        title="Tiền nong của tàu"
        sub="Bán có lợi thế nhờ nắm giá và mối mua — lãi lỗ rõ ràng từng chuyến."
        toColor="var(--t2)"
      />
      <Tabs
        ariaLabel="Mục tiền nong"
        tabs={[
          { id: "giao-dich", label: "Giao dịch", content: <TradeHub /> },
          { id: "hieu-qua", label: "Hiệu quả", content: <MoneyInsights /> },
        ]}
      />
    </div>
  );
}
