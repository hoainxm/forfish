import type { Metadata, Viewport } from "next";
import { Archivo, Be_Vietnam_Pro } from "next/font/google";
import "./globals.css";
import { BottomNav } from "@/components/bottom-nav";

const display = Archivo({
  variable: "--font-display",
  subsets: ["latin", "vietnamese"],
  weight: ["600", "700", "800"],
});

const body = Be_Vietnam_Pro({
  variable: "--font-body",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "ForFish — Bạn đồng hành của ngư dân",
  description:
    "Đánh bắt tốt hơn · Bán được đắt hơn · Vận hành rẻ hơn · Tuân thủ dễ hơn",
  applicationName: "ForFish",
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
      </body>
    </html>
  );
}
