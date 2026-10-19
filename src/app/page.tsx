import { ManHeader } from "@/components/man-header";
import { UrgentStrip } from "@/components/urgent-strip";
import { HeroAccount } from "@/components/hero-account";
import { UrgentWithInstall } from "@/components/install-prompt";
import { InboxSection } from "@/components/inbox-section";
import { StormBanner } from "@/components/storm-banner";
import { TideHomeCard } from "@/components/tide-home-card";

/*
  TRANG CHỦ — "hôm nay có gì cần biết, cần làm" (làm lại 2026-10-19, dock 5 mục
  Trang chủ · Bản đồ · Tàu tôi · Chợ cá · Vật tư; rà design Codex).
  Thứ tự = thứ tự quan trọng:
    1. TIN BÃO THƯỜNG TRỰC — có bão / không có bão + giờ hỏi / không hỏi được +
       tuổi tin; luôn một dòng, không bao giờ im (chủ dự án chốt).
    2. Việc cần làm (giấy tờ sắp hết hạn, bảo dưỡng, nợ…) + nhắc cài về máy.
    3. Thông báo — đọc được ngay, tin mới đánh dấu.
    4. Con nước cảng nhà.
  BỎ bốn thẻ nhóm việc (Ra khơi/Tàu cá/Bạn thuyền/Giao dịch): chúng nhắc lại đúng
  dock bên dưới. BỎ bộ chọn tàu: chọn tàu chỉ ở Tàu tôi › Hồ sơ tàu. Sen Biển là
  icon nổi (app-shell) — không có khối riêng ở đây.
  Tone: công cụ làm việc tin cậy — chữ đời thường, không emoji, không trang trí.
*/
export default function Home() {
  return (
    <div>
      <ManHeader compact title="Chào bà con" right={<HeroAccount light />} />
      <div className="space-y-5 px-4 pt-1">
        <StormBanner variant="page" always />
        <UrgentWithInstall>
          <UrgentStrip />
        </UrgentWithInstall>
        <InboxSection />
        <TideHomeCard />
      </div>
    </div>
  );
}
