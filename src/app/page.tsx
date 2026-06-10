import Link from "next/link";
import { demoDocuments, getExpiryStatus, byUrgency } from "@/lib/documents";
import { PageHeader } from "@/components/page-header";
import {
  AnchorIcon,
  ChevronRightIcon,
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
  const today = new Date();
  const urgent = demoDocuments(today)
    .sort(byUrgency(today))
    .map((d) => ({ doc: d, status: getExpiryStatus(d, today) }))
    .filter((x) => x.status.level === "expired" || x.status.level === "soon");

  return (
    <div>
      <PageHeader
        kicker="ForFish · Bạn của ngư dân"
        title="Chào bà con"
      />

      <div className="space-y-4 px-4 pt-3">
        {urgent.length > 0 && (
          <section aria-label="Việc cần làm ngay">
            <h2 className="display mb-1.5 px-1 text-[16px] font-bold text-navy">
              Việc cần làm ngay
            </h2>
            <Link
              href="/tau"
              className="block overflow-hidden rounded-xl border-l-4 border-danger bg-card shadow-sm ring-1 ring-line transition active:scale-[0.99]"
            >
              <ul>
                {urgent.slice(0, 2).map(({ doc, status }, i) => (
                  <li
                    key={doc.id}
                    className={`flex items-center gap-3 px-4 py-3.5 ${
                      i > 0 ? "border-t border-line" : ""
                    }`}
                  >
                    <span
                      className={`h-3 w-3 shrink-0 rounded-full ${
                        status.level === "expired" ? "bg-danger" : "bg-warn"
                      }`}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[17px] font-semibold">
                        {doc.label}
                      </span>
                      <span
                        className={`text-[15px] font-bold ${
                          status.level === "expired"
                            ? "text-danger"
                            : "text-warn"
                        }`}
                      >
                        {status.label}
                      </span>
                    </span>
                    <ChevronRightIcon className="h-5 w-5 shrink-0 text-foreground/30" />
                  </li>
                ))}
              </ul>
              <p className="border-t border-line bg-background px-4 py-2.5 text-[15px] font-bold text-danger">
                Xem tất cả giấy tờ
              </p>
            </Link>
          </section>
        )}

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
