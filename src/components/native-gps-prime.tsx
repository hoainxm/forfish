"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";

/*
  NativeGpsPrime — trên bản NATIVE (Capacitor), XIN QUYỀN VỊ TRÍ ngay lần mở app
  đầu, để lúc bà con vào Ra khơi thì GPS đã bật sẵn, KHÔNG phải bấm gì (chủ dự án
  chốt 2026-08-26 qua Zalo: *"cài app tự động bật GPS luôn"* — làm cho ngư dân thì
  tối giản). CHỈ áp bản native: web/trình duyệt CẤM tự bung hộp xin quyền khi không
  có thao tác người dùng, nên bản web giữ nguyên hành vi cũ (bấm nút Vị trí mới xin).

  · CHỈ khi quyền CHƯA quyết (`state === "prompt"`): đã cho / đã từ chối thì THÔI,
    không nag lại mỗi lần mở app. Chính permission-state là bộ nhớ — không đẻ khoá
    localStorage mới (khỏi đụng sổ sao-lưu offline).
  · `getCurrentPosition` có callback LỖI → từ chối / máy không có GPS KHÔNG treo,
    KHÔNG throw. Đây là cảm biến tại chỗ: KHÔNG request mạng, KHÔNG ghi kho → an
    toàn offline. iOS đã khai `NSLocationWhenInUseUsageDescription`; Android khai
    `ACCESS_FINE/COARSE_LOCATION` trong manifest (cùng mạch này).
*/
export function NativeGpsPrime() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) return;

    let cancelled = false;
    const prime = () => {
      if (cancelled) return;
      navigator.geolocation.getCurrentPosition(
        () => {},
        () => {},
        { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 },
      );
    };

    const perms = navigator.permissions;
    if (perms?.query) {
      perms
        .query({ name: "geolocation" })
        .then((st) => {
          if (st.state === "prompt") prime();
        })
        .catch(() => {
          // máy không tra được quyền → cứ xin, native tự khử trùng lặp
          prime();
        });
    } else {
      prime();
    }

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
