"use client";

/**
 * CÓ SÓNG KHÔNG — một chỗ duy nhất cho câu hỏi này (2026-08-18, audit thông
 * báo G7/M8). Trước đây `isOffline()` chép ở use-storm-check / pretrip-auto-
 * notify / usage-heartbeat, và `subscribeOnline` nằm riêng trong pretrip-auto-
 * notify. Gom về đây để tầng "mời gọi" (đăng nhập / Premium / cài app) ẩn được
 * đồng loạt khi mất sóng — `tel:`/`/login` giữa biển là ngõ cụt.
 *
 * `navigator.onLine` chỉ chắc ở chiều PHỦ ĐỊNH (false = chắc chắn mất sóng);
 * true có thể là "sóng sống mà chết". Chip/lời mời chỉ cần chiều phủ định.
 * KHÔNG request, KHÔNG khoá `forfish.*`, KHÔNG hẹn giờ.
 */

import { useSyncExternalStore } from "react";

export const isOffline = () =>
  typeof navigator !== "undefined" && navigator.onLine === false;

/** Nghe hai sự kiện có sẵn của trình duyệt. */
export function subscribeOnline(f: () => void) {
  window.addEventListener("online", f);
  window.addEventListener("offline", f);
  return () => {
    window.removeEventListener("online", f);
    window.removeEventListener("offline", f);
  };
}

/** true = máy KHÔNG báo mất sóng (SSR mặc định true để không nhấp nháy). */
export function useOnline(): boolean {
  return useSyncExternalStore(subscribeOnline, () => !isOffline(), () => true);
}
