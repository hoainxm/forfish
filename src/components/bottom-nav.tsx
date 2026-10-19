"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnchorIcon, CartIcon, FishIcon, HomeIcon, PinIcon } from "@/components/icons";
import { DOCK, dockActive, type DockId } from "@/lib/dock-nav";

/*
  Dock điều hướng (spec user 2026-07-29; phẳng theo mẫu Codex 2026-10-19): DockFrame
  fixed + dock `absolute bottom:0` neo đáy frame. Nền TRẮNG viền trên 1px, không
  pill navy; mục đang chọn navy đậm, mục khác xám. Safe-area là padding TRONG dock
  nên icon/chữ nằm trên home-indicator. Chiều cao dùng chung --dock-total.
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
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`flex h-full flex-col items-center justify-center gap-1 transition-[color,transform] duration-200 ease-out active:scale-95 ${
                    active ? "text-navy" : "text-foreground/60"
                  }`}
                >
                  <Icon className="h-6 w-6 shrink-0" />
                  <span className={`dock-label ${active ? "font-semibold" : "font-medium"}`}>{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
