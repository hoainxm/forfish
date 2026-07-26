import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Quản trị SDFish",
  description:
    "Dashboard nội bộ SDVICO — tài khoản, nguồn dữ liệu, sức khoẻ hệ thống SDFish.",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body className="antialiased">{children}</body>
    </html>
  );
}
