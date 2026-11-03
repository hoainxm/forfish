import { ViecScreen } from "@/components/viec/viec-screen";

export const metadata = { title: "Việc làm — SDFish" };

// VIỆC LÀM (spec 17 §6.3) — dock "Việc làm" của vai Đi bạn; chủ tàu vào qua Tàu tôi › Bạn thuyền › Tuyển người.
// Khách xem được danh sách; Gọi mời đăng nhập. Mất sóng đọc bản lưu forfish.viec.v1.
export default function ViecPage() {
  return <ViecScreen />;
}
