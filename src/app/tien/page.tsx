import { TradeHub } from "@/components/trade-hub";
import { ManHeader } from "@/components/man-header";

export const metadata = { title: "Chợ cá — SDFish" };

// Trục GIAO DỊCH (user chốt 2026-07-27 — gộp về đúng 1 việc: mua–bán):
// thông tin được cấp để bán có lợi thế — giá cá hôm nay, tin mua/bán
// (chủ tàu đăng tin bán / tin mua, đầu nậu–nhà máy đăng tin cần mua),
// và danh bạ đầu mối bán. Bỏ Hiệu quả + Công nợ khỏi tab này.
export default function TienPage() {
  return (
    <div>
      {/* CHỢ CÁ (dock 2026-10-19, trước là "Giao dịch") — đầu màn gọn nền sáng */}
      <ManHeader title="Chợ cá" sub="Giá cá, tin mua bán, chỗ thu mua." />
      {/* Giao dịch (giá cá tham khảo) để PUBLIC — nắm giá là quyền lợi chung,
          không bắt đăng nhập. Sổ lãi lỗ + công nợ là data cá nhân → khóa. */}
      {/* Bỏ BoatSwitcher (2026-10-19): chọn tàu chỉ ở Hồ sơ tàu — tin đăng chỉ ĐIỀN SẴN tên/tỉnh tàu đang chọn, sửa được */}
      <TradeHub />
    </div>
  );
}
