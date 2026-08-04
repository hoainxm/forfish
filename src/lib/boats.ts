// Đa tàu — 1 chủ tàu có thể có NHIỀU tàu. Mọi dữ liệu (giấy tờ, thuyền viên,
// sản phẩm) gắn theo `boatId` của tàu đang chọn. Lưu local (chưa đăng nhập);
// khi có auth + Supabase sẽ đồng bộ theo owner_id.

import { readUserList } from "@/lib/user-list-store";
import { saveUserJson } from "@/lib/user-store";

export interface Boat {
  id: string;
  name: string;        // tên gọi tàu
  maTau?: string;      // mã/số đăng ký tàu (vd "BV-1234-TS")
  homeProvince?: string; // tỉnh cảng nhà (lọc "gần tôi")
  homePortId?: string;   // cảng hay cập (id trong fishing-ports)
  lengthM?: number;      // chiều dài Lmax (m) — chi phối quy định
}

const BOATS_KEY = "forfish.boats.v1";
const CURRENT_KEY = "forfish.currentBoat.v1";

/**
 * KHÔNG ĐỌC ĐƯỢC DANH SÁCH TÀU ⇒ KHOÁ CỬA GHI (K4, 2026-08-02).
 *
 * Đây đúng cảnh mà `lib/user-store.ts` gọi tên: đọc hỏng thì ĐỪNG cho ghi đè.
 * Một ký tự JSON hỏng mà vẫn cho `saveBoats` chạy là cú `addBoat`/`updateBoat`
 * đầu tiên ĐÈ danh sách rỗng lên sổ thật: mất cả đội tàu, mà MỌI dữ liệu khác
 * (giấy tờ, thuyền viên, bảo dưỡng) đều gắn theo `boatId` nên mất tàu là mất
 * đường về của hết thảy.
 *
 * Cờ đặt Ở TẦNG KHO vì `boat-store.ts` (chỗ gọi) không có ô hiện câu báo. Đọc
 * hỏng thì `loadBoats` trả [] để app còn mở được, nhưng KHÔNG cho ghi đè — mở
 * lại app là đọc lại sổ gốc.
 */
let readFailed = false;

/** Lần đọc danh sách tàu gần nhất có hỏng không (chỗ gọi muốn báo thì đã có). */
export function boatsReadFailed(): boolean {
  return readFailed;
}

export function loadBoats(): Boat[] {
  if (typeof window === "undefined") return [];
  const r = readUserList<Boat>(BOATS_KEY);
  readFailed = !r.ok;
  // KHÔNG seed tàu mẫu — sdvico đã bỏ demo (chốt 2026-07-29); user tự thêm tàu thật.
  return r.list ?? [];
}

/** Trả `false` khi máy KHÔNG giữ được (đọc hỏng → cấm đè; hoặc hết chỗ). */
export function saveBoats(boats: Boat[]): boolean {
  if (readFailed) return false;
  return saveUserJson(BOATS_KEY, boats);
}

export function loadCurrentBoatId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(CURRENT_KEY);
  } catch {
    return null;
  }
}

export function saveCurrentBoatId(id: string) {
  try {
    window.localStorage.setItem(CURRENT_KEY, id);
  } catch {
    /* ignore */
  }
}
