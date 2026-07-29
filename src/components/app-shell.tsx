"use client";

import { usePathname } from "next/navigation";
import { BottomNav } from "@/components/bottom-nav";

/*
  Khung app theo KHU (chủ dự án chốt 2026-07-26):
  · App ngư dân — cột mobile 480px + dock BottomNav (nguyên trạng).
  · /quan-tri — WEB QUẢN TRỊ ĐỘC LẬP về giao diện: full màn hình desktop,
    KHÔNG dock, không khung mobile — "bản chất nó là web độc lập, chỉ dùng
    chung Vercel với DB". Chung build để 1 project Vercel; tách giao diện ở đây.
  usePathname có sẵn lúc SSR (RSC payload) nên không nháy khung sai.
*/
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname.startsWith("/quan-tri")) {
    return <main className="min-h-dvh bg-background">{children}</main>;
  }

  // GIỮ body scroll (min-h-dvh, không overflow ở main) để body-lock của
  // bottom-sheet còn tác dụng. Dock là DockFrame fixed riêng (BottomNav). Nội
  // dung chừa đúng chiều cao dock qua .app-content (globals.css, dùng chung
  // --dock-total) thay số 8rem rời.
  return (
    <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col bg-background shadow-sm">
      <main className="app-content flex-1">{children}</main>
      <BottomNav />
    </div>
  );
}
