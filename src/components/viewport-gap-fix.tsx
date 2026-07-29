"use client";

/*
  BÙ BUG iOS 26 STANDALONE — layout viewport kẹt NGẮN (Apple xác nhận sửa ở
  Safari 26.1, số 158055568): "fixed a bottom gap appearing on layouts with
  viewport-sized fixed containers on iOS".

  Ở bản cài (standalone), sau khi bàn phím / thanh công cụ đóng, layout viewport
  kẹt ngắn hơn màn thật → position:fixed bottom:0 (dock, map, sheet, thanh ngày)
  bám đáy viewport NGẮN → cả cụm bị nâng, lòi khối trống bên dưới.

  Cách vá (user chốt): đo phần viewport bị HỤT (visual − layout) → gán vào biến
  chung --pwa-viewport-gap; dock dịch xuống bằng transform, map nới đáy — cùng
  một biến nên cả cụm bottom xuống đều.

  NGUYÊN TẮC:
   · CHỈ standalone. Ngoài standalone: không chạy → biến giữ 0px, Safari thường
     KHÔNG bị bù oan khi thanh công cụ co giãn.
   · CHỈ đo sau khi bàn phím ĐÓNG / app RESUME / xoay màn. KHÔNG đo lúc input
     còn focus (bàn phím mở làm viewport ngắn HỢP LỆ — không phải bug).
   · safe-area vẫn là padding trong dock, KHÔNG lẫn với biến này.
*/

import { useEffect } from "react";

/** Chặn số đo rác (xoay màn giữa chừng, zoom…) — hụt thật cỡ thanh công cụ */
const GAP_MAX_PX = 200;

export function ViewportGapFix() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches === true ||
      (navigator as { standalone?: boolean }).standalone === true;
    if (!standalone) return; // ngoài standalone: biến giữ 0px, không đụng gì

    const de = document.documentElement;
    let raf = 0;

    const isTyping = () => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable === true;
    };

    const measure = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (isTyping()) return; // bàn phím đang mở → viewport ngắn HỢP LỆ, bỏ
        // phần HỤT = màn nhìn thấy thật (visual) − layout viewport (bị kẹt ngắn)
        const gap = Math.round(vv.height - de.clientHeight);
        const px = gap > 2 && gap <= GAP_MAX_PX ? gap : 0;
        de.style.setProperty("--pwa-viewport-gap", `${px}px`);
      });
    };

    measure();
    // bàn phím đóng (blur ô nhập) — chờ viewport settle rồi mới đo
    const onFocusOut = () => window.setTimeout(measure, 120);
    const onVisible = () => {
      if (!document.hidden) measure();
    };
    window.addEventListener("focusout", onFocusOut);
    document.addEventListener("visibilitychange", onVisible);
    vv.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);
    // lưới an toàn: đổi tab có thể đổi trạng thái viewport mà không bắn event;
    // measure tự bỏ khi đang gõ nên không bù oan lúc bàn phím mở
    const tick = window.setInterval(measure, 600);

    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(tick);
      window.removeEventListener("focusout", onFocusOut);
      document.removeEventListener("visibilitychange", onVisible);
      vv.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
      de.style.removeProperty("--pwa-viewport-gap");
    };
  }, []);

  return null;
}
