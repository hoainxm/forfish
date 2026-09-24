"use client";

import { usePathname } from "next/navigation";

/*
  CHUYỂN TRANG MƯỢT (user 2026-09-24: "các thao tác còn hơi đơ"). Next App
  Router dựng lại `template` mỗi lần ĐỔI ROUTE → bọc nội dung trang trong
  `.anim-fade-in` (globals.css: opacity 0→1, 180ms) là mỗi lần chuyển dock
  nội dung hiện lên mượt thay vì "nhảy" tức thì.

  · CSS THUẦN, KHÔNG lib. `prefers-reduced-motion` đã tắt mọi animation ở
    globals.css (a11y) — không cần xử lý riêng.
  · Keyframe CHỈ đổi opacity (không transform) → KHÔNG tạo containing-block
    bẫy vị trí fixed/absolute (dock cố định nằm ngoài lớp bọc này ở AppShell;
    bản đồ full-bleed vẫn neo đúng).
  · TRỪ bản đồ `/ngu-truong`: màn full-bleed + render nặng (MapLibre), fade là
    thừa và dễ nháy khi tile đang tải → trả thẳng children, không bọc.
*/
const NO_FADE = ["/ngu-truong"];

export default function Template({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const skip = NO_FADE.some((p) => pathname.startsWith(p));
  return skip ? <>{children}</> : <div className="anim-fade-in">{children}</div>;
}
