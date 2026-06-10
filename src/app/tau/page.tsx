import { DocumentVault } from "@/components/document-vault";
import { FinesLookup } from "@/components/fines-lookup";
import { MaintenanceReminders } from "@/components/maintenance-reminders";
import { BoatProducts } from "@/components/boat-products";
import { PageHeader } from "@/components/page-header";
import { BoatSwitcher } from "@/components/boat-switcher";
import { Tabs } from "@/components/ui/tabs";

export const metadata = { title: "Tàu của tôi — ForFish" };

// Trục TÀU (tài sản): giấy tờ + tuân thủ, bảo dưỡng, sản phẩm SDVICO + bảo
// hành. Cảng đã chuyển sang nhóm Ra khơi (route /cang). Mọi mục gắn theo
// tàu đang chọn (BoatSwitcher) — 1 chủ có thể có nhiều tàu.
export default function TauPage() {
  return (
    <div>
      <PageHeader
        kicker="Tàu của tôi"
        title="Quản lý con tàu"
        sub="Giấy tờ, bảo dưỡng, sản phẩm — giữ tàu đủ điều kiện ra khơi."
        toColor="var(--t3)"
      />
      <BoatSwitcher />
      <Tabs
        ariaLabel="Mục quản lý tàu"
        tabs={[
          { id: "giay-to", label: "Giấy tờ", content: <DocumentVault /> },
          { id: "bao-duong", label: "Bảo dưỡng", content: <MaintenanceReminders /> },
          { id: "san-pham", label: "Sản phẩm", content: <BoatProducts /> },
          { id: "muc-phat", label: "Mức phạt", content: <FinesLookup /> },
        ]}
      />
    </div>
  );
}
