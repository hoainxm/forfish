// Trục 1 — "Điểm của tôi": vị trí ghim đặc thù của chủ tàu (bãi hay đánh, rạn
// quen, chỗ trúng cá) + cảng nhà. Thay cho việc chọn cảng trong danh sách —
// ngư dân nghĩ theo CHỖ CỦA MÌNH, không theo danh mục cảng nhà nước.
//
// Lưu localStorage `forfish.places.v1`. Logic thuần (không đụng React/map) để
// test được; sau này nối DB theo tàu thì chỉ thay loadPlaces/persist.

import { readUserList } from "@/lib/user-list-store";
import { saveUserJson } from "@/lib/user-store";

export type PlaceKind = "home" | "spot";

/** LOẠI điểm do bà con chọn (chế độ Hải đồ, rà soát so iSailor AddInfoEditor 2026-11-04) — TUỲ CHỌN, điểm cũ
 *  không có trường này vẫn hợp lệ. Khác `kind` (cảng nhà / điểm thường) — hai trục độc lập. */
export type LoaiDiem = "ca" | "ran" | "xac" | "neo" | "khac";
export const LOAI_DIEM: readonly LoaiDiem[] = ["ca", "ran", "xac", "neo", "khac"];
/** ghi chú tối đa — đủ một hai câu ("đáy cát, cá chỉ vàng tháng 3"), không thành sổ tay */
export const GHI_CHU_TOI_DA = 200;
/** ảnh mỗi điểm tối đa (lib/hai-do/anh-diem — path máy chủ hoặc khoá "cho:" kho chờ trong máy) */
export const ANH_DIEM_TOI_DA = 3;

export interface SavedPlace {
  /** id suy ra từ toạ độ → cùng một chỗ không ghim trùng 2 lần */
  id: string;
  name: string;
  lat: number;
  lon: number;
  kind: PlaceKind;
  /** loại điểm (tuỳ chọn — điểm ghim ở bản đồ thường không có) */
  loai?: LoaiDiem;
  /** ghi chú (tuỳ chọn, ≤ GHI_CHU_TOI_DA) */
  ghiChu?: string;
  /** ảnh (tuỳ chọn, ≤ ANH_DIEM_TOI_DA): path Storage `<sđt>/diem_…/…` hoặc "cho:…" đang chờ đẩy */
  anh?: string[];
}

const KEY = "forfish.places.v1";

/** id ổn định theo toạ độ (làm tròn 3 số ~ 100 m) — không cần Date/random */
export function placeId(lat: number, lon: number): string {
  return `${lat.toFixed(3)},${lon.toFixed(3)}`;
}

/**
 * KHÔNG ĐỌC ĐƯỢC SỔ ĐIỂM GHIM ⇒ KHOÁ CỬA GHI (K4, 2026-08-02).
 *
 * Điểm ghim là dữ liệu bà con GÕ TAY (bãi hay đánh, rạn quen, chỗ trúng cá) —
 * mất là mất luôn, không như dự báo có sóng là tải lại. Trước đây `loadPlaces`
 * nuốt mọi lỗi rồi trả `[]`: một ký tự JSON hỏng (ghi dở lúc máy đầy / pin sập)
 * là màn hình coi như "chưa ghim chỗ nào", rồi cú ghim tiếp theo `persistPlaces`
 * ĐÈ danh sách một phần tử lên chuỗi gốc — xoá sạch chỗ đánh cá cả đời.
 *
 * Cờ này đặt Ở TẦNG KHO (không phải ở màn hình) vì màn duy nhất đang gọi là
 * `fishing-map-view.tsx` và nó ghi thẳng trong callback của nút Ghim, không có
 * cửa `ready` như các màn khác. Đọc hỏng thì vẫn cho xem (danh sách rỗng trong
 * bộ nhớ), chỉ KHÔNG cho ghi đè — sổ gốc còn nguyên để lần mở sau đọc lại.
 */
let readFailed = false;

/** Lần đọc gần nhất có hỏng không — cho màn hình nói thật nếu muốn. */
export function placesReadFailed(): boolean {
  return readFailed;
}

export function loadPlaces(): SavedPlace[] {
  const r = readUserList<SavedPlace>(KEY);
  readFailed = !r.ok;
  return (r.list ?? []).filter(isValid);
}

function isValid(p: unknown): p is SavedPlace {
  const x = p as SavedPlace;
  return (
    !!x &&
    typeof x.id === "string" &&
    typeof x.name === "string" &&
    Number.isFinite(x.lat) &&
    Number.isFinite(x.lon)
  );
}

/**
 * Ghi sổ điểm ghim. Trả `false` khi KHÔNG giữ được — hai đường:
 *  · đọc hỏng (`readFailed`) → KHÔNG ghi, giữ nguyên sổ gốc;
 *  · máy hết chỗ → `saveUserJson` bảo dự báo nhường chỗ (dự báo tải lại được,
 *    chỗ đánh cá thì không) rồi mới chịu thua.
 * Trước đây là `try/catch` RỖNG: máy đầy là mất im lặng, mở lại app mới biết.
 */
export function persistPlaces(list: SavedPlace[]): boolean {
  if (readFailed) return false;
  return saveUserJson(KEY, list);
}

/** Điểm đang đặt làm cảng nhà (mở app vào đây), null nếu chưa đặt */
export function homeOf(list: SavedPlace[]): SavedPlace | null {
  return list.find((p) => p.kind === "home") ?? null;
}

/** Điểm đã ghim trùng toạ độ đang xem (để biết nên hiện "Ghim" hay "Bỏ ghim") */
export function placeAt(
  list: SavedPlace[],
  lat: number,
  lon: number,
): SavedPlace | null {
  const id = placeId(lat, lon);
  return list.find((p) => p.id === id) ?? null;
}

/**
 * Thêm/ghi đè một điểm. `asHome` = đặt làm cảng nhà (hạ cấp cảng nhà cũ
 * thành điểm thường). Trả về danh sách MỚI (immutable cho React).
 */
export function upsertPlace(
  list: SavedPlace[],
  input: { name: string; lat: number; lon: number; asHome?: boolean; loai?: LoaiDiem; ghiChu?: string; anh?: string[] },
): SavedPlace[] {
  const id = placeId(input.lat, input.lon);
  /*  GIỮ loại + ghi chú cũ khi chỗ gọi không nói gì (bản đồ thường ghim lại cùng chỗ chỉ có tên) — không để
      một cú ghim ở màn kia xoá mất ghi chú bà con gõ ở màn Hải đồ. */
  const cu = list.find((p) => p.id === id);
  const loai = input.loai && LOAI_DIEM.includes(input.loai) ? input.loai : cu?.loai;
  const ghi = (input.ghiChu !== undefined ? input.ghiChu : (cu?.ghiChu ?? "")).trim().slice(0, GHI_CHU_TOI_DA);
  const anh = (input.anh !== undefined ? input.anh : (cu?.anh ?? []))
    .filter((k): k is string => typeof k === "string" && k.length > 0 && k.length <= 200)
    .slice(0, ANH_DIEM_TOI_DA);
  const kind: PlaceKind = input.asHome ? "home" : "spot";
  let next = list.filter((p) => p.id !== id);
  if (input.asHome) {
    // chỉ một cảng nhà — hạ cấp cái cũ
    next = next.map((p) => (p.kind === "home" ? { ...p, kind: "spot" } : p));
  }
  next.push({ id, name: input.name.trim() || "Chỗ chưa đặt tên", lat: input.lat, lon: input.lon, kind, ...(loai ? { loai } : {}), ...(ghi ? { ghiChu: ghi } : {}), ...(anh.length ? { anh } : {}) });
  return next;
}

export function removePlace(list: SavedPlace[], id: string): SavedPlace[] {
  return list.filter((p) => p.id !== id);
}

export function renamePlace(
  list: SavedPlace[],
  id: string,
  name: string,
): SavedPlace[] {
  return list.map((p) =>
    p.id === id ? { ...p, name: name.trim() || p.name } : p,
  );
}

/** Đặt một điểm có sẵn làm cảng nhà (hạ cấp cái cũ) */
export function makeHome(list: SavedPlace[], id: string): SavedPlace[] {
  return list.map((p) => {
    if (p.id === id) return { ...p, kind: "home" };
    if (p.kind === "home") return { ...p, kind: "spot" };
    return p;
  });
}

/** Sắp xếp để hiện: cảng nhà trước, rồi tới các điểm ghim theo tên */
export function sortedPlaces(list: SavedPlace[]): SavedPlace[] {
  return [...list].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "home" ? -1 : 1;
    return a.name.localeCompare(b.name, "vi");
  });
}
