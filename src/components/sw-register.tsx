"use client";

import { useEffect } from "react";

import { requestPersistentStorage } from "@/lib/storage-persist";

/*
  Đăng ký service worker (public/sw.js) sau khi mount — CHỈ production
  (dev/Turbopack đổi bundle liên tục, SW gây kẹt cache). Không render gì.
  Lỗi đăng ký nuốt im: PWA là tăng cường, không được làm hỏng app.

  XIN BỘ NHỚ BỀN (mọi env): cache SW + dự báo trong localStorage là "best-effort"
  — máy đầy thì trình duyệt tự xoá. persist() xin trình duyệt giữ lại, để ra khơi
  mất sóng vẫn còn dữ liệu. Best-effort, nuốt lỗi (xem lib/storage-persist.ts).
*/
export function SwRegister() {
  useEffect(() => {
    void requestPersistentStorage();

    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator))
      return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  return null;
}
