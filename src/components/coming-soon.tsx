import { PageHeader } from "@/components/page-header";
import { CheckIcon, WrenchIcon } from "@/components/icons";

type Tone = "t1" | "t2" | "t3";

export function ComingSoon({
  tone,
  title,
  promise,
  features,
}: {
  tone: Tone;
  title: string;
  promise: string;
  features: string[];
}) {
  return (
    <div>
      <PageHeader
        kicker="Sắp có trên ForFish"
        title={title}
        sub={promise}
        toColor={`var(--${tone})`}
      />

      <div className="px-4 pt-2">
        <div
          className="mb-4 flex items-center gap-3 rounded-xl px-4 py-3.5"
          style={{ backgroundColor: `var(--${tone}-bg)` }}
        >
          <span
            className="shrink-0"
            style={{ color: `var(--${tone})` }}
            aria-hidden
          >
            <WrenchIcon className="h-6 w-6" />
          </span>
          <p
            className="text-[16px] font-bold leading-snug"
            style={{ color: `var(--${tone})` }}
          >
            Phần này đang được xây dựng, sẽ ra mắt trong thời gian tới.
          </p>
        </div>

        <h2 className="display mb-2 px-1 text-[17px] font-bold text-navy">
          App sẽ giúp bà con:
        </h2>
        <ul className="space-y-3">
          {features.map((f) => (
            <li
              key={f}
              className="flex items-start gap-3 rounded-xl bg-card p-4 shadow-sm ring-1 ring-line"
            >
              <span
                className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white"
                style={{ backgroundColor: `var(--${tone})` }}
                aria-hidden
              >
                <CheckIcon className="h-4 w-4" />
              </span>
              <span className="text-[17px] leading-snug">{f}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
