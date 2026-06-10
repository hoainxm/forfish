import { PageHeader } from "@/components/page-header";
import { PriceBoard } from "@/components/price-board";
import { TripLog } from "@/components/trip-log";

export const metadata = { title: "Bán cá — ForFish" };

export default function GiaCaPage() {
  return (
    <div>
      <PageHeader
        kicker="Bán cá · Trục 2"
        title="Giá cá & sổ lãi lỗ"
        sub="Biết giá trước khi bán, biết lời lỗ sau mỗi chuyến."
        toColor="var(--t2)"
      />

      <div className="px-4 pt-1">
        <section>
          <h2 className="display mb-3 text-[22px] font-bold text-navy">
            Giá cá hôm nay
          </h2>
          <PriceBoard />
        </section>

        <section className="mt-8">
          <h2 className="display mb-3 text-[22px] font-bold text-navy">
            Sổ lãi lỗ chuyến biển
          </h2>
          <TripLog />
        </section>
      </div>
    </div>
  );
}
