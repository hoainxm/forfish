import { TradeHub } from "@/components/trade-hub";
import { MoneyInsights } from "@/components/money-insights";
import { DebtLedger } from "@/components/debt-ledger";
import { PageHeader } from "@/components/page-header";
import { Tabs } from "@/components/ui/tabs";
import { LoginGate } from "@/components/login-gate";

export const metadata = { title: "Sổ tiền — SDFish" };

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
      {/* Giao dịch (giá cá tham khảo) để PUBLIC — nắm giá là quyền lợi chung,
          không bắt đăng nhập. Sổ lãi lỗ + công nợ là data cá nhân → khóa. */}
      <Tabs
        ariaLabel="Mục tiền nong"
        paramKey="tab"
        tabs={[
          { id: "giao-dich", label: "Giao dịch", content: <TradeHub /> },
          {
            id: "hieu-qua",
            label: "Hiệu quả",
            content: (
              <LoginGate
                feature="sổ lãi lỗ chuyến biển"
                blurb="Đăng nhập để ghi và xem lãi lỗ từng chuyến — dữ liệu riêng của bạn, đồng bộ nhiều máy."
                accent="t2"
              >
                <MoneyInsights />
              </LoginGate>
            ),
          },
          {
            id: "cong-no",
            label: "Công nợ",
            content: (
              <LoginGate
                feature="sổ công nợ"
                blurb="Đăng nhập để ghi ai nợ ai, ứng trước bao nhiêu — dữ liệu riêng của bạn, đồng bộ nhiều máy."
                accent="t2"
              >
                <DebtLedger />
              </LoginGate>
            ),
          },
        ]}
      />
    </div>
  );
}
