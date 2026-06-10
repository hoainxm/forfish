import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { UrgentStrip } from "@/components/urgent-strip";
import { AccountBar } from "@/components/account-bar";
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

const pillars = [
  {
    href: "/ngu-truong",
    tone: "t1",
    icon: FishIcon,
    title: "Ra khơi",
    sub: "Hôm nay đi biển được không?",
  },
  {
    href: "/tau",
    tone: "t3",
    icon: AnchorIcon,
    title: "Tàu của tôi",
    sub: "Giấy tờ, bảo dưỡng, vật tư",
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
    sub: "Giá cá, lãi lỗ, chia tiền",
  },
] as const;

export default function Home() {
  return (
    <div>
      <PageHeader
        kicker="ForFish · Bạn của ngư dân"
        title="Chào bà con"
      />

      <BoatSwitcher />

      <div className="space-y-4 px-4 pt-3">
        <AccountBar />
        <UrgentStrip />

        <section aria-label="Bốn nhóm việc">
          <h2 className="display mb-1.5 px-1 text-[18px] font-bold text-navy">
            Quản lý tàu
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {pillars.map((p) => {
              const Icon = p.icon;
              return (
                <Link
                  key={p.href}
                  href={p.href}
                  className="flex min-h-[124px] flex-col justify-between rounded-[22px] p-4 transition active:scale-[0.98]"
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
                    <span className="display block text-[19px] font-bold leading-tight text-navy">
                      {p.title}
                    </span>
                    <span className="mt-0.5 block text-[14px] leading-snug text-foreground/60">
                      {p.sub}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        </section>

        <p className="pb-2 text-center text-[14px] text-foreground/40">
          Thuận buồm xuôi gió, cá đầy khoang.
        </p>
      </div>
    </div>
  );
}
