import type { ReactNode } from "react";

/*
  StatusBanner dùng chung — băng trạng thái màu + icon + chữ ("ngôn ngữ thẻ"
  đã thống nhất toàn app). Màu KHÔNG đứng một mình: luôn kèm icon + chữ
  (an toàn cho mù màu + nắng chói). Token màu đã đạt WCAG AA cho chữ đậm.
*/
export type StatusLevel = "ok" | "warn" | "danger" | "neutral";

const STYLE: Record<StatusLevel, { bg: string; fg: string }> = {
  ok: { bg: "var(--ok-bg)", fg: "var(--ok)" },
  warn: { bg: "var(--warn-bg)", fg: "var(--warn)" },
  danger: { bg: "var(--danger-bg)", fg: "var(--danger)" },
  neutral: { bg: "var(--background)", fg: "var(--foreground)" },
};

export function StatusBanner({
  level,
  icon,
  children,
}: {
  level: StatusLevel;
  icon?: ReactNode;
  children: ReactNode;
}) {
  const s = STYLE[level];
  return (
    <p
      className="flex items-center gap-2 px-4 py-2.5 text-[16px] font-bold"
      style={{ backgroundColor: s.bg, color: s.fg }}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
    </p>
  );
}

export { STYLE as STATUS_STYLE };
