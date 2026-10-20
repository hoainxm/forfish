"use client";

import { useEffect, useState } from "react";

import { apiUrl } from "@/lib/api-base";
import { timeoutSignal } from "@/lib/abort";
import {
  LOCAL_BUILD_ID,
  LOCAL_BUILD_DATE,
  VERSION_CHECK_TIMEOUT_MS,
  buildLabel,
  isNewBuild,
} from "@/lib/app-version";

/*
  KHỐI "PHIÊN BẢN" trong panel Cài đặt (rail Ra khơi) — cho bà con/người hỗ trợ
  biết máy đang chạy BẢN NÀO (nhãn "ngày · mã", vd "2026-10-05 · 2a59c1a") và đã
  phải bản mới nhất chưa. Bổ sung cho thẻ nổi "Có bản mới" ở layout (vốn CHỈ hiện
  khi có bản mới — components/update-notice.tsx); đây hiện THƯỜNG TRỰC để xác nhận
  máy đã lên bản mới sau khi deploy.

  OFFLINE/TRUNG THỰC: mã rỗng (dev / build ngoài CI) ⇒ "bản phát triển", KHÔNG hỏi
  máy chủ. Mất sóng / route lỗi ⇒ im phần đối chiếu (không treo, không báo lỗi,
  `.catch` nuốt). KHÔNG tự tải lại. Không lưu gì (không đụng khoá forfish.*).
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

  return (
    <div>
      <p className="mb-2 mt-3 text-[0.75rem] font-bold uppercase tracking-wide text-foreground/55">
        Phiên bản
      </p>
      <p className="text-[0.9375rem] font-semibold text-foreground/80">
        {buildLabel(LOCAL_BUILD_ID, LOCAL_BUILD_DATE)}
      </p>
      {match === "latest" && (
        <p className="mt-0.5 text-[0.8125rem] text-foreground/55">
          Đã là bản mới nhất.
        </p>
      )}
      {match === "new" && (
        <p className="mt-0.5 text-[0.8125rem] text-foreground/55">
          Có bản mới — bấm “Cập nhật” ở thẻ đầu màn hình.
        </p>
      )}
    </div>
  );
}
