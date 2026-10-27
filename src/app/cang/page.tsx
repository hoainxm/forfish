import { CangHeader, PortDirectory } from "@/components/port-directory";

export const metadata = { title: "Danh bạ cảng — SDFish" };

// Danh bạ cảng cá chỉ định, lọc theo vùng tàu — thuộc nhóm Ra khơi. Đường vào:
// hàng "Cảng gần đây ›" trong phần Xem đủ của ngăn gió sóng trên bản đồ
// /ngu-truong (BD-01, 2026-10-25) + Sen Biển giọng nói. KHÔNG để trong Quản lý
// con tàu. Tiêu đề là client (theo tỉnh cảng nhà) — xem CangHeader.
export default function CangPage() {
  return (
    <div>
      <CangHeader />
      {/* KHÁCH XEM ĐƯỢC (2026-10-27, anh Long: "cho bà con xem các tính năng miễn phí, chỉ có vào bản đồ là bắt
          đăng nhập mua gói") — danh bạ là dữ liệu tĩnh trong bundle, không gọi mạng. */}
      <PortDirectory />
    </div>
  );
}
