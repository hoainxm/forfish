// Trục 1 — ĐƯỜNG ĐÃ LƯU: cất cả một đường đi (nơi xuất phát + chuỗi chỗ ghé
// theo đúng thứ tự) dưới một cái tên, lần sau mở ra là chạy lại ngay.
// Logic thuần (không đụng React/map) để test được.
//
// VÌ SAO CẦN (chủ dự án 2026-08-29h): trước đây máy chỉ giữ MỘT chuỗi điểm
// đang dùng (`forfish.routestops.v1`), sửa tới đâu đè tới đó. Bấm "Xoá hết" là
// mất hẳn — chuyến đi lặp lại hằng tuần phải chấm lại 2-3 chỗ và chờ tính
// ~10 giây MỖI LẦN. Lối lách đang có là lưu từng chỗ vào "Điểm đã lưu", nhưng
// đó là điểm RỜI: thứ tự và nơi xuất phát vẫn phải dựng tay.
//
// ⚠️ CỐ Ý KHÔNG LƯU KẾT QUẢ ĐÃ TÍNH (quãng · giờ · dầu · sóng · gió).
// Ba con số đó là dự báo CỦA HÔM ẤY. Cất lại rồi bày ra tuần sau là app tự nói
// dối: bà con đọc "1662 lít, sóng 2,6 m" tưởng là tình hình bây giờ mà thật ra
// là tình hình tuần trước — tính dầu theo đó có thể thiếu dầu giữa biển, mà
// CLAUDE.md cấm hứa độ chính xác nguồn dữ liệu không bảo đảm được. Mở một
// đường đã lưu ⇒ khôi phục ĐIỂM, rồi bấm Tính đường để máy tính lại bằng dự
// báo hôm nay.
//
// ⚠️ TÊN KHOÁ: `forfish.savedroutes.v1` — dài dòng CỐ Ý. Tên ngắn gọn hơn
// (chỉ "routes") đã được docs/app-map/09 §5c giữ chỗ cho lộ trình chuyến biển
// nhiều ngày bản premium; bản ghi đó khác hẳn (lịch theo ngày, tuổi dữ liệu,
// boatId). Dùng chung tên là sau này hai tính năng đè lên nhau.

import { readUserList } from "@/lib/user-list-store";
import { saveUserJson } from "@/lib/user-store";
import type { RouteStop } from "@/lib/route-stops";

export interface SavedRoute {
  id: string;
  /** tên bà con đặt; rỗng thì nơi gọi tự đặt tên gợi ý */
  name: string;
  /*  Nơi xuất phát. `null` = lựa chọn "chỗ tàu tôi đang đứng (định vị)" —
      không có toạ độ cố định, mở lại thì vẫn là "chỗ tàu tôi". Phải giữ được
      ca này, không thì đường lưu từ ngoài biển mở lại sẽ nhảy về cảng. */
  start: { lat: number; lon: number; label: string } | null;
  /*  LỰA CHỌN nơi xuất phát ("gps" · "cursor" · "place:…" · "port:…"), không
      phải toạ độ. Mở lại đường đi phải trả về đúng LỰA CHỌN: lưu từ "Cảng nhà"
      thì tuần sau vẫn là cảng nhà, dù bà con đã đổi cảng nhà sang chỗ khác.
      Tuỳ chọn vì bản ghi có thể tới từ chỗ khác — thiếu thì nơi gọi tự dò theo
      toạ độ, thà lệch lựa chọn còn hơn vứt cả đường đã lưu (án lệ K4). */
  startId?: string;
  stops: RouteStop[];
  /** mốc lưu (ms) — để xếp mới nhất lên đầu và nói "lưu ngày nào" */
  savedAt: number;
}

const KEY = "forfish.savedroutes.v1";

/**
 * Trần số đường lưu được. Đây là danh sách bà con ĐỌC BẰNG MẮT trên màn
 * 375px giữa nắng — quá chục dòng là tìm lâu hơn chấm lại. Đủ cho các luồng
 * quen (bãi gần, bãi xa, tuyến về cảng bán) mà không thành kho lưu trữ.
 */
export const MAX_SAVED_ROUTES = 12;

/**
 * KHÔNG ĐỌC ĐƯỢC ⇒ KHOÁ CỬA GHI — án lệ K4 của `places.ts`/`route-stops.ts`.
 * Đây là thứ bà con tự đặt tên và tự chấm, mất là mất luôn.
 */
let readFailed = false;

/** Lần đọc gần nhất có hỏng không — để màn hình nói thật. */
export function savedRoutesReadFailed(): boolean {
  return readFailed;
}

function isValidStop(s: unknown): s is RouteStop {
  const x = s as RouteStop;
  return (
    !!x &&
    typeof x.id === "string" &&
    Number.isFinite(x.lat) &&
    Number.isFinite(x.lon)
  );
}

function isValid(r: unknown): r is SavedRoute {
  const x = r as SavedRoute;
  if (!x || typeof x.id !== "string" || typeof x.name !== "string") return false;
  if (!Array.isArray(x.stops) || x.stops.length === 0) return false;
  if (!x.stops.every(isValidStop)) return false;
  /*  `start` được phép null (ca "chỗ tàu tôi"), nhưng CÓ thì phải đủ toạ độ —
      nửa vời là mở lại vẽ vạch từ chỗ sai. */
  if (x.start != null) {
    if (!Number.isFinite(x.start.lat) || !Number.isFinite(x.start.lon))
      return false;
  }
  return Number.isFinite(x.savedAt);
}

/** Mới lưu nhất lên đầu — thứ vừa dùng là thứ hay dùng lại nhất. */
export function loadSavedRoutes(): SavedRoute[] {
  const r = readUserList<SavedRoute>(KEY);
  readFailed = !r.ok;
  return (r.list ?? [])
    .filter(isValid)
    .sort((a, b) => b.savedAt - a.savedAt)
    .slice(0, MAX_SAVED_ROUTES);
}

/**
 * Ghi danh sách. Trả `false` khi KHÔNG giữ được — đọc hỏng (giữ nguyên bản
 * gốc) hoặc máy hết chỗ. Màn hình phải nói ra, không nuốt im lặng.
 */
export function persistSavedRoutes(list: SavedRoute[]): boolean {
  if (readFailed) return false;
  return saveUserJson(KEY, list);
}

/**
 * Tên gợi ý khi bà con không gõ gì: đọc theo ĐIỂM ĐẾN, vì đó là thứ nhớ được
 * ("đi Hoàng Sa"), không phải theo số chỗ ghé. Có tên chỗ thì dùng tên; không
 * thì đành nói số chỗ — KHÔNG đọc toạ độ ra làm tên (không ai nhớ dãy số).
 */
export function suggestName(stops: RouteStop[]): string {
  const last = stops[stops.length - 1];
  if (last?.name) return `Đi ${last.name}`;
  return stops.length > 1 ? `Đường qua ${stops.length} chỗ` : "Đường đi";
}

/**
 * Cùng một đường hay không — so NƠI XUẤT PHÁT và CẢ CHUỖI chỗ ghé, đúng luật
 * của `routeMatchesStops`. Dùng để lưu lại đường đã có thì ĐÈ chứ không đẻ bản
 * thứ hai y hệt (danh sách 12 dòng mà 5 dòng trùng nhau là vô dụng).
 */
export function sameRoute(
  a: Pick<SavedRoute, "start" | "stops">,
  b: Pick<SavedRoute, "start" | "stops">,
): boolean {
  if ((a.start == null) !== (b.start == null)) return false;
  if (a.start && b.start) {
    if (a.start.lat !== b.start.lat || a.start.lon !== b.start.lon) return false;
  }
  if (a.stops.length !== b.stops.length) return false;
  return a.stops.every((s, i) => s.id === b.stops[i].id);
}

/**
 * Thêm một đường vào danh sách. Trùng đường cũ ⇒ ĐÈ bản cũ (giữ tên mới, dời
 * lên đầu). Đầy trần ⇒ bỏ bản CŨ NHẤT — không chặn thao tác, vì chặn thì bà
 * con phải tự đi dọn trước khi lưu được thứ đang cần.
 *
 * `now` truyền vào chứ không gọi `Date.now()` trong này: hàm thuần, test được.
 */
export function addSavedRoute(
  list: SavedRoute[],
  route: {
    name: string;
    start: SavedRoute["start"];
    startId?: string;
    stops: RouteStop[];
  },
  now: number,
): SavedRoute[] {
  if (route.stops.length === 0) return list;
  const rec: SavedRoute = {
    id: `r${now}`,
    name: route.name.trim() || suggestName(route.stops),
    start: route.start,
    ...(route.startId ? { startId: route.startId } : {}),
    stops: route.stops,
    savedAt: now,
  };
  const rest = list.filter((r) => !sameRoute(r, rec));
  return [rec, ...rest].slice(0, MAX_SAVED_ROUTES);
}

export function removeSavedRoute(list: SavedRoute[], id: string): SavedRoute[] {
  return list.filter((r) => r.id !== id);
}
