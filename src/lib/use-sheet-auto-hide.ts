"use client";

/*
  ĐIỀU PHỐI NGĂN GIÓ SÓNG — MỘT NGUỒN cho màn bản đồ và test (rà Codex lần 9:
  test luồng trước đây tự chép lại phần nối, luật thật lệch mà test vẫn xanh).

  Hai hook vì một lý do bố cục của fishing-map-view: các callback dùng đồng hồ
  (`onInteract`, `hideSheetForOverlay`) khai RẤT SỚM trong thân component, còn
  `borderLocked` / `loading` tính MÃI phía dưới — đọc state khai sau là TDZ,
  React Compiler chặn build (02 §14). Nên:
    · `useSheetAutoHide(size, setSize)` gọi SỚM → trả `arm` / `clear` /
      `forceHide` / ghim; các cờ nằm trong ref.
    · `useSheetAutoHideSync(ctl, { size, border, loading, resetKey })` gọi MUỘN
      (sau khi biết ranh giới / đang tải) → nạp ref, mở ngăn khi sát ranh giới,
      lên lịch đồng hồ.
  Luật thuần (ai được thu, khi nào phải mở) ở `lib/sheet-hold.ts`.
*/
import { useCallback, useEffect, useRef, useState } from "react";
import { canAutoHide, canForceHide, heldAfterSize, mustOpenForBorder } from "@/lib/sheet-hold";

/** 3 giây buông tay thì ngăn tự thu (07 §10.7) */
export const SHEET_AUTO_HIDE_MS = 3000;

type SetSize = (s: "hidden" | "half") => void;

/** Đang đọc bằng bàn phím / trình đọc màn hình bên trong sheet? (`:focus-visible`
 *  nằm trong `[data-snap-sheet]`). Chạm ngón tay không bật `:focus-visible`. */
function dangDocBangPhim(): boolean {
  if (typeof document === "undefined") return false;
  const a = document.activeElement;
  if (!(a instanceof HTMLElement) || !a.closest("[data-snap-sheet]")) return false;
  try {
    return a.matches(":focus-visible");
  } catch {
    return false; // môi trường không hiểu :focus-visible (jsdom cũ) ⇒ coi như chạm
  }
}

export type SheetAutoHide = ReturnType<typeof useSheetAutoHide>;

export function useSheetAutoHide(size: string, setSize: SetSize, hideMs = SHEET_AUTO_HIDE_MS) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** cấm ĐỒNG HỒ (ranh giới HOẶC ghim) — đọc trong `arm` mỗi cú chạm */
  const noAutoRef = useRef(false);
  /** riêng RANH GIỚI — cấm cả ép ẩn */
  const borderRef = useRef(false);
  /** lượt tải số chưa ngã ngũ — `arm` cũng phải biết, không chỉ effect (rà Codex
   *  lần 10: chạm trong ngăn lúc đang tải gọi `arm` ⇒ ngăn thu khi số chưa hiện) */
  const loadingRef = useRef(false);
  const [heldRaw, setHeld] = useState(false);
  // mọi đường thu ngăn đều bỏ ghim — suy ra lúc render, không bắt từng chỗ setSize
  const held = heldAfterSize(heldRaw, size);
  if (heldRaw && !held) setHeld(false);

  const clear = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  /*  NẠP LẠI ĐỒNG HỒ — gọi từ `onInteract` mỗi cú chạm/cuộn/phím trong sheet.
      Guard nằm Ở ĐÂY chứ không chỉ ở effect (lỗi thật 2026-08-28): chạm trong
      sheet không đổi state nào, effect không chạy lại, guard ở effect là lọt.
      Đến giờ mà đang đọc bằng bàn phím trong sheet thì HẸN LẠI, không thu. */
  const arm = useCallback(() => {
    clear();
    if (size === "hidden" || noAutoRef.current || loadingRef.current) return;
    const fire = () => {
      if (dangDocBangPhim()) {
        timer.current = setTimeout(fire, hideMs);
        return;
      }
      setSize("hidden");
    };
    timer.current = setTimeout(fire, hideMs);
  }, [clear, size, setSize, hideMs]);

  /** Lớp nổi khác xin ép ẩn ngăn. Trả `true` nếu đã ẩn — sát ranh giới thì TỪ
   *  CHỐI (giấu cảnh báo an toàn là cấm); "Giữ mở" KHÔNG chặn (không chồng bảng). */
  const forceHide = useCallback((): boolean => {
    if (!canForceHide({ border: borderRef.current, held: false })) return false;
    setSize("hidden");
    return true;
  }, [setSize]);

  return { held, setHeld, arm, clear, forceHide, noAutoRef, borderRef, loadingRef };
}

export function useSheetAutoHideSync(
  ctl: SheetAutoHide,
  setSize: SetSize,
  {
    size,
    border,
    loading,
    resetKey,
  }: {
    size: string;
    /** rất gần / ngoài ranh giới tại điểm đang xem */
    border: boolean;
    /** lượt tải số chưa ngã ngũ — chưa đếm giờ (đếm từ lúc số hiện, không từ lúc chạm) */
    loading: boolean;
    /** đổi điểm xem ⇒ đếm lại từ đầu */
    resetKey: string;
  },
) {
  /*  SÁT RANH GIỚI mà ngăn chỉ là viên (`peek`) ⇒ mở `half` cho dòng đỏ HIỆN —
      lưới an toàn cho MỌI đường đưa con trỏ tới sát biên. `hidden` do người dùng
      tự Thu thì tôn trọng. */
  if (mustOpenForBorder({ border, held: false }, size)) setSize("half");

  const { arm, clear, held, noAutoRef, borderRef, loadingRef } = ctl;
  useEffect(() => {
    // nạp cờ TRƯỚC khi quyết — `arm` và `forceHide` đọc các ref này
    borderRef.current = border;
    loadingRef.current = loading;
    noAutoRef.current = !canAutoHide({ border, held });
    if (size === "hidden" || noAutoRef.current || loading) {
      clear();
      return;
    }
    arm();
    return clear;
  }, [size, border, held, loading, resetKey, arm, clear, noAutoRef, borderRef, loadingRef]);
}
