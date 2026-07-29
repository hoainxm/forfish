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
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        // PWA cài về máy hay MỞ SUỐT nhiều ngày → trình duyệt không tự kiểm
        // sw.js mới → bà con kẹt bản cũ dù đã deploy sửa lỗi (user 2026-07-29:
        // Chrome chạy tốt mà bản cài màn hình không có dự báo). Mỗi lần quay
        // lại app thì kiểm bản mới; sw.js đã skipWaiting+claim nên lần mở sau
        // là chạy vỏ mới. Nghe suốt đời app — không cần gỡ.
        const onVisible = () => {
          if (document.visibilityState === "visible")
            reg.update().catch(() => {});
        };
        document.addEventListener("visibilitychange", onVisible);
      })
      .catch(() => {});
  }, []);

  return null;
}
