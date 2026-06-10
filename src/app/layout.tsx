import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import "./globals.css";
import { BottomNav } from "@/components/bottom-nav";

const beVietnam = Be_Vietnam_Pro({
  variable: "--font-sans",
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
  themeColor: "#1f3a5f",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className={`${beVietnam.variable} h-full antialiased`}>
      <body className="min-h-full">
        {/* Mobile-first: a phone-width column centred on larger screens. */}
        <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col bg-background shadow-sm sm:my-0">
          <main className="flex-1 pb-24">{children}</main>
          <BottomNav />
        </div>
      </body>
    </html>
  );
}
