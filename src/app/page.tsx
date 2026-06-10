import Link from "next/link";
import { demoDocuments, getExpiryStatus, byUrgency } from "@/lib/documents";
import { PageHeader } from "@/components/page-header";

/*
  Home — built for first-time, low-tech users:
  · one glance = "what needs my attention" (urgent strip)
  · one tap   = one of four BIG buttons, icon + 2–3 words, no jargon
*/

const pillars = [
  {
    href: "/ngu-truong",
    tone: "t1",
    emoji: "🐟",
    title: "Đánh bắt",
    sub: "Hôm nay đi biển không?",
  },
  {
    href: "/gia-ca",
    tone: "t2",
    emoji: "💰",
    title: "Bán cá",
    sub: "Giá hôm nay bao nhiêu?",
  },
  {
    href: "/van-hanh",
    tone: "t3",
    emoji: "🔧",
    title: "Vật tư & máy",
    sub: "Mua đồ, sửa tàu",
  },
  {
    href: "/giay-to",
    tone: "t4",
    emoji: "📋",
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
        kicker="ForFish · Bạn của ngư dân"
        title={
          <>
            Chào bà con! <span className="bob">⛵</span>
          </>
        }
        sub="Một app lo bốn việc: đi biển, bán cá, sửa tàu, giấy tờ."
      />

      <div className="space-y-6 px-4 pt-4">
        {urgent.length > 0 && (
          <section aria-label="Việc cần làm ngay">
            <h2 className="mb-2 px-1 text-[17px] font-bold text-navy">
              ⚠️ Việc cần làm ngay
            </h2>
            <Link
              href="/giay-to"
              className="block overflow-hidden rounded-3xl border-2 border-danger/25 bg-card shadow-sm transition active:scale-[0.99]"
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
                      className={`h-3.5 w-3.5 shrink-0 rounded-full ${
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
                    <span className="text-2xl text-line" aria-hidden>
                      ›
                    </span>
                  </li>
                ))}
              </ul>
              <p className="bg-danger/8 px-4 py-2.5 text-center text-[15px] font-bold text-danger">
                Bấm vào để xem giấy tờ →
              </p>
            </Link>
          </section>
        )}

        <section aria-label="Bốn việc chính">
          <h2 className="mb-2 px-1 text-[17px] font-bold text-navy">
            Bà con cần gì hôm nay?
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {pillars.map((p) => (
              <Link
                key={p.href}
                href={p.href}
                className="flex min-h-[150px] flex-col items-center justify-center gap-1.5 rounded-3xl border-b-4 bg-card p-4 text-center shadow-sm transition active:translate-y-0.5 active:border-b-2"
                style={{ borderBottomColor: `var(--${p.tone})` }}
              >
                <span
                  className="flex h-16 w-16 items-center justify-center rounded-full text-4xl"
                  style={{ backgroundColor: `var(--${p.tone}-bg)` }}
                  aria-hidden
                >
                  {p.emoji}
                </span>
                <span className="display text-[20px] font-bold leading-tight text-navy">
                  {p.title}
                </span>
                <span className="text-[14px] leading-snug text-foreground/60">
                  {p.sub}
                </span>
              </Link>
            ))}
          </div>
        </section>

        <p className="pb-2 text-center text-[14px] text-foreground/40">
          Thuận buồm xuôi gió, cá đầy khoang 🌊
        </p>
      </div>
    </div>
  );
}
