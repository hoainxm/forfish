import Link from "next/link";
import { MyRequests } from "@/components/market/buyer/market-requests";
import { MarketHeader } from "@/components/market/shared/market-header";
import { RequireLogin } from "@/components/require-login";
import { NHAN } from "@/lib/labels";

export const metadata = { title: "Yêu cầu đặt hàng — SDFish" };

export default function YeuCauPage() {
  return (
    <div>
      {/* VT-20: "+ Đặt món" là nút phụ ở header (như FB/Shopee), không phải nút cam 3.75rem đầu màn */}
      <MarketHeader
        title="Yêu cầu đặt hàng"
        fallback="/cho"
        right={<Link href="/cho/yeu-cau/moi" className="sq-btn mr-2 bg-field text-navy">+ {NHAN.datMon}</Link>}
      />
      <RequireLogin what="yêu cầu đặt hàng">
        <MyRequests />
      </RequireLogin>
    </div>
  );
}
