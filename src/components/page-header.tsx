/**
 * Shared page header — COMPACT. Một dải mỏng hull-blue: kicker nhỏ + tiêu đề.
 * Bỏ sóng trang trí + sub dài để nhường diện tích cho nội dung (tỷ lệ
 * thông tin/màn hình cao hơn). `sub` chỉ hiện khi thật cần (mặc định ẩn gọn).
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
      className="px-4 pb-3 pt-3.5 text-white"
      style={{
        background: `linear-gradient(135deg, var(--navy), ${toColor})`,
      }}
    >
      <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-white/65">
        {kicker}
      </p>
      <h1 className="text-[22px] font-bold leading-tight">{title}</h1>
      {sub && <p className="mt-0.5 text-[14px] leading-snug text-white/85">{sub}</p>}
      {children}
    </header>
  );
}
