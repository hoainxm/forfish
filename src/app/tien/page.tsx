import { TradeHub } from "@/components/trade-hub";
import { BoatSwitcher } from "@/components/boat-switcher";
import { PageHeader } from "@/components/page-header";

export const metadata = { title: "Giao dịch — SDFish" };

// Trục GIAO DỊCH (user chốt 2026-07-27 — gộp về đúng 1 việc: mua–bán):
// thông tin được cấp để bán có lợi thế — giá cá hôm nay, tin mua/bán
// (chủ tàu đăng tin bán / tin mua, đầu nậu–nhà máy đăng tin cần mua),
// và danh bạ đầu mối bán. Bỏ Hiệu quả + Công nợ khỏi tab này.
export default function TienPage() {
  return (
    <div>
      <PageHeader
        kicker="Giao dịch"
        title="Mua bán của tàu"
        sub="Giúp bà con nắm giá cả và đầu mối thu mua — dễ dàng đăng tin, gọi trực tiếp thương lái."
        toColor="var(--t2)"
      />
      {/* Giao dịch (giá cá tham khảo) để PUBLIC — nắm giá là quyền lợi chung,
          không bắt đăng nhập. Sổ lãi lỗ + công nợ là data cá nhân → khóa. */}
      <BoatSwitcher />
      <TradeHub />
    </div>
  );
}
