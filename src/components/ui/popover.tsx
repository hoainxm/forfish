"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { viTriNeoNut } from "@/lib/the-noi-vi-tri";
import { useEscape } from "@/lib/use-escape";

/*
  POPOVER NEO CẠNH NÚT — primitive dùng chung (03 §6 mục 9, anh Long 2026-10-23: "click từ nút
  thì nó hiện ra bên cạnh nút vì lúc đó tay họ đang ở gần nút rồi, tự dưng kéo xuống dưới cả
  thì nó không thuận tiện").

  Dùng cho: menu, danh sách chọn ngắn, panel lớp nhỏ. KHÔNG dùng cho form nhiều trường, nội
  dung dài cần đọc, hộp xác nhận — mấy loại đó vẫn là BottomSheet / ConfirmDialog.

  · Vị trí: `lib/the-noi-vi-tri` `viTriNeoNut` — ngay dưới nút, thiếu chỗ thì lật lên; nút nửa
    phải canh mép phải, nửa trái canh mép trái; kẹp trong KHUNG = cột app (≤480px) từ đỉnh màn
    tới mép trên dock (`.bottom-dock`). Cả hai phía chật ⇒ `maxHeight` + cuộn trong.
  · Đo lại khi lớp nổi đổi cỡ (ResizeObserver), khi xoay/đổi cỡ cửa sổ, khi cuộn trang.
  · Đóng: Escape · chạm ra ngoài (trừ chính nút mở — nút tự lo bật/tắt) · bên gọi. Đóng xong
    trả focus về nút. Mở ra: focus phần tử đầu tiên trong lớp nổi (bàn phím đi tiếp được).
  · Portal ra body, `fixed`, z-40 — nổi trên ngăn đáy/bản đồ (mở từ trong ngăn vẫn thấy).
  · Chuyển động (Emil): nở từ phía NÚT (transform-origin theo hướng lật), 180ms ease-out.
*/
export function Popover({
  anchor,
  onClose,
  children,
  label,
  className = "",
  role = "dialog",
}: {
  /** phần tử nút mở — lớp nổi neo theo khung chữ nhật của nó */
  anchor: HTMLElement | null;
  onClose: () => void;
  children: React.ReactNode;
  /** aria-label của lớp nổi */
  label: string;
  /** bề ngang + nền… — mặc định w-[16rem] */
  className?: string;
  role?: "dialog" | "menu";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [goc, setGoc] = useState("top right");

  const dat = useCallback(() => {
    const el = ref.current;
    if (!el || !anchor) return;
    const vw = window.innerWidth;
    const khungW = Math.min(vw, el.ownerDocument.documentElement.clientWidth);
    const colW = Math.min(khungW, parseFloat(getComputedStyle(el).getPropertyValue("--w-app")) || 480);
    const x0 = (khungW - colW) / 2;
    const dock = document.querySelector(".bottom-dock");
    const dockTop = dock ? dock.getBoundingClientRect().top : window.innerHeight;
    const ph = dockTop > 0 ? dockTop : window.innerHeight;
    const r = anchor.getBoundingClientRect();
    // đo cỡ TỰ NHIÊN (bỏ maxHeight cũ trước khi đo)
    el.style.maxHeight = "";
    const v = viTriNeoNut({
      nut: { left: r.left - x0, top: r.top, right: r.right - x0, bottom: r.bottom },
      w: el.offsetWidth,
      h: el.scrollHeight,
      pw: colW,
      ph,
    });
    el.style.left = `${x0 + v.left}px`;
    el.style.top = `${v.top}px`;
    el.style.maxHeight = `${v.maxH}px`;
    setGoc(`${v.tren ? "bottom" : "top"} ${v.canhPhai ? "right" : "left"}`);
  }, [anchor]);

  useLayoutEffect(() => {
    if (!mounted) return;
    dat();
    const el = ref.current;
    const ro = typeof ResizeObserver !== "undefined" && el ? new ResizeObserver(dat) : null;
    if (ro && el) ro.observe(el);
    window.addEventListener("resize", dat);
    window.addEventListener("scroll", dat, true);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", dat);
      window.removeEventListener("scroll", dat, true);
    };
  }, [mounted, dat]);

  // focus vào KHUNG lớp nổi khi mở (không vào nút đầu — tránh vòng focus đậm trên nút × mỗi
  // lần chạm mở; bàn phím Tab là vào nút đầu); trả focus về nút khi đóng
  useEffect(() => {
    if (!mounted) return;
    ref.current?.focus({ preventScroll: true });
    return () => {
      anchor?.focus?.({ preventScroll: true });
    };
  }, [mounted, anchor]);

  useEscape(true, onClose);

  // chạm ra ngoài ⇒ đóng (pha capture; bỏ qua chính nút mở — nút tự bật/tắt)
  useEffect(() => {
    const ngoai = (e: PointerEvent) => {
      const t = e.target as Node | null;
      if (!t || ref.current?.contains(t) || anchor?.contains(t)) return;
      onClose();
    };
    document.addEventListener("pointerdown", ngoai, true);
    return () => document.removeEventListener("pointerdown", ngoai, true);
  }, [anchor, onClose]);

  if (!mounted) return null;
  return createPortal(
    <div
      ref={ref}
      role={role}
      aria-label={label}
      tabIndex={-1}
      style={{ transformOrigin: goc }}
      className={`anim-pop-in fixed z-40 overflow-y-auto rounded-2xl outline-none border border-line bg-card shadow-float [overscroll-behavior:contain] ${
        className || "w-[16rem]"
      }`}
    >
      {children}
    </div>,
    document.body,
  );
}
