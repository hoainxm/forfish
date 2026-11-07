import type { Metadata, Viewport } from "next";
import { Archivo, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/app-shell";
import { SwRegister } from "@/components/sw-register";
import { UpdateNotice } from "@/components/update-notice";
import { UsageHeartbeat } from "@/components/usage-heartbeat";
import { PushTuBat } from "@/components/push-tu-bat";
import { ViewportGapFix } from "@/components/viewport-gap-fix";

/*  ĐỘ ĐẬM = ĐÚNG CÁI CODE DÙNG (soát 2026-10-29): font-normal/medium/semibold/bold
    (400/500/600/700) có dùng ⇒ giữ; KHÔNG chỗ nào dùng 800 (font-extrabold, 800)
    ⇒ bỏ khỏi Archivo. Cả hai họ là font BIẾN THIÊN: mọi độ đậm trỏ CÙNG một file
    mỗi bộ chữ ⇒ bớt độ đậm không bớt byte tải, chỉ bớt @font-face thừa. Thêm lại
    một độ đậm khi code thật sự dùng nó (03-design-system §Font). */
const display = Archivo({
  variable: "--font-display",
  subsets: ["latin", "vietnamese"],
  weight: ["600", "700"],
});

const body = Plus_Jakarta_Sans({
  variable: "--font-body",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  // Gốc để Next đổi ảnh OG tương đối thành URL tuyệt đối — bot Messenger/Zalo không đọc được "/icons/..."
  metadataBase: new URL("https://sdfish.sdvico.vn"),
  title: "SDFish — Bạn đồng hành của ngư dân",
  description:
    "Đánh bắt tốt hơn · Bán được đắt hơn · Vận hành rẻ hơn · Tuân thủ dễ hơn",
  applicationName: "SDFish",
  // Khung xem trước khi gửi link qua Messenger/Zalo. Không đặt `url` ở đây: trang con kế thừa thì mọi link đều trỏ về trang chủ.
  // nợ: ảnh vuông 512 (icon) nên Messenger/Zalo hiện thumbnail nhỏ, khi có ảnh bìa 1200×630 thì thay.
  openGraph: {
    type: "website",
    siteName: "SDFish",
    locale: "vi_VN",
    title: "SDFish — Bạn đồng hành của ngư dân",
    description: "Đánh bắt tốt hơn · Bán được đắt hơn · Vận hành rẻ hơn · Tuân thủ dễ hơn",
    images: [{ url: "/icons/icon-512.png", width: 512, height: 512, alt: "SDFish" }],
  },
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
        {/* "Có bản mới — Cập nhật": so mã bản với /api/version, chỉ báo, không tự tải lại. */}
        <UpdateNotice />
        {/* Máy tự báo đã mở app (cho /quan-tri biết ai chưa mở BẢN CÀI).
            Không vẽ gì, không chặn gì — xem lib/heartbeat.ts. */}
        <UsageHeartbeat />
        {/* Tự bật thông báo: hộp xin quyền ở cú chạm đầu tiên; mất đăng ký thì tự đăng ký lại — push-tu-bat.tsx. */}
        <PushTuBat />
        {/* Vá bug iOS 26 Safari: dock đáy treo lưng chừng sau đóng bàn phím —
            xem viewport-gap-fix.tsx. Máy không dính bug thì nó im lặng. */}
        <ViewportGapFix />
      </body>
    </html>
  );
}
