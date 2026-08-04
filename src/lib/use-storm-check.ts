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

/**
 * THANG LÙI CÓ TRẦN khi hỏi bão hỏng liên tiếp: 1 phút → 3 phút → 10 phút →
 * 30 phút, rồi giữ 30 phút.
 *
 * VÌ SAO (D-PH10, soát 2026-08-02): trước đây hỏng là hỏi lại sau ĐÚNG 1 phút,
 * mãi mãi — ~45–60 request/giờ suốt cả chuyến biển, mỗi lần đánh thức radio,
 * tốn pin và tranh băng thông với chính bản tin bão mình đang chờ.
 *
 * VÌ SAO TRẦN LÀ 30 PHÚT, KHÔNG DÀI HƠN: đó ĐÚNG BẰNG nhịp hỏi lúc mọi thứ
 * bình thường (STORM_REFRESH_MS) — nghĩa là dù hỏng bao lâu, app cũng KHÔNG
 * BAO GIỜ hỏi bão thưa hơn lúc khoẻ. An toàn tính mạng không được đánh đổi lấy
 * pin. Ngoài ra sóng về (`online`) hoặc bà con mở lại app đều hỏi NGAY, không
 * phải chờ hết nhịp.
 */
export const STORM_RETRY_STEPS_MS = [
  STORM_RETRY_MS,
  3 * 60 * 1000,
  10 * 60 * 1000,
  STORM_REFRESH_MS,
];

/**
 * Hỏng lần thứ `failCount` (tính cả lần vừa rồi) thì chờ bao lâu — THUẦN, có
 * test. Cùng khuôn với `netBackoffMs` của lib/heartbeat.
 *
 * `offline = true` (máy nói thẳng là mất mạng) → nhảy luôn về trần: thử mạng
 * khi hệ điều hành đã báo không có mạng chỉ tốn pin, mà sóng về thì sự kiện
 * `online` đánh thức ngay. KHÔNG dừng hẳn: có máy (WebView cũ) không bắn
 * `online`, nên vẫn phải còn một nhịp đều đặn.
 */
export function stormRetryMs(failCount: number, offline = false): number {
  const steps = STORM_RETRY_STEPS_MS;
  if (offline) return steps[steps.length - 1];
  if (!Number.isFinite(failCount) || failCount < 1) return steps[0];
  return steps[Math.min(Math.round(failCount), steps.length) - 1];
}

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
    /* ĐANG CÓ MỘT LƯỢT HỎI BAY DỞ chưa? (soát 2026-08-02)
       LỖI CŨ: `ask()` chỉ clearTimeout cái handle HIỆN TẠI. Mạng nhấp nháy làm
       hai `ask()` chồng nhau; lượt trước về sau đặt timer của nó, lượt sau lại
       ghi đè biến `timer` ⇒ timer cũ thành MỒ CÔI, không ai clear được nữa.
       Mỗi lần chồng là thêm VĨNH VIỄN một dây hỏi song song — càng chạy càng
       nhiều request, đúng thứ ngoài khơi không chịu nổi. */
    let inFlight = false;
    /** số lần hỏng LIÊN TIẾP — chọn nấc trong thang lùi */
    let fails = 0;
    /* ĐÃ NÓI ĐƯỢC THÀNH LỜI CHƯA (LỖI 4, soát chéo 2026-08-02)
       LỖI CŨ: nhánh reject gọi `done(null)` mà KHÔNG `setCheck` ⇒ `check` còn
       null ⇒ UI đứng mãi ở "đang hỏi tin bão". Nếu cú reject rơi đúng lần hỏi
       ĐẦU TIÊN thì bà con nhìn một cái vòng quay không bao giờ dừng, không hề
       biết là app CHƯA hỏi được. Với tin bão, im lặng mập mờ nguy hiểm ngang
       nói sai: phải ra một trạng thái nói được thành lời ("chưa hỏi được").
       Chỉ nói MỘT lần và chỉ khi CHƯA có tin nào: `{ok:false}` mà đè lên bản
       tin bão đang hiện là xoá mất chính thứ cần nhất. */
    let spoken = false;

    const schedule = (ms: number) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(ask, ms);
    };
    const isOffline = () =>
      typeof navigator !== "undefined" && navigator.onLine === false;

    // khai báo hàm (hoisted) để tự hẹn lại chính nó mà không vướng TDZ
    function ask() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (inFlight) return; // đã có lượt đang bay — đừng bắn chồng
      inFlight = true;
      /* VẪN HỎI KỂ CẢ KHI MÁY BÁO MẤT MẠNG: fetch hỏng NGAY (không đánh thức
         radio, không tốn pin) và fetchStormCheck rơi về bản tin ĐÃ LƯU trong
         máy/kho service worker — đó là cách duy nhất bà con thấy lại tin bão
         giữa biển. Cái `onLine` gác là NHỊP HỎI LẠI, không phải quyền được đọc
         tin (xem stormRetryMs). Luật "không bao giờ nói không có bão bằng tin
         cũ" nằm ở stormStatus(), không đụng tới. */
      const done = (c: StormCheck | null) => {
        inFlight = false;
        if (!alive) return;
        if (c) {
          setCheck(c);
          spoken = true;
          if (c.ok) lastOkAtRef.current = Date.now();
        } else if (!spoken) {
          // fetchStormCheck tự nuốt lỗi nên nhánh này hiếm — nhưng "hiếm" với
          // chuyện tính mạng vẫn phải có đường ra (xem chú thích `spoken`).
          setCheck({ ok: false });
          spoken = true;
        }
        if (c?.ok) {
          fails = 0;
          schedule(STORM_REFRESH_MS);
        } else {
          fails += 1;
          schedule(stormRetryMs(fails, isOffline()));
        }
      };
      void fetchStormCheck().then(done, () => done(null));
    }

    ask();

    // có sóng trở lại → hỏi NGAY (và xoá thang lùi: đường vừa thông, cho nó
    // một cơ hội mới), đừng bắt bà con chờ hết nhịp
    const onOnline = () => {
      fails = 0;
      ask();
    };
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
