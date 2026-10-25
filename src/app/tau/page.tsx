import { ManHeader } from "@/components/man-header";
import { TauToiNav } from "@/components/tau-toi-nav";
import { TauTabs } from "@/components/tau-tabs";
import { RequireLogin } from "@/components/require-login";
import { ToastHost } from "@/components/ui/toast";
import "@/components/market/market-ui.css";
import "./tau.css";

export const metadata = { title: "Tàu tôi — SDFish" };

// Trục TÀU (tài sản) — ForFish là kênh CSKH của SDVICO: giấy tờ + tuân thủ,
// DỊCH VỤ (sửa chữa/bảo dưỡng/cước + sổ nhắc tự ghi), sản phẩm SDVICO
// (đã mua → bảo hành; chưa mua → gợi ý + nút hỏi mua). Cảng đã chuyển sang
// nhóm Ra khơi (/cang). Mọi mục gắn theo tàu đang chọn (BoatSwitcher).
// Tabs trong TauTabs (client) — banner nợ quá hạn + badge + deep-link ?tab=.
export default function TauPage() {
  return (
    <div className="tau-workspace market-ui">
      {/*  TÀU TÔI (dock 2026-10-19): đầu màn gọn nền sáng + thanh Hồ sơ tàu | Bạn thuyền.
           Cửa hàng + Đơn KHÔNG còn ở đây — đã là mục dock Vật tư (một việc một chỗ). */}
      <ManHeader title="Tàu tôi" />
      <TauToiNav />
      {/*  CẢ MÀN CẦN TÀI KHOẢN (chủ dự án 2026-09-01). Tiêu đề vẫn hiện để
           người chưa có tài khoản biết mình đang đứng ở đâu. */}
      <RequireLogin what="hồ sơ tàu">
        <TauTabs />
      </RequireLogin>
      {/* biên nhận nổi (xoá có Hoàn tác, "Đã ghi: làm hôm nay") — dự phòng tới khi vỏ app gắn <ToastHost/>; host thứ hai tự im */}
      <ToastHost />
    </div>
  );
}
