"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AnchorIcon,
  FishIcon,
  HomeIcon,
  PriceIcon,
  UsersIcon,
} from "@/components/icons";

/*
  Dock điều hướng (spec user 2026-07-29): DockFrame fixed + dock `absolute
  bottom:0` neo đáy frame → mọi tab một đáy, không dịch theo tab. Nền navy phủ
  TỚI đáy màn (border-radius top), safe-area là padding TRONG dock nên icon/chữ
  nằm trên home-indicator. Chiều cao dùng chung --dock-total (globals.css).
  Taxonomy MECE: Ra khơi · Tàu cá · Bạn thuyền · Giao dịch.
*/
const items = [
  { href: "/", label: "Trang chủ", icon: HomeIcon },
  { href: "/ngu-truong", label: "Ra khơi", icon: FishIcon },
  { href: "/tau", label: "Tàu cá", icon: AnchorIcon },
  { href: "/nguoi", label: "Bạn thuyền", icon: UsersIcon },
  { href: "/tien", label: "Giao dịch", icon: PriceIcon },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <div className="dock-frame">
      <nav aria-label="Điều hướng chính" className="bottom-dock px-2 backdrop-blur-md">
        <ul className="grid grid-cols-5 px-1 py-1.5">
          {items.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-[3.75rem] flex-col items-center justify-center gap-0.5 rounded-[1.25rem] transition-colors ${
                    active ? "bg-white text-navy" : "text-white/75"
                  }`}
                >
                  <Icon className="h-6 w-6" />
                  <span className="text-[0.75rem] font-bold leading-none">
                    {label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
