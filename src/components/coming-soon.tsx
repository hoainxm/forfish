type Tone = "t1" | "t2" | "t3";

export function ComingSoon({
  tone,
  truc,
  emoji,
  title,
  promise,
  features,
  dataNote,
}: {
  tone: Tone;
  truc: number;
  emoji: string;
  title: string;
  promise: string;
  features: string[];
  dataNote: string;
}) {
  return (
    <div>
      <header
        className="px-5 pb-6 pt-8 text-white"
        style={{
          background: `linear-gradient(135deg, var(--navy), var(--${tone}))`,
        }}
      >
        <p className="text-xs uppercase tracking-widest text-white/70">
          Trục {truc}
        </p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold">
          <span aria-hidden>{emoji}</span>
          {title}
        </h1>
        <p className="mt-1 text-sm text-white/85">{promise}</p>
      </header>

      <div className="px-4 py-5">
        <div
          className="mb-4 rounded-2xl border border-line p-4"
          style={{ backgroundColor: `var(--${tone}-bg)` }}
        >
          <p className="text-sm font-semibold" style={{ color: `var(--${tone})` }}>
            Sắp ra mắt
          </p>
          <p className="mt-1 text-sm text-gray-600">
            Tính năng đang được xây dựng. Những việc app sẽ lo cho bà con:
          </p>
        </div>

        <ul className="space-y-2.5">
          {features.map((f) => (
            <li
              key={f}
              className="flex items-start gap-2.5 rounded-2xl border border-line bg-white p-3.5 shadow-sm"
            >
              <span
                className="mt-0.5 inline-block h-5 w-5 shrink-0 rounded-full text-center text-xs font-bold leading-5 text-white"
                style={{ backgroundColor: `var(--${tone})` }}
                aria-hidden
              >
                ✓
              </span>
              <span className="text-sm text-foreground">{f}</span>
            </li>
          ))}
        </ul>

        <p className="mt-4 rounded-xl bg-white px-3 py-2.5 text-xs text-gray-500 ring-1 ring-line">
          <strong className="text-gray-600">Nguồn dữ liệu: </strong>
          {dataNote}
        </p>
      </div>
    </div>
  );
}
