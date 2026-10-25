"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useGiuCuon } from "@/lib/giu-cuon";

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
  // giữ chỗ cuộn khi qua lại hai màn (TAU-14) — thanh này có mặt ở cả /tau và /nguoi
  const { sapRoi } = useGiuCuon(p);
  return (
    <nav aria-label="Tàu tôi" className="grid grid-cols-2 border-b border-line px-4">
      {MUC.map(({ href, label }) => {
        const on = p === href || p.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={on ? "page" : undefined}
            onClick={on ? undefined : sapRoi}
            className={`relative flex h-[3.25rem] items-center justify-center text-[1rem] font-semibold ${
              on ? "text-navy after:absolute after:inset-x-3 after:bottom-0 after:h-[0.1875rem] after:rounded-full after:bg-navy" : "text-foreground/65"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
