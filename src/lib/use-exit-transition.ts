"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/*
  Hook đóng-có-animation dùng chung cho sheet/dialog: gọi requestClose() thì
  chạy animation thoát (set closing=true) rồi mới gọi onClose THẬT sau `ms`.
  Giúp BottomSheet/ConfirmDialog trượt/mờ ra mượt thay vì biến mất tức thì.
  API ngoài của component KHÔNG đổi — caller vẫn truyền onClose như cũ.
*/
export function useExitTransition(onClose: () => void, ms = 200) {
  const [closing, setClosing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // override: callback khác khi đóng (vd ConfirmDialog confirm chạy onConfirm).
  // typeof-guard vì onClick truyền sự kiện làm tham số đầu — bỏ qua nếu không
  // phải hàm, lùi về onClose.
  const requestClose = useCallback(
    (override?: unknown) => {
      if (timer.current) return; // đã trong lúc đóng — bỏ qua lần gọi thừa
      const done = typeof override === "function" ? (override as () => void) : onClose;
      setClosing(true);
      timer.current = setTimeout(() => done(), ms);
    },
    [onClose, ms],
  );

  // dọn timer nếu component biến mất giữa chừng
  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return { closing, requestClose };
}
