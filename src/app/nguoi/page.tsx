import { CrewList } from "@/components/crew-list";
import { PageHeader } from "@/components/page-header";
import { BoatSwitcher } from "@/components/boat-switcher";
import { RequireLogin } from "@/components/require-login";

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
      {/*  ĐỔI `LoginGate` → `RequireLogin` (chủ dự án 2026-09-01): từ nay CẢ
           app cần tài khoản, mà tài khoản KHÔNG tự đăng ký được nữa. Câu cũ
           mời "đăng nhập để lưu hồ sơ… đồng bộ nhiều máy" là chỉ sai đường —
           người chưa có tài khoản bấm vào /login cũng không vào nổi. Thẻ mới
           nói thẳng: gọi SDVICO. */}
      <RequireLogin what="sổ thuyền viên">
        <BoatSwitcher />
        <CrewList />
      </RequireLogin>
    </div>
  );
}
