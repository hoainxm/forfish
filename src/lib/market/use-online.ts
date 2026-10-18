"use client";

// "CÓ SÓNG LẠI TỰ TẢI" (11 §9): màn đang mở nghe `online` ⇒ gọi lại `fn`, không
// bắt bà con bấm Thử lại. `fn` được giữ qua ref để không đăng ký lại mỗi render.
import { useEffect, useRef } from "react";

export function useOnlineRefetch(fn: () => void): void {
  const ref = useRef(fn);
  useEffect(() => {
    ref.current = fn;
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    const on = () => {
      try {
        ref.current();
      } catch {
        /* màn tự lo lỗi của nó */
      }
    };
    window.addEventListener("online", on);
    return () => window.removeEventListener("online", on);
  }, []);
}
