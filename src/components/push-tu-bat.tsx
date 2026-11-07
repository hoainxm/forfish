"use client";

/*
  TỰ BẬT THÔNG BÁO (2026-11-07 — lib/push-tu-hoi.ts). Không vẽ gì.
   · Quyền còn "default" ⇒ hộp xin quyền của máy hiện ở CÚ CHẠM ĐẦU TIÊN vào app (trình duyệt chỉ cho hỏi trong cú
     chạm). Khoá VAPID lấy TRƯỚC lúc mở app — trong cú chạm phải gọi xin quyền ngay, không được chờ mạng (iPhone mất
     "cú chạm" sau một lần chờ).
   · Quyền đã "granted" mà máy mất đăng ký ⇒ `syncPushAccount` tự đăng ký lại (decideRekey). Đã đăng nhập thì
     UsageHeartbeat gọi rồi; ở đây lo cho KHÁCH (tin bão gửi cả máy chưa đăng nhập).
  OFFLINE: mất sóng ⇒ không hỏi, không gọi mạng; lấy khoá có hết giờ 8 s, hỏng ⇒ không hỏi lần này.
*/

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useAuthUser } from "@/lib/use-auth";
import { useOnline } from "@/lib/use-online";
import { fetchVapidPublicKey, isPushSupported, pushUserOff, subscribeToPush, syncPushAccount } from "@/lib/push-client";
import { docLanHoi, ghiLanHoi, nenTuHoiQuyen } from "@/lib/push-tu-hoi";
import { baoToast } from "@/components/ui/toast";

const quyenMay = (): string | undefined => (typeof Notification === "undefined" ? undefined : Notification.permission);

export function PushTuBat() {
  const { ready, signedIn, phone } = useAuthUser();
  const online = useOnline();
  const pathname = usePathname() ?? "/";
  const path = useRef(pathname);
  const sdt = useRef(phone);
  useEffect(() => {
    path.current = pathname;
    sdt.current = phone;
  }, [pathname, phone]);

  useEffect(() => {
    if (!ready || signedIn || !isPushSupported() || quyenMay() !== "granted") return;
    void syncPushAccount();
  }, [ready, signedIn]);

  useEffect(() => {
    if (!ready) return;
    const tt = () => ({
      hoTro: isPushSupported(),
      quyen: quyenMay(),
      userOff: pushUserOff(),
      online,
      lanHoiTruoc: docLanHoi(),
      now: Date.now(),
      path: path.current,
    });
    if (!nenTuHoiQuyen(tt())) return;
    let alive = true;
    let key: string | null = null;
    void fetchVapidPublicKey().then((k) => {
      key = k;
    });
    const cham = () => {
      if (!key || !nenTuHoiQuyen(tt())) return; // chưa có khoá / vào /quan-tri ⇒ chờ cú chạm sau
      document.removeEventListener("click", cham, true);
      ghiLanHoi(Date.now());
      void subscribeToPush(key, sdt.current).then((r) => {
        if (!alive || !r.ok) return; // bà con từ chối / đóng hộp ⇒ im, hàng "Bật chuông" Trang chủ vẫn còn
        void syncPushAccount();
        baoToast("Đã bật thông báo — tin bão, cảnh báo tàu báo cả khi tắt app.");
      }, () => {});
    };
    document.addEventListener("click", cham, true);
    return () => {
      alive = false;
      document.removeEventListener("click", cham, true);
    };
  }, [ready, online]);

  return null;
}
