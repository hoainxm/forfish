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
    // GIỮ ĐÁY LỚN NHẤT đã đo cho từng CHIỀU màn hình (user 2026-07-29): tab
    // KHÔNG cuộn iOS báo visualViewport thấp hơn, tab cuộn được WebKit tự nở →
    // nếu ghi thẳng số đo mỗi tab, --app-vh co/nở theo tab, dock nhảy. Chỉ cho
    // LỚN LÊN, không cho nhỏ lại; key theo screen.width×height (xoay màn = mốc
    // mới). sessionStorage: ổn định trong một lần mở app.
    let stableKey = "";
    let stableBottom = 0;

    const isTyping = () => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable === true;
    };

    const apply = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (isTyping()) return; // bàn phím mở → viewport ngắn hợp lệ, bỏ
        const key = `forfish.pwa-frame.${screen.width}x${screen.height}`;
        const measured = Math.round(vv.offsetTop + vv.height);
        if (key !== stableKey) {
          // đổi chiều màn (xoay) → mốc mới: lấy bản đã lưu của chiều này, hoặc số đo hiện tại
          stableKey = key;
          let saved = 0;
          try {
            saved = Number(sessionStorage.getItem(key)) || 0;
          } catch {}
          stableBottom = saved > 0 ? saved : measured;
        }
        // CHỈ cho lớn lên: tab ngắn đo nhỏ hơn KHÔNG kéo chuẩn xuống
        stableBottom = Math.max(stableBottom, measured);
        try {
          sessionStorage.setItem(key, String(stableBottom));
        } catch {}
        de.style.setProperty("--app-vh", `${stableBottom}px`);
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
