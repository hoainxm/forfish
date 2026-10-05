"use client";

import { useEffect, useState } from "react";

import { apiUrl } from "@/lib/api-base";
import { timeoutSignal } from "@/lib/abort";
import {
  LOCAL_BUILD_ID,
  VERSION_CHECK_TIMEOUT_MS,
  isNewBuild,
} from "@/lib/app-version";

/*
  DÒNG "PHIÊN BẢN" — cho bà con/người hỗ trợ LIẾC biết máy đang chạy bản nào và
  đã phải bản mới nhất chưa (bổ sung cho thẻ nổi "Có bản mới" ở layout, vốn CHỈ
  hiện khi có bản mới — xem components/update-notice.tsx). Đặt ở chân trang Quyền
  riêng tư (khu "giới thiệu app"), cùng khuôn chữ muted với dòng bản quyền.

  Vì sao cần: trước đây mã bản máy vs máy chủ chỉ thấy ở `/ngu-truong?debug=tiles`
  (components/tile-load-debug.tsx) — người dùng thường không có chỗ xác nhận
  "máy mình đã lên bản mới chưa".

  OFFLINE/TRUNG THỰC: mã rỗng (dev / build ngoài CI) ⇒ chỉ ghi "bản phát triển",
  KHÔNG hỏi máy chủ. Mất sóng / route lỗi ⇒ im lặng ở phần đối chiếu (không treo,
  không báo lỗi, `.catch` nuốt). KHÔNG tự tải lại (như UpdateNotice). Không lưu
  gì (không đụng khoá forfish.*), không gửi gì đi.
*/
export function AppVersionLine() {
  const [match, setMatch] = useState<"idle" | "latest" | "new">("idle");

  useEffect(() => {
    if (!LOCAL_BUILD_ID) return; // dev / tự host không có mã ⇒ không đối chiếu
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;
    let alive = true;
    fetch(apiUrl("/api/version"), {
      cache: "no-store",
      signal: timeoutSignal(VERSION_CHECK_TIMEOUT_MS),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!alive) return;
        setMatch(isNewBuild(LOCAL_BUILD_ID, j?.build) ? "new" : "latest");
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const build = LOCAL_BUILD_ID || "bản phát triển";
  return (
    <p className="pb-4 text-[0.9375rem] text-foreground/55">
      Phiên bản: {build}
      {match === "latest" && " · đã là bản mới nhất"}
      {match === "new" && " · có bản mới — bấm Cập nhật ở đầu màn hình"}
    </p>
  );
}
