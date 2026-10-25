"use client";

/*
  NỘI QUY KAIROS — hiện ở LẦN ĐĂNG/BÌNH LUẬN ĐẦU (14 §3.3, AC08). Đọc không cần đồng ý.
  Đồng ý ⇒ PATCH /api/kairos/me {acceptRules:true} (máy chủ lưu `rules_accepted_at`). Nút ghi đủ
  ba trạng thái: đang gửi · lỗi nói thật + bấm lại · mất sóng "Cần sóng".
*/

import { useState } from "react";
import { errorText, kairosSend, type KairosMe } from "@/lib/kairos/write-client";
import { NHAN } from "@/lib/labels";
import { useOnline } from "@/lib/use-online";

export const NOI_QUY = [
  "Nói thật, không bịa tin, không tung tin đồn.",
  "Không chửi bới, xúc phạm, không chữ bậy.",
  "Không lừa đảo, không quảng cáo trá hình.",
  "Gọi đúng tên biển đảo: Biển Đông, Hoàng Sa, Trường Sa của Việt Nam.",
  "Bài sai nội quy sẽ bị ẩn; sai nhiều lần bị khoá đăng.",
] as const;

export function RulesBox({ onAccepted }: { onAccepted: (me: KairosMe) => void }) {
  const online = useOnline();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const accept = async () => {
    setBusy(true);
    setErr("");
    const r = await kairosSend<{ me: KairosMe }>("PATCH", "/api/kairos/me", { acceptRules: true });
    setBusy(false);
    if (r.ok) onAccepted(r.data.me);
    else setErr(errorText(r, "bai"));
  };
  return (
    <div className="rounded-2xl border border-line bg-card p-4">
      <p className="mb-2 font-semibold text-navy">Nội quy Kairos</p>
      <ol className="mb-3 list-decimal space-y-1 pl-5 text-[1rem]">
        {NOI_QUY.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ol>
      {err && (
        <p role="alert" className="mb-2 text-[0.875rem] font-semibold text-danger">
          {err}
        </p>
      )}
      <button
        type="button"
        onClick={() => void accept()}
        disabled={busy || !online}
        className="h-(--h-cta) w-full rounded-xl bg-sea text-[1rem] font-semibold text-white disabled:opacity-40"
      >
        {!online ? NHAN.canSong : busy ? NHAN.dangGui : NHAN.dongY}
      </button>
    </div>
  );
}
