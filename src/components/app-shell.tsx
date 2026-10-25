"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { BottomNav } from "@/components/bottom-nav";
import { dockActive } from "@/lib/dock-nav";
import { NativeGpsPrime } from "@/components/native-gps-prime";
import { UserSyncInit } from "@/components/user-sync-init";

// CHỈ dựng ở máy: tts.ts (plugin TTS Capacitor) đụng `window` lúc nạp module ⇒ dựng trên máy chủ là 500 mọi trang
const SenBienToanApp = dynamic(() => import("@/components/sen-bien-toan-app").then((m) => m.SenBienToanApp), { ssr: false });

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
  // bottom-sheet còn tác dụng. class `app-shell`: bản cài iOS ép min-height =
  // --app-vh (globals.css) → tab viewport NHỎ (Trang chủ/Ra khơi) cao bằng
  // --app-vh max nên iOS tự NỞ viewport bằng tab dài → dock max không còn bị
  // che (user 2026-07-29: "khung view của tab 1/2 phải nở theo vh mới").
  /*  MÀN KHÔNG THUỘC MỤC DOCK NÀO (đăng nhập · đăng ký · quên/đổi mật khẩu · quyền riêng tư — `dockActive` null,
      07 §5 hàng 8–9 "không dock"): luồng tập trung kiểu FB, thoát bằng "‹"; không vẽ dock, không chừa đáy
      (rà FB 2026-10-25, VO-APP-06). Sen Biển đã tự ẩn ở các màn này. */
  const coDock = dockActive(pathname) !== null;
  return (
    <div className="app-shell mx-auto flex min-h-dvh max-w-(--w-app) flex-col bg-background shadow-sm">
      <main className={coDock ? "app-content flex-1" : "flex-1"}>{children}</main>
      {coDock && <BottomNav />}
      <NativeGpsPrime />
      {/* Sen Biển — trợ lý giọng nói ở MỌI màn (màn bản đồ có bản riêng, tự ẩn ở đó) */}
      <SenBienToanApp />
      <UserSyncInit />
    </div>
  );
}
