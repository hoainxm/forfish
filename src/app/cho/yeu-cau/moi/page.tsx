import { RequestForm } from "@/components/market/buyer/market-requests";
import { MarketHeader } from "@/components/market/shared/market-header";
import { RequireLogin } from "@/components/require-login";

export const metadata = { title: "Đặt món không có trên chợ — SDFish" };

// đơn vị Sen Biển gửi đã bỏ dấu ("cai") — đổi lại chữ có dấu cho bà con đọc
const DV: Record<string, string> = { cai: "cái", bo: "bộ", thung: "thùng", cuon: "cuộn", kg: "kg", lit: "lít", tam: "tấm", cay: "cây", bao: "bao", can: "can", chai: "chai" };

export default async function YeuCauMoiPage({ searchParams }: { searchParams: Promise<{ ten?: string; sl?: string; dv?: string }> }) {
  const { ten, sl, dv } = await searchParams;
  const qty = Math.min(9999, Math.max(1, Math.floor(Number(sl) || 1)));
  const unit = typeof dv === "string" && dv ? (DV[dv] ?? dv).slice(0, 20) : "cái";
  return (
    <div>
      <MarketHeader title="Đặt món không có trên chợ" fallback="/cho/yeu-cau" />
      <RequireLogin what="đặt hàng">
        <RequestForm initialTitle={typeof ten === "string" ? ten.slice(0, 120) : ""} initialQty={qty} initialUnit={unit} />
      </RequireLogin>
    </div>
  );
}
