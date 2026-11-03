import { MarketHeader } from "@/components/market/shared/market-header";
import { DocumentVault } from "@/components/document-vault";
import { RequireLogin } from "@/components/require-login";
import { ToastHost } from "@/components/ui/toast";
import { NHAN } from "@/lib/labels";
import "@/components/market/market-ui.css";
import "../../tau/tau.css";

export const metadata = { title: "Giấy tờ của tôi — SDFish" };

/*  GIẤY TỜ CỦA TÔI (17 §12.2, 2026-11-03) — người đi bạn không có tàu vẫn có giấy riêng sắp hết hạn (chứng chỉ thuyền
    viên, sổ thuyền viên, CCCD), và chủ tàu hỏi tới khi tuyển. Dùng lại ĐÚNG tủ giấy tờ (`DocumentVault rieng`): cùng kho
    trong máy, cùng ảnh, cùng nhắc hạn — giấy gắn chủ là NGƯỜI (`PERSONAL_OWNER_ID`), không gắn tàu. Dữ liệu nằm sẵn
    trong máy ⇒ mất sóng vẫn xem/nhập được; chỉ chụp giấy + xem ảnh chưa cất là cần sóng. */
export default function GiayCuaToiPage() {
  return (
    <div className="tau-workspace market-ui">
      {/* màn con của Việc làm ⇒ đầu màn có "‹" như các màn /viec/* khác (về /viec khi không có lịch sử) */}
      <MarketHeader title={NHAN.giayTo} fallback="/viec" />
      <RequireLogin what="giấy tờ của tôi">
        <section aria-label="Giấy tờ của tôi" className="pt-2">
          <DocumentVault rieng />
        </section>
      </RequireLogin>
      {/* biên nhận nổi (xoá có Hoàn tác) — dự phòng tới khi vỏ app gắn <ToastHost/>; host thứ hai tự im */}
      <ToastHost />
    </div>
  );
}
