import { ManHeader } from "@/components/man-header";
import { UrgentStrip } from "@/components/urgent-strip";
import { HeroAccount, KickedNotice } from "@/components/hero-account";
import { UrgentWithInstall } from "@/components/install-prompt";
import { InboxSection } from "@/components/inbox-section";
import { StormBanner } from "@/components/storm-banner";
import { TideHomeCard } from "@/components/tide-home-card";
import { HomeDauTrang } from "@/components/home-giu-cho";
import { DocRemindOnOpen } from "@/components/doc-remind-on-open";
import { KhuyenMaiCard } from "@/components/khuyen-mai-card";

/*
  TRANG CHỦ — "hôm nay có gì cần biết, cần làm" (làm lại 2026-10-19, dock 5 mục
  Trang chủ · Bản đồ · Tàu tôi · Chợ cá · Vật tư; rà design Codex).
  Thứ tự = thứ tự quan trọng:
    1. TIN BÃO THƯỜNG TRỰC — có bão / không có bão + giờ hỏi / không hỏi được +
       tuổi tin; luôn một dòng, không bao giờ im (chủ dự án chốt).
    2. Việc cần làm (giấy tờ sắp hết hạn, bảo dưỡng, nợ…) + nhắc cài về máy.
    3. Thông báo — đọc được ngay, tin mới đánh dấu.
    4. Con nước cảng nhà.
  2026-10-22 (rà Taste "màn trả lời câu hỏi của nó bằng khối to nhất"): ngay dưới tin
  bão là thẻ BIỂN HÔM NAY ở cảng nhà (mô tả, không phán đi/không) — câu bà con hỏi
  mỗi sáng; chữ trạng thái 1.5rem là chữ to nhất màn, ngang tiêu đề.
  BỎ bốn thẻ nhóm việc (Ra khơi/Tàu cá/Bạn thuyền/Giao dịch): chúng nhắc lại đúng
  dock bên dưới. BỎ bộ chọn tàu: chọn tàu chỉ ở Tàu tôi › Hồ sơ tàu. Sen Biển là
  icon nổi (app-shell) — không có khối riêng ở đây.
  Tone: công cụ làm việc tin cậy — chữ đời thường, không emoji, không trang trí.
*/
/*
  Rà design Codex lần 2 (2026-10-19): header chỉ còn tiêu đề + MỘT chip nhãn cố
  định; thẻ "tài khoản đang dùng ở máy khác" ra khỏi header, đứng ngay dưới tin
  bão, nguyên bề ngang (trước bị ép vào hàng tiêu đề, vỡ 13 dòng).
*/
export default function Home() {
  return (
    <div>
      <ManHeader title="Chào bà con" right={<HeroAccount light />} />
      <div className="space-y-5 px-4 pt-1">
        <div className="space-y-3">
          {/* GIỮ CHỖ tin bão (review B-P2-1): "Đang hỏi tin bão…" cao 1 hàng, rồi nở thành hàng "Không có
              tin bão · Hỏi lúc" 2 dòng ⇒ đẩy cả màn. Khung lưới cao bằng trạng thái yên (4rem), con kéo giãn
              lấp đủ. nợ: băng vàng "không hỏi được" 3 dòng ở 360px vẫn nở thêm ≈1.4rem; nâng khi
              storm-banner có câu ngắn 2 dòng cho Trang chủ. */}
          <div className="grid min-h-[4rem]">
            <StormBanner variant="page" always />
          </div>
          <KickedNotice />
          {/* Biển hôm nay + việc cần làm/tầng 5 dùng chung MỘT ô giữ chỗ (khung chờ 1 hàng, lỗi ⇒ câu + Thử lại) */}
          <HomeDauTrang>
            <UrgentWithInstall>
              <UrgentStrip />
            </UrgentWithInstall>
          </HomeDauTrang>
        </div>
        {/* Nhắc hạn giấy tờ KHI MỞ APP (2026-10-20, đồng bộ từ sdvico 2026-10-27) —
            sheet theo lịch mốc 30·25·20·15·10 rồi hằng ngày 5→0, mỗi mốc 1 lần,
            đọc kho máy; nhường tin bão. Xem lib/doc-reminder-local + 07 §12. */}
        <DocRemindOnOpen />
        {/* Ưu đãi SDVICO (2026-10-26, tin của Quân): một thẻ, dưới việc cần làm, trên Thông
            báo — không tranh chỗ với tin bão/việc gấp; đã đăng ký thì thẻ đổi trạng thái. */}
        <KhuyenMaiCard />
        <InboxSection />
        <TideHomeCard />
      </div>
    </div>
  );
}
