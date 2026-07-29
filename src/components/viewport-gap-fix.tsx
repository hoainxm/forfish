"use client";

/*
  VÁ BUG iOS 26 SAFARI — dock đáy "treo lưng chừng" (ảnh user 2026-07-29).

  Bug WebKit (Apple sửa từ Safari 26.1, số 158055568): sau khi bàn phím /
  thanh công cụ Safari đóng-mở, LAYOUT viewport không nở lại theo màn hình →
  phần tử position:fixed bám đáy layout viewport CŨ (ngắn hơn), lòi dải nền
  trống bên dưới; dính cả Safari thường lẫn PWA cài về máy. Cộng đồng xác
  nhận CUỘN TRANG là Safari neo lại đúng.

  Cách vá: nghe visualViewport — khi đáy NHÌN THẤY thấp hơn đáy LAYOUT quá 2px
  thì hích cuộn 1px xuống-lên cho Safari tính lại. Trang VỪA KHÍT màn hình
  (trang chủ) không có gì để cuộn → nới đáy body 2px MỘT NHỊP cho scrollBy có
  chỗ làm việc rồi trả lại; kiểm lại mỗi lần đổi trang (dep pathname).

  ĐÃ GỠ 2026-07-29 (user: "tệ hơn bản trước, mất cả góc nhìn"): bù vị trí dock
  bằng CSS var --vvgap. Sai ở chỗ: thanh công cụ Safari thu gọn thì visual và
  layout viewport lệch nhau MỘT CÁCH BÌNH THƯỜNG (Safari vẫn tự neo fixed đúng
  đáy) → phép đo không phân biệt được trạng thái đó với bug thật, bù oan làm
  dock chui xuống dưới mép màn hình. KHÔNG làm lại kiểu đo-rồi-dịch này.
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
        if (gap > 2) {
          // không có gì để cuộn (trang vừa khít) → nới đáy 2px một nhịp
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
    check();
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
