import { Suspense } from "react";
import { PhieuHoiMua } from "@/components/sdvico-phieu-hoi-mua";
import { MarketHeader } from "@/components/market/shared/market-header";

export const metadata = { title: "Nhờ SDVICO gọi lại — SDFish" };

/** Phiếu riêng để lại SĐT + số tàu + cảng lắp (14 §3.14) — mở từ thẻ SDVICO trả lời dưới bình luận Kairos. */
export default function HoiMuaPage() {
  return (
    <div>
      <MarketHeader fallback="/kairos" />
      <Suspense fallback={null}>
        <PhieuHoiMua />
      </Suspense>
    </div>
  );
}
