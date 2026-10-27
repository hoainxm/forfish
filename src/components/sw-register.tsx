"use client";

import { useEffect } from "react";

import { ensurePersistentStorage } from "@/lib/storage-persist";
import { refreshDataKeyOnce } from "@/lib/data-key";
import { batDauNgheCai } from "@/lib/app-install";
import { TOKEN_STORE_EVENT } from "@/lib/device-token-store";
import { PUSH_CHIME_MSG, pushChimeUrgent } from "@/lib/push-message";
import { armWarningSound, playPushChime } from "@/lib/warning-sound";

/*
  Đăng ký service worker (public/sw.js) sau khi mount — CHỈ production
  (dev/Turbopack đổi bundle liên tục, SW gây kẹt cache). Không render gì.
  Lỗi đăng ký nuốt im: PWA là tăng cường, không được làm hỏng app.

  XIN BỘ NHỚ BỀN (mọi env): cache SW + dự báo trong localStorage là "best-effort"
  — máy đầy thì trình duyệt tự xoá. persist() xin trình duyệt giữ lại, để ra khơi
  mất sóng vẫn còn dữ liệu. Best-effort, nuốt lỗi (xem lib/storage-persist.ts).

  ⚠️ HIỆU ỨNG NÀY CHẠY MỘT LẦN MỖI LẦN NẠP TÀI LIỆU, không phải mỗi lần mở màn:
  App Router không remount layout khi chuyển màn, còn bản cài PWA thì bấm Home
  rồi quay lại cũng giữ nguyên tài liệu. Nên đây KHÔNG đủ làm đường xin duy nhất
  — hai chỗ hỏi lại nằm ở `usage-heartbeat` (quay lại app) và
  `pretrip-auto-notify` (ngay sau khi ghi được gói đi biển). Cửa giãn cách nằm
  trong `ensurePersistentStorage`, gọi thừa cũng không sao.
*/
let chimeListening = false;

export function SwRegister() {
  useEffect(() => {
    // hộp cài của Chrome bắn MỘT lần, rất sớm — nghe ngay lúc nạp để thẻ/mục "Cài app" mở sau vẫn bung được
    batDauNgheCai();
    /*  KHOÁ DỮ LIỆU BẢN ĐỒ (2026-10-02): nền .pmtiles/bờ/đảo cũng là SDF2 — máy
        không có khoá mà ra khơi là trắng bản đồ. Xin ngay khi nạp app, khi vừa
        đăng nhập (TOKEN_STORE_EVENT) và khi có sóng lại; mỗi lần nạp chỉ một
        lượt thành công, không có tài khoản / mất sóng thì im. */
    refreshDataKeyOnce();
    window.addEventListener(TOKEN_STORE_EVENT, refreshDataKeyOnce);
    window.addEventListener("online", refreshDataKeyOnce);

    void ensurePersistentStorage();

    /*  CHUÔNG RIÊNG KHI TIN TỚI LÚC APP ĐANG MỞ (2026-10-20). sw.js nhắn
        PUSH_CHIME_MSG kèm một cổng trả lời; phát được chuông SDFish thì báo
        `played:true` để thông báo im, không thì báo false để giữ tiếng mặc
        định. armWarningSound mở khoá tiếng ở lần chạm đầu (luật autoplay) —
        chưa chạm lần nào thì playPushChime trả false, thông báo vẫn kêu như cũ.
        Đặt TRƯỚC cửa production: sw.js bản cũ đã cài vẫn có thể nhắn. */
    armWarningSound();
    const sw = typeof navigator !== "undefined" ? navigator.serviceWorker : undefined;
    const onSwMessage = (e: MessageEvent) => {
      const d = e.data as { type?: string; tag?: unknown } | null;
      if (!d || d.type !== PUSH_CHIME_MSG) return;
      const port = e.ports[0];
      const reply = (played: boolean) => {
        try {
          port?.postMessage({ played });
        } catch {
          /* cổng đã đóng (sw hết chờ) — thông báo đã hiện bằng tiếng mặc định */
        }
      };
      if (document.visibilityState !== "visible") return reply(false);
      playPushChime({ urgent: pushChimeUrgent(d.tag) }).then(reply, () => reply(false));
    };
    // một listener cho cả đời tài liệu (StrictMode chạy effect 2 lần ⇒ 2 chuông)
    if (!chimeListening) {
      chimeListening = true;
      sw?.addEventListener("message", onSwMessage);
    }

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
