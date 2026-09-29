"use client";

import { useEffect, useState } from "react";

import { apiUrl } from "@/lib/api-base";
import { timeoutSignal } from "@/lib/abort";
import {
  LOCAL_BUILD_ID,
  VERSION_CHECK_TIMEOUT_MS,
  dueForCheck,
  isNewBuild,
} from "@/lib/app-version";
import { CloseButton } from "@/components/ui/close-button";
import { SQ_BTN } from "@/components/ui/sq-btn";

/*
  THẺ "CÓ BẢN MỚI" (2026-09-29) — luật ở lib/app-version.ts.

  Hỏi /api/version lúc mở app và mỗi lần quay lại app (giãn 10 phút). Mất sóng
  / sóng yếu / route lỗi ⇒ im lặng, không báo gì, lần sau hỏi lại.

  KHÔNG TỰ TẢI LẠI TRANG: tải lại giữa lúc dẫn đường ngoài biển là giật màn,
  mất tuyến đang đi. Chỉ báo — bà con tự chạm "Cập nhật" lúc tiện. "Để sau"
  ẩn tới lần mở app sau (không lưu gì, không đụng khoá forfish.*).
*/
export function UpdateNotice() {
  const [hasNew, setHasNew] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!LOCAL_BUILD_ID) return; // dev / tự host: không có mã bản ⇒ tắt
    let lastCheck: number | null = null;
    let alive = true;
    const check = () => {
      if (document.visibilityState !== "visible") return;
      if (typeof navigator !== "undefined" && navigator.onLine === false) return;
      const now = Date.now();
      if (!dueForCheck(lastCheck, now)) return;
      lastCheck = now;
      fetch(apiUrl("/api/version"), {
        cache: "no-store",
        signal: timeoutSignal(VERSION_CHECK_TIMEOUT_MS),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => {
          if (alive && isNewBuild(LOCAL_BUILD_ID, j?.build)) setHasNew(true);
        })
        .catch(() => {});
    };
    check();
    document.addEventListener("visibilitychange", check);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", check);
    };
  }, []);

  if (!hasNew || dismissed) return null;
  return (
    <div
      role="status"
      className="surface fixed inset-x-3 top-[calc(env(safe-area-inset-top)+0.75rem)] z-50 mx-auto flex max-w-md items-center gap-2 py-2 pl-4 pr-2"
    >
      <p className="min-w-0 flex-1 text-[1rem] font-semibold leading-snug text-foreground">
        Có bản mới của app — cập nhật để dùng bản sửa lỗi mới nhất
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className={`${SQ_BTN} bg-trim text-white shadow-trim-cta`}
      >
        Cập nhật
      </button>
      <CloseButton onClose={() => setDismissed(true)} label="Để sau" />
    </div>
  );
}
