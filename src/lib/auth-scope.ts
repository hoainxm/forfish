// Auth scope guard cho localStorage demo mode.
//
// Bối cảnh: dữ liệu KH (boats/documents/sổ lãi lỗ/...) lưu localStorage CHƯA
// scope theo user → cùng browser, user B login thấy data của user A. Đợt 1 fix
// nhanh: clear data KH khi user CHANGE hoặc logout. Đợt 2 (kế hoạch C): wire
// các bảng này lên Supabase owner_id để sync đa thiết bị.
//
// UI prefs (theme, mode hiển thị, lớp bản đồ, region home, cảng, places) KHÔNG
// xóa — chia sẻ trong máy.

const LAST_PHONE_KEY = "forfish.auth.lastPhone.v1";

/** Key localStorage chứa dữ liệu KH (xoá khi user đổi/logout). */
const USER_SCOPED_KEYS = [
  "forfish.boats.v1",
  "forfish.currentBoat.v1",
  "forfish.boat.v1", // route-planner boat profile
  "forfish.products.v1",
  "forfish.documents.v1",
  "forfish.maintenance.v1",
  "forfish.buyers.v1",
  "forfish.debts.v1",
  "forfish.trips.v1",
  "forfish.crew.v1",
  // Gán món SDVICO → tàu: map id-món của CHÍNH user (lib/sdvico-assign.ts).
  // Không xoá → user B thấy bản đồ gán của A trên cùng máy.
  "forfish.sdvico-boat.v1",
  // Dấu "phiên gần nhất là premium" (lib/use-tier.ts). use-tier tự xoá khi
  // logout NHƯNG chỉ lúc hook mount + ONLINE — đổi user lúc offline thì dấu
  // premium của A còn cho B (quyền offline rò). Xoá ở đây đóng nốt đường đó.
  "forfish.tier.premium.v1",
] as const;

/**
 * Bảo service worker XOÁ kho phản hồi `/api/*` đã cache (SDFISH_API_V).
 *
 * Vì sao: SW cache mọi GET `/api/*` theo URL, KHÔNG theo user. Endpoint riêng
 * tư (`/api/me/*`…) do đó dính chung khoá → user B mất sóng, SW trả bản cache
 * của A (rò tên/serial/mã đơn). localStorage đã scope, nhưng Cache API thì
 * `clearUserScopedData` không với tới → phải nhờ SW tự xoá. Best-effort:
 * không có SW / chưa control thì bỏ qua (sw.js cũng đã CHẶN cache các path
 * riêng tư ngay từ đầu — đây là lớp dọn thêm cho bản cache cũ còn sót).
 */
export function purgeApiCache(): void {
  if (typeof navigator === "undefined") return;
  try {
    navigator.serviceWorker?.controller?.postMessage({
      type: "forfish:purge-api-cache",
    });
  } catch {
    /* ignore */
  }
}

/** Xoá TRẦN các key data KH — không đụng tracking phone. Dùng cả trong
 *  pagehide (xoá lần cuối trước unload, chặn save-effect hồi sinh data).
 *  Kèm nhờ SW xoá kho `/api/*` (bản cache riêng tư của user cũ). */
export function clearUserScopedData(): void {
  if (typeof window === "undefined") return;
  try {
    USER_SCOPED_KEYS.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
  purgeApiCache();
}

/**
 * Đồng bộ scope localStorage với phone hiện tại của session.
 *  - phone mới ≠ phone cũ → user đổi → xoá data KH cũ
 *  - phone = null + có lưu phone cũ → logout → xoá data + xoá tracking
 *  - phone trùng phone cũ → no-op
 *
 * An toàn gọi nhiều lần (idempotent). SSR-safe: thoát sớm khi không window.
 * Trả về `true` nếu có xoá data (để caller biết mà reset state nếu cần).
 */
export function syncAuthScope(phone: string | null): boolean {
  if (typeof window === "undefined") return false;
  let last: string | null = null;
  try {
    last = window.localStorage.getItem(LAST_PHONE_KEY);
  } catch {
    return false;
  }
  if (phone === last) return false;
  // User đổi (hoặc logout): xoá data KH cũ.
  clearUserScopedData();
  try {
    if (phone) {
      window.localStorage.setItem(LAST_PHONE_KEY, phone);
    } else {
      window.localStorage.removeItem(LAST_PHONE_KEY);
    }
  } catch {
    /* ignore */
  }
  return true;
}

/** Mốc thời điểm reload gần nhất (sessionStorage — sống qua reload, mất khi
 *  đóng tab). Dùng cho circuit-breaker chống vòng lặp reload. */
const RELOAD_AT_KEY = "forfish.scopeReloadAt.v1";

/**
 * Circuit-breaker: CÓ được phép reload trang cho lần đổi scope này không?
 *
 * Bug đã gặp: khi `getUser()` (xác thực server) và `onAuthStateChange` (phiên
 * lưu trong máy) BẤT ĐỒNG — một bên thấy user, bên kia thấy null — scope đảo
 * qua lại liên tục, mỗi lần lại `window.location.reload()` → TRANG NHẤP NHÁY
 * TẢI LẠI VÔ HẠN (báo cáo: đăng nhập tài khoản phiên lỗi → reload liên tục).
 *
 * Chốt chặn: chỉ cho reload TỐI ĐA 1 lần mỗi `windowMs` (mặc định 5s) trong 1
 * tab. Lần đổi scope thật (đổi user/logout) vẫn reload được; còn vòng lặp đảo
 * trong tích tắc thì bị chặn — data KH đã bị xoá rồi nên không rò rỉ, chỉ là
 * không reset RAM (đánh đổi chấp nhận được so với treo trang).
 *
 * THUẦN + tự-quản mốc (tham số `now` để test tất định). SSR-safe.
 */
export function shouldReloadForScope(now: number, windowMs = 5000): boolean {
  if (typeof window === "undefined") return false;
  try {
    const last = Number(window.sessionStorage.getItem(RELOAD_AT_KEY) || "0");
    if (Number.isFinite(last) && now - last < windowMs) return false;
    window.sessionStorage.setItem(RELOAD_AT_KEY, String(now));
    return true;
  } catch {
    // sessionStorage lỗi (private mode…) → giữ hành vi cũ (cho reload).
    return true;
  }
}

/** Test helper — export list keys để unit test xác minh xoá đúng key. */
export const __USER_SCOPED_KEYS_FOR_TEST = USER_SCOPED_KEYS;
export const __LAST_PHONE_KEY_FOR_TEST = LAST_PHONE_KEY;
export const __RELOAD_AT_KEY_FOR_TEST = RELOAD_AT_KEY;
