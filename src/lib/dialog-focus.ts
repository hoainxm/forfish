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
