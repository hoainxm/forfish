"use client";

/**
 * Máy tự báo "vừa mở app" — KHÔNG vẽ gì ra màn hình.
 *
 * ══ MẤT SÓNG: KHÔNG CÓ NHỊP NÀO ══
 *  Không request, không hẹn giờ, không đụng kho offline. Bất biến số một —
 *  heartbeat là tính năng cho NGƯỜI QUẢN TRỊ, không được tranh sóng với tin bão.
 *
 * ══ CÓ SÓNG: HAI LOẠI NHỊP (chủ dự án chốt 2026-08-02d) ══
 *  ① SỰ KIỆN — một điểm theo dõi vừa đổi (đổi tài khoản · web→bản cài · vừa đủ
 *    đồ đi biển · ĐỔI MÁY): gửi NGAY, và **bám 30 giây → 3 phút → 5 phút cho
 *    tới khi máy chủ xác nhận GÁN ĐƯỢC**. Tin này không được mất.
 *  ② ĐỊNH KỲ — 30 phút một lần, báo trạng thái hiện giờ. Lỡ lượt thì lượt sau
 *    bù, KHÔNG bám đuổi.
 *  Cộng ba cú gửi ngay: mở app · quay lại app (`visibilitychange`) · vừa có
 *  sóng lại (`online`).
 *
 * VÌ SAO PHẢI CÓ HẸN GIỜ (lỗi cũ): nhịp chỉ gửi lúc component mount, mà **bản
 * cài PWA mở lại từ nền KHÔNG remount React** — một máy dùng cả ngày vẫn chỉ có
 * đúng một nhịp lúc cold-start. Ghép với cửa 12 giờ cũ thì /quan-tri gần như
 * đứng hình, nhân viên nhìn vào tưởng khách bỏ app.
 *
 * Luật + hợp đồng với máy chủ: `lib/heartbeat-policy.ts`. Chỗ này chỉ nối dây.
 *
 * Chỉ gửi khi ĐÃ ĐĂNG NHẬP (chưa đăng nhập thì không quy về ai được). Mọi hàng
 * rào còn lại nằm ở lib/heartbeat.ts. Không await gì ở đường vẽ màn, không
 * state, không render.
 */

import { useEffect } from "react";
import { useAuthUser } from "@/lib/use-auth";
import { sendHeartbeat } from "@/lib/heartbeat";
import { devicePlatform, isStandalone } from "@/lib/storage-persist";
import { deviceId } from "@/lib/device-id";
import { isShellReady } from "@/lib/shell-ready";
import { savedCoverage } from "@/lib/pretrip";
import { syncPushAccount } from "@/lib/push-client";

export function UsageHeartbeat() {
  const { user, ready } = useAuthUser();

  /* GẮN MÁY ↔ TÀI KHOẢN — effect RIÊNG, chạy NGAY khi biết tài khoản.
     Lỗi đã sửa (2026-08-01p, chủ dự án thử trên máy thật: bật thông báo, đăng
     nhập, đổi tài khoản mà /quan-tri vẫn "chưa gán account nào"): trước đây nó
     nằm SAU chuỗi `setTimeout 3 giây → await isShellReady()` của nhịp
     heartbeat, nên đóng app sớm / kiểm vỏ chậm là không kịp chạy — mà việc gắn
     thì phải chắc chắn, nó là gốc của cả tính năng thông báo.
     Deps có `user` nên ĐỔI TÀI KHOẢN là gắn lại ngay. */
  useEffect(() => {
    if (!ready || !user) return;
    void syncPushAccount();
  }, [ready, user]);

  useEffect(() => {
    if (!ready || !user) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const isOffline = () =>
      typeof navigator !== "undefined" && navigator.onLine === false;

    const clear = () => {
      if (timer != null) clearTimeout(timer);
      timer = null;
    };

    // Gửi một nhịp rồi tự hẹn lượt kế. Mọi hàng rào (mất sóng · cửa 30 phút ·
    // mức hoãn · chữ ký) nằm trong sendHeartbeat — gọi sớm quá thì nó tự trả
    // false mà KHÔNG gửi gì, nên hẹn giờ ở đây luôn an toàn.
    const beat = async () => {
      if (!alive || isOffline()) return;
      try {
        const shellOk = await isShellReady();
        if (!alive) return;
        // "đủ đồ" = vỏ app cài đủ VÀ mọi lớp dữ liệu đã tải. Máy chủ còn lọc
        // thêm: CHƯA MỞ BẢN CÀI thì không tính, mọi nền — thang một chiều
        // web → bản cài → tải (countsAsOfflineReady, lib/app-usage.ts).
        const cov = savedCoverage({});
        const r = await sendHeartbeat({
          standalone: isStandalone(),
          offlineReady: shellOk && cov.allSaved,
          // loại máy THÔ (ios|android|khac) — để nhân viên gọi điện chỉ đúng
          // bước cài. KHÔNG gửi user-agent đầy đủ (dấu vân tay).
          platform: devicePlatform(),
          // mã máy — để máy chủ biết bà con vừa đổi điện thoại và dọn mốc cũ
          deviceId: deviceId(),
        });
        if (!alive) return;
        /*  MỘT ĐƯỜNG HẸN GIỜ DUY NHẤT (2026-08-02d). `sendHeartbeat` mới là chỗ
            biết nhịp vừa rồi là SỰ KIỆN hay ĐỊNH KỲ, máy chủ có gán được không,
            và máy chủ dặn chờ bao lâu — nên nó trả luôn `nextInMs`. Ở đây không
            được tự đoán lại: đoán sai là hoặc bám quá gắt, hoặc bỏ rơi một tin
            mới (đổi tài khoản / đổi máy) suốt cả phiên. */
        clear();
        if (!isOffline()) timer = setTimeout(() => void beat(), r.nextInMs);
      } catch {
        /* không bao giờ làm phiền app */
      }
    };

    /*  QUAY LẠI APP / VỪA CÓ SÓNG LẠI → thử ngay, không chờ hết nhịp. Đây là
        hai mốc mà /quan-tri cần nhất: bà con vừa mở lại app, và máy vừa ra khỏi
        vùng mất sóng. `sendHeartbeat` tự chặn nếu chưa tới hạn. */
    const onVisible = () => {
      if (document.visibilityState === "visible") void beat();
    };
    const onOnline = () => void beat();
    const onOffline = () => clear(); // mất sóng: dừng hẳn hẹn giờ

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    // Đợi một nhịp cho màn hình vẽ xong đã — heartbeat không được tranh chỗ
    // với việc dựng bản đồ lúc mở app.
    timer = setTimeout(() => void beat(), 3000);
    return () => {
      alive = false;
      clear();
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [ready, user]);

  return null;
}
