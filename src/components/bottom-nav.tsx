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
  Taxonomy MECE theo đối tượng: Ra khơi (chuyến) · Tàu cá · Bạn thuyền · Giao dịch.
  Nhãn ĐỒNG BỘ khuôn 2 chữ/nhãn (03-design-system "Nhãn ngang hàng", 2026-07-28).
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
    <nav
      aria-label="Điều hướng chính"
      // Canh giữa bằng LỀ (left-0/right-0/mx-auto) để transform CHỈ còn trục
      // dọc. bottom:0 + padding safe-area giữ nguyên (nguyên tắc dock). Bug iOS
      // 26 standalone: dịch dock XUỐNG đúng phần viewport hụt bằng
      // translate3d(0, --pwa-viewport-gap, 0). Ngoài standalone biến = 0px →
      // translate3d(0,0,0) = y hệt cũ.
      className="fixed bottom-0 left-0 right-0 z-20 mx-auto w-full max-w-[480px] px-3"
      style={{
        paddingBottom: "calc(env(safe-area-inset-bottom) + 10px)",
        transform: "translate3d(0, var(--pwa-viewport-gap, 0px), 0)",
        transition: "transform 140ms ease-out",
      }}
    >
      <ul
        className="grid grid-cols-5 rounded-[1.625rem] px-1.5 py-1.5 shadow-[0_12px_32px_-8px_rgba(10,30,50,0.45)] backdrop-blur-md"
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
  );
}
