import { PageHeader } from "@/components/page-header";

type Tone = "t1" | "t2" | "t3";

export function ComingSoon({
  tone,
  emoji,
  title,
  promise,
  features,
}: {
  tone: Tone;
  emoji: string;
  title: string;
  promise: string;
  features: string[];
}) {
  return (
    <div>
      <PageHeader
        kicker="Sắp có trên ForFish"
        title={
          <>
            {title} {emoji}
          </>
        }
        sub={promise}
        toColor={`var(--${tone})`}
      />

      <div className="px-4 pt-2">
        <div
          className="mb-4 flex items-center gap-3 rounded-3xl px-4 py-3.5"
          style={{ backgroundColor: `var(--${tone}-bg)` }}
        >
          <span className="text-3xl" aria-hidden>
            🛠️
          </span>
          <p
            className="text-[16px] font-bold leading-snug"
            style={{ color: `var(--${tone})` }}
          >
            Đội ForFish đang làm phần này. Sắp xong, bà con chờ chút nhé!
          </p>
        </div>

        <h2 className="mb-2 px-1 text-[17px] font-bold text-navy">
          App sẽ giúp bà con:
        </h2>
        <ul className="space-y-3">
          {features.map((f) => (
            <li
              key={f}
              className="flex items-start gap-3 rounded-3xl border border-line bg-card p-4 shadow-sm"
            >
              <span
                className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[15px] font-bold text-white"
                style={{ backgroundColor: `var(--${tone})` }}
                aria-hidden
              >
                ✓
              </span>
              <span className="text-[17px] leading-snug">{f}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
