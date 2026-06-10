import { PriceBoard } from "@/components/price-board";
import { TripLog } from "@/components/trip-log";
import { TripSplit } from "@/components/trip-split";
import { PageHeader } from "@/components/page-header";
import { SectionHeader } from "@/components/ui/primitives";

export const metadata = { title: "Sổ tiền — ForFish" };

// Trục TIỀN (tài chính): mọi thứ liên quan dòng tiền gom một chỗ —
// giá bán, lãi/lỗ chuyến, chia phần bạn thuyền (trước rải ở Bán cá + Thuyền viên).
export default function TienPage() {
  return (
    <div>
      <PageHeader
        kicker="Sổ tiền"
        title="Tiền nong của tàu"
        sub="Giá cá, lãi lỗ từng chuyến, chia tiền bạn thuyền — rõ ràng một chỗ."
        toColor="var(--t2)"
      />

      <section className="pt-3">
        <SectionHeader>Giá cá hôm nay</SectionHeader>
        <PriceBoard />
      </section>

      <section className="pt-5">
        <SectionHeader>Sổ lãi lỗ chuyến biển</SectionHeader>
        <TripLog />
      </section>

      <section className="pt-5 pb-2">
        <SectionHeader>Chia tiền chuyến</SectionHeader>
        <p className="mb-2 px-4 text-[15px] leading-snug text-foreground/70">
          Nhập tiền bán cá và tổn chung — app tự chia theo phần từng người,
          trừ luôn tiền đã ứng.
        </p>
        <TripSplit />
      </section>
    </div>
  );
}
