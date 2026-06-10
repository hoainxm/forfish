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
  Dock điều hướng NỔI (redesign "Mặt nước"): thanh navy kính mờ bo tròn,
  tách khỏi mép màn hình — chuẩn app mobile hiện đại. Vẫn cho tay ướt:
  item cao ≥60px, icon + chữ luôn đi cùng nhau, tab đang chọn nổi pill sáng.
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
      className="fixed bottom-0 left-1/2 z-20 w-full max-w-[480px] -translate-x-1/2 px-3"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 10px)" }}
    >
      <ul
        className="grid grid-cols-5 rounded-[26px] px-1.5 py-1.5 shadow-[0_12px_32px_-8px_rgba(10,30,50,0.45)] backdrop-blur-md"
        style={{ backgroundColor: "rgb(17 42 66 / 0.92)" }}
      >
        {items.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-[60px] flex-col items-center justify-center gap-0.5 rounded-[20px] transition-colors ${
                  active ? "bg-white text-navy" : "text-white/75"
                }`}
              >
                <Icon className="h-6 w-6" />
                <span className="text-[12px] font-bold leading-none">
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
