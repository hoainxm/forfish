"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/*
  TÀU TÔI = Hồ sơ tàu (/tau) | Bạn thuyền (/nguoi) — hai màn, MỘT mục dock
  (2026-10-19). Sổ bạn thuyền là danh bạ CHUNG của chủ tàu, không lọc theo tàu
  đang chọn — nên là màn riêng, không phải tab con của một tàu. Thanh gạch chân
  (không ô nền đặc) theo design Codex; mỗi ô ≥3.5rem.
*/
const MUC = [
  { href: "/tau", label: "Hồ sơ tàu" },
  { href: "/nguoi", label: "Bạn thuyền" },
] as const;

export function TauToiNav() {
  const p = usePathname() ?? "";
  return (
    <nav aria-label="Tàu tôi" className="grid grid-cols-2 border-b border-line px-4">
      {MUC.map(({ href, label }) => {
        const on = p === href || p.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={on ? "page" : undefined}
            className={`relative flex min-h-(--row-h) items-center justify-center text-[1.125rem] font-bold ${
              on ? "text-navy after:absolute after:inset-x-3 after:bottom-0 after:h-[3px] after:rounded-full after:bg-navy" : "text-foreground/65"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
