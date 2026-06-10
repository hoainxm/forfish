import { MaintenanceReminders } from "@/components/maintenance-reminders";
import { SupplyCatalog } from "@/components/supply-catalog";
import { PageHeader } from "@/components/page-header";

export const metadata = { title: "Vật tư & máy — ForFish" };

export default function VanHanhPage() {
  return (
    <div>
      <PageHeader
        kicker="Vật tư & máy · Trục 3"
        title="Vật tư & bảo dưỡng"
        sub="Mua đúng đồ, bảo dưỡng đúng lúc — tàu bền, đỡ tốn."
        toColor="var(--t3)"
      />

      <section className="pt-4">
        <h2 className="display px-4 pb-2 text-[22px] font-bold text-navy">
          Nhắc bảo dưỡng
        </h2>
        <MaintenanceReminders />
      </section>

      <section className="pt-2">
        <h2 className="display px-4 pb-2 text-[22px] font-bold text-navy">
          Bảng giá vật tư
        </h2>
        <SupplyCatalog />
      </section>
    </div>
  );
}
