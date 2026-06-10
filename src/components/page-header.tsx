/**
 * Shared page header: hull-blue gradient with a sand-coloured wave at the
 * bottom edge — the app's signature motif. Keep copy SHORT and plain.
 */
export function PageHeader({
  kicker,
  title,
  sub,
  toColor = "var(--sea)",
  children,
}: {
  kicker: string;
  title: React.ReactNode;
  sub?: string;
  /** right colour of the gradient, e.g. `var(--t4)` */
  toColor?: string;
  children?: React.ReactNode;
}) {
  return (
    <header
      className="relative text-white"
      style={{
        background: `linear-gradient(135deg, var(--navy), ${toColor})`,
      }}
    >
      <div className="px-5 pb-12 pt-7">
        <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-white/70">
          {kicker}
        </p>
        <h1 className="mt-1 text-[30px] font-bold leading-[1.15]">{title}</h1>
        {sub && <p className="mt-1.5 text-[16px] text-white/90">{sub}</p>}
        {children}
      </div>
      {/* sand wave — matches --background so it melts into the page */}
      <svg
        className="absolute bottom-0 left-0 block w-full"
        viewBox="0 0 480 28"
        preserveAspectRatio="none"
        aria-hidden
      >
        <path
          d="M0 28 L0 16 Q60 2 120 14 T240 14 T360 14 T480 12 L480 28 Z"
          fill="var(--background)"
        />
      </svg>
    </header>
  );
}
