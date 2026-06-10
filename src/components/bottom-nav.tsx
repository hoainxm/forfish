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
  Bottom nav sized for wet thumbs: 64px-tall items, bold 13px labels,
  active tab gets a filled pill so "where am I" is obvious at a glance.
  Taxonomy MECE theo đối tượng: Ra khơi (chuyến) · Tàu · Bạn thuyền · Tiền.
*/
const items = [
  { href: "/", label: "Trang chủ", icon: HomeIcon },
  { href: "/ngu-truong", label: "Ra khơi", icon: FishIcon },
  { href: "/tau", label: "Tàu", icon: AnchorIcon },
  { href: "/nguoi", label: "Bạn thuyền", icon: UsersIcon },
  { href: "/tien", label: "Tiền", icon: PriceIcon },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Điều hướng chính"
      className="fixed bottom-0 left-1/2 z-20 w-full max-w-[480px] -translate-x-1/2 border-t-2 border-line bg-card"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="grid grid-cols-5">
        {items.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className="flex min-h-[64px] flex-col items-center justify-center gap-0.5 py-2"
              >
                <span
                  className={`flex h-8 w-14 items-center justify-center rounded-lg transition-colors ${
                    active ? "bg-navy text-white" : "text-foreground/70"
                  }`}
                >
                  <Icon className="h-6 w-6" />
                </span>
                <span
                  className={`text-[13px] font-bold ${
                    active ? "text-navy" : "text-foreground/70"
                  }`}
                >
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
