// Trục 1 — LƯU DỰ BÁO ĐỂ XEM OFFLINE ("ra biển mất mạng vẫn coi được 16 ngày").
//
// Vì sao cần: Service Worker (public/sw.js) chỉ cache same-origin (/api/* → cá
// PFZ chạy offline sẵn). NHƯNG dự báo BIỂN 16 ngày lấy thẳng từ Open-Meteo
// (cross-origin) → SW không đụng → mất mạng là mất. Module này lưu bản MỚI NHẤT
// vào localStorage lúc CÓ mạng; mất mạng thì trả bản đã lưu + cờ `stale`.
//
// Không TTL cứng cho bản offline: có mạng luôn lấy mới + ghi đè; chỉ khi fetch
// hỏng (ngoài khơi) mới lùi về bản lưu. Prefix `forfish.*` giữ đúng quy ước.

const PREFIX = "forfish.fc.";
/** Trần số bản điểm-chạm giữ lại (đủ vài chuyến, không phình localStorage) */
const MAX_ENTRIES = 40;

export interface Cached<T> {
  /** epoch ms lúc lưu — để hiện "dữ liệu lưu lúc …" */
  savedAt: number;
  data: T;
}

function key(ns: string, id: string): string {
  return `${PREFIX}${ns}.${id}`;
}

/** Lưu bản mới nhất (ghi đè). `now` truyền vào để test được (không dùng Date.now ẩn). */
export function saveForecast<T>(
  ns: string,
  id: string,
  data: T,
  now: number = Date.now(),
): void {
  try {
    window.localStorage.setItem(
      key(ns, id),
      JSON.stringify({ savedAt: now, data } satisfies Cached<T>),
    );
    trim(ns);
  } catch {
    // storage đầy / SSR không có window — bỏ qua, mất mạng thì chịu
  }
}

/** Đọc bản đã lưu (bất kể cũ) — null nếu chưa từng lưu / hỏng. */
export function loadForecast<T>(ns: string, id: string): Cached<T> | null {
  try {
    const raw = window.localStorage.getItem(key(ns, id));
    if (!raw) return null;
    const c = JSON.parse(raw) as Cached<T>;
    if (typeof c?.savedAt !== "number" || c.data == null) return null;
    return c;
  } catch {
    return null;
  }
}

/** Bản lưu GẦN ĐÂY NHẤT trong namespace (mất mạng tap điểm lạ → lùi về bản cuối). */
export function loadLatest<T>(ns: string): Cached<T> | null {
  try {
    const pre = key(ns, "");
    let best: Cached<T> | null = null;
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (!k || !k.startsWith(pre)) continue;
      const c = loadForecast<T>(ns, k.slice(pre.length));
      if (c && (!best || c.savedAt > best.savedAt)) best = c;
    }
    return best;
  } catch {
    return null;
  }
}

/** Giữ tối đa MAX_ENTRIES bản mới nhất mỗi namespace — xoá bản cũ nhất. */
function trim(ns: string): void {
  try {
    const pre = key(ns, "");
    const items: { k: string; savedAt: number }[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (!k || !k.startsWith(pre)) continue;
      const raw = window.localStorage.getItem(k);
      let savedAt = 0;
      try {
        savedAt = (JSON.parse(raw ?? "{}") as Cached<unknown>).savedAt ?? 0;
      } catch {
        savedAt = 0;
      }
      items.push({ k, savedAt });
    }
    if (items.length <= MAX_ENTRIES) return;
    items.sort((a, b) => a.savedAt - b.savedAt); // cũ nhất trước
    for (const it of items.slice(0, items.length - MAX_ENTRIES)) {
      window.localStorage.removeItem(it.k);
    }
  } catch {
    // bỏ qua
  }
}

/** Toạ độ → id lưới ~0.25° (gộp các lần tap gần nhau về một bản) */
export function coordId(lat: number, lon: number): string {
  const r = (v: number) => (Math.round(v * 4) / 4).toFixed(2);
  return `${r(lat)}_${r(lon)}`;
}

/** "dữ liệu lưu lúc …" — nhãn tiếng Việt ngắn cho UI khi xem offline */
export function savedAgoLabel(savedAt: number, now: number = Date.now()): string {
  const mins = Math.max(0, Math.round((now - savedAt) / 60000));
  if (mins < 60) return `lưu ${mins} phút trước`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `lưu ${hours} giờ trước`;
  const days = Math.round(hours / 24);
  return `lưu ${days} ngày trước`;
}
