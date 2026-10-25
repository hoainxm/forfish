"use client";

/*
  TUỲ CHỌN DÒNG TIN KAIROS (14 §13, 2026-10-24 — anh Long: "icon dạng cấu hình của fb để chọn chủ đề thích đọc").
  ƯU TIÊN, KHÔNG LỌC: chủ đề "Thích đọc" lên trước, chủ đề khác vẫn hiện; tin biển vẫn chiếm phần lớn (luật 85 %).
  Kèm công tắc "Hiện bài trợ lý AI" (mặc định bật). Mỗi lần chạm GHI NGAY vào máy (`forfish.kairos.tuychon.v1`);
  dòng tin tải lại trang đầu khi ĐÓNG ngăn (bên gọi so trước/sau) — chạm năm công tắc không bắn năm request.
  Máy không ghi được ⇒ báo "chỉ dùng lần này", vẫn áp cho phiên này. Mất sóng: vẫn chỉnh được, có sóng sẽ áp.
*/

import { useRef, useState } from "react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { TOPICS } from "@/lib/kairos/chu-de.mjs";
import { saveTuyChon } from "@/lib/kairos/feed-client";
import { doiThich, type TuyChon } from "@/lib/kairos/tuy-chon";
import { NHAN_CHIP_KAIROS } from "@/lib/labels";

function CongTac({ label, on, onToggle }: { label: string; on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      className="flex min-h-[3.25rem] w-full items-center gap-3 rounded-xl bg-field px-3 text-left transition active:scale-[0.99]"
    >
      <span className="min-w-0 flex-1 text-[1rem] font-semibold text-navy">{label}</span>
      <span
        aria-hidden
        className={`flex h-7 w-12 shrink-0 items-center rounded-full px-0.5 transition ${on ? "justify-end bg-ok" : "justify-start bg-line"}`}
      >
        <span className="h-6 w-6 rounded-full bg-white shadow" />
      </span>
    </button>
  );
}

export function TuyChonSheet({ value, onClose }: { value: TuyChon; onClose: (t: TuyChon) => void }) {
  const [t, setT] = useState(value);
  const [ghiHong, setGhiHong] = useState(false);
  // ref: đường đóng (Escape/vuốt/chạm nền) có thể giữ hàm onClose của lần vẽ trước — luôn trả bản MỚI nhất
  const moiNhat = useRef(value);
  const doi = (n: TuyChon) => {
    moiNhat.current = n;
    setT(n);
    setGhiHong(!saveTuyChon(n));
  };
  return (
    <BottomSheet title="Tuỳ chọn dòng tin" onClose={() => onClose(moiNhat.current)}>
      <p className="mb-3 text-[0.9375rem] text-foreground/75">Chủ đề thích sẽ lên trước, tin biển vẫn nhiều nhất.</p>
      <p className="mb-2 text-[0.75rem] font-semibold text-foreground/55">Thích đọc</p>
      <div className="space-y-2">
        {TOPICS.map((topic) => (
          <CongTac key={topic} label={NHAN_CHIP_KAIROS[topic]} on={t.thich.includes(topic)} onToggle={() => doi(doiThich(t, topic))} />
        ))}
      </div>
      <p className="mb-2 mt-4 text-[0.75rem] font-semibold text-foreground/55">Trợ lý AI</p>
      <CongTac label="Hiện bài trợ lý AI" on={t.ai} onToggle={() => doi({ ...t, ai: !t.ai })} />
      {ghiHong && (
        <p role="status" className="mt-3 text-[0.875rem] text-danger">
          Máy chưa lưu được tuỳ chọn — chỉ dùng lần này.
        </p>
      )}
    </BottomSheet>
  );
}
