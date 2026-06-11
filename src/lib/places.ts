// Trục 1 — "Điểm của tôi": vị trí ghim đặc thù của chủ tàu (bãi hay đánh, rạn
// quen, chỗ trúng cá) + cảng nhà. Thay cho việc chọn cảng trong danh sách —
// ngư dân nghĩ theo CHỖ CỦA MÌNH, không theo danh mục cảng nhà nước.
//
// Lưu localStorage `forfish.places.v1`. Logic thuần (không đụng React/map) để
// test được; sau này nối DB theo tàu thì chỉ thay loadPlaces/persist.

export type PlaceKind = "home" | "spot";

export interface SavedPlace {
  /** id suy ra từ toạ độ → cùng một chỗ không ghim trùng 2 lần */
  id: string;
  name: string;
  lat: number;
  lon: number;
  kind: PlaceKind;
}

const KEY = "forfish.places.v1";

/** id ổn định theo toạ độ (làm tròn 3 số ~ 100 m) — không cần Date/random */
export function placeId(lat: number, lon: number): string {
  return `${lat.toFixed(3)},${lon.toFixed(3)}`;
}

export function loadPlaces(): SavedPlace[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as SavedPlace[];
    return Array.isArray(list) ? list.filter(isValid) : [];
  } catch {
    return [];
  }
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

export function persistPlaces(list: SavedPlace[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // storage đầy — bỏ qua, mất phần nhớ điểm
  }
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
  input: { name: string; lat: number; lon: number; asHome?: boolean },
): SavedPlace[] {
  const id = placeId(input.lat, input.lon);
  const kind: PlaceKind = input.asHome ? "home" : "spot";
  let next = list.filter((p) => p.id !== id);
  if (input.asHome) {
    // chỉ một cảng nhà — hạ cấp cái cũ
    next = next.map((p) => (p.kind === "home" ? { ...p, kind: "spot" } : p));
  }
  next.push({ id, name: input.name.trim() || "Chỗ chưa đặt tên", lat: input.lat, lon: input.lon, kind });
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
