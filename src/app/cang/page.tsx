import { CangHeader, PortDirectory } from "@/components/port-directory";
import { RequireLogin } from "@/components/require-login";

export const metadata = { title: "Danh bạ cảng — SDFish" };

// Danh bạ cảng cá chỉ định, lọc theo vùng tàu — thuộc nhóm Ra khơi. Đường vào:
// hàng "Cảng gần đây ›" trong phần Xem đủ của ngăn gió sóng trên bản đồ
// /ngu-truong (BD-01, 2026-10-25) + Sen Biển giọng nói. KHÔNG để trong Quản lý
// con tàu. Tiêu đề là client (theo tỉnh cảng nhà) — xem CangHeader.
export default function CangPage() {
  return (
    <div>
      <CangHeader />
      <RequireLogin what="danh bạ cảng cá">
        <PortDirectory />
      </RequireLogin>
    </div>
  );
}
