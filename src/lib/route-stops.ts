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
  /*  TÊN CHỖ (tuỳ chọn) — bà con đặt tên "Rạn ông Tư" chính là để KHỎI phải
      đọc toạ độ; có 3 điểm mà hàng nào cũng là dãy số thì không phân biệt được.
      CỐ Ý để tuỳ chọn: bản ghi cũ trong `forfish.routestops.v1` (chấm từ bản
      đồ, không có tên) vẫn hợp lệ — `isValid` KHÔNG được đòi trường này, mất
      danh sách là mất thứ gõ tay không tải lại được (án lệ K4). */
  name?: string;
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
  name?: string,
): RouteStop[] {
  const id = placeId(lat, lon);
  if (list.some((s) => s.id === id)) return list;
  if (list.length >= MAX_STOPS) return list;
  // không tên thì KHÔNG ghi khoá `name` rỗng — bản ghi giữ đúng hình cũ
  return [...list, { id, lat, lon, ...(name ? { name } : {}) }];
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

/**
 * Tuyến ĐÃ TÍNH có còn khớp danh sách chỗ ghé hiện tại không — so CẢ CHUỖI,
 * không chỉ điểm cuối.
 *
 * VÌ SAO CẢ CHUỖI: bỏ một điểm GIỮA thì điểm cuối không đổi, phép so điểm cuối
 * im lặng, trong khi bản đồ vẫn vẽ vạch xuyên qua đúng chỗ vừa loại. Giữa biển
 * bà con tin vạch trên màn chứ không đọc lại chữ — giấu chuyện đó là giấu cảnh
 * báo an toàn. Đặt ở lib để thẻ dẫn đường và lớp vẽ bản đồ dùng CHUNG một luật.
 *
 * Dung sai = dung sai của `placeId` (~100 m, làm tròn 3 số lẻ), ĐÚNG bằng độ
 * làm tròn của onClick bản đồ — với chạm bản đồ nó chặt hơn phép so 1e-6 cũ.
 * `stops` rỗng ⇒ chuỗi đúng là `[dest]` (hành vi cũ: đích = chỗ đang xem).
 *
 * Nhận `{lat;lon}` theo cấu trúc chứ không import `LatLon` từ `route-plan` —
 * giữ file kho này không kéo theo cả module tính tuyến.
 */
export function routeMatchesStops(
  routeStops: { lat: number; lon: number }[],
  stops: RouteStop[],
  dest: { lat: number; lon: number },
): boolean {
  const want = stops.length
    ? stops.map((s) => s.id)
    : [placeId(dest.lat, dest.lon)];
  if (routeStops.length !== want.length) return false;
  return routeStops.every((p, i) => placeId(p.lat, p.lon) === want[i]);
}

/**
 * Nơi XUẤT PHÁT của tuyến đã tính có còn khớp lựa chọn hiện tại không.
 *
 * VÌ SAO CẦN RIÊNG MỘT HÀM: `routeMatchesStops` chỉ so CHUỖI ĐIỂM ĐẾN. Đổi
 * "Điểm xuất phát" sau khi đã tính thì trước đây KHÔNG có gì reset — ba con số
 * giữ nguyên, bản đồ vẫn vẽ vạch chạy từ cảng CŨ, và không băng cảnh báo nào
 * bật. Cùng một lớp lỗi với "bỏ điểm giữa", và cùng lý do: giữa biển bà con
 * tin vạch trên màn chứ không đọc lại chữ.
 *
 * `startCoord == null` = lựa chọn "chỗ tàu tôi đang đứng (định vị)" — chưa
 * biết toạ độ trước khi bấm tính, nên KHÔNG đoán bừa: coi như còn khớp, thà
 * im còn hơn báo sai mỗi lần mở thẻ.
 *
 * Dung sai = dung sai của `placeId` (~100 m), đúng bằng hàm anh em ở trên.
 */
export function routeStartMatches(
  routeStart: { lat: number; lon: number },
  startCoord: { lat: number; lon: number } | null,
): boolean {
  if (startCoord == null) return true;
  return (
    placeId(routeStart.lat, routeStart.lon) ===
    placeId(startCoord.lat, startCoord.lon)
  );
}

export function removeStop(list: RouteStop[], id: string): RouteStop[] {
  return list.filter((s) => s.id !== id);
}

export function clearStops(): RouteStop[] {
  return [];
}

/*  NƠI ĐI GỬI KÈM CHUỖI ĐIỂM (2026-11-08). Lộ trình chuyến biển bấm "Bản đồ" nạp chuỗi vùng sang Dẫn đường,
    nhưng Dẫn đường mặc định đi từ VỊ TRÍ ĐIỆN THOẠI — người ngồi nhà ở TP.HCM bấm thử thì chặng đầu từ TP.HCM ra
    Vịnh Bắc Bộ "vướng đất liền" (ảnh lỗi anh Long). Nay màn lộ trình gửi kèm cảng xuất bến; Dẫn đường đọc MỘT LẦN
    lúc mở rồi xoá. sessionStorage: chỉ sống trong phiên này (một lần chuyển màn), không cần chép sang máy khác. */
const NOI_DI_KEY = "forfish.route.noiDi.v1";
/** Gửi quá lâu mà chưa mở Dẫn đường thì bỏ — mở bản đồ hôm sau không được nhảy về cảng của lộ trình cũ. */
const NOI_DI_HAN_MS = 30 * 60_000;

export interface NoiDiGui {
  lat: number;
  lon: number;
  ten: string;
}

export function guiNoiDi(p: NoiDiGui): void {
  try {
    sessionStorage.setItem(NOI_DI_KEY, JSON.stringify({ ...p, luc: Date.now() }));
  } catch {
    /* chế độ riêng tư — tệ nhất là Dẫn đường đi từ nơi mặc định, bà con tự chọn cảng */
  }
}

/** Xoá nơi đi đã gửi — gọi sau khi Dẫn đường đã nhận (đọc trong initializer, xoá ở effect: StrictMode gọi
    initializer hai lần, đọc-là-xoá thì lần hai mất). */
export function xoaNoiDi(): void {
  try {
    sessionStorage.removeItem(NOI_DI_KEY);
  } catch {
    /* không xoá được thì hạn 30 phút tự bỏ */
  }
}

/** Đọc nơi đi đã gửi (KHÔNG xoá — xem `xoaNoiDi`); null khi không có / quá hạn / hỏng. */
export function layNoiDi(nowMs: number = Date.now()): NoiDiGui | null {
  try {
    const raw = sessionStorage.getItem(NOI_DI_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<NoiDiGui> & { luc?: number };
    if (
      typeof v?.lat !== "number" || !Number.isFinite(v.lat) || Math.abs(v.lat) > 90 ||
      typeof v?.lon !== "number" || !Number.isFinite(v.lon) || Math.abs(v.lon) > 180 ||
      typeof v.luc !== "number" || nowMs - v.luc > NOI_DI_HAN_MS || v.luc > nowMs + 60_000
    )
      return null;
    return { lat: v.lat, lon: v.lon, ten: typeof v.ten === "string" && v.ten.trim() ? v.ten.trim().slice(0, 60) : "Cảng xuất bến" };
  } catch {
    return null;
  }
}
