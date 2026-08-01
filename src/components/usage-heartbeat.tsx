"use client";

/**
 * Máy tự báo "vừa mở app" — KHÔNG vẽ gì ra màn hình.
 *
 * Đặt ở layout cạnh SwRegister. Chỉ gửi khi ĐÃ ĐĂNG NHẬP (chưa đăng nhập thì
 * không quy về ai được) và chỉ khi CÒN SÓNG; mọi hàng rào khác nằm ở
 * lib/heartbeat.ts. Không await gì ở đường vẽ màn, không state, không render.
 */

import { useEffect } from "react";
import { useAuthUser } from "@/lib/use-auth";
import { nextFastRetryDelayMs, sendHeartbeat } from "@/lib/heartbeat";
import { isIOS, isStandalone } from "@/lib/storage-persist";
import { isShellReady } from "@/lib/shell-ready";
import { savedCoverage } from "@/lib/pretrip";

export function UsageHeartbeat() {
  const { user, ready } = useAuthUser();

  useEffect(() => {
    if (!ready || !user) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;

    // Gửi một nhịp; hỏng vì KHÔNG NGHE ĐƯỢC MÁY CHỦ thì tự hẹn giờ thử lại
    // theo thang 3 phút → 5 phút → thôi (nấc cuối 12 giờ để lần mở app sau lo).
    // Mọi hàng rào (mất sóng · cửa 12 giờ · mức hoãn) nằm trong sendHeartbeat,
    // ở đây chỉ đặt hẹn giờ — gọi sớm quá thì nó tự trả false, không gửi.
    const beat = async () => {
      try {
        const shellOk = await isShellReady();
        if (!alive) return;
        // "đủ đồ" = vỏ app cài đủ VÀ mọi lớp dữ liệu đã tải. Máy chủ còn
        // lọc thêm một lần theo chế độ chạy (iOS/Safari không tính) — xem
        // countsAsOfflineReady trong lib/app-usage.ts.
        const cov = savedCoverage({});
        const ok = await sendHeartbeat({
          standalone: isStandalone(),
          ios: isIOS(),
          offlineReady: shellOk && cov.allSaved,
        });
        if (!alive || ok) return;
        const wait = nextFastRetryDelayMs();
        if (wait == null) return;
        timer = setTimeout(() => void beat(), wait);
      } catch {
        /* không bao giờ làm phiền app */
      }
    };

    // Đợi một nhịp cho màn hình vẽ xong đã — heartbeat không được tranh chỗ
    // với việc dựng bản đồ lúc mở app.
    timer = setTimeout(() => void beat(), 3000);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [ready, user]);

  return null;
}
