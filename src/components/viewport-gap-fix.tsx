"use client";

/*
  DOCK iOS STANDALONE — GHIM VÀO SHELL cao đúng màn NHÌN THẤY.

  Bug WebKit (số 158055568): ở bản cài, layout viewport kẹt ngắn → position:fixed
  bottom:0 (dock/map/sheet) bám đáy viewport ngắn, lòi khối trống. iOS báo chiều
  cao KHÁC nhau giữa tab có scroll và không.

  ⚠️ APPLE ĐÃ SỬA bug này ở SAFARI 26.1. Trên iOS ≥ 26.1, workaround dưới đây trở
  thành THỦ PHẠM: --app-vh latch theo ĐÁY LỚN NHẤT (tab cuộn được) rồi dùng chung
  cho MỌI tab; tab thấp hơn (vd Ra khơi — map fixed, không cuộn) bị khung cao quá
  màn → dock tụt xuống dưới mép, CỤT; và giá trị nhảy qua lại giữa 2 tab ("không
  lưu"). Máy iOS 26.6 dính đúng ca này (user 2026-08-29).

  NÊN: iOS ≥ 26.1 → KHÔNG chạy workaround, KHÔNG gắn `pwa-frame` → CSS về nhánh
  GỐC (dock fixed bottom:0 + 100dvh) mà native nay xử lý ĐÚNG per-tab. Chỉ iOS
  standalone < 26.1 (còn dính bug) mới chạy workaround `--app-vh` bên dưới.

  Workaround (iOS < 26.1): --app-vh = đáy lớn nhất của viewport (vv.height, chỉ
  cho lớn lên), lưu localStorage theo screen.w×h. KHÔNG cập nhật lúc input focus.
*/

import { useEffect } from "react";

/**
 * Bug viewport standalone ĐÃ ĐƯỢC SỬA chưa (Apple: Safari 26.1)?
 * Đọc phiên bản iOS/Safari từ UA. KHÔNG rõ → coi như CHƯA sửa (giữ workaround,
 * an toàn cho máy cũ). true = đã sửa → dùng native, khỏi workaround.
 */
function viewportBugFixed(): boolean {
  const ua = navigator.userAgent;
  const m = ua.match(/ OS (\d+)_(\d+)/) || ua.match(/Version\/(\d+)\.(\d+)/);
  if (!m) return false;
  const major = Number(m[1]);
  const minor = Number(m[2]);
  return major > 26 || (major === 26 && minor >= 1);
}

export function ViewportGapFix() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches === true ||
      (navigator as { standalone?: boolean }).standalone === true;
    if (!standalone) return; // ngoài standalone: không đụng gì
    // iOS ≥ 26.1 đã sửa bug: chạy workaround chỉ tổ gây cụt dock (xem đầu file).
    // Bỏ chạy → không gắn `pwa-frame` → CSS về nhánh gốc (dock fixed bottom +
    // 100dvh) mà native xử lý đúng per-tab.
    if (viewportBugFixed()) return;

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
