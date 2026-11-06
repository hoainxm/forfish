"use client";

// Trang chủ: máy chưa có cảng nhà ⇒ thử TỰ GẮN theo số tàu S-Tracking của tài khoản (lib/cang-theo-so-tau) trước khi
// mời "Chọn cảng nhà". Đọc bản S-Tracking đã lưu trong máy trước (không tốn sóng); không có thì hỏi
// `/api/stracking/cua-toi` MỘT lần, có hạn chờ — mất sóng/hỏng/401 ⇒ im lặng, thẻ "Chọn cảng nhà" vẫn hiện như cũ.

import { useEffect } from "react";
import { apiUrl } from "@/lib/api-base";
import { timeoutSignal } from "@/lib/abort";
import { tokenHeader } from "@/lib/device-token-store";
import { CANG_TU_DONG_KEY, thuTuGanCangNha } from "@/lib/cang-theo-so-tau";
import { docCangNha } from "@/lib/cang-nha";

/** = `STRACKING_CACHE_KEY` của components/stracking-cua-toi (viết lại chuỗi để Trang chủ không kéo cả thẻ giám sát). */
const STRACKING_CACHE = "forfish.stracking.v1";
const HET_GIO_MS = 8_000;

function soTauDaLuu(): string[] {
  try {
    const b = JSON.parse(window.localStorage.getItem(STRACKING_CACHE) ?? "null") as { tau?: { tenTau?: string | null }[] } | null;
    return Array.isArray(b?.tau) ? b.tau.map((t) => t?.tenTau ?? "").filter(Boolean) : [];
  } catch {
    return [];
  }
}

/** `bat` = đã đăng nhập + có sóng + chưa có cảng nhà. Gắn xong ⇒ `datCangNha` bắn CANG_NHA_EVENT, các thẻ tự đọc lại. */
export function useTuGanCangNha(bat: boolean): void {
  useEffect(() => {
    if (!bat) return;
    try {
      if (docCangNha() !== null || window.localStorage.getItem(CANG_TU_DONG_KEY) !== null) return;
    } catch {
      return;
    }
    if (thuTuGanCangNha(soTauDaLuu())) return;
    let alive = true;
    fetch(apiUrl("/api/stracking/cua-toi"), { headers: { ...tokenHeader() }, signal: timeoutSignal(HET_GIO_MS) })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { tau?: { tenTau?: string | null }[] } | null) => {
        if (!alive || !Array.isArray(j?.tau)) return;
        thuTuGanCangNha(j.tau.map((t) => t?.tenTau ?? null));
      })
      .catch(() => {
        /* mất sóng / hết giờ — để thẻ "Chọn cảng nhà" làm việc của nó, lần mở sau thử lại */
      });
    return () => {
      alive = false;
    };
  }, [bat]);
}
