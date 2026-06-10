"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/*
  Bottom nav sized for wet thumbs: 64px-tall items, bold 13px labels,
  active tab gets a filled pill so "where am I" is obvious at a glance.
*/
const items = [
  { href: "/", label: "Trang chủ", icon: HomeIcon },
  { href: "/ngu-truong", label: "Đánh bắt", icon: FishIcon },
  { href: "/gia-ca", label: "Bán cá", icon: PriceIcon },
  { href: "/van-hanh", label: "Vật tư", icon: WrenchIcon },
  { href: "/giay-to", label: "Giấy tờ", icon: DocIcon },
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
                  className={`flex h-8 w-14 items-center justify-center rounded-full transition-colors ${
                    active ? "bg-navy text-white" : "text-foreground/45"
                  }`}
                >
                  <Icon className="h-6 w-6" />
                </span>
                <span
                  className={`text-[13px] font-bold ${
                    active ? "text-navy" : "text-foreground/45"
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

type IconProps = { className?: string };

function HomeIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
    </svg>
  );
}
function FishIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12c3.5-4.5 8-6 12-4.5 2 .8 3.5 2.3 4.5 4.5-1 2.2-2.5 3.7-4.5 4.5-4 1.5-8.5 0-12-4.5Z" />
      <path d="M19.5 12h.01M3 12l-1.5-3M3 12l-1.5 3" />
    </svg>
  );
}
function PriceIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 4v16" />
      <path d="M16.5 7.5c0-1.7-2-2.8-4.5-2.8S7.5 5.8 7.5 7.5 9.5 10.3 12 10.8s4.5 1.5 4.5 3.4-2 3.1-4.5 3.1-4.5-1.2-4.5-2.9" />
    </svg>
  );
}
function WrenchIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 6.5a4 4 0 0 0-5.6 4.9L3 17.3V21h3.7l5.9-5.9a4 4 0 0 0 4.9-5.6L14.6 12 12 9.4l2.5-2.9Z" />
    </svg>
  );
}
function DocIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2.5h8L19 7v14.5H6z" />
      <path d="M14 2.5V7h5M9 13h6M9 17h6" />
    </svg>
  );
}
