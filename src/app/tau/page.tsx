import { DocumentVault } from "@/components/document-vault";
import { FinesLookup } from "@/components/fines-lookup";
import { MaintenanceReminders } from "@/components/maintenance-reminders";
import { SupplyCatalog } from "@/components/supply-catalog";
import { PageHeader } from "@/components/page-header";
import { SectionHeader } from "@/components/ui/primitives";

export const metadata = { title: "Tàu của tôi — ForFish" };

// Trục TÀU (tài sản): mọi thứ thuộc con tàu — giấy tờ + tuân thủ, bảo dưỡng,
// vật tư. Thứ tự ưu tiên: giấy tờ (gấp nhất) → bảo dưỡng → vật tư → tra phạt.
export default function TauPage() {
  return (
    <div>
      <PageHeader
        kicker="Tàu của tôi"
        title="Quản lý con tàu"
        sub="Giấy tờ, bảo dưỡng, vật tư — giữ tàu đủ điều kiện ra khơi."
        toColor="var(--t3)"
      />

      <section className="pt-3">
        <SectionHeader>Giấy tờ tàu</SectionHeader>
        <DocumentVault />
      </section>

      <section className="pt-4">
        <SectionHeader>Nhắc bảo dưỡng</SectionHeader>
        <MaintenanceReminders />
      </section>

      <section className="pt-4">
        <SectionHeader>Vật tư & phụ tùng</SectionHeader>
        <SupplyCatalog />
      </section>

      <section className="pt-4">
        <FinesLookup />
      </section>
    </div>
  );
}
