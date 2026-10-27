// CÀI APP VỀ MÁY — nhận biết đã cài chưa + giữ hộp cài của Chrome (2026-10-27, anh Long: "thẻ cài app hiện song
// song với thẻ chọn cảng nhà, thêm mục Cài app cố định trong menu/tài khoản … phải check luôn là đã cài hay chưa để ẩn
// hay hiện thông minh"). Dùng chung cho thẻ ở Trang chủ (install-prompt) và mục trong menu tài khoản (hero-account).
//
// BA NGUỒN BIẾT "ĐÃ CÀI":
//   1. Đang mở BẰNG app đã cài (display-mode standalone / iOS navigator.standalone) — chắc chắn.
//   2. `navigator.getInstalledRelatedApps()` (Chrome Android): manifest khai `related_applications` trỏ chính manifest
//      ⇒ mở trong tab Chrome vẫn biết PWA đã nằm trên màn hình chính. Có API thì TIN API (gỡ app là hết "đã cài").
//   3. Sổ máy `forfish.appInstalled.v1` ghi lúc sự kiện `appinstalled` / lúc mở bằng app — chỉ dùng khi KHÔNG có API.
//
// HỘP CÀI: Chrome bắn `beforeinstallprompt` MỘT lần, rất sớm lúc nạp trang — trước khi menu kịp mở. Nên nghe ở mức
// module (`batDauNgheCai`, gọi từ SwRegister có mặt mọi trang) và giữ sự kiện cho ai cần bung.

import { isAndroid, isIOS, isStandalone } from "@/lib/storage-persist";

export const DA_CAI_KEY = "forfish.appInstalled.v1";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/** Cách mời cài lúc này: ẩn hẳn · đã cài (đang xem trong trình duyệt) · có nút bung hộp cài · chỉ đường tay. */
export type CachCai = "an" | "da-cai" | "nut" | "tay-android" | "tay-ios";

/**
 * QUYẾT ĐỊNH — thuần, có test. `phatHien`: kết quả getInstalledRelatedApps (null = máy không có API).
 * Đang mở bằng app ⇒ ẩn; API nói đã cài ⇒ đã cài; không có API mà sổ máy nhớ đã cài ⇒ đã cài; có hộp cài ⇒ nút;
 * iPhone ⇒ chỉ tay (Safari không có hộp cài); Android ⇒ chỉ tay qua menu ⋮; máy tính không hộp cài ⇒ ẩn.
 */
export function quyetDinhCai(i: {
  standalone: boolean;
  phatHien: boolean | null;
  soNhoDaCai: boolean;
  coHopCai: boolean;
  ios: boolean;
  android: boolean;
}): CachCai {
  if (i.standalone) return "an";
  if (i.phatHien === true) return "da-cai";
  if (i.phatHien === null && i.soNhoDaCai) return "da-cai";
  if (i.coHopCai) return "nut";
  if (i.ios) return "tay-ios";
  if (i.android) return "tay-android";
  return "an";
}

let hoan: BeforeInstallPromptEvent | null = null;
let dangNghe = false;
const nguoiNghe = new Set<() => void>();
const bao = () => nguoiNghe.forEach((f) => f());

function ghiSo(v: boolean): void {
  try {
    if (v) window.localStorage.setItem(DA_CAI_KEY, String(Date.now()));
    else window.localStorage.removeItem(DA_CAI_KEY);
  } catch {
    /* kho chặn/đầy — chỉ mất phần nhớ phụ, API vẫn trả lời */
  }
}

function docSo(): boolean {
  try {
    return window.localStorage.getItem(DA_CAI_KEY) != null;
  } catch {
    return false;
  }
}

/** Nghe hộp cài + sự kiện đã cài — gọi sớm (SwRegister). Gọi nhiều lần vô hại. */
export function batDauNgheCai(): void {
  if (dangNghe || typeof window === "undefined") return;
  dangNghe = true;
  if (isStandalone()) ghiSo(true); // đang mở bằng app ⇒ chắc chắn đã cài
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // giữ lại, chỉ bung khi bà con bấm
    hoan = e as BeforeInstallPromptEvent;
    bao();
  });
  window.addEventListener("appinstalled", () => {
    hoan = null;
    ghiSo(true);
    bao();
  });
}

/** Đăng ký nghe thay đổi (có hộp cài / vừa cài xong). Trả hàm huỷ. */
export function ngheThayDoiCai(f: () => void): () => void {
  nguoiNghe.add(f);
  return () => nguoiNghe.delete(f);
}

export function coHopCai(): boolean {
  return hoan != null;
}

/** Bung hộp cài của Chrome. "khong-co" = trình duyệt chưa cho (chỉ đường tay). */
export async function bungHopCai(): Promise<"accepted" | "dismissed" | "khong-co"> {
  const d = hoan;
  if (!d) return "khong-co";
  let kq: "accepted" | "dismissed" = "dismissed";
  try {
    await d.prompt();
    kq = (await d.userChoice).outcome;
  } catch {
    /* bà con huỷ / trình duyệt lỗi */
  }
  hoan = null; // một sự kiện chỉ bung được một lần
  if (kq === "accepted") ghiSo(true);
  bao();
  return kq;
}

/** getInstalledRelatedApps: true/false; null = máy không có API (iPhone, Firefox…) hoặc API hỏng. */
export async function phatHienDaCai(): Promise<boolean | null> {
  const nav = typeof navigator !== "undefined"
    ? (navigator as Navigator & { getInstalledRelatedApps?: () => Promise<unknown[]> })
    : null;
  if (!nav?.getInstalledRelatedApps) return null;
  try {
    const ds = await nav.getInstalledRelatedApps();
    const co = Array.isArray(ds) && ds.length > 0;
    ghiSo(co); // có API thì TIN API — gỡ app rồi là thôi nhớ
    return co;
  } catch {
    return null;
  }
}

/** Gộp đủ nguồn ⇒ cách mời cài. Không ném. */
export async function cachCaiHienTai(): Promise<CachCai> {
  if (typeof window === "undefined") return "an";
  const standalone = isStandalone();
  const phatHien = standalone ? null : await phatHienDaCai();
  return quyetDinhCai({ standalone, phatHien, soNhoDaCai: docSo(), coHopCai: coHopCai(), ios: isIOS(), android: isAndroid() });
}
