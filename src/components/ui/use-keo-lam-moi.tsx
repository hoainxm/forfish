"use client";

import { useEffect, useRef, useState } from "react";
import { nguongKeo, quangKeo, trangThaiKeo, type TrangThaiKeo } from "@/lib/kairos/keo-lam-moi";

/*
  VUỐT XUỐNG LÀM MỚI dùng chung (tách từ kairos-feed 2026-10-25, rà FB §2 — cho /cho, /ban-hang, Thông báo,
  /tien, /cang). Hành vi y Kairos: đang ở ĐẦU TRANG (window.scrollY ≤ 0) mà kéo xuống ≥ KEO_LAM_MOI rem rồi thả ⇒
  gọi `onRefresh`; tắt "kéo tải lại cả trang" của trình duyệt (overscroll-behavior-y: contain) khi hook sống.
  Không bắt khi đang có hộp/ngăn mở ([role=dialog] / aria-modal / nền đang khoá cuộn). Ngưỡng theo rem của máy
  (chữ to vẫn đúng). Mất sóng vẫn cho kéo — `onRefresh` của màn tự giữ bản đang hiện + báo mất sóng.
  Luật thuần (ngưỡng, trạng thái, quãng nặng tay) ở lib/kairos/keo-lam-moi.ts, có test.
*/

export type TrangThaiLamMoi = TrangThaiKeo | "lam-moi";

/** Đang mở hộp/ngăn hoặc trang đang khoá cuộn ⇒ không bắt vuốt làm mới. */
export function dangCoHop(target: EventTarget | null): boolean {
  if (target instanceof Element && target.closest("[role=dialog]")) return true;
  if (document.querySelector('[aria-modal="true"]')) return true;
  const b = document.body;
  return b.style.overflow === "hidden" || b.style.position === "fixed" || getComputedStyle(b).overflowY === "hidden";
}

export function useKeoLamMoi(onRefresh: () => void | Promise<void>, { disabled = false }: { disabled?: boolean } = {}) {
  const [keo, setKeo] = useState(0);
  const [dangLamMoi, setDangLamMoi] = useState(false);
  /** px của 1rem trên máy này (chế độ chữ to ⇒ lớn hơn 16) — ngưỡng kéo + chiều cao vùng kéo dùng chung */
  const [rem, setRem] = useState(16);
  const nguong = nguongKeo(rem);
  const keoRef = useRef<{ y0: number | null; d: number }>({ y0: null, d: 0 });
  const lamMoiRef = useRef(onRefresh);
  useEffect(() => {
    lamMoiRef.current = onRefresh;
  });

  useEffect(() => {
    if (disabled) return;
    const html = document.documentElement;
    const cu = html.style.overscrollBehaviorY;
    html.style.overscrollBehaviorY = "contain";
    const r = parseFloat(getComputedStyle(html).fontSize);
    setRem(Number.isFinite(r) && r > 0 ? r : 16);
    const nguong = nguongKeo(r);
    const bat = (e: TouchEvent) => {
      const ok = window.scrollY <= 0 && e.touches.length === 1 && !dangCoHop(e.target);
      keoRef.current = { y0: ok ? e.touches[0].clientY : null, d: 0 };
    };
    const di = (e: TouchEvent) => {
      const k = keoRef.current;
      if (k.y0 == null) return;
      const d = e.touches[0].clientY - k.y0;
      if (d <= 0 || window.scrollY > 0) {
        if (k.d) setKeo(0);
        k.d = 0;
        return;
      }
      k.d = quangKeo(d, nguong);
      setKeo(k.d);
    };
    const tha = () => {
      const k = keoRef.current;
      const du = trangThaiKeo(k.d, nguong) === "tha";
      keoRef.current = { y0: null, d: 0 };
      setKeo(0);
      if (!du) return;
      void (async () => {
        setDangLamMoi(true);
        try {
          await lamMoiRef.current();
        } finally {
          setDangLamMoi(false);
        }
      })();
    };
    window.addEventListener("touchstart", bat, { passive: true });
    window.addEventListener("touchmove", di, { passive: true });
    window.addEventListener("touchend", tha);
    window.addEventListener("touchcancel", tha);
    return () => {
      html.style.overscrollBehaviorY = cu;
      window.removeEventListener("touchstart", bat);
      window.removeEventListener("touchmove", di);
      window.removeEventListener("touchend", tha);
      window.removeEventListener("touchcancel", tha);
    };
  }, [disabled]);

  const trangThai: TrangThaiLamMoi = dangLamMoi ? "lam-moi" : trangThaiKeo(keo, nguong);
  return { keo, rem, nguong, dangLamMoi, trangThai, chi: { keo, rem, trangThai } };
}

/** Vòng quay nhỏ đầu danh sách — đặt NGAY TRÊN danh sách: `<KeoLamMoiChi {...hook.chi} />`. Nghỉ ⇒ không vẽ gì. */
export function KeoLamMoiChi({ keo, rem, trangThai }: { keo: number; rem: number; trangThai: TrangThaiLamMoi }) {
  if (trangThai === "nghi") return null;
  const lamMoi = trangThai === "lam-moi";
  return (
    <div
      aria-live="polite"
      className="flex items-end justify-center overflow-hidden text-[0.875rem] font-semibold text-foreground/65"
      style={{ height: lamMoi ? "2.5rem" : `${keo / rem}rem` }}
    >
      <span className="flex items-center gap-2 pb-2">
        {lamMoi && <span aria-hidden className="h-4 w-4 animate-spin rounded-full border-2 border-sea border-t-transparent motion-reduce:animate-none" />}
        {lamMoi ? "Đang làm mới…" : trangThai === "tha" ? "Thả để làm mới" : "Kéo để làm mới"}
      </span>
    </div>
  );
}
