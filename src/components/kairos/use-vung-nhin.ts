"use client";

import { useEffect, useState } from "react";

/**
 * Vùng nhìn thấy thật (trừ bàn phím) qua `visualViewport` — khung soạn và ô bình luận dính đáy
 * luôn nằm trên bàn phím như Facebook. Máy không có `visualViewport` ⇒ null (bên gọi dùng bố cục
 * thường). `ban` = phần bàn phím che đáy (0 khi bàn phím đóng).
 */
export function useVungNhin(): { top: number; height: number; ban: number } | null {
  const [v, setV] = useState<{ top: number; height: number; ban: number } | null>(null);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const cap = () => setV({ top: vv.offsetTop, height: vv.height, ban: Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)) });
    cap();
    vv.addEventListener("resize", cap);
    vv.addEventListener("scroll", cap);
    return () => {
      vv.removeEventListener("resize", cap);
      vv.removeEventListener("scroll", cap);
    };
  }, []);
  return v;
}
