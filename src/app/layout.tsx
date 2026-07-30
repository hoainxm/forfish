import type { Metadata, Viewport } from "next";
import { Archivo, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/app-shell";
import { SwRegister } from "@/components/sw-register";
import { ViewportGapFix } from "@/components/viewport-gap-fix";

const display = Archivo({
  variable: "--font-display",
  subsets: ["latin", "vietnamese"],
  weight: ["600", "700", "800"],
});

const body = Plus_Jakarta_Sans({
  variable: "--font-body",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "SDFish — Bạn đồng hành của ngư dân",
  description:
    "Đánh bắt tốt hơn · Bán được đắt hơn · Vận hành rẻ hơn · Tuân thủ dễ hơn",
  applicationName: "SDFish",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "SDFish",
  },
};

export const viewport: Viewport = {
  themeColor: "#14324f",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      className={`${display.variable} ${body.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full">
        {/* Đặt chế độ hiển thị TRƯỚC khi vẽ — không nháy cỡ chữ (xem globals.css).
            MẶC ĐỊNH "Gọn" (user chốt 2026-07-28) — kể cả chưa đăng nhập/màn login;
            "auto" (theo máy) chỉ khi user đã chọn lại trong sheet tài khoản. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "var m=null;try{m=localStorage.getItem('forfish.displaymode.v1')}catch(e){}var d=document.documentElement.dataset;if(m==='to')d.mode='to';else if(m!=='auto')d.mode='gon'",
          }}
        />
        <AppShell>{children}</AppShell>
        <SwRegister />
        {/* Vá bug iOS 26 Safari: dock đáy treo lưng chừng sau đóng bàn phím —
            xem viewport-gap-fix.tsx. Máy không dính bug thì nó im lặng. */}
        <ViewportGapFix />
      </body>
    </html>
  );
}
