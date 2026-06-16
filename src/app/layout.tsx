import type { Metadata, Viewport } from "next";
import { Archivo, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { BottomNav } from "@/components/bottom-nav";
import { SwRegister } from "@/components/sw-register";

const display = Archivo({
  variable: "--font-display",
  subsets: ["latin", "vietnamese"],
  weight: ["600", "700", "800"],
});

// Body: Plus Jakarta Sans (user 2026-06-11: "international hơn" — thay
// Be Vietnam Pro). Geometric-humanist kiểu các app toàn cầu, đậm chắc,
// subset vietnamese đầy đủ dấu.
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
  // PWA cài về home screen iOS — chạy chuẩn standalone, không thanh trình duyệt
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
  // KHÔNG khóa maximumScale — mắt người 40–60 tuổi ngoài nắng cần phóng to (a11y)
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
      // Script đầu <body> đặt data-mode từ localStorage TRƯỚC hydrate (chống
      // nháy cỡ chữ) → server không có attr, client có. Cố ý → tắt cảnh báo
      // hydrate trên <html> (chỉ ảnh hưởng chính thẻ này, không lan xuống cây).
      suppressHydrationWarning
    >
      <body className="min-h-full">
        {/* Đặt chế độ hiển thị TRƯỚC khi vẽ — không nháy cỡ chữ (xem globals.css) */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var m=localStorage.getItem('forfish.displaymode.v1');if(m==='gon'||m==='to')document.documentElement.dataset.mode=m}catch(e){}",
          }}
        />
        {/* Mobile-first: a phone-width column centred on larger screens. */}
        <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col bg-background shadow-sm">
          <main className="flex-1 pb-32">{children}</main>
          <BottomNav />
        </div>
        <SwRegister />
      </body>
    </html>
  );
}
