"use client";

/**
 * Trục 1 — TỰ TẢI SẴN DỰ BÁO + một dòng báo tự tắt.
 *
 * Trước 2026-07-25 chỗ này là thẻ "Chuẩn bị đi biển": một nút to + thẻ xanh báo
 * xong + một dòng thường trực "Trong máy: …". Chủ dự án xem app thật thấy màn
 * hình RỐI vì quá nhiều chữ nằm lì trên bản đồ → bỏ cả ba, máy tự lo.
 *
 * Cách hiện học theo banner tin bão (components/storm-banner.tsx): một dòng gọn
 * bo tròn, nổi trên bản đồ, nói xong thì TỰ TẮT — không có nút, không chắn view.
 *
 * TIẾT CHẾ DATA: mỗi lượt tải sẵn ≈ 2,5–3 MB. Cửa chặn (còn mới / mất sóng /
 * đã chạy rồi) nằm ở lib/pretrip-auto.ts — xem lý do ở đó.
 */

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  runPretrip,
  savedSummary,
  type PretripPoint,
  type SavedSummary,
} from "@/lib/pretrip";
import {
  autoPretripLine,
  lastAutoPretripAt,
  markAutoPretripRun,
  pretripSavedText,
  shouldAutoPretrip,
  type PretripSavedPhase,
} from "@/lib/pretrip-auto";
import { AlertIcon, CheckIcon } from "@/components/icons";

/* Trạng thái tải sẵn dùng CHUNG cho dòng nổi tự tắt (PretripAutoNotify) và nhãn
   nhỏ thường trực trên box biển động (PretripSavedStatus). Store nhỏ ở mức
   module + useSyncExternalStore để hai chỗ luôn khớp mà không phải nâng state
   lên tận trang. */
let sharedPhase: PretripSavedPhase = "idle";
const phaseSubs = new Set<() => void>();
function setSharedPhase(p: PretripSavedPhase) {
  sharedPhase = p;
  phaseSubs.forEach((f) => f());
}
function subscribePhase(f: () => void) {
  phaseSubs.add(f);
  return () => {
    phaseSubs.delete(f);
  };
}

/**
 * Nói xong thì tắt sau ngần này — đủ đọc một dòng, rồi trả lại bản đồ.
 * Xuất ra để MỌI dòng báo nổi trên bản đồ tắt cùng một nhịp (vd nhắc "mất
 * sóng — đang dùng bản đồ lưu trong máy" ở fishing-map-view).
 */
export const NOTIFY_HIDE_MS = 5000;

/**
 * CHỈ MỘT LẦN mỗi lần mở app. Để ở mức module (không phải state) nên vẽ lại,
 * đóng/mở sheet hay đổi qua lại trong màn đều KHÔNG gọi tải lại.
 */
let startedThisLoad = false;

type Note = { text: string; kind: "busy" | "ok" | "warn" };

export function PretripAutoNotify({ points }: { points: PretripPoint[] }) {
  const [note, setNote] = useState<Note | null>(null);
  // chỗ tải sẵn có thể đổi khi bà con ghim thêm điểm — lấy bản mới nhất lúc
  // chạy, nhưng KHÔNG để nó kích hoạt chạy lại
  const pointsRef = useRef(points);
  useEffect(() => {
    pointsRef.current = points;
  }, [points]);

  useEffect(() => {
    if (startedThisLoad) return;
    startedThisLoad = true;

    const online =
      typeof navigator === "undefined" ? true : navigator.onLine !== false;
    const go = shouldAutoPretrip({
      lastRunAt: lastAutoPretripAt(),
      nowMs: Date.now(),
      online,
    });
    // Bản còn mới hoặc đang mất sóng → IM LẶNG hoàn toàn, không báo gì cả.
    if (!go) return;

    setNote({ text: "Đang tải dự báo…", kind: "busy" });
    setSharedPhase("loading");
    runPretrip(pointsRef.current)
      .then((r) => {
        markAutoPretripRun();
        const ok = !r.full && r.ok > 0 && r.saved.places > 0 && !!r.saved.untilIso;
        setNote({ text: autoPretripLine(r), kind: ok ? "ok" : "warn" });
      })
      .catch(() => {
        setNote({ text: "Chưa tải được dự báo — chưa có sóng.", kind: "warn" });
      })
      .finally(() => setSharedPhase("idle"));
  }, []);

  // tự tắt sau khi đã nói xong (lúc đang tải thì cứ để đó)
  useEffect(() => {
    if (!note || note.kind === "busy") return;
    const t = setTimeout(() => setNote(null), NOTIFY_HIDE_MS);
    return () => clearTimeout(t);
  }, [note]);

  if (!note) return null;

  const skin =
    note.kind === "ok"
      ? "bg-ok-bg text-ok"
      : note.kind === "warn"
        ? "bg-warn-bg text-warn"
        : "bg-card/95 text-navy";

  return (
    <p
      role="status"
      className={`pointer-events-none mx-auto flex w-fit max-w-[92%] items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.875rem] font-bold leading-snug shadow-md ${skin}`}
    >
      {note.kind === "ok" && <CheckIcon className="h-4 w-4 shrink-0" />}
      {note.kind === "warn" && <AlertIcon className="h-4 w-4 shrink-0" />}
      {note.text}
    </p>
  );
}

/**
 * Nhãn NHỎ THƯỜNG TRỰC sát trên box biển động — bà con liếc là biết trong máy đã
 * có dự báo tới ngày nào (sẵn sàng ra khơi chưa), khác dòng nổi tự tắt ở trên.
 * Đọc thẳng "trong máy có gì" (savedSummary) + bám phase tải sẵn để đổi câu.
 */
export function PretripSavedStatus() {
  const phase = useSyncExternalStore(
    subscribePhase,
    () => sharedPhase,
    () => "idle" as PretripSavedPhase,
  );
  const [saved, setSaved] = useState<SavedSummary | null>(null);

  // đọc lại "trong máy có gì" khi vào màn + mỗi lần phase đổi (tải xong → cập nhật)
  useEffect(() => {
    const read = () => setSaved(savedSummary());
    read();
    return subscribePhase(read);
  }, []);

  const text = pretripSavedText(phase, saved);
  const tone =
    phase === "loading"
      ? "text-navy"
      : saved && saved.places > 0 && saved.untilIso
        ? "text-ok"
        : "text-warn";

  return (
    <span
      role="status"
      className={`pointer-events-none inline-flex items-center rounded-full bg-card/95 px-2.5 py-1 text-[0.8125rem] font-bold shadow-sm ring-1 ring-line ${tone}`}
    >
      {text}
    </span>
  );
}
