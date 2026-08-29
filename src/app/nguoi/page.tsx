import { CrewList } from "@/components/crew-list";
import { PageHeader } from "@/components/page-header";
import { BoatSwitcher } from "@/components/boat-switcher";
import { LoginGate } from "@/components/login-gate";

export const metadata = { title: "Bạn thuyền — SDFish" };

// Trục NGƯỜI (lao động), cấu trúc 2026-07-27: hồ sơ thuyền viên (định danh
// CCCD) + chứng chỉ/bảo hiểm + tra cảnh báo chéo trước khi nhận người
// (premium). KHÔNG dính tiền — sổ ứng/chia tiền đã gỡ hẳn.
export default function NguoiPage() {
  return (
    <div>
      {/* Bỏ prop sub (D1): chỉ giải thích màn này là gì — tiêu đề "Sổ thuyền
          viên" ngay trên đã nói xong, mà 41px đó nằm trong ngân sách 380px bị ăn
          trước khi thấy người đầu tiên. */}
      <PageHeader
        kicker="Bạn thuyền"
        title="Sổ thuyền viên"
        toColor="var(--t4)"
      />
      <LoginGate
        feature="sổ thuyền viên"
        blurb="Đăng nhập để lưu hồ sơ, chứng chỉ, bảo hiểm thuyền viên — dữ liệu riêng của bạn, đồng bộ nhiều máy."
        accent="t4"
      >
        <BoatSwitcher />
        <CrewList />
      </LoginGate>
    </div>
  );
}
