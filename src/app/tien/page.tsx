import { PriceBoard } from "@/components/price-board";
import { TripLog } from "@/components/trip-log";
import { TripSplit } from "@/components/trip-split";
import { SellGuide } from "@/components/sell-guide";
import { PageHeader } from "@/components/page-header";
import { Tabs } from "@/components/ui/tabs";

export const metadata = { title: "Sổ tiền — ForFish" };

// Trục TIỀN (tài chính): giá bán, lãi/lỗ chuyến, chia phần — gom một chỗ,
// tách tab trong trang thay vì cuộn dọc.
export default function TienPage() {
  return (
    <div>
      <PageHeader
        kicker="Sổ tiền"
        title="Tiền nong của tàu"
        sub="Giá cá, lãi lỗ từng chuyến, chia tiền bạn thuyền — rõ ràng một chỗ."
        toColor="var(--t2)"
      />
      <Tabs
        ariaLabel="Mục tiền nong"
        tabs={[
          { id: "gia", label: "Giá cá", content: <PriceBoard /> },
          { id: "ban-o-dau", label: "Bán ở đâu", content: <SellGuide /> },
          { id: "lai-lo", label: "Lãi/lỗ", content: <TripLog /> },
          {
            id: "chia",
            label: "Chia tiền",
            content: (
              <div>
                <p className="mb-2 px-4 text-[15px] leading-snug text-foreground/70">
                  Nhập tiền bán cá và tổn chung — app tự chia theo phần từng
                  người, trừ luôn tiền đã ứng.
                </p>
                <TripSplit />
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
