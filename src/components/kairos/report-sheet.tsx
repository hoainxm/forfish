"use client";

/*
  BÁO XẤU bài / bình luận (14 §3.10, AC15). Lý do chọn sẵn (6 mã REPORT_REASONS) + ghi chú
  ≤200 ký tự khi chọn "Khác". Một người một đích một lần — báo trùng máy chủ trả 200 `dup`,
  app vẫn nói "đã gửi". Nút gửi đủ trạng thái: đang gửi · xong · lỗi thật + bấm lại · cần sóng.
*/

import { useState } from "react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { inputClass } from "@/components/ui/primitives";
import { LIMITS, REPORT_REASONS, type ReportReason } from "@/lib/kairos/types";
import { charLen } from "@/lib/kairos/validate";
import { errorText, kairosSend } from "@/lib/kairos/write-client";
import { NHAN } from "@/lib/labels";
import { useOnline } from "@/lib/use-online";

/** Câu hiện cho từng mã lý do (mã khớp check 0065). */
export const REPORT_REASON_TEXT: Record<ReportReason, string> = {
  "lua-dao": "Lừa đảo",
  "bay-ba": "Bậy bạ",
  "sai-su-that": "Sai sự thật",
  "xuc-pham": "Xúc phạm",
  "quang-cao": "Quảng cáo",
  khac: "Khác",
};

export function ReportSheet({
  target,
  onClose,
}: {
  target: { type: "post" | "comment"; id: string };
  onClose: () => void;
}) {
  const online = useOnline();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [err, setErr] = useState("");
  const tooLong = charLen(note.trim()) > LIMITS.reportNote;

  const send = async () => {
    if (!reason || tooLong) return;
    setState("busy");
    setErr("");
    const r = await kairosSend("POST", "/api/kairos/reports", {
      targetType: target.type,
      targetId: target.id,
      reason,
      note: reason === "khac" && note.trim() ? note : null,
    });
    if (r.ok) setState("done");
    else {
      setState("idle");
      setErr(errorText(r, "bao-xau"));
    }
  };

  if (state === "done") {
    return (
      <BottomSheet title={NHAN.baoXau} onClose={onClose}>
        <p role="status" className="mb-4 text-[1rem]">
          Đã gửi. Người trực SDVICO sẽ xem trong 48 giờ. Cảm ơn bà con giữ Kairos sạch sẽ.
        </p>
        <button type="button" onClick={onClose} className="h-(--h-cta) w-full rounded-xl bg-field font-semibold text-navy">
          {NHAN.dong}
        </button>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet title={NHAN.baoXau} onClose={onClose} kieu="form">
      <fieldset className="mb-3">
        <legend className="mb-2 text-[1rem]">{target.type === "post" ? "Bài này" : "Bình luận này"} có vấn đề gì?</legend>
        <div className="grid grid-cols-2 gap-2">
          {REPORT_REASONS.map((r) => (
            <label
              key={r}
              className={`flex min-h-12 items-center gap-2 rounded-xl border px-3 text-[1rem] font-semibold ${
                reason === r ? "border-sea bg-sea/10 text-sea" : "border-line text-navy"
              }`}
            >
              <input type="radio" name="ly-do" value={r} checked={reason === r} onChange={() => setReason(r)} className="h-5 w-5 accent-sea" />
              {REPORT_REASON_TEXT[r]}
            </label>
          ))}
        </div>
      </fieldset>
      {reason === "khac" && (
        <>
          <label htmlFor="bao-xau-ghi" className="mb-1 block text-[0.875rem] font-semibold text-navy">
            Ghi thêm (không bắt buộc)
          </label>
          <textarea
            id="bao-xau-ghi"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className={`${inputClass} mb-1 h-auto py-2`}
          />
          <p className={`mb-2 text-right text-[0.8125rem] tabular-nums ${tooLong ? "font-semibold text-danger" : "text-foreground/65"}`}>
            {LIMITS.reportNote - charLen(note.trim())}
          </p>
        </>
      )}
      {err && (
        <p role="alert" className="mb-2 text-[0.875rem] font-semibold text-danger">
          {err}
        </p>
      )}
      <div className="grid grid-cols-2 gap-3">
        <button type="button" onClick={onClose} className="h-(--h-cta) rounded-xl bg-field font-semibold text-foreground/75">
          {NHAN.huy}
        </button>
        <button
          type="button"
          onClick={() => void send()}
          disabled={!online || !reason || tooLong || state === "busy"}
          className="h-(--h-cta) rounded-xl bg-danger font-semibold text-white disabled:opacity-40"
        >
          {!online ? NHAN.canSong : state === "busy" ? NHAN.dangGui : NHAN.gui}
        </button>
      </div>
    </BottomSheet>
  );
}
