import { AnchorIcon } from "@/components/icons";
import { TauTabs } from "@/components/tau-tabs";
import { RequireLogin } from "@/components/require-login";
import "@/components/market/market-ui.css";
import "./tau.css";

export const metadata = { title: "Tàu cá — SDFish" };

// Trục TÀU (tài sản) — ForFish là kênh CSKH của SDVICO: giấy tờ + tuân thủ,
// DỊCH VỤ (sửa chữa/bảo dưỡng/cước + sổ nhắc tự ghi), sản phẩm SDVICO
// (đã mua → bảo hành; chưa mua → gợi ý + nút hỏi mua). Cảng đã chuyển sang
// nhóm Ra khơi (/cang). Mọi mục gắn theo tàu đang chọn (BoatSwitcher).
// Tabs trong TauTabs (client) — banner nợ quá hạn + badge + deep-link ?tab=.
export default function TauPage() {
  return (
    <div className="tau-workspace market-ui">
      {/* Rút bỏ vế liệt kê "Giấy tờ, dịch vụ, sản phẩm" khỏi sub (D1): ĐÚNG BA
          TỪ đó là nhãn ba tab hiện ngay bên dưới. */}
      <header className="tau-header flex items-center gap-3 bg-navy px-4 pb-4 text-white">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10"><AnchorIcon className="h-7 w-7" /></span>
        <div><h1 className="display text-2xl font-bold leading-tight">Tàu cá</h1><p className="mt-1 text-[0.9375rem] text-white/80">Chăm tàu, mua đồ, theo dõi đơn.</p></div>
      </header>
      {/*  CẢ MÀN CẦN TÀI KHOẢN (chủ dự án 2026-09-01). Tiêu đề vẫn hiện để
           người chưa có tài khoản biết mình đang đứng ở đâu, và thẻ khoá nói
           thẳng phải gọi SDVICO. */}
      <RequireLogin what="hồ sơ tàu">
        <TauTabs />
      </RequireLogin>
    </div>
  );
}
