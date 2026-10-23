"use client";

import { viTriTheNoi } from "@/lib/the-noi-vi-tri";

/*
  Callback ref đặt vị trí THẺ NỔI theo khung bản đồ thật (lib/the-noi-vi-tri.ts). Dùng:
    <div ref={(el) => kepTheTrongKhung(el, info.x, info.y)} className="absolute …">
  Hàm mới mỗi lần vẽ ⇒ React gọi lại khi điểm chạm đổi. Đo lại khi thẻ đổi cỡ (thẻ độ sâu
  nạp con nước muộn) bằng ResizeObserver; trả hàm dọn (React 19 callback-ref cleanup).
  Chạy trong pha commit, TRƯỚC khi trình duyệt vẽ ⇒ không nháy ở góc trên-trái.
*/
export function kepTheTrongKhung(el: HTMLElement | null, x: number, y: number) {
  if (!el) return;
  const dat = () => {
    const cha = el.offsetParent as HTMLElement | null;
    if (!cha) return;
    const v = viTriTheNoi({
      x,
      y,
      w: el.offsetWidth,
      h: el.offsetHeight,
      pw: cha.clientWidth,
      ph: cha.clientHeight,
    });
    el.style.left = `${v.left}px`;
    el.style.top = `${v.top}px`;
  };
  dat();
  if (typeof ResizeObserver === "undefined") return;
  const ro = new ResizeObserver(dat);
  ro.observe(el);
  return () => ro.disconnect();
}
