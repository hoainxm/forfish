"use client";

/*
  VÁ BUG iOS 26 SAFARI — dock đáy "treo lưng chừng" (ảnh user 2026-07-29).

  Bug WebKit (Apple sửa từ Safari 26.1, số 158055568): sau khi bàn phím /
  thanh công cụ Safari đóng-mở, LAYOUT viewport không nở lại theo màn hình →
  phần tử position:fixed bám đáy layout viewport CŨ (ngắn hơn), lòi dải nền
  trống bên dưới; dính cả Safari thường lẫn PWA cài về máy. Cộng đồng xác
  nhận CUỘN TRANG là Safari neo lại đúng.

  Cách vá: nghe visualViewport — khi đáy NHÌN THẤY thấp hơn đáy LAYOUT quá 2px
  (đúng dấu vết bug, còn bàn phím đang mở thì hai bên co CÙNG NHAU nên không
  kích nhầm) thì hích cuộn 1px xuống-lên cho Safari tính lại. Máy đã lên 26.1+
  hoặc Android: gap không bao giờ xuất hiện → component này im lặng cả đời.
*/

import { useEffect } from "react";

export function ViewportGapFix() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    let raf = 0;
    const check = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const gap =
          vv.height + vv.offsetTop - document.documentElement.clientHeight;
        if (gap > 2) {
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
    check();
    return () => {
      cancelAnimationFrame(raf);
      vv.removeEventListener("resize", check);
      vv.removeEventListener("scroll", check);
      window.removeEventListener("focusout", check);
      window.removeEventListener("orientationchange", check);
    };
  }, []);
  return null;
}
