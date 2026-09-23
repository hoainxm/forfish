"use client";

/**
 * Trục 1 — CHIP CẢNH BÁO SỚM (nổi trên bản đồ Ra khơi).
 *
 * TÁCH RIÊNG khỏi `storm-banner.tsx` CỐ Ý: banner bão giữ 4 trạng thái dính
 * tính mạng (có bão / không có / chưa hỏi được / đang hỏi), cân đối rất kỹ —
 * cảnh báo sớm là tin MỀM (nhắc theo dõi), không được chen vào làm rối logic đó.
 *
 * Ai quyết CÓ HIỆN hay không nằm ở cha (fishing-map-view): chỉ hiện khi tin bão
 * còn TƯƠI (stormStatus = "khong-co") và KHÔNG có bão thật — mất sóng/tin cũ thì
 * lời dặn của trục bão chính lên tiếng thay. Component này chỉ lo phần hiện.
 *
 * Bung đầy đủ MỘT lần khi câu đổi rồi tự thu về chip (khỏi che view) — cùng nhịp
 * với nhánh "chưa hỏi được" của storm-banner.
 */
import { useEffect, useRef, useState } from "react";
import { earlyWarningLine, type EarlyWarning } from "@/lib/storm-early";
import { NOTIFY_HIDE_LONG_MS } from "@/lib/notify";
import { AlertIcon, ChevronDownIcon } from "@/components/icons";

export function StormEarlyBanner({ ew }: { ew: EarlyWarning }) {
  const { short, full } = earlyWarningLine(ew);
  const [open, setOpen] = useState(true);
  // bung lại mỗi khi CÂU đổi (tin biển mới đổi loại/mốc), rồi tự thu.
  const spokenRef = useRef<string | null>(null);
  useEffect(() => {
    if (spokenRef.current === full) return;
    spokenRef.current = full;
    setOpen(true);
    const t = setTimeout(() => setOpen(false), NOTIFY_HIDE_LONG_MS);
    return () => clearTimeout(t);
  }, [full]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="pointer-events-auto mx-auto flex min-h-[2.75rem] w-fit items-center gap-1.5 rounded-full bg-warn-bg px-3 py-1.5 text-[0.875rem] font-bold text-warn shadow-md"
      >
        <AlertIcon className="h-4 w-4 shrink-0" />
        {short} — chạm xem
        <ChevronDownIcon className="h-4 w-4" />
      </button>
    );
  }
  return (
    <button
      type="button"
      role="status"
      onClick={() => setOpen(false)}
      className="pointer-events-auto mx-auto flex w-fit max-w-[92%] items-start gap-1.5 rounded-2xl bg-warn-bg px-3 py-2 text-left text-[0.9375rem] font-bold leading-snug text-warn shadow-md"
    >
      <AlertIcon className="mt-0.5 h-5 w-5 shrink-0" />
      <span>{full}</span>
    </button>
  );
}
