import { PortDirectory } from "@/components/port-directory";
import { PageHeader } from "@/components/page-header";

export const metadata = { title: "Danh bạ cảng — ForFish" };

// Danh bạ cảng cá chỉ định, lọc theo vùng tàu — thuộc nhóm Ra khơi
// (vào từ nút nổi trên bản đồ /ngu-truong), KHÔNG để trong Quản lý con tàu.
export default function CangPage() {
  return (
    <div>
      <PageHeader
        kicker="Ra khơi · Cảng cá"
        title="Danh bạ cảng gần tôi"
        sub="Cảng chỉ định để bốc dỡ, bán cá, làm thủ tục — lọc theo tỉnh tàu."
        toColor="var(--t1)"
      />
      <PortDirectory />
    </div>
  );
}
