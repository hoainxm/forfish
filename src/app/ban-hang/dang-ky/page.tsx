import { PageHeader } from "@/components/page-header";
import { RequireLogin } from "@/components/require-login";
import { ShopRegister } from "@/components/market/seller/shop-register";

export const metadata = { title: "Đăng ký gian hàng — SDFish" };

export default function DangKyShopPage() {
  return (
    <div>
      <PageHeader
        kicker="Kênh người bán"
        title="Đăng ký gian hàng"
        sub="Điền vài dòng, SDVICO duyệt trong 1–2 ngày làm việc."
        toColor="var(--t3)"
      />
      <RequireLogin what="kênh người bán">
        <div className="mt-4">
          <ShopRegister />
        </div>
      </RequireLogin>
    </div>
  );
}
