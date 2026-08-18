import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { UrgentStrip } from "@/components/urgent-strip";
import { HeroAccount } from "@/components/hero-account";
import { BoatSwitcher } from "@/components/boat-switcher";
import { UrgentWithInstall } from "@/components/install-prompt";
import { InboxSection } from "@/components/inbox-section";
import { StormBanner } from "@/components/storm-banner";
import {
  AnchorIcon,
  FishIcon,
  PriceIcon,
  UsersIcon,
} from "@/components/icons";

/*
  Home — built for first-time, low-tech users:
  · one glance = "what needs my attention" (urgent strip)
  · one tap   = one of FOUR entities you manage (taxonomy MECE theo đối tượng):
    Ra khơi (chuyến) · Tàu cá (tài sản) · Bạn thuyền (người) · Giao dịch (mua bán)
  Tone: a dependable work tool — plain words, no emoji, no decoration.
*/

// Mô tả thẻ bám CẤU TRÚC 2026-07-27: Ra khơi có dự báo cá; Tàu là kênh CSKH
// SDVICO (giấy tờ + dịch vụ + đồ đã mua); Bạn thuyền = hồ sơ + tra cảnh báo
// CCCD; Giao dịch gọn về đúng việc mua–bán (giá cá / tin mua bán / chỗ bán —
// đã bỏ hẳn lãi lỗ + công nợ).
const pillars = [
  {
    href: "/ngu-truong",
    tone: "t1",
    icon: FishIcon,
    title: "Ra khơi",
    sub: "Dự báo cá, gió sóng, dẫn đường",
  },
  {
    href: "/tau",
    tone: "t3",
    icon: AnchorIcon,
    title: "Tàu cá",
    sub: "Giấy tờ, dịch vụ, đồ SDVICO",
  },
  {
    href: "/nguoi",
    tone: "t4",
    icon: UsersIcon,
    title: "Bạn thuyền",
    sub: "Hồ sơ, giấy tờ, tra cảnh báo",
  },
  {
    href: "/tien",
    tone: "t2",
    icon: PriceIcon,
    title: "Giao dịch",
    sub: "Giá cá, tin mua bán, chỗ bán",
  },
] as const;

export default function Home() {
  return (
    <div>
      <PageHeader kicker="SDFish · Bạn của ngư dân" title="Chào bà con">
        {/* hero chỉ bày MỘT chip tài khoản — cỡ chữ/đăng xuất nằm trong sheet */}
        <HeroAccount />
      </PageHeader>

      <BoatSwitcher />

      <div className="space-y-4 px-4 pt-3">
        {/* TIN BÃO Ở TRANG CHỦ (2026-08-18, audit S10) — tầng 1 tính mạng, đứng
            TRÊN dải khẩn. Ở đây chỉ lên tiếng khi CÓ BÃO hoặc tin bão trong máy
            đã quá cũ >24h / chưa từng có; "không có bão" thì im cho màn chính
            yên (luật ở lib/storms.ts shouldShowStormOnHome). Cùng hook hỏi +
            tự thử lại với bản đồ Ra khơi. */}
        <StormBanner variant="page" />

        {/* Dải khẩn + nhắc cài về máy: nhắc cài tự ẩn khi đã cài / đã tắt /
            trình duyệt không cho cài / mất sóng / dải khẩn ≥3 dòng — xem
            07-design-spec §10.8 + lib/install-nudge.ts */}
        <UrgentWithInstall>
          <UrgentStrip />
        </UrgentWithInstall>

        <section aria-label="Bốn nhóm việc">
          {/* "Quản lý tàu" bán sai app (trùng tiêu đề /tau) — app là 4 việc */}
          <h2 className="display mb-1.5 px-1 text-[1.125rem] font-bold text-navy">
            Bốn việc chính
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {pillars.map((p) => {
              const Icon = p.icon;
              return (
                <Link
                  key={p.href}
                  href={p.href}
                  className="flex min-h-[7.75rem] flex-col justify-between rounded-[1.375rem] p-4 transition active:scale-[0.98]"
                  style={{ backgroundColor: `var(--${p.tone}-bg)` }}
                >
                  <span
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white shadow-sm"
                    style={{ backgroundColor: `var(--${p.tone})` }}
                    aria-hidden
                  >
                    <Icon className="h-7 w-7" />
                  </span>
                  <span className="mt-3 block min-w-0">
                    <span className="display block text-[1.1875rem] font-bold leading-tight text-navy">
                      {p.title}
                    </span>
                    <span className="mt-0.5 block text-[1rem] leading-snug text-foreground/70">
                      {p.sub}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        </section>

        {/* THÔNG BÁO — ngay dưới bốn việc chính (chủ dự án 2026-08-01). Đây là
            chỗ DUY NHẤT đọc lại được tin đã vuốt tắt. Hiện CẢ KHI CHƯA ĐĂNG
            NHẬP (tin gửi chung, 2026-08-01n); chỉ tự ẩn khi chưa có tin nào:
            màn hình chính không được có khối trống. */}
        <InboxSection />

        <p className="pb-2 text-center text-[0.875rem] text-foreground/65">
          Thuận buồm xuôi gió, cá đầy khoang.
        </p>
      </div>
    </div>
  );
}
