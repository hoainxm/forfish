import { PageHeader } from "@/components/page-header";
import { BoatSwitcher } from "@/components/boat-switcher";
import { TauTabs } from "@/components/tau-tabs";

export const metadata = { title: "Tàu của tôi — SDFish" };

// Trục TÀU (tài sản) — ForFish là kênh CSKH của SDVICO: giấy tờ + tuân thủ,
// DỊCH VỤ (sửa chữa/bảo dưỡng/cước + sổ nhắc tự ghi), sản phẩm SDVICO
// (đã mua → bảo hành; chưa mua → gợi ý + nút hỏi mua). Cảng đã chuyển sang
// nhóm Ra khơi (/cang). Mọi mục gắn theo tàu đang chọn (BoatSwitcher).
// Tabs trong TauTabs (client) — banner nợ quá hạn + badge + deep-link ?tab=.
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
      <TauTabs />
    </div>
  );
}
