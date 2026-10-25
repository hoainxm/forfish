import { useCallback, useEffect, useId, useRef } from "react";

/*
  HỘP THOẠI DÙNG CHUNG — khoá cuộn nền + giữ focus trong hộp (rà bố cục 2026-10-22).
  Trước đây chỉ BottomSheet có hai thứ này (viết riêng trong file); ConfirmDialog thì không
  khoá cuộn, không giữ focus (Tab chạy ra trang dưới nền mờ). Một nguồn cho mọi hộp.
*/

/*  Khóa cuộn nền ĐẾM THAM CHIẾU (module-level) — mở sheet B từ trong sheet A, hay hộp xác
    nhận từ trong sheet: chỉ khóa ở hộp đầu, chỉ mở khóa khi hộp cuối đóng (trước đây mỗi
    hộp tự lưu/khôi phục body.overflow → hộp đóng trước mở khóa nền trong khi hộp sau còn). */
let lockCount = 0;
let savedOverflow = "";
export function lockBodyScroll(): void {
  if (lockCount === 0) {
    savedOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  lockCount += 1;
}
export function unlockBodyScroll(): void {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) document.body.style.overflow = savedOverflow;
}

export const FOCUSABLE =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/** Phần tử nhận focus được trong hộp (bỏ nút bị vô hiệu). */
export function focusablesIn(root: HTMLElement | null): HTMLElement[] {
  if (!root) return [];
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.hasAttribute("disabled"),
  );
}

/**
 * Tab ở mép hộp thì vòng lại — trả phần tử cần focus, hoặc null nếu để trình duyệt tự đi.
 * THUẦN (không đụng DOM) để test được.
 */
export function vongFocus<T>(items: T[], active: unknown, shift: boolean): T | null {
  if (items.length === 0) return null;
  const first = items[0];
  const last = items[items.length - 1];
  if (shift && (active === first || !items.includes(active as T))) return last;
  if (!shift && (active === last || !items.includes(active as T))) return first;
  return null;
}

/**
 * VUỐT XUỐNG ĐỂ ĐÓNG NGĂN (03 §Nút X mục 4; chuẩn Emil "momentum dismissal"): kéo quá
 * `nguongPx` HOẶC hất nhanh hơn `vanToc` px/ms là đóng — không bắt kéo hết một quãng dài
 * mới chịu. Kéo lên (dy âm) không bao giờ đóng.
 */
export function vuotDeDong(dyPx: number, ms: number, nguongPx = 80, vanToc = 0.11): boolean {
  if (!(dyPx > 0)) return false;
  if (dyPx >= nguongPx) return true;
  return ms > 0 && dyPx / ms > vanToc;
}

/*
  BACK CỦA MÁY ĐÓNG LỚP NỔI TRƯỚC KHI RỜI TRANG (rà FB 2026-10-25: VO-APP-01 · TAU-01 · BD-03 · VT-06).
  Cơ chế lấy từ kairos/xem-anh.tsx (chạy thật từ 2026-10-24) thành của chung:
  · Lớp mở ⇒ đẩy MỘT mục lịch sử cùng URL có dấu `sdfLop: <id lớp>`. Giữ nguyên state Next đang có
    (__NA + cây route) — thiếu là Next reload trang khi popstate.
  · Bấm back ⇒ popstate ⇒ mục hiện tại KHÔNG còn là của mình ⇒ đóng. Lớp DƯỚI (sheet đang mở hộp xác
    nhận) thấy mục hiện tại vẫn là của mình ⇒ đứng yên. Nhờ vậy chồng bao nhiêu lớp cũng đúng thứ tự
    mà không cần ngăn xếp.
  · Đóng tay (×, Escape, chạm nền) ⇒ history.back() rồi để popstate đóng — lần back sau không phải bấm
    hai lần. Bên gọi gỡ lớp thẳng (nút Lưu/Huỷ của họ) ⇒ cleanup dọn mục còn thừa.
  Phần quyết định là hàm THUẦN (test ở dialog-focus.test.ts); hook chỉ nối với window.history.
*/
export const DAU_LOP = "sdfLop";

/** Mục lịch sử hiện tại có phải của lớp `id` không. */
export function laMucCuaLop(state: unknown, id: string): boolean {
  return !!state && typeof state === "object" && (state as Record<string, unknown>)[DAU_LOP] === id;
}

/** State cho mục mới của lớp — GIỮ mọi khoá đang có (Next cần `__NA` + cây route), chỉ thêm dấu. */
export function mucLop(state: unknown, id: string): Record<string, unknown> {
  const goc = state && typeof state === "object" ? (state as Record<string, unknown>) : {};
  return { ...goc, [DAU_LOP]: id };
}

/** popstate: lớp `id` có phải đóng không — còn đứng ở mục của mình (lớp trên vừa đóng) thì không. */
export function popLaDong(state: unknown, id: string): boolean {
  return !laMucCuaLop(state, id);
}

/** Popstate không về (webview lạ) thì sau ngần này vẫn đóng — không để kẹt hộp. */
export const CHO_POPSTATE_MS = 400;

/**
 * Lớp nổi đang mở chiếm một mục lịch sử (xem khối chú thích trên).
 * `dong` = việc đóng khi back (sheet form: `dongNhe` để còn hỏi "Bỏ phần đang ghi?"); đọc bản mới nhất qua ref.
 * `bat` = lớp đang mở (component mở-là-dựng thì để mặc định true; ngăn bên của bản đồ truyền nấc mở).
 * Trả `dongTay()` cho mọi đường đóng do người dùng (×/Escape/chạm nền) và `giuLai()` để đẩy lại mục khi
 * bà con chọn "Ghi tiếp" sau khi back đã ăn mất mục.
 */
export function useLichSuDong(dong: () => void, bat = true): { dongTay: () => void; giuLai: () => void } {
  const id = useId();
  const dongRef = useRef(dong);
  useEffect(() => {
    dongRef.current = dong;
  });
  const choPop = useRef<ReturnType<typeof setTimeout> | null>(null);
  const donMuc = useRef<ReturnType<typeof setTimeout> | null>(null);

  const giuLai = useCallback(() => {
    if (typeof window === "undefined" || laMucCuaLop(window.history.state, id)) return;
    try {
      window.history.pushState(mucLop(window.history.state, id), "");
    } catch {
      /* trình duyệt chặn lịch sử ⇒ vẫn còn × và Escape */
    }
  }, [id]);

  useEffect(() => {
    if (!bat) return;
    // StrictMode gỡ-gắn lại ngay: mục vẫn còn, huỷ lệnh dọn của lần gỡ
    if (donMuc.current) {
      clearTimeout(donMuc.current);
      donMuc.current = null;
    }
    giuLai();
    const onPop = () => {
      if (!popLaDong(window.history.state, id)) return;
      if (choPop.current) {
        clearTimeout(choPop.current);
        choPop.current = null;
      }
      dongRef.current();
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      if (choPop.current) {
        clearTimeout(choPop.current);
        choPop.current = null;
      }
      /*  Bị gỡ thẳng mà mục còn là của mình ⇒ lùi cho sạch (không thì lần back sau "chết" một nhịp).
          Hoãn một nhịp và KIỂM LẠI lúc chạy: StrictMode gắn lại thì thôi; bên gọi vừa router.push thì mục
          đã là của Next ⇒ không lùi (lùi là kéo bà con về trang cũ). */
      donMuc.current = setTimeout(() => {
        donMuc.current = null;
        if (laMucCuaLop(window.history.state, id)) window.history.back();
      }, 0);
    };
  }, [bat, id, giuLai]);

  const dongTay = useCallback(() => {
    if (typeof window !== "undefined" && laMucCuaLop(window.history.state, id)) {
      window.history.back();
      if (choPop.current) clearTimeout(choPop.current);
      choPop.current = setTimeout(() => {
        choPop.current = null;
        dongRef.current();
      }, CHO_POPSTATE_MS);
      return;
    }
    dongRef.current();
  }, [id]);

  return { dongTay, giuLai };
}
