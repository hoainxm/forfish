"use client";

/*
  NÚT NỔI KÉO ĐƯỢC, ẨN ĐƯỢC — khuôn dùng chung cho Sen Biển (trợ lý) và giỏ hàng.

  Ba việc file này làm, và vì sao (2026-09-07, user):
  · NẰM TRONG CỘT APP: khung `fixed` rộng đúng 480px căn giữa (y hệt `.dock-frame`),
    nút `absolute` trong khung. Trước đây nút `fixed right:1rem` neo theo mép
    TRÌNH DUYỆT nên màn rộng là nút bay ra ngoài khung app.
  · KÉO ĐƯỢC: giữ và rê là nút đi theo ngón tay; thả là NÉP về mép gần nhất và
    giữ độ cao vừa kéo (không để lơ lửng giữa màn che chữ). Chạm không rê = bấm.
  · ẨN ĐƯỢC: đẩy nút sát ra ngoài mép là nó nép vào, chỉ ló một mẩu 1,25rem
    (mờ đi) — chạm mẩu đó là hiện lại. Không giấu hẳn: bà con 40–60 tuổi giấu
    xong không biết mở lại ở đâu là mất luôn trợ lý.

  Vị trí nhớ theo máy (`lib/float-pos`, khoá `forfish.fab.v1`), đọc SAU khi
  gắn (component cha có thể SSR — đọc trong initializer là lệch hydration).

  Dời nút bằng `transform` trên LỚP BỌC, không trên nút: lớp `active:scale`
  của nút cũng viết `transform`, đặt inline lên nút là mất hiệu ứng nhấn.
*/

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as RPointerEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { DEFAULT_FLOAT_POS, loadFloatPos, saveFloatPos, settleDrop, type FloatPos } from "@/lib/float-pos";

/** Rê quá ngần này px mới tính là kéo (dưới đó là chạm rung tay). */
const DRAG_START_PX = 8;
/** Cách mép cột app. */
const EDGE = "1rem";
/** Phần còn ló khi ẩn. */
const PEEK = "1.25rem";
/** Không kéo sát mép trên hơn ngần này (px) — chừa safe-area + thanh trạng thái. */
const TOP_GAP_PX = 24;

type Props = {
  /** ngăn trong sổ vị trí — mỗi nút một tên ổn định */
  id: string;
  /** aria-label của nút (khi ẩn tự nối " — đang ẩn, chạm để hiện lại") */
  label: string;
  onPress: () => void;
  /** khoảng cách MẶC ĐỊNH tính từ đỉnh dock (CSS length), vd "0.75rem" */
  baseBottom: string;
  /** cạnh nút (CSS length) — sàn 3.5rem */
  size: string;
  /** màu/bóng của nút (token) */
  className: string;
  /** nâng thêm (px) do màn cha đo — vd tránh dải chip ngày ở Ra khơi */
  lift?: number;
  /** ref tới chính nút — màn cha cần đo hình chữ nhật */
  btnRef?: RefObject<HTMLButtonElement | null>;
  /** báo cho màn cha biết đang kéo (để tạm ngưng phép đo tự động) */
  onDragChange?: (dragging: boolean) => void;
  children: ReactNode;
};

type Drag = {
  pointerId: number;
  startX: number;
  startY: number;
  /** khoảng nút còn lên được (px) lúc bắt đầu kéo */
  headroom: number;
  moved: boolean;
};

export function FloatBtn({
  id,
  label,
  onPress,
  baseBottom,
  size,
  className,
  lift = 0,
  btnRef,
  onDragChange,
  children,
}: Props) {
  const frameRef = useRef<HTMLDivElement>(null);
  const ownBtnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<FloatPos>(DEFAULT_FLOAT_POS);
  const [offset, setOffset] = useState<{ x: number; y: number } | null>(null);
  const drag = useRef<Drag | null>(null);
  const justDragged = useRef(false);

  useEffect(() => {
    setPos(loadFloatPos(id));
  }, [id]);

  const setRefs = useCallback(
    (el: HTMLButtonElement | null) => {
      ownBtnRef.current = el;
      if (btnRef) btnRef.current = el;
    },
    [btnRef],
  );

  const commit = (next: FloatPos) => {
    setPos(next);
    saveFloatPos(id, next); // hỏng thì nút về mặc định lần mở sau — không phải sổ của bà con
  };

  const onPointerDown = (e: RPointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    const btn = ownBtnRef.current;
    const frame = frameRef.current;
    if (!btn || !frame) return;
    const b = btn.getBoundingClientRect();
    const f = frame.getBoundingClientRect();
    drag.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      headroom: Math.max(0, b.top - f.top - TOP_GAP_PX),
      moved: false,
    };
    try {
      btn.setPointerCapture(e.pointerId);
    } catch {
      /* không capture được thì vẫn kéo được khi ngón tay còn trên nút */
    }
  };

  const onPointerMove = (e: RPointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved) {
      if (Math.hypot(dx, dy) < DRAG_START_PX) return;
      d.moved = true;
      onDragChange?.(true);
    }
    setOffset({ x: dx, y: dy });
  };

  const endDrag = (e: RPointerEvent<HTMLButtonElement>, cancelled: boolean) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    drag.current = null;
    try {
      ownBtnRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* đã mất capture — không sao */
    }
    if (!d.moved) return; // chạm thường → để onClick lo (bàn phím cũng đi đường đó)
    justDragged.current = true;
    onDragChange?.(false);
    setOffset(null);
    if (cancelled) return;
    const btn = ownBtnRef.current;
    const frame = frameRef.current;
    if (!btn || !frame) return;
    const b = btn.getBoundingClientRect();
    const f = frame.getBoundingClientRect();
    commit(
      settleDrop({
        centerX: b.left + b.width / 2 - f.left,
        frameWidth: f.width,
        btnWidth: b.width,
        dyBefore: pos.dy,
        deltaY: e.clientY - d.startY,
        maxDy: pos.dy + d.headroom,
      }),
    );
  };

  const onClick = () => {
    if (justDragged.current) {
      justDragged.current = false; // click theo sau một lượt kéo — không phải bấm
      return;
    }
    if (pos.tucked) {
      commit({ ...pos, tucked: false });
      return;
    }
    onPress();
  };

  const dragging = offset !== null;
  let transform = "none";
  if (dragging) transform = `translate(${offset.x}px, ${offset.y}px)`;
  else if (pos.tucked) {
    const out = `calc(${size} + ${EDGE} - ${PEEK})`;
    transform = pos.side === "right" ? `translateX(${out})` : `translateX(calc(-1 * ${out}))`;
  }

  return (
    <div
      ref={frameRef}
      /*  `overflow-hidden`: phần nút nép ra ngoài mép cột bị CẮT — trên điện
          thoại cột = màn nên tự cắt, còn màn rộng thì không có gì cắt, nút "ẩn"
          lại lòi nguyên ra cạnh cột (đo thật 2026-09-07). */
      className="pointer-events-none fixed inset-x-0 top-0 z-20 mx-auto max-w-[480px] overflow-hidden"
      style={{ height: "var(--app-vh, 100dvh)" }}
    >
      <div
        className={`pointer-events-auto absolute ${dragging ? "" : "transition-transform duration-200"}`}
        style={{
          [pos.side]: EDGE,
          bottom: `calc(var(--dock-total) + ${baseBottom} + ${pos.dy}px)`,
          marginBottom: lift,
          transform,
        }}
      >
        <button
          ref={setRefs}
          type="button"
          onClick={onClick}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={(e) => endDrag(e, false)}
          onPointerCancel={(e) => endDrag(e, true)}
          aria-label={pos.tucked ? `${label} — đang ẩn, chạm để hiện lại` : label}
          className={`relative flex select-none flex-col items-center justify-center gap-0.5 rounded-full transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sun ${
            dragging ? "scale-105 shadow-xl" : "active:scale-[0.95]"
          } ${pos.tucked ? "opacity-70" : ""} ${className}`}
          style={{ width: size, height: size, touchAction: "none" }}
        >
          {children}
        </button>
      </div>
    </div>
  );
}
