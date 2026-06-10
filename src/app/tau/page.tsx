import { DocumentVault } from "@/components/document-vault";
import { FinesLookup } from "@/components/fines-lookup";
import { MaintenanceReminders } from "@/components/maintenance-reminders";
import { SupplyCatalog } from "@/components/supply-catalog";
import { PortDirectory } from "@/components/port-directory";
import { PageHeader } from "@/components/page-header";
import { Tabs } from "@/components/ui/tabs";

export const metadata = { title: "Tàu của tôi — ForFish" };

// Trục TÀU (tài sản): giấy tờ + tuân thủ, bảo dưỡng, vật tư.
// Tách tab trong trang thay vì cuộn dọc dài.
export default function TauPage() {
  return (
    <div>
      <PageHeader
        kicker="Tàu của tôi"
        title="Quản lý con tàu"
        sub="Giấy tờ, bảo dưỡng, vật tư — giữ tàu đủ điều kiện ra khơi."
        toColor="var(--t3)"
      />
      <Tabs
        ariaLabel="Mục quản lý tàu"
        tabs={[
          { id: "giay-to", label: "Giấy tờ", content: <DocumentVault /> },
          { id: "bao-duong", label: "Bảo dưỡng", content: <MaintenanceReminders /> },
          { id: "vat-tu", label: "Vật tư", content: <SupplyCatalog /> },
          { id: "cang", label: "Cảng", content: <PortDirectory /> },
          { id: "muc-phat", label: "Mức phạt", content: <FinesLookup /> },
        ]}
      />
    </div>
  );
}
