"use client";

/*
  VÁ BUG iOS 26 SAFARI — dock đáy "treo lưng chừng" (ảnh user 2026-07-29).

  Bug WebKit (Apple sửa từ Safari 26.1, số 158055568): sau khi bàn phím /
  thanh công cụ Safari đóng-mở, LAYOUT viewport không nở lại theo màn hình →
  phần tử position:fixed bám đáy layout viewport CŨ (ngắn hơn), lòi dải nền
  trống bên dưới; dính cả Safari thường lẫn PWA cài về máy. Cộng đồng xác
  nhận CUỘN TRANG là Safari neo lại đúng.

  HAI ĐƯỜNG VÁ, gate theo chế độ chạy:

  · SAFARI THƯỜNG — chỉ HÍCH CUỘN (scrollBy 1px xuống-lên; trang vừa khít thì
    nới đáy body 2px một nhịp cho có chỗ cuộn). TUYỆT ĐỐI không đo-rồi-dịch:
    thanh công cụ Safari thu gọn làm visual/layout viewport lệch nhau MỘT CÁCH
    BÌNH THƯỜNG (fixed vẫn được neo đúng đáy) — không phân biệt được với bug
    thật, đã bù oan một lần (v2 2026-07-29 sáng, dock chui mất nửa → revert).

  · STANDALONE (PWA cài màn hình, ảnh user 2026-07-29 13:20 vẫn treo) — KHÔNG
    có thanh công cụ nào ⇒ lệch dương kéo dài giữa đáy NHÌN THẤY và đáy LAYOUT
    chính LÀ bug, bù không bao giờ oan. Đặt CSS var `--vvgap` trên <html>;
    bottom-nav tụt xuống đúng phần hụt (transform) và trang bản đồ nở đáy theo
    (bottom: calc(... - var(--vvgap))). Bàn phím mở / pinch-zoom cho gap ÂM
    hoặc 0 → var về 0, không đụng gì. Safari 26.1 sửa bug → gap 0 → vá tự tắt.
*/

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/** Trần bù (px) — hụt thật đo được cỡ thanh công cụ (~50–120); quá trần coi
    như số đo rác (xoay màn giữa chừng…), không bù bừa. */
const VVGAP_MAX_PX = 160;

export function ViewportGapFix() {
  const pathname = usePathname();

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const de = document.documentElement;
    // PWA cài màn hình: display-mode standalone (manifest) / navigator.standalone (iOS)
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches === true ||
      (navigator as { standalone?: boolean }).standalone === true;
    let raf = 0;
    let undoPad = 0;

    const check = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const gap = vv.height + vv.offsetTop - de.clientHeight;
        if (standalone) {
          // bù đúng phần hụt — chỉ khi dương rõ ràng và trong trần hợp lý
          const px = gap > 2 && gap <= VVGAP_MAX_PX ? Math.round(gap) : 0;
          de.style.setProperty("--vvgap", `${px}px`);
        }
        if (gap > 2) {
          // hích cuộn cho Safari neo lại (chạy ở CẢ hai chế độ — vô hại, và là
          // đường vá duy nhất của Safari thường)
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
