"use client";

/*
  DOCK iOS 26 STANDALONE — GHIM VÀO SHELL cao đúng màn NHÌN THẤY.

  Bug WebKit (Apple sửa Safari 26.1, số 158055568): ở bản cài, layout viewport
  kẹt ngắn → position:fixed bottom:0 (dock/map/sheet) bám đáy viewport ngắn,
  lòi khối trống. Mọi cách "đo phần hụt rồi bù" đều lệch vì iOS báo chiều cao
  KHÁC nhau giữa trang có scroll và không.

  Cách chắc (spec user): CHỈ bản cài iOS → thêm class `pwa-frame` trên <html> +
  đặt --app-vh = đáy vùng NHÌN THẤY (visualViewport.offsetTop + height — giá
  trị duy nhất đáng tin). CSS cho DockFrame cao đúng --app-vh, dock neo
  `absolute bottom:0` trong frame (globals.css .dock-frame/.full-map). Ngoài
  standalone: KHÔNG chạy → không có class → giao diện y hệt cũ.

  KHÔNG cập nhật lúc bàn phím MỞ (input focus): giữ chiều cao khung ổn định,
  khỏi nhảy layout khi gõ; đo lại sau khi bàn phím đóng / app resume / xoay.
*/

import { useEffect } from "react";

export function ViewportGapFix() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches === true ||
      (navigator as { standalone?: boolean }).standalone === true;
    if (!standalone) return; // ngoài standalone: không đụng gì

    const de = document.documentElement;
    de.classList.add("pwa-frame");
    let raf = 0;

    const isTyping = () => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable === true;
    };

    const apply = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (isTyping()) return; // bàn phím mở → giữ chiều cao khung, không nhảy
        // đáy vùng NHÌN THẤY thật (visual viewport), làm chiều cao DockFrame
        const visibleBottom = Math.round(vv.offsetTop + vv.height);
        de.style.setProperty("--app-vh", `${visibleBottom}px`);
      });
    };

    apply();
    vv.addEventListener("resize", apply);
    vv.addEventListener("scroll", apply);
    window.addEventListener("orientationchange", apply);
    const onFocusOut = () => window.setTimeout(apply, 120); // bàn phím đóng
    const onVisible = () => {
      if (!document.hidden) apply();
    };
    window.addEventListener("focusout", onFocusOut);
    document.addEventListener("visibilitychange", onVisible);
    // lưới an toàn: đổi tab / trạng thái viewport tự đổi không bắn event
    const tick = window.setInterval(apply, 600);

    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(tick);
      vv.removeEventListener("resize", apply);
      vv.removeEventListener("scroll", apply);
      window.removeEventListener("orientationchange", apply);
      window.removeEventListener("focusout", onFocusOut);
      document.removeEventListener("visibilitychange", onVisible);
      de.classList.remove("pwa-frame");
      de.style.removeProperty("--app-vh");
    };
  }, []);

  return null;
}
