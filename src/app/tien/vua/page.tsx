import { MarketHeader } from "@/components/market/shared/market-header";
import { RequireLogin } from "@/components/require-login";
import { VuaProfileForm } from "@/components/vua-profile-form";

export const metadata = { title: "Hồ sơ vựa — SDFish" };

// HỒ SƠ VỰA (spec 17 §12.4) — vựa · nậu · nhà máy · chợ tự khai để hiện ở Chợ cá › Đầu mối sau khi SDVICO duyệt.
// Lối vào: dòng "Hồ sơ" đầu mục Đầu mối, chỉ hiện cho vai Thu mua; vai khác vẫn mở được bằng link.
export default function VuaPage() {
  return (
    <div>
      <MarketHeader title="Hồ sơ vựa" fallback="/tien?muc=dau-moi" />
      <RequireLogin what="hồ sơ vựa">
        <div className="mt-2">
          <VuaProfileForm />
        </div>
      </RequireLogin>
    </div>
  );
}
