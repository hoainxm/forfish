import { CrewList } from "@/components/crew-list";
import { ManHeader } from "@/components/man-header";
import { TauToiNav } from "@/components/tau-toi-nav";
import { RequireLogin } from "@/components/require-login";

export const metadata = { title: "Bạn thuyền — SDFish" };

// Trục NGƯỜI (lao động), cấu trúc 2026-07-27: hồ sơ thuyền viên (định danh
// CCCD) + chứng chỉ/bảo hiểm + tra cảnh báo chéo trước khi nhận người
// (premium). KHÔNG dính tiền — sổ ứng/chia tiền đã gỡ hẳn.
export default function NguoiPage() {
  return (
    <div>
      {/* TÀU TÔI › Bạn thuyền (dock 2026-10-19) — cùng đầu màn + thanh với /tau */}
      <ManHeader title="Tàu tôi" />
      <TauToiNav />
      {/*  ĐỔI `LoginGate` → `RequireLogin` (chủ dự án 2026-09-01): từ nay CẢ
           app cần tài khoản. Người ngoài tự đăng ký lại được (2026-09-23) —
           thẻ khoá mời TẠO tài khoản hoặc đăng nhập, không còn bắt gọi SDVICO. */}
      <RequireLogin what="sổ thuyền viên">
        {/* Bỏ BoatSwitcher (2026-10-19): sổ bạn thuyền là danh bạ CHUNG của chủ tàu, bộ chọn tàu ở đây làm tưởng danh sách bị lọc */}
        <CrewList />
      </RequireLogin>
    </div>
  );
}
