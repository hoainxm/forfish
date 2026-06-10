import { DocumentVault } from "@/components/document-vault";
import { FinesLookup } from "@/components/fines-lookup";
import { BoatServices } from "@/components/boat-services";
import { BoatProducts } from "@/components/boat-products";
import { PageHeader } from "@/components/page-header";
import { BoatSwitcher } from "@/components/boat-switcher";
import { Tabs } from "@/components/ui/tabs";

export const metadata = { title: "Tàu của tôi — ForFish" };

// Trục TÀU (tài sản) — ForFish là kênh CSKH của SDVICO: giấy tờ + tuân thủ,
// DỊCH VỤ (sửa chữa/bảo dưỡng/cước + sổ nhắc tự ghi), sản phẩm SDVICO
// (đã mua → bảo hành; chưa mua → gợi ý + nút hỏi mua). Cảng đã chuyển sang
// nhóm Ra khơi (/cang). Mọi mục gắn theo tàu đang chọn (BoatSwitcher).
export default function TauPage() {
  return (
    <div>
      <PageHeader
        kicker="Tàu của tôi"
        title="Quản lý con tàu"
        sub="Giấy tờ, dịch vụ, sản phẩm — giữ tàu đủ điều kiện ra khơi."
        toColor="var(--t3)"
      />
      <BoatSwitcher />
      <Tabs
        ariaLabel="Mục quản lý tàu"
        tabs={[
          { id: "giay-to", label: "Giấy tờ", content: <DocumentVault /> },
          { id: "dich-vu", label: "Dịch vụ", content: <BoatServices /> },
          { id: "san-pham", label: "Sản phẩm", content: <BoatProducts /> },
          { id: "muc-phat", label: "Mức phạt", content: <FinesLookup /> },
        ]}
      />
    </div>
  );
}
