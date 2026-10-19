"use client";

/*
  CHẠM / KÉO NGANG để chọn trên một trục (dải 30 ngày, đường nước một ngày) —
  dùng chung cho màn con nước (2026-10-19, anh Quân: "thao tác vuốt khó, phải
  làm nhiều lần mới được").

  GỐC LỖI: dải tháng chỉ nghe `onClick`. Trong sheet cuộn dọc, ngón tay xê dịch
  một chút là trình duyệt coi như bắt đầu cuộn và HUỶ cú click — bà con chạm
  mấy lần mới ăn một lần; còn vuốt ngang dọc dải thì không có gì xảy ra.

  CÁCH SỬA (cùng họ `time-scrubber.tsx`, khác ở một chỗ): pointer events +
  setPointerCapture, nhưng `touch-action: pan-y` thay vì `none` — vùng này
  nằm GIỮA sheet cuộn dọc, khoá hẳn cảm ứng thì bà con đặt ngón lên đồ thị là
  không cuộn sheet được nữa. Kéo ngang = chọn; kéo dọc = trình duyệt cuộn sheet
  (nó gửi pointercancel, ta bỏ qua). Chạm gọn (nhấc tay không bị huỷ) = chọn.
*/

import { useRef } from "react";

/** Ngón tay đi ngang quá chừng này (px) mới tính là kéo — dưới đó là chạm run tay. */
const DRAG_SLOP_PX = 6;

/**
 * Vị trí ngón tay trong VÙNG VẼ của một SVG co giãn theo bề ngang: 0 = mép trái
 * vùng vẽ, 1 = mép phải. `padL`/`padR` tính theo đơn vị viewBox (`viewW`).
 * Không kẹp — người gọi tự kẹp theo luật của trục mình.
 */
export function fracInPlot(
  clientX: number,
  rectLeft: number,
  rectWidth: number,
  viewW: number,
  padL = 0,
  padR = 0,
): number {
  const plot = viewW - padL - padR;
  if (!(rectWidth > 0) || !(plot > 0) || !Number.isFinite(clientX)) return NaN;
  const x = ((clientX - rectLeft) / rectWidth) * viewW;
  return (x - padL) / plot;
}

/**
 * Bộ handler gắn thẳng vào phần tử: `onPick(clientX, rect)` gọi khi chạm gọn
 * hoặc liên tục khi đang kéo ngang. Trả kèm `className` cho touch-action.
 */
export function usePointerScrub(onPick: (clientX: number, rect: DOMRect) => void) {
  const st = useRef<{ id: number; x0: number; dragging: boolean } | null>(null);
  const pick = (e: React.PointerEvent<HTMLElement>) => onPick(e.clientX, e.currentTarget.getBoundingClientRect());
  return {
    className: "touch-pan-y select-none",
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      st.current = { id: e.pointerId, x0: e.clientX, dragging: false };
    },
    onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
      const s = st.current;
      if (!s || s.id !== e.pointerId) return;
      if (!s.dragging) {
        if (Math.abs(e.clientX - s.x0) < DRAG_SLOP_PX) return;
        s.dragging = true;
        // giữ ngón tay dù trượt ra ngoài đồ thị — kéo tới mép vẫn ăn. Máy cũ /
        // pointer đã nhả có thể ném: mất capture thì thôi, KHÔNG được mất nhịp kéo
        try {
          e.currentTarget.setPointerCapture?.(e.pointerId);
        } catch {
          /* bỏ qua */
        }
      }
      pick(e);
    },
    onPointerUp: (e: React.PointerEvent<HTMLElement>) => {
      const s = st.current;
      st.current = null;
      if (s && s.id === e.pointerId) pick(e);
    },
    // trình duyệt giành ngón tay để cuộn dọc sheet — không chọn gì
    onPointerCancel: () => {
      st.current = null;
    },
  };
}
