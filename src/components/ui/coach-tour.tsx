"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon, CloseIcon } from "@/components/icons";
import { type TourStep } from "@/lib/tour";

/*
  COACH-MARK — hướng dẫn thao tác NGAY TRÊN MÀN HÌNH thật.

  Cách hoạt động: mỗi bước tìm nút mang `data-tour="<target>"`, cuộn nút đó
  vào giữa màn, khoét một "lỗ sáng" quanh nút (phần còn lại tối đi) rồi đặt
  thẻ giải thích ngay cạnh. Bước không có nút (`target: null`) thì thẻ nằm
  giữa màn.

  Vì sao khoét lỗ bằng box-shadow spread thay vì SVG mask: một thẻ div,
  không phụ thuộc kích thước màn, bo góc mượt, chạy được cả trên WebView cũ.

  Design system: chữ ≥18px, nút ≥56px, pill, icon stroke + chữ (không emoji),
  chuyển động điềm đạm dùng .anim-scrim-in/.anim-pop-in của globals.css.
*/

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

/** khoảng hở quanh nút được chỉ (px) */
const PAD = 10;
/** khoảng cách từ nút tới thẻ giải thích (px) */
const GAP = 14;

export function CoachTour({
  steps,
  screen,
  onClose,
  onDisable,
}: {
  steps: TourStep[];
  /** tên màn hiện trên đầu thẻ, vd "Tàu của tôi" */
  screen: string;
  /** gọi khi xem xong HOẶC bấm bỏ qua — cả hai đều đánh dấu "đã xem" */
  onClose: () => void;
  /** tắt hẳn chỉ dẫn (nút "không hiện nữa" ở bước cuối) — có thì mới bày nút */
  onDisable?: () => void;
}) {
  const [i, setI] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const [vh, setVh] = useState(0);
  // chiều cao THẬT của thẻ — ước lượng cứng thì nút "Tiếp" bị cắt khỏi màn
  // khi nút được chỉ cao (lưới 4 ô ở Trang chủ cao 336px)
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [cardH, setCardH] = useState(0);

  const step = steps[i];
  const last = i === steps.length - 1;
  const target = step?.target ?? null;

  const back = useCallback(() => setI((n) => Math.max(0, n - 1)), []);
  // KHÔNG gọi onClose bên trong updater của setI — đó là setState lúc render
  // của component khác (React cảnh báo "setstate-in-render").
  const next = useCallback(() => {
    if (i + 1 >= steps.length) onClose();
    else setI(i + 1);
  }, [i, steps.length, onClose]);

  // Đo vị trí nút của bước hiện tại. Cuộn nút vào giữa màn TRƯỚC rồi đo lại
  // sau khi cuộn xong — nếu đo ngay thì lỗ sáng lệch khỏi nút.
  useEffect(() => {
    setVh(window.innerHeight);
    if (!target) {
      setBox(null);
      return;
    }
    const el = document.querySelector<HTMLElement>(`[data-tour="${target}"]`);
    if (!el) {
      setBox(null);
      return;
    }
    let alive = true;
    const measure = () => {
      if (!alive) return;
      const r = el.getBoundingClientRect();
      setVh(window.innerHeight);
      setBox({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    measure();
    const t = window.setTimeout(measure, 400);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      alive = false;
      window.clearTimeout(t);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [target]);

  // Đo thẻ sau khi vẽ — nội dung mỗi bước dài ngắn khác nhau, cỡ chữ "Chữ to"
  // còn làm thẻ cao thêm; đo thật mới đặt đúng chỗ.
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const m = () => setCardH(el.getBoundingClientRect().height);
    m();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(m);
    ro.observe(el);
    return () => ro.disconnect();
  }, [i]);

  // Phím Esc = bỏ qua (bàn phím ngoài / máy tính bảng có bàn phím)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!step) return null;

  // Thẻ đặt DƯỚI nút nếu đủ chỗ, không thì TRÊN nút, không nữa thì ép sát
  // đáy màn (nút được chỉ to gần bằng màn — vẫn phải bấm được nút "Tiếp").
  // Không có nút thì thả giữa màn.
  const below = box ? box.top + box.height + PAD + GAP : 0;
  const above = box ? box.top - PAD - GAP : 0;
  const cardPos: React.CSSProperties = !box
    ? { top: "50%", transform: "translateY(-50%)" }
    : cardH === 0 || cardH <= vh - below - GAP
      ? { top: below }
      : cardH <= above - GAP
        ? { top: above - cardH }
        : { top: Math.max(GAP, vh - cardH - GAP) };

  return (
    <div
      className="fixed inset-0 z-[70]"
      role="dialog"
      aria-modal="true"
      aria-label={`Hướng dẫn màn ${screen}`}
    >
      {box ? (
        <div
          className="anim-scrim-in pointer-events-none absolute rounded-[1.25rem]"
          style={{
            top: box.top - PAD,
            left: box.left - PAD,
            width: box.width + PAD * 2,
            height: box.height + PAD * 2,
            boxShadow:
              "0 0 0 9999px rgba(8,24,40,0.74), 0 0 0 3px rgba(255,255,255,0.9)",
          }}
        />
      ) : (
        <div
          className="anim-scrim-in absolute inset-0"
          style={{ backgroundColor: "rgba(8,24,40,0.74)" }}
        />
      )}

      <div
        ref={cardRef}
        className="anim-pop-in absolute left-3 right-3 mx-auto max-w-[456px] rounded-[1.25rem] bg-card p-4 shadow-[0_18px_40px_-12px_rgba(8,24,40,0.6)]"
        style={cardPos}
      >
        <div className="mb-2 flex items-start gap-2">
          <p className="flex-1 text-[0.875rem] font-bold uppercase tracking-[0.12em] text-foreground/60">
            {screen} · bước {i + 1}/{steps.length}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="-mr-1.5 -mt-1.5 flex min-h-[2.75rem] min-w-[2.75rem] items-center justify-center rounded-full text-foreground/70 active:bg-field"
            aria-label="Bỏ qua hướng dẫn"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <h2 className="display text-[1.25rem] font-bold leading-tight text-navy">
          {step.title}
        </h2>
        <p className="mt-1.5 text-[1.125rem] leading-snug text-foreground/85">
          {step.body}
        </p>

        <div className="mt-3.5 flex gap-2">
          {i > 0 && (
            <button
              type="button"
              onClick={back}
              className="flex min-h-[3.5rem] shrink-0 items-center gap-1 rounded-full bg-field px-4 text-[1rem] font-bold text-navy active:scale-[0.98]"
            >
              <ChevronLeftIcon className="h-5 w-5" />
              Quay lại
            </button>
          )}
          <button
            type="button"
            onClick={next}
            className="display flex min-h-[3.5rem] flex-1 items-center justify-center gap-1.5 rounded-full bg-navy text-[1.125rem] font-bold text-white active:scale-[0.98]"
          >
            {last ? "Xong" : "Tiếp"}
            {!last && <ChevronRightIcon className="h-5 w-5" />}
          </button>
        </div>

        {/* Bước cuối: cho tắt hẳn NGAY tại chỗ vừa xem xong (bà con quen rồi
            thì không phải mò vào Cài đặt). Tắt = ẩn nút nổi + không tự chạy. */}
        {last && onDisable && (
          <button
            type="button"
            onClick={() => {
              onDisable();
              onClose();
            }}
            className="mt-2.5 flex min-h-[3rem] w-full items-center justify-center rounded-full text-[1rem] font-bold text-foreground/60 active:bg-field"
          >
            Tắt hướng dẫn, không hiện nữa
          </button>
        )}
      </div>
    </div>
  );
}
