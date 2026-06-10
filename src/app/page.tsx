import Link from "next/link";
import { demoDocuments, getExpiryStatus, byUrgency } from "@/lib/documents";

const pillars = [
  {
    href: "/ngu-truong",
    n: 1,
    tone: "t1",
    emoji: "🎯",
    title: "Đánh bắt tốt hơn",
    sub: "Ra khơi trúng hơn, đỡ phí dầu phí công",
    points: ["Điểm số đi biển hằng ngày", "Bản đồ ngư trường tiềm năng"],
  },
  {
    href: "/gia-ca",
    n: 2,
    tone: "t2",
    emoji: "💰",
    title: "Bán được đắt hơn",
    sub: "Cá về bờ bán được giá, không bị ép",
    points: ["Giá cảng theo loài", "Kết nối đầu mối thu mua"],
  },
  {
    href: "/van-hanh",
    n: 3,
    tone: "t3",
    emoji: "⚙️",
    title: "Vận hành rẻ hơn",
    sub: "Giữ tàu chạy bền, tốn ít tiền hơn",
    points: ["Chợ vật tư trong app", "Nhắc bảo dưỡng định kỳ"],
  },
  {
    href: "/giay-to",
    n: 4,
    tone: "t4",
    emoji: "📋",
    title: "Tuân thủ dễ hơn",
    sub: "Lo giấy tờ nhẹ đầu, tránh bị phạt oan",
    points: ["Nhắc hạn đăng kiểm, giấy phép", "Trợ lý pháp lý tiếng Việt"],
  },
] as const;

export default function Home() {
  const today = new Date();
  // Surface the most urgent compliance item from Trục 4 right on the home screen.
  const urgent = demoDocuments(today)
    .sort(byUrgency(today))
    .map((d) => ({ doc: d, status: getExpiryStatus(d, today) }))
    .filter((x) => x.status.level === "expired" || x.status.level === "soon");

  return (
    <div>
      <header className="bg-gradient-to-br from-navy to-steel px-5 pb-7 pt-8 text-white">
        <p className="text-xs uppercase tracking-widest text-white/70">
          ForFish · Bạn đồng hành của ngư dân
        </p>
        <h1 className="mt-1 text-2xl font-bold leading-tight">
          Chào bà con đi biển 🌊
        </h1>
        <p className="mt-1 text-sm text-white/85">
          Đánh bắt tốt hơn · Bán được đắt hơn · Vận hành rẻ hơn · Tuân thủ dễ hơn
        </p>
      </header>

      <div className="space-y-5 px-4 pt-5">
        {urgent.length > 0 && (
          <section
            aria-label="Nhắc việc gấp"
            className="rounded-2xl border border-line bg-white p-4 shadow-sm"
          >
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-navy">
                ⏰ Cần để ý ngay
              </h2>
              <Link href="/giay-to" className="text-xs font-medium text-steel">
                Xem tất cả
              </Link>
            </div>
            <ul className="space-y-2">
              {urgent.slice(0, 3).map(({ doc, status }) => (
                <li
                  key={doc.id}
                  className="flex items-center justify-between gap-3"
                >
                  <span className="truncate text-sm text-foreground">
                    {doc.label}
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      status.level === "expired"
                        ? "bg-danger/10 text-danger"
                        : "bg-warn/10 text-warn"
                    }`}
                  >
                    {status.label}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h2 className="mb-3 px-1 text-sm font-semibold text-gray-500">
            Bốn việc app lo cho bà con
          </h2>
          <div className="grid grid-cols-1 gap-3">
            {pillars.map((p) => (
              <Link
                key={p.href}
                href={p.href}
                className="block rounded-2xl border border-line p-4 transition active:scale-[0.99]"
                style={{
                  backgroundColor: `var(--${p.tone}-bg)`,
                  borderLeft: `5px solid var(--${p.tone})`,
                }}
              >
                <div className="flex items-start gap-3">
                  <div className="text-2xl" aria-hidden>
                    {p.emoji}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span
                      className="text-[11px] font-bold uppercase tracking-wide"
                      style={{ color: `var(--${p.tone})` }}
                    >
                      Trục {p.n}
                    </span>
                    <h3 className="text-base font-bold text-navy">{p.title}</h3>
                    <p className="text-sm text-gray-600">{p.sub}</p>
                    <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
                      {p.points.map((pt) => (
                        <li
                          key={pt}
                          className="text-xs text-gray-500 before:mr-1 before:content-['•']"
                        >
                          {pt}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <p className="px-1 pb-2 text-center text-xs text-gray-400">
          Mọi nguồn dữ liệu chỉ là phương tiện. Lời hứa với bà con thì không đổi.
        </p>
      </div>
    </div>
  );
}
