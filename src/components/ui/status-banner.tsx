import type { ReactNode } from "react";
import { AlertIcon, CheckIcon, ClockIcon } from "@/components/icons";

/*
  StatusBanner dùng chung — băng trạng thái màu + icon + chữ ("ngôn ngữ thẻ"
  đã thống nhất toàn app). Màu KHÔNG đứng một mình: luôn kèm icon + chữ
  (an toàn cho mù màu + nắng chói). Token màu đã đạt WCAG AA cho chữ đậm.

  Icon mặc định theo mức (đỏ = chuông, vàng = đồng hồ, xanh = tick) —
  truyền `icon` khi cần biểu tượng khác, `icon={null}` để bỏ hẳn.
*/
export type StatusLevel = "ok" | "warn" | "danger" | "neutral";

const STYLE: Record<StatusLevel, { bg: string; fg: string }> = {
  ok: { bg: "var(--ok-bg)", fg: "var(--ok)" },
  warn: { bg: "var(--warn-bg)", fg: "var(--warn)" },
  danger: { bg: "var(--danger-bg)", fg: "var(--danger)" },
  neutral: { bg: "var(--background)", fg: "var(--foreground)" },
};

const DEFAULT_ICON: Record<StatusLevel, ReactNode> = {
  danger: <AlertIcon className="h-5 w-5" />,
  warn: <ClockIcon className="h-5 w-5" />,
  ok: <CheckIcon className="h-5 w-5" />,
  neutral: null,
};

export function StatusBanner({
  level,
  icon,
  children,
}: {
  level: StatusLevel;
  /** icon riêng; bỏ qua = icon mặc định theo mức; null = không icon */
  icon?: ReactNode;
  children: ReactNode;
}) {
  const s = STYLE[level];
  const shown = icon === undefined ? DEFAULT_ICON[level] : icon;
  return (
    <p
      className="flex items-center gap-2 px-4 py-2.5 text-[16px] font-bold"
      style={{ backgroundColor: s.bg, color: s.fg }}
    >
      {shown && <span className="shrink-0">{shown}</span>}
      <span>{children}</span>
    </p>
  );
}

export { STYLE as STATUS_STYLE };
