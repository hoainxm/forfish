"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
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
  // Bản cài iOS (standalone): sau vá v3.1 vẫn còn lệch dư ~10px hai chiều —
  // user đo bằng mắt 2026-07-29: Trang chủ + Ra khơi (trang VỪA KHÍT, đang ăn
  // bù --vvgap) dock CAO hơn đáy 10px → tụt thêm; 3 tab cuộn được (var đã về
  // 0) dock THẤP quá 10px → nhấc lên. CHỈ áp trong standalone — Android /
  // desktop / Safari thường không dính, giữ nguyên.
  const [standalone, setStandalone] = useState(false);
  useEffect(() => {
    setStandalone(
      window.matchMedia?.("(display-mode: standalone)").matches === true ||
        (navigator as { standalone?: boolean }).standalone === true,
    );
  }, []);
  const firstTwoTabs = pathname === "/" || pathname.startsWith("/ngu-truong");
  const iosTrimPx = standalone ? (firstTwoTabs ? 10 : -10) : 0;
  return (
    <nav
      aria-label="Điều hướng chính"
      className="fixed bottom-0 left-1/2 z-20 w-full max-w-[480px] px-3"
      style={{
        paddingBottom: "calc(env(safe-area-inset-bottom) + 10px)",
        // --vvgap: bù bug iOS 26 layout-viewport ngắn — CHỈ standalone mới đặt
        // khác 0 (viewport-gap-fix.tsx). Thay class -translate-x-1/2 để khỏi
        // hai transform đè nhau; bình thường var + trim = 0 → y hệt cũ.
        transform: `translate(-50%, calc(var(--vvgap, 0px) + ${iosTrimPx}px))`,
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
