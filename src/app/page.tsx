import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { UrgentStrip } from "@/components/urgent-strip";
import { HeroAccount } from "@/components/hero-account";
import { BoatSwitcher } from "@/components/boat-switcher";
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
    Ra khơi (chuyến) · Tàu của tôi (tài sản) · Bạn thuyền (người) · Sổ tiền (tiền)
  Tone: a dependable work tool — plain words, no emoji, no decoration.
*/

// Mô tả thẻ bám CẤU TRÚC MỚI (2026-06-10): Ra khơi có dự báo cá; Tàu là
// kênh CSKH SDVICO (dịch vụ + đồ đã mua); Tiền tách giao dịch / hiệu quả.
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
    title: "Tàu của tôi",
    sub: "Giấy tờ, dịch vụ, đồ SDVICO",
  },
  {
    href: "/nguoi",
    tone: "t4",
    icon: UsersIcon,
    title: "Bạn thuyền",
    sub: "Hồ sơ, chứng chỉ, bảo hiểm",
  },
  {
    href: "/tien",
    tone: "t2",
    icon: PriceIcon,
    title: "Sổ tiền",
    sub: "Giá cá, ai cần mua, lãi lỗ",
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
        <UrgentStrip />

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
                    <span className="mt-0.5 block text-[0.875rem] leading-snug text-foreground/70">
                      {p.sub}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        </section>

        <p className="pb-2 text-center text-[0.875rem] text-foreground/65">
          Thuận buồm xuôi gió, cá đầy khoang.
        </p>
      </div>
    </div>
  );
}
