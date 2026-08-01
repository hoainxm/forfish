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
import { sendHeartbeat } from "@/lib/heartbeat";
import { isStandalone } from "@/lib/storage-persist";
import { isShellReady } from "@/lib/shell-ready";
import { savedCoverage } from "@/lib/pretrip";

export function UsageHeartbeat() {
  const { user, ready } = useAuthUser();

  useEffect(() => {
    if (!ready || !user) return;
    let alive = true;
    // Đợi một nhịp cho màn hình vẽ xong đã — heartbeat không được tranh chỗ
    // với việc dựng bản đồ lúc mở app.
    const t = setTimeout(() => {
      void (async () => {
        try {
          const shellOk = await isShellReady();
          if (!alive) return;
          // "đủ đồ đi biển" = vỏ app cài đủ VÀ mọi lớp dữ liệu đã tải
          const cov = savedCoverage({});
          void sendHeartbeat({
            standalone: isStandalone(),
            offlineReady: shellOk && cov.allSaved,
          });
        } catch {
          /* không bao giờ làm phiền app */
        }
      })();
    }, 3000);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [ready, user]);

  return null;
}
