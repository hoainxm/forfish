import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { UrgentStrip } from "@/components/urgent-strip";
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

      <div className="space-y-4 px-4 pt-3">
        <UrgentStrip />

        <section aria-label="Bốn nhóm việc">
          <h2 className="display mb-1.5 px-1 text-[16px] font-bold text-navy">
            Quản lý tàu
          </h2>
          <div className="grid grid-cols-2 gap-2.5">
            {pillars.map((p) => {
              const Icon = p.icon;
              return (
                <Link
                  key={p.href}
                  href={p.href}
                  className="flex items-center gap-3 rounded-xl bg-card p-3 shadow-sm ring-1 ring-line transition active:scale-[0.99]"
                >
                  <span
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-white"
                    style={{ backgroundColor: `var(--${p.tone})` }}
                    aria-hidden
                  >
                    <Icon className="h-6 w-6" />
                  </span>
                  <span className="min-w-0">
                    <span className="display block text-[16px] font-bold leading-tight text-navy">
                      {p.title}
                    </span>
                    <span className="mt-0.5 block text-[12.5px] leading-snug text-foreground/55">
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
