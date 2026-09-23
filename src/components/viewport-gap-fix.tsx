"use client";

/*
  DOCK bản cài iOS (standalone) — GHIM CAO ĐÚNG VÙNG NHÌN THẤY.

  Bug WebKit standalone (số 158055568): iOS báo chiều cao viewport KHÁC nhau giữa
  các tab — tab cuộn được cho viewport ĐẦY, tab tĩnh (map fixed) cho viewport
  NGẮN hơn. `position:fixed` bám đáy viewport ngắn → dock/khung LỆCH giữa 2 màn,
  màn ngắn bị CỤT.

  CÁCH (chủ dự án chốt 2026-08-29 — "đọc khung nào lớn hơn thì CỐ ĐỊNH theo khung
  đó thôi"): --app-vh = ĐÁY LỚN NHẤT đo được, CHỈ CHO LỚN LÊN rồi KHOÁ; trần =
  screen.height (bỏ số đo vọt quá màn thật). CSS ghim dock-frame + app-shell +
  full-map theo --app-vh (globals.css) → MỌI tab MỘT chiều cao DUY NHẤT → dock
  khớp, hết cụt. app-shell min-height = --app-vh ép tab ngắn nở bằng tab dài
  (nội dung cao hơn viewport ngắn → iOS tự giãn viewport bằng tab dài).

  KHÔNG "tự hạ theo tab ngắn": mọi lần thử hạ đều gây DAO ĐỘNG qua lại 2 tab
  (chính là lỗi "khung kia bị cụt / không lưu"). Đo vọt quá màn đã chặn bằng trần
  screen.height; trong ngưỡng đó thì GIỮ CHẶT mốc lớn nhất.

  Lưu localStorage theo screen.w×h → mở lại có ngay mốc, khỏi đo lại (đỡ giật).
  KHÔNG đo lúc gõ (bàn phím mở → viewport ngắn hợp lệ). Ngoài standalone: không chạy.
*/

import { useEffect } from "react";

export function ViewportGapFix() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches === true ||
      (navigator as { standalone?: boolean }).standalone === true;
    if (!standalone) return; // ngoài bản cài: không đụng gì

    const de = document.documentElement;
    de.classList.add("pwa-frame");
    let raf = 0;
    // GIỮ ĐÁY LỚN NHẤT đã đo cho từng CHIỀU màn hình. localStorage: giữ qua các
    // lần mở app — mở lại có ngay mốc đã học, khỏi đo lại.
    let stableKey = "";
    let stableBottom = 0;

    /** đọc mốc đã lưu cho chiều màn hiện tại + đặt --app-vh NGAY (khỏi nhảy).
        Đổi chiều (xoay) thì nạp lại mốc của chiều mới. */
    const syncKey = () => {
      const key = `forfish.pwa-frame.${screen.width}x${screen.height}`;
      if (key !== stableKey) {
        stableKey = key;
        let saved = 0;
        try {
          saved = Number(localStorage.getItem(key)) || 0;
        } catch {}
        // TRẦN VẬT LÝ: mốc > màn thật là số đo LỖI kẹt lại → bỏ, đo lại tươi.
        if (saved > (screen.height || saved)) saved = 0;
        stableBottom = saved;
        if (saved > 0) de.style.setProperty("--app-vh", `${saved}px`);
      }
      return key;
    };
    syncKey(); // đặt --app-vh ngay từ localStorage trước khi vẽ

    const isTyping = () => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName;
      return (
        tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable === true
      );
    };

    const apply = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (isTyping()) return; // bàn phím mở → viewport ngắn hợp lệ, bỏ
        const key = syncKey();
        // vv.height = KÍCH THƯỚC viewport (không offsetTop — offset cuộn làm vọt).
        const measured = Math.round(vv.height);
        // TRẦN CỨNG = KÍCH THƯỚC MÀN HÌNH THẬT của máy: `screen.height` (CSS px)
        // do iOS cấp — KHÔNG cần biết tên/đời máy, đây CHÍNH LÀ size màn của đúng
        // máy đó. --app-vh KHÔNG BAO GIỜ được vượt quá nó.
        const ceil = screen.height || measured;
        // Đo VỌT quá màn thật = glitch iOS → BỎ (không cho latch mốc quá to →
        // dock chui khỏi đáy).
        if (measured > ceil) return;
        // CHỈ LỚN LÊN rồi KHOÁ. Nhỏ hơn (tab tĩnh) → GIỮ mốc lớn, KHÔNG tự hạ
        // (tự hạ = dao động 2 tab).
        if (measured <= stableBottom) return;
        stableBottom = Math.min(measured, ceil); // KHOÁ TRẦN màn hình, tuyệt đối
        try {
          localStorage.setItem(key, String(stableBottom));
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
    // lưới an toàn: đổi tab / viewport tự đổi mà không bắn event
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
