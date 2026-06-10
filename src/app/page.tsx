import Link from "next/link";
import { demoDocuments, getExpiryStatus, byUrgency } from "@/lib/documents";
import { PageHeader } from "@/components/page-header";
import {
  ChevronRightIcon,
  DocIcon,
  FishIcon,
  PriceIcon,
  WrenchIcon,
} from "@/components/icons";

/*
  Home — built for first-time, low-tech users:
  · one glance = "what needs my attention" (urgent strip)
  · one tap   = one of four BIG buttons, icon + 2–3 words, no jargon
  Tone: a dependable work tool — plain words, no emoji, no decoration.
*/

const pillars = [
  {
    href: "/ngu-truong",
    tone: "t1",
    icon: FishIcon,
    title: "Đánh bắt",
    sub: "Hôm nay nên ra khơi không?",
  },
  {
    href: "/gia-ca",
    tone: "t2",
    icon: PriceIcon,
    title: "Bán cá",
    sub: "Giá cá hôm nay tại cảng",
  },
  {
    href: "/van-hanh",
    tone: "t3",
    icon: WrenchIcon,
    title: "Vật tư & máy",
    sub: "Mua vật tư, bảo dưỡng tàu",
  },
  {
    href: "/giay-to",
    tone: "t4",
    icon: DocIcon,
    title: "Giấy tờ",
    sub: "Hạn đăng kiểm, giấy phép",
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
        kicker="ForFish · Bạn đồng hành của ngư dân"
        title="Chào bà con"
        sub="Một app lo bốn việc: đi biển, bán cá, sửa tàu, giấy tờ."
      />

      <div className="space-y-6 px-4 pt-4">
        {urgent.length > 0 && (
          <section aria-label="Việc cần làm ngay">
            <h2 className="display mb-2 px-1 text-[17px] font-bold text-navy">
              Việc cần làm ngay
            </h2>
            <Link
              href="/giay-to"
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

        <section aria-label="Bốn việc chính">
          <h2 className="display mb-2 px-1 text-[17px] font-bold text-navy">
            Chọn việc cần làm
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {pillars.map((p) => {
              const Icon = p.icon;
              return (
                <Link
                  key={p.href}
                  href={p.href}
                  className="flex min-h-[150px] flex-col items-start justify-between rounded-xl bg-card p-4 shadow-sm ring-1 ring-line transition active:scale-[0.99]"
                >
                  <span
                    className="flex h-12 w-12 items-center justify-center rounded-lg text-white"
                    style={{ backgroundColor: `var(--${p.tone})` }}
                    aria-hidden
                  >
                    <Icon className="h-6 w-6" />
                  </span>
                  <span>
                    <span className="display block text-[19px] font-bold leading-tight text-navy">
                      {p.title}
                    </span>
                    <span className="mt-0.5 block text-[14px] leading-snug text-foreground/55">
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
