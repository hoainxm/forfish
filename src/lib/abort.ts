// ĐỒNG HỒ CHẶN CHO YÊU CẦU MẠNG — THUẦN, dùng chung client/server.
//
// VÌ SAO CÓ (2026-08-02): repo đang gọi thẳng `AbortSignal.timeout(ms)` ở hàng
// chục chỗ. Hàm tĩnh đó chỉ có từ Safari 16 / Chrome 103; máy cũ của bà con
// (iPhone còn Safari 15, WebView Android đời cũ) ném `TypeError: AbortSignal
// .timeout is not a function` NGAY TRONG khối `try` bao quanh lời gọi mạng ⇒
// lỗi đội lốt "mất sóng". Ở use-tier thì hậu quả là `fallback()` → `scheduleRetry`
// → vòng lặp 10 phút VĨNH VIỄN, `answered` không bao giờ true: máy đó không bao
// giờ tra được hạng, dù đang ngồi ngay cảng đầy sóng.
//
// KHÔNG BAO GIỜ ném, và có ĐƯỜNG LÙI THẬT (AbortController + setTimeout) chứ
// không trả `undefined` cho xong — mất đồng hồ chặn nghĩa là promise treo giữa
// biển, đúng thứ mấy bản vá trước đã phải đi dọn.

/**
 * Tín hiệu tự huỷ sau `ms` mili-giây.
 *
 * Trả `undefined` CHỈ khi môi trường không có cả `AbortController` (rất cũ /
 * môi trường test tối giản) — lúc đó chỗ gọi cứ chạy không kèm tín hiệu, đừng
 * chặn việc của bà con vì thiếu một thứ phụ trợ. Chỗ gọi nên viết:
 *   `const s = timeoutSignal(ms); if (s) q = q.abortSignal(s);`
 */
export function timeoutSignal(ms: number): AbortSignal | undefined {
  const t = Number.isFinite(ms) && ms > 0 ? ms : 0;
  try {
    const ctor = AbortSignal as unknown as {
      timeout?: (ms: number) => AbortSignal;
    };
    if (typeof ctor?.timeout === "function") return ctor.timeout(t);
  } catch {
    /* có tên nhưng gọi hỏng — rơi xuống đường lùi bên dưới */
  }
  try {
    if (typeof AbortController === "undefined") return undefined;
    const c = new AbortController();
    const timer = setTimeout(() => {
      try {
        c.abort();
      } catch {
        /* bỏ qua */
      }
    }, t);
    /* đừng giữ tiến trình node sống chỉ vì một đồng hồ chặn (route/test) */
    (timer as unknown as { unref?: () => void }).unref?.();
    return c.signal;
  } catch {
    return undefined;
  }
}
