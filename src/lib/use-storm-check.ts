"use client";

// Trục 1 — HỎI TIN BÃO PHẢI THỬ LẠI. An toàn tính mạng.
//
// LỖI ĐÃ SỬA (2026-07-26): cả `fishing-map-view` lẫn `storm-banner` gọi
// `fetchStormCheck()` trong `useEffect(..., [])` — chạy ĐÚNG MỘT LẦN lúc mở
// trang, KHÔNG BAO GIỜ thử lại. Hệ quả: mở app lúc mất sóng (ngoài biển sóng
// chập chờn là chuyện thường) → `{ok:false}` → màn hình kẹt ở "Chưa hỏi được
// tin bão" VĨNH VIỄN, kể cả khi sóng đã về, cho tới khi bà con tự tải lại
// trang. Bão đang vào mà app không bao giờ hỏi lại = chết người.
//
// Nay hỏi lại khi: (a) có sóng trở lại (`online`), (b) bà con mở lại app
// (`visibilitychange`) nếu tin đã cũ, (c) định kỳ khi đang mở, (d) NHANH hơn
// khi lần hỏi trước HỎNG.

import { useEffect, useRef, useState } from "react";
import { fetchStormCheck, type StormCheck } from "@/lib/storms";

/** Hỏi lại định kỳ khi đang có tin tốt — khớp cache 30 phút của /api/storms */
export const STORM_REFRESH_MS = 30 * 60 * 1000;
/** Hỏi lại nhanh khi lần trước HỎNG (mất sóng) — ngoài khơi sóng chập chờn */
export const STORM_RETRY_MS = 60 * 1000;
/** Nhịp nhích đồng hồ để tuổi tin bão không đứng yên khi app mở suốt chuyến */
export const STORM_CLOCK_TICK_MS = 5 * 60 * 1000;

export interface StormCheckState {
  /** null = chưa hỏi xong lần nào (UI hiện "đang hỏi") */
  check: StormCheck | null;
  /** đồng hồ nhích 5 phút/lần — để tính tuổi bản tin */
  nowMs: number;
}

/**
 * Hỏi tin bão + TỰ THỬ LẠI. Dùng chung cho MỌI nơi hiển thị bão để không nơi
 * nào quên phần thử lại.
 */
export function useStormCheck(): StormCheckState {
  const [check, setCheck] = useState<StormCheck | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  /** mốc lần hỏi ĐƯỢC gần nhất — để quyết có cần hỏi lại khi quay lại app */
  const lastOkAtRef = useRef(0);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    // khai báo hàm (hoisted) để tự hẹn lại chính nó mà không vướng TDZ
    function ask() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      void fetchStormCheck().then((c) => {
        if (!alive) return;
        setCheck(c);
        if (c.ok) lastOkAtRef.current = Date.now();
        // hỏng → thử lại NHANH (mất sóng tạm); được → theo nhịp thường
        timer = setTimeout(ask, c.ok ? STORM_REFRESH_MS : STORM_RETRY_MS);
      });
    }

    ask();

    // có sóng trở lại → hỏi NGAY, đừng bắt bà con chờ hết nhịp
    const onOnline = () => ask();
    // mở lại app → hỏi lại nếu tin đã cũ (hoặc chưa lần nào hỏi được)
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastOkAtRef.current >= STORM_REFRESH_MS) ask();
    };
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), STORM_CLOCK_TICK_MS);
    return () => clearInterval(t);
  }, []);

  return { check, nowMs };
}
