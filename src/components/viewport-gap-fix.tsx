"use client";

/*
  DOCK iOS 26 STANDALONE — GHIM VÀO SHELL cao đúng màn NHÌN THẤY.

  Bug WebKit (Apple sửa Safari 26.1, số 158055568): ở bản cài, layout viewport
  kẹt ngắn → position:fixed bottom:0 (dock/map/sheet) bám đáy viewport ngắn,
  lòi khối trống. Mọi cách "đo phần hụt rồi bù" đều lệch vì iOS báo chiều cao
  KHÁC nhau giữa trang có scroll và không.

  Cách chắc: CHỈ bản cài iOS → class `pwa-frame` trên <html> + --app-vh = ĐÁY
  LỚN NHẤT của viewport (vv.height, chỉ cho lớn lên). CSS cho DockFrame + khung
  app (app-shell min-height) cao đúng --app-vh → tab viewport nhỏ tự nở bằng
  tab dài, dock khớp (globals.css). Ngoài standalone: KHÔNG chạy → y hệt cũ.

  localStorage theo screen.w×h: giữ mốc qua các lần mở app (khỏi học lại). Đặt
  --app-vh NGAY từ localStorage lúc init + chỉ ghi lại khi số LỚN LÊN → chuyển
  tab không reflow, MƯỢT. KHÔNG cập nhật lúc input focus (bàn phím mở).
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
    // GIỮ ĐÁY LỚN NHẤT đã đo cho từng CHIỀU màn hình: tab KHÔNG cuộn iOS báo
    // viewport thấp hơn tab cuộn được → chỉ cho LỚN LÊN, không cho nhỏ lại.
    // localStorage (2026-07-29 user): GIỮ qua các lần mở app — mở lại là có
    // ngay mốc đã học, KHÔNG phải đo lại (đỡ giật lúc khởi động + chuyển tab).
    let stableKey = "";
    let stableBottom = 0;

    /** đọc mốc đã lưu cho chiều màn hiện tại + đặt --app-vh NGAY (khỏi nhảy).
        Trả key hiện tại; đổi chiều (xoay) thì nạp lại mốc của chiều mới. */
    const syncKey = () => {
      const key = `forfish.pwa-frame.${screen.width}x${screen.height}`;
      if (key !== stableKey) {
        stableKey = key;
        let saved = 0;
        try {
          saved = Number(localStorage.getItem(key)) || 0;
        } catch {}
        // TRẦN VẬT LÝ: vùng nhìn thấy KHÔNG thể cao hơn màn hình thật. Mốc đã
        // lưu mà > screen.height là số đo LỖI kẹt lại (bug iOS đo vọt 1 lần) →
        // BỎ, coi như chưa có mốc để đo lại tươi. Đây là nguyên nhân dock chui
        // khỏi đáy màn: khung cao hơn màn → dock trôi xuống dưới mép (user
        // 2026-08-07: "dính wh max 1 lần, quá khung màn hình"; trước đây phải
        // xoá app mới thoát vì mốc chỉ-tăng, giờ tự bỏ).
        const ceil = screen.height || saved;
        if (saved > ceil) saved = 0;
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
      return tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable === true;
    };

    const apply = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (isTyping()) return; // bàn phím mở → viewport ngắn hợp lệ, bỏ
        const key = syncKey();
        // KÍCH THƯỚC viewport (vv.height, không offsetTop — offset cuộn làm vọt)
        const measured = Math.round(vv.height);
        // TRẦN VẬT LÝ: bỏ số đo vọt quá màn hình thật (glitch iOS) — không cho
        // latch mốc quá to (dock sẽ chui khỏi đáy màn, phải xoá app mới thoát).
        const ceil = screen.height || measured;
        if (measured > ceil) return;
        if (measured > stableBottom) {
          // LỚN LÊN: nhận ngay (tab cuộn được cho viewport đầy đủ hơn tab tĩnh).
          stableBottom = measured;
        } else if (stableBottom - measured > 32) {
          // NHỎ hơn NHIỀU (>32px, quá mức jitter giữa các tab): mốc cũ SAI/kẹt
          // quá to → TỰ HẠ về số đo thật (tự chữa, khỏi xoá app). Chênh nhỏ thì
          // rơi xuống nhánh dưới, GIỮ nguyên → không reflow → chuyển tab MƯỢT.
          stableBottom = measured;
        } else {
          return; // chênh nhỏ: giữ mốc, tránh giật giữa các tab
        }
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
