import { MarketHeader } from "@/components/market/shared/market-header";
import { RequireLogin } from "@/components/require-login";
import { DangTin } from "@/components/viec/dang-tin";

export const metadata = { title: "Đăng tin tuyển — SDFish" };

// ĐĂNG / SỬA TIN TUYỂN (spec 17 §6.1) — `?id=` = sửa. Chỉ vai Chủ tàu đăng được; nháp giữ trong máy.
export default function ViecDangPage() {
  return (
    <div>
      <MarketHeader title="Tin tuyển" fallback="/viec/cua-toi" />
      <RequireLogin what="đăng tin tuyển">
        <DangTin />
      </RequireLogin>
    </div>
  );
}
