import { PageHeader } from "@/components/page-header";
import { BoatSwitcher } from "@/components/boat-switcher";
import { TauTabs } from "@/components/tau-tabs";
import { RequireLogin } from "@/components/require-login";

export const metadata = { title: "Tàu cá — SDFish" };

// Trục TÀU (tài sản) — ForFish là kênh CSKH của SDVICO: giấy tờ + tuân thủ,
// DỊCH VỤ (sửa chữa/bảo dưỡng/cước + sổ nhắc tự ghi), sản phẩm SDVICO
// (đã mua → bảo hành; chưa mua → gợi ý + nút hỏi mua). Cảng đã chuyển sang
// nhóm Ra khơi (/cang). Mọi mục gắn theo tàu đang chọn (BoatSwitcher).
// Tabs trong TauTabs (client) — banner nợ quá hạn + badge + deep-link ?tab=.
export default function TauPage() {
  return (
    <div>
      {/* Rút bỏ vế liệt kê "Giấy tờ, dịch vụ, sản phẩm" khỏi sub (D1): ĐÚNG BA
          TỪ đó là nhãn ba tab hiện ngay bên dưới. */}
      <PageHeader
        kicker="Quản lý tàu"
        title="Tàu cá"
        sub="Theo dõi hồ sơ để tàu luôn đủ điều kiện ra khơi."
        toColor="var(--t3)"
      />
      {/*  CẢ MÀN CẦN TÀI KHOẢN (chủ dự án 2026-09-01). Tiêu đề vẫn hiện để
           người chưa có tài khoản biết mình đang đứng ở đâu, và thẻ khoá nói
           thẳng phải gọi SDVICO. */}
      <RequireLogin what="hồ sơ tàu">
        <BoatSwitcher />
        <TauTabs />
      </RequireLogin>
    </div>
  );
}
