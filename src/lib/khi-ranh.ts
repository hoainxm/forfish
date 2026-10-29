/*
  CHẠY SAU KHI TRANG TẢI XONG + MÁY RẢNH (2026-10-29, rà soát tốc độ D/P1).

  Việc nền nặng mạng (đăng ký service worker ⇒ precache ~3,7 MB vỏ) không được
  giành băng thông với màn đang mở trên 3G. Thứ tự:
    1. chờ sự kiện `load` (đã `complete` thì đi luôn);
    2. rồi chờ lúc rảnh — `requestIdleCallback` (trần `idleMs` để máy bận suốt
       vẫn chạy), máy không có API này (Safari) thì `setTimeout(lui)`.
  TRẦN TỔNG `capMs`: `load` có thể trễ vô hạn (một ảnh treo trên sóng yếu) — quá
  trần thì chạy luôn, để việc nền (vỏ offline) không bao giờ bị bỏ qua cả phiên.

  `fn` chạy ĐÚNG MỘT LẦN. Trả hàm huỷ (chưa chạy thì không chạy nữa).
*/

type WinLike = {
  document: { readyState: string };
  addEventListener(type: "load", cb: () => void, opts?: { once?: boolean }): void;
  removeEventListener(type: "load", cb: () => void): void;
  requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  cancelIdleCallback?: (id: number) => void;
};

export const KHI_RANH_IDLE_MS = 5_000;
export const KHI_RANH_LUI_MS = 1_000;
export const KHI_RANH_CAP_MS = 20_000;

export function sauKhiTaiVaRanh(
  fn: () => void,
  opts: { win?: WinLike; idleMs?: number; luiMs?: number; capMs?: number } = {},
): () => void {
  const w = opts.win ?? (typeof window === "undefined" ? undefined : (window as unknown as WinLike));
  if (!w) return () => {};
  const idleMs = opts.idleMs ?? KHI_RANH_IDLE_MS;
  const luiMs = opts.luiMs ?? KHI_RANH_LUI_MS;
  let xong = false;
  let idleId: number | undefined;
  let luiT: ReturnType<typeof setTimeout> | undefined;

  const chay = () => {
    if (xong) return;
    xong = true;
    huyHet();
    try {
      fn();
    } catch {
      /* việc nền là tăng cường — không được làm hỏng trang */
    }
  };
  const choRanh = () => {
    if (xong || idleId !== undefined || luiT !== undefined) return;
    if (typeof w.requestIdleCallback === "function") idleId = w.requestIdleCallback(chay, { timeout: idleMs });
    else luiT = setTimeout(chay, luiMs);
  };
  const capT = setTimeout(chay, opts.capMs ?? KHI_RANH_CAP_MS);
  function huyHet() {
    clearTimeout(capT);
    w!.removeEventListener("load", choRanh);
    if (idleId !== undefined) w!.cancelIdleCallback?.(idleId);
    if (luiT !== undefined) clearTimeout(luiT);
  }

  if (w.document.readyState === "complete") choRanh();
  else w.addEventListener("load", choRanh, { once: true });

  return () => {
    xong = true;
    huyHet();
  };
}
