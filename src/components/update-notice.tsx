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

  Rà FB 2026-10-25 (VO-APP-10): thẻ đứng DƯỚI header (không đè tiêu đề/nút header như
  khi `top` sát đỉnh), chữ một dòng "Có bản mới"; chạm "Cập nhật" lúc đang có ngăn/hộp
  mở (`[role=dialog]`, bà con có thể đang gõ) thì CHỜ đóng xong mới tải lại — không mất
  phần đang ghi.
*/
/** Chờ ngăn/hộp đang mở đóng rồi mới tải lại — kiểm mỗi ngần này ms. */
const KIEM_HOP_MS = 400;
/** Đang có lớp nổi (ngăn, hộp xác nhận, menu) không — tải lại lúc này là mất phần đang gõ. */
function dangMoHop(): boolean {
  return !!document.querySelector('[role="dialog"],[role="alertdialog"]');
}
export function UpdateNotice() {
  const [hasNew, setHasNew] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  /** đã chạm "Cập nhật" nhưng còn hộp mở ⇒ đợi */
  const [choDong, setChoDong] = useState(false);
  useEffect(() => {
    if (!choDong) return;
    const t = setInterval(() => {
      if (!dangMoHop()) window.location.reload();
    }, KIEM_HOP_MS);
    return () => clearInterval(t);
  }, [choDong]);

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
      /* z-[28]: DƯỚI nền mờ của ngăn/hộp (z-30/40) — trước z-50 nổi đè lên hộp xác nhận
         đang hỏi; rộng theo khung app --w-app (trước max-w-md 448px lệch khung 480px) —
         rà bố cục 2026-10-22. top = safe-area + 4.5rem: ngay DƯỚI hàng header (0.5rem +
         3.5rem + 0.25rem), không đè tiêu đề/nút header. */
      className="surface fixed inset-x-3 top-[calc(env(safe-area-inset-top)+4.5rem)] z-[28] mx-auto flex max-w-[calc(var(--w-app)-1.5rem)] items-center gap-2 py-2 pl-4 pr-2"
    >
      <p className="min-w-0 flex-1 truncate text-[1rem] font-semibold leading-snug text-foreground">
        {choDong ? "Đóng hộp xong sẽ cập nhật" : "Có bản mới"}
      </p>
      <button
        type="button"
        disabled={choDong}
        aria-busy={choDong}
        onClick={() => {
          if (dangMoHop()) setChoDong(true);
          else window.location.reload();
        }}
        className={`${SQ_BTN} bg-trim text-white shadow-trim-cta disabled:opacity-60`}
      >
        Cập nhật
      </button>
      <CloseButton onClose={() => setDismissed(true)} label="Để sau" />
    </div>
  );
}
