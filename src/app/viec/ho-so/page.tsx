import { MarketHeader } from "@/components/market/shared/market-header";
import { RequireLogin } from "@/components/require-login";
import { HoSoForm } from "@/components/viec/ho-so-form";

export const metadata = { title: "Hồ sơ tìm tàu — SDFish" };

// HỒ SƠ TÌM TÀU CỦA TÔI (spec 17 §6.2) — một SĐT một hồ sơ, mọi vai đăng được.
export default function ViecHoSoPage() {
  return (
    <div>
      <MarketHeader title="Hồ sơ tìm tàu" fallback="/viec" />
      <RequireLogin what="hồ sơ tìm tàu">
        <HoSoForm />
      </RequireLogin>
    </div>
  );
}
