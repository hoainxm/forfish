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
] as const;

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
  try {
    USER_SCOPED_KEYS.forEach((k) => window.localStorage.removeItem(k));
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

/** Test helper — export list keys để unit test xác minh xoá đúng key. */
export const __USER_SCOPED_KEYS_FOR_TEST = USER_SCOPED_KEYS;
export const __LAST_PHONE_KEY_FOR_TEST = LAST_PHONE_KEY;
