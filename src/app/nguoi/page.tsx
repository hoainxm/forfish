import { CrewList } from "@/components/crew-list";
import { PageHeader } from "@/components/page-header";
import { BoatSwitcher } from "@/components/boat-switcher";

export const metadata = { title: "Bạn thuyền — SDFish" };

// Trục NGƯỜI (lao động), cấu trúc 2026-07-27: hồ sơ thuyền viên (định danh
// CCCD) + chứng chỉ/bảo hiểm + tra cảnh báo chéo trước khi nhận người
// (premium). KHÔNG dính tiền — sổ ứng/chia tiền đã gỡ hẳn.
export default function NguoiPage() {
  return (
    <div>
      <PageHeader
        kicker="Bạn thuyền"
        title="Sổ thuyền viên"
        sub="Hồ sơ, chứng chỉ, bảo hiểm — tra cảnh báo trước khi nhận bạn mới."
        toColor="var(--t4)"
      />
      <BoatSwitcher />
      <CrewList />
    </div>
  );
}
