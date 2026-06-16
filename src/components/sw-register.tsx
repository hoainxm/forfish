"use client";

import { useEffect } from "react";

/*
  Đăng ký service worker (public/sw.js) sau khi mount — CHỈ production
  (dev/Turbopack đổi bundle liên tục, SW gây kẹt cache). Không render gì.
  Lỗi đăng ký nuốt im: PWA là tăng cường, không được làm hỏng app.
*/
export function SwRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator))
      return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  return null;
}
