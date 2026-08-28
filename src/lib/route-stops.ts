// Trục 1 — ĐƯỜNG ĐI NHIỀU ĐIỂM: danh sách chỗ bà con muốn ghé, THEO ĐÚNG THỨ
// TỰ mình chấm (app KHÔNG tự sắp xếp lại — thứ tự là kinh nghiệm thuyền
// trưởng, chủ dự án chốt 2026-08-28). Dẫn đường nối lần lượt từng chặng bằng
// đúng thuật toán né sóng/cạn sẵn có (lib/route-plan.ts).
//
// Lưu localStorage `forfish.routestops.v1`. Logic thuần (không đụng React/map)
// để test được.
//
// ⚠️ TÊN KHOÁ CỐ Ý dài dòng ("routestops") chứ không phải "routes": tên
// "routes" đã được docs/app-map/09 §5c giữ chỗ cho lộ trình chuyến biển nhiều
// ngày (premium) — bản ghi khác hẳn (lịch theo ngày, tuổi dữ liệu, boatId).
// Dùng chung tên là sau này hai tính năng đè lên nhau.

import { placeId } from "@/lib/places";
import { readUserList } from "@/lib/user-list-store";
import { saveUserJson } from "@/lib/user-store";

export interface RouteStop {
  /** id suy ra từ toạ độ (dùng lại placeId ~100 m) → chấm lại đúng chỗ cũ không thêm trùng */
  id: string;
  lat: number;
  lon: number;
}

const KEY = "forfish.routestops.v1";

/**
 * Trần số điểm trong một đường đi. Khớp tinh thần "0–5 điểm quen + đích" của
 * 09-ba-spec §4; hơn nữa thì thời gian Dijkstra × số chặng vượt ngưỡng chờ
 * được trên điện thoại giữa biển.
 */
export const MAX_STOPS = 6;

/**
 * KHÔNG ĐỌC ĐƯỢC DANH SÁCH ⇒ KHOÁ CỬA GHI — cùng án lệ K4 của `places.ts`.
 * Chuỗi điểm là thứ bà con tự chấm tay, mất là mất luôn (không như dự báo có
 * sóng là tải lại). Đọc hỏng thì vẫn cho xem (rỗng trong bộ nhớ), chỉ KHÔNG
 * cho ghi đè — bản gốc còn nguyên để lần mở sau đọc lại.
 */
let readFailed = false;

/** Lần đọc gần nhất có hỏng không — để màn hình nói thật với bà con. */
export function stopsReadFailed(): boolean {
  return readFailed;
}

function isValid(s: unknown): s is RouteStop {
  const x = s as RouteStop;
  return (
    !!x &&
    typeof x.id === "string" &&
    Number.isFinite(x.lat) &&
    Number.isFinite(x.lon)
  );
}

export function loadStops(): RouteStop[] {
  const r = readUserList<RouteStop>(KEY);
  readFailed = !r.ok;
  return (r.list ?? []).filter(isValid).slice(0, MAX_STOPS);
}

/**
 * Ghi danh sách điểm ghé. Trả `false` khi KHÔNG giữ được — đọc hỏng (giữ
 * nguyên bản gốc) hoặc máy hết chỗ. Màn hình phải nói ra, không nuốt im lặng.
 */
export function persistStops(list: RouteStop[]): boolean {
  if (readFailed) return false;
  return saveUserJson(KEY, list);
}

/**
 * Thêm một chỗ vào CUỐI đường đi. Chấm lại đúng chỗ cũ (trong ~100 m) thì giữ
 * nguyên thứ tự cũ, không thêm trùng. Đã đủ `MAX_STOPS` thì trả về nguyên
 * danh sách — nơi gọi so độ dài để biết mà nói "đã đủ chỗ".
 */
export function addStop(
  list: RouteStop[],
  lat: number,
  lon: number,
): RouteStop[] {
  const id = placeId(lat, lon);
  if (list.some((s) => s.id === id)) return list;
  if (list.length >= MAX_STOPS) return list;
  return [...list, { id, lat, lon }];
}

/** Chỗ này đã nằm trong đường đi chưa (để nút đổi chữ Thêm/Bỏ) */
export function stopAt(
  list: RouteStop[],
  lat: number,
  lon: number,
): RouteStop | null {
  const id = placeId(lat, lon);
  return list.find((s) => s.id === id) ?? null;
}

export function removeStop(list: RouteStop[], id: string): RouteStop[] {
  return list.filter((s) => s.id !== id);
}

export function clearStops(): RouteStop[] {
  return [];
}
