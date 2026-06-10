import { CrewList } from "@/components/crew-list";
import { PageHeader } from "@/components/page-header";
import { BoatSwitcher } from "@/components/boat-switcher";

export const metadata = { title: "Bạn thuyền — ForFish" };

// Trục NGƯỜI (lao động): hồ sơ thuyền viên + chứng chỉ/bảo hiểm + hạn.
// Chia tiền chuyến đã chuyển sang trục TIỀN (/tien) cho gọn taxonomy.
export default function NguoiPage() {
  return (
    <div>
      <PageHeader
        kicker="Bạn thuyền"
        title="Sổ thuyền viên"
        sub="Hồ sơ, chứng chỉ, bảo hiểm — đủ giấy trước khi ra khơi, khỏi bị phạt."
        toColor="var(--t4)"
      />
      <BoatSwitcher />
      <CrewList />
    </div>
  );
}
