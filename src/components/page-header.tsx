/**
 * Shared page header — HERO tràn viền (redesign "Mặt nước" 2026-06-10).
 * Gradient biển sâu + quầng sáng, bo đáy 28px, tiêu đề display lớn.
 * `toColor` = màu trục để người dùng nhận diện "khu" bằng màu.
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
      className="hero px-5 pb-10 pt-6"
      style={{
        background: `linear-gradient(150deg, var(--navy) 35%, ${toColor})`,
      }}
    >
      <p className="text-[0.75rem] font-bold uppercase tracking-[0.2em] text-white/60">
        {kicker}
      </p>
      <h1 className="display mt-0.5 text-[1.75rem] font-bold leading-[1.15]">
        {title}
      </h1>
      {sub && (
        <p className="mt-1 max-w-[34ch] text-[0.9375rem] leading-snug text-white/80">
          {sub}
        </p>
      )}
      {children}
    </header>
  );
}
