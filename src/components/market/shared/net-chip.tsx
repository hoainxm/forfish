"use client";

import { useEffect, useState } from "react";

const STYLE: Record<"offline" | "stale" | "error", { bg: string; fg: string; ttl: number }> = {
  offline: { bg: "var(--warn-bg)", fg: "var(--warn)", ttl: 8000 },
  stale: { bg: "var(--field)", fg: "var(--navy)", ttl: 5000 },
  error: { bg: "var(--danger-bg)", fg: "var(--danger)", ttl: 8000 },
};

/**
 * Chip tầng 4 (07 §12): MỘT chip/màn, tự tắt sau 5 s (stale) / 8 s (offline,
 * error). Đổi `text`/`state` là hiện lại. Không toast, không chồng.
 */
export function NetChip({ state, text }: { state: "offline" | "stale" | "error"; text: string }) {
  const [shown, setShown] = useState(true);
  useEffect(() => {
    setShown(true);
    const t = setTimeout(() => setShown(false), STYLE[state].ttl);
    return () => clearTimeout(t);
  }, [state, text]);
  if (!shown) return null;
  const s = STYLE[state];
  return (
    <div className="pointer-events-none sticky top-2 z-10 flex justify-center px-4" role="status">
      <span
        className="rounded-full px-4 py-2 text-[0.875rem] font-semibold shadow-sm"
        style={{ backgroundColor: s.bg, color: s.fg }}
      >
        {text}
      </span>
    </div>
  );
}
