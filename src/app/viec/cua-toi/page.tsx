import { MarketHeader } from "@/components/market/shared/market-header";
import { RequireLogin } from "@/components/require-login";
import { TinCuaToi } from "@/components/viec/tin-cua-toi";

export const metadata = { title: "Tuyển người — SDFish" };

// TUYỂN NGƯỜI · TIN CỦA TÔI (spec 17 §12.3, AC7) — đang mở / hết hạn / đủ người; Gia hạn · Đủ người · Sửa.
export default function ViecCuaToiPage() {
  return (
    <div>
      <MarketHeader title="Tuyển người" fallback="/nguoi" />
      <RequireLogin what="tin tuyển của bà con">
        <TinCuaToi />
      </RequireLogin>
    </div>
  );
}
