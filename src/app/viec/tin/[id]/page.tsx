import { MarketHeader } from "@/components/market/shared/market-header";
import { ViecChiTiet } from "@/components/viec/viec-chi-tiet";

export const metadata = { title: "Tin tuyển — SDFish" };

// CHI TIẾT TIN TUYỂN (spec 17 §12.2). Đọc không cần tài khoản; Gọi/Zalo cần đăng nhập; mất sóng đọc bản lưu.
export default async function ViecTinPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div>
      <MarketHeader title="Tin tuyển" fallback="/viec" />
      <ViecChiTiet id={id} />
    </div>
  );
}
