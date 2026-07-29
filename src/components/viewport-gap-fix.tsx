"use client";

/*
  DOCK iOS 26 (bản cài / standalone) — GHIM VÀO ĐÁY MÀN HÌNH NHÌN THẤY.

  Cách làm (user 2026-07-29 chốt, sau khi mọi bản "đo phần hụt rồi bù" đều sai
  qua lại giữa các tab): KHÔNG so layout viewport, KHÔNG so screen.height,
  KHÔNG hích cuộn. Chỉ đo CHIỀU CAO NHÌN THẤY THẬT (visualViewport) rồi đặt
  MỘT biến `--sd-vh` = vị trí ĐÁY nhìn thấy tính từ đỉnh trang. Dock ghim đáy
  đó, trang bản đồ cao tới đó — mọi tab như nhau, trên dock là phần hiển thị.

  CHỈ chạy trong bản cài iOS (standalone). Safari thường / Android / desktop
  KHÔNG đụng: thêm class `sd-pinned` để CSS chỉ bật ghim đúng lúc đó; ngoài ra
  dock giữ nguyên `bottom:0` gốc.
*/

import { useEffect } from "react";

export function ViewportGapFix() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches === true ||
      (navigator as { standalone?: boolean }).standalone === true;
    if (!standalone) return; // chỉ bản cài iOS — "làm cho phần iOS docker thôi"

    const de = document.documentElement;
    de.classList.add("sd-pinned");
    let raf = 0;
    const apply = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        // đáy vùng nhìn thấy, tính từ đỉnh layout viewport (mốc trên luôn đúng)
        const bottom = Math.round(vv.offsetTop + vv.height);
        de.style.setProperty("--sd-vh", `${bottom}px`);
      });
    };
    apply();
    // đo lại khi bàn phím/thanh công cụ đổi, xoay màn, và định kỳ (đổi tab có
    // thể khiến viewport tự lành/hỏng mà không bắn event nào — 500ms bắt được)
    vv.addEventListener("resize", apply);
    vv.addEventListener("scroll", apply);
    window.addEventListener("resize", apply);
    window.addEventListener("orientationchange", apply);
    const tick = window.setInterval(apply, 500);
    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(tick);
      vv.removeEventListener("resize", apply);
      vv.removeEventListener("scroll", apply);
      window.removeEventListener("resize", apply);
      window.removeEventListener("orientationchange", apply);
      de.classList.remove("sd-pinned");
      de.style.removeProperty("--sd-vh");
    };
  }, []);

  return null;
}
