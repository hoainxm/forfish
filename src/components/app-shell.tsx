"use client";

import { usePathname } from "next/navigation";
import { BottomNav } from "@/components/bottom-nav";
import { TourLauncher } from "@/components/tour-launcher";

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

  return (
    <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col bg-background shadow-sm">
      {/* pb = chừa CHIỀU CAO dock nổi (≈82px) + vùng an toàn đáy (home
          indicator iOS / thanh gesture Android, env có thể tới ~48px). Cộng
          env(safe-area-inset-bottom) để máy nút-dưới KHÔNG che nội dung/nút
          cuối (trước: pb-32 cứng 128px, thiếu trên máy gesture bar lớn). */}
      <main className="flex-1 pb-[calc(8rem+env(safe-area-inset-bottom))]">
        {children}
      </main>
      <BottomNav />
      <TourLauncher />
    </div>
  );
}
