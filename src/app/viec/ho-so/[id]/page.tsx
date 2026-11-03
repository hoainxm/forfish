import { MarketHeader } from "@/components/market/shared/market-header";
import { RequireLogin } from "@/components/require-login";
import { HoSoChiTiet } from "@/components/viec/ho-so-chi-tiet";

export const metadata = { title: "Người tìm tàu — SDFish" };

// CHI TIẾT HỒ SƠ TÌM TÀU (spec 17 §12.3) — chỉ vai Chủ tàu xem được (route gác 403 `vai`).
export default async function ViecHoSoChiTietPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div>
      <MarketHeader title="Người tìm tàu" fallback="/viec?tab=nguoi" />
      <RequireLogin what="hồ sơ người tìm tàu">
        <HoSoChiTiet id={id} />
      </RequireLogin>
    </div>
  );
}
