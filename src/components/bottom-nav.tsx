"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnchorIcon, CartIcon, FishIcon, HomeIcon, PinIcon } from "@/components/icons";
import { DOCK, dockActive, type DockId } from "@/lib/dock-nav";

/*
  Dock điều hướng (spec user 2026-07-29; KIỂU FACEBOOK 2026-10-19): DockFrame
  fixed + thanh trắng bo tròn NỔI, tách mép, hở trên home-indicator (globals.css
  .bottom-dock). Chỉ icon; mục đang chọn = pill xanh nhạt + icon xanh. Chiều cao
  chừa đáy dùng chung --dock-total (đã cộng hở --dock-gap).
  NĂM MỤC (chủ dự án chốt 2026-10-19): Trang chủ · Bản đồ · Tàu tôi · Chợ cá ·
  Vật tư — mỗi việc một chỗ; mục nào sáng ở route nào: lib/dock-nav.ts.
*/
const ICON: Record<DockId, typeof HomeIcon> = {
  "trang-chu": HomeIcon,
  "ban-do": PinIcon,
  "tau-toi": AnchorIcon,
  "cho-ca": FishIcon,
  "vat-tu": CartIcon,
};

export function BottomNav() {
  const pathname = usePathname() ?? "/";
  const on = dockActive(pathname);
  return (
    <div className="dock-frame">
      <nav aria-label="Điều hướng chính" className="bottom-dock">
        <ul className="grid h-full grid-cols-5 items-stretch">
          {DOCK.map(({ id, href, label }) => {
            const active = on === id;
            const Icon = ICON[id];
            return (
              <li key={id}>
                {/*  KIỂU FACEBOOK (anh Long 2026-10-19): chỉ icon, mục đang chọn
                    là pill xanh nhạt sau icon + icon xanh; tên mục vẫn đọc được
                    qua aria-label/title (trình đọc màn hình, nhấn giữ). */}
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  aria-label={label}
                  title={label}
                  className="flex h-full items-center justify-center transition-transform duration-200 ease-out active:scale-95"
                >
                  <span
                    className={`flex h-10 w-[3.75rem] items-center justify-center rounded-full transition-colors ${
                      active ? "bg-sea/12 text-sea" : "text-foreground/70"
                    }`}
                  >
                    <Icon className="h-6 w-6 shrink-0" />
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
