"use client";

/*
  VÁ BUG iOS 26 SAFARI — dock đáy "treo lưng chừng" (ảnh user 2026-07-29).

  Bug WebKit (Apple sửa từ Safari 26.1, số 158055568): sau khi bàn phím /
  thanh công cụ Safari đóng-mở, LAYOUT viewport không nở lại theo màn hình →
  phần tử position:fixed bám đáy layout viewport CŨ (ngắn hơn), lòi dải nền
  trống bên dưới; dính cả Safari thường lẫn PWA cài về máy. Cộng đồng xác
  nhận CUỘN TRANG là Safari neo lại đúng.

  V2 (user 2026-07-29: "/tau tự hết mà trang chủ thì không"): trang chủ nội
  dung VỪA KHÍT màn hình — không có gì để cuộn nên cú hích scrollBy vô tác
  dụng (/tau dài, cuộn được nên tự khỏi). Nay:
   1. BÙ VỊ TRÍ qua CSS var --vvgap: dock (bottom-nav) tự tụt xuống đúng phần
      hụt ngay cả khi chưa hích được — hết treo lưng chừng tức thì.
   2. Hích CÓ ĐỆM: trang không cuộn được thì nới đáy body 2px một nhịp cho
      scrollBy có chỗ làm việc, rồi trả lại.
   3. Kiểm lại mỗi lần ĐỔI TRANG (pathname) — không chỉ lúc mount.
  Máy đã lên 26.1+ hoặc Android: gap không xuất hiện → im lặng cả đời.
*/

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function ViewportGapFix() {
  const pathname = usePathname();

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const de = document.documentElement;
    let raf = 0;
    let undoPad = 0;

    const check = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const gap = vv.height + vv.offsetTop - de.clientHeight;
        // (1) dock đọc var này để tự tụt xuống phần hụt (bottom-nav.tsx)
        de.style.setProperty(
          "--vvgap",
          gap > 2 ? `${Math.round(gap)}px` : "0px",
        );
        if (gap > 2) {
          // (2) không có gì để cuộn (trang vừa khít) → nới đáy 2px một nhịp
          if (de.scrollHeight <= de.clientHeight + 1) {
            document.body.style.paddingBottom = "2px";
            window.clearTimeout(undoPad);
            undoPad = window.setTimeout(() => {
              document.body.style.paddingBottom = "";
            }, 350);
          }
          window.scrollBy(0, 1);
          window.scrollBy(0, -1);
        }
      });
    };

    vv.addEventListener("resize", check);
    vv.addEventListener("scroll", check);
    // đóng bàn phím (blur ô nhập) — thời điểm bug hay lộ nhất
    window.addEventListener("focusout", check);
    window.addEventListener("orientationchange", check);
    check(); // (3) chạy lại mỗi lần đổi trang nhờ dep pathname
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(undoPad);
      vv.removeEventListener("resize", check);
      vv.removeEventListener("scroll", check);
      window.removeEventListener("focusout", check);
      window.removeEventListener("orientationchange", check);
    };
  }, [pathname]);

  return null;
}
