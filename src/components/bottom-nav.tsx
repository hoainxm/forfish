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
  // Vị trí đáy: mặc định `bottom-0` (Safari thường / Android / desktop). Bản
  // cài iOS bật class `sd-pinned` trên <html> (viewport-gap-fix.tsx) → CSS
  // `.sd-pinned .sd-dock` GHIM dock vào đáy vùng nhìn thấy thật (--sd-vh).
  return (
    <nav
      aria-label="Điều hướng chính"
      // Căn giữa bằng LỀ (inset-x-0 + mx-auto), KHÔNG bằng translateX — để
      // pinned chỉ đụng trục DỌC (translateY). Gộp -50% X vào cùng transform
      // với calc dọc thì iOS drop cả cụm nếu calc lỗi → dock lệch hẳn sang trái.
      className="sd-dock fixed inset-x-0 bottom-0 z-20 mx-auto w-full max-w-[480px] px-3"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 10px)" }}
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
