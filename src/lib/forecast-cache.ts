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
/** Mỗi lần máy báo hết chỗ thì bỏ ÍT NHẤT bấy nhiêu bản CŨ NHẤT (mọi namespace) */
const DROP_PER_RETRY = 4;
/** Số lần dọn-rồi-ghi-lại trước khi chịu thua (thà báo thật còn hơn treo) */
const MAX_RETRY = 3;

export interface Cached<T> {
  /** epoch ms lúc lưu — để hiện "dữ liệu lưu lúc …" */
  savedAt: number;
  data: T;
}

/** Lần gần nhất máy báo HẾT CHỖ khi lưu (epoch ms; 0 = chưa lần nào) */
let lastFullAt = 0;

/**
 * Lúc nào máy hết chỗ nhớ gần nhất — để dòng báo lúc tự tải sẵn nói thật
 * ("máy hết chỗ") thay vì báo xong trong khi chẳng giữ được gì.
 */
export function lastStorageFullAt(): number {
  return lastFullAt;
}

function key(ns: string, id: string): string {
  return `${PREFIX}${ns}.${id}`;
}

/**
 * Lưu bản mới nhất (ghi đè). `now` truyền vào để test được (không dùng Date.now ẩn).
 * Trả về `false` khi KHÔNG ghi được (máy hết chỗ) — UI phải nói thật với bà con
 * chứ không im lặng rồi ra biển mới biết máy chẳng giữ gì.
 *
 * LỖI CŨ (đã sửa): trim() nằm SAU setItem trong CÙNG khối try → localStorage đầy
 * thì setItem ném QuotaExceeded, trim KHÔNG BAO GIỜ chạy → kẹt vĩnh viễn, từ đó
 * về sau không lưu thêm được bản nào. Nay dọn TRƯỚC, và còn đầy thì dọn mạnh tay
 * (bỏ bản cũ nhất của MỌI namespace) rồi ghi lại.
 */
export function saveForecast<T>(
  ns: string,
  id: string,
  data: T,
  now: number = Date.now(),
): boolean {
  let payload: string;
  try {
    payload = JSON.stringify({ savedAt: now, data } satisfies Cached<T>);
  } catch {
    return false; // data không stringify được — không phải lỗi bộ nhớ
  }
  const k = key(ns, id);
  try {
    // Ghi ĐÈ id cũ thì số bản không tăng; id mới thì phải chừa 1 chỗ.
    const exists = window.localStorage.getItem(k) != null;
    trim(ns, exists ? MAX_ENTRIES : MAX_ENTRIES - 1);
  } catch {
    return false; // SSR / không có window
  }
  // Chỗ cần cho bản này (localStorage đếm UTF-16 ⇒ ~2 byte/ký tự)
  const needBytes = (k.length + payload.length) * 2;
  for (let attempt = 0; attempt <= MAX_RETRY; attempt++) {
    try {
      window.localStorage.setItem(k, payload);
      return true;
    } catch {
      // Hết chỗ: bỏ bản CŨ NHẤT (mọi namespace dự báo) rồi thử lại. Dọn theo
      // BYTE chứ không theo số bản (sửa 2026-07-31): bỏ 4 bản điểm ghim ~3 KB
      // không bao giờ đủ chỗ cho một lưới 16 ngày ~800 KB ⇒ các lớp chạy CUỐI
      // (độ mặn, nước dâng, dòng chảy tầng sâu) không bao giờ lưu được.
      // Nới DẦN (1/4 → 1/2 → cả bản): trình duyệt không cho hỏi còn trống bao
      // nhiêu, nên thiếu một tí cũng đừng dọn sạch cả kho ngay lượt đầu.
      const want = Math.ceil((needBytes * (attempt + 1)) / (MAX_RETRY + 1));
      if (attempt === MAX_RETRY || dropOldest(DROP_PER_RETRY, want, k) === 0) {
        lastFullAt = now;
        return false;
      }
    }
  }
  lastFullAt = now;
  return false;
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

/*
  KHÔNG có loadLatest("bản mới nhất bất kỳ") nữa — đã bỏ 2026-07-25. Nó là gốc
  của lỗi "dữ liệu chỗ khác / khung khác đội lốt chỗ đang xem": mất sóng thì trả
  bản gần nhất của MỘT id nào đó, UI lại dán nhãn theo thứ bà con vừa xin. Muốn
  lùi về bản lưu thì phải xin ĐÚNG id (loadForecast), không có thì nói thật.
*/

/** Mọi key cache dự báo bắt đầu bằng `pre`, kèm mốc lưu (cũ nhất trước) */
function entriesUnder(pre: string): { k: string; savedAt: number }[] {
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
  items.sort((a, b) => a.savedAt - b.savedAt); // cũ nhất trước
  return items;
}

/** Giữ tối đa `max` bản mới nhất trong namespace — xoá bản cũ nhất. */
function trim(ns: string, max: number = MAX_ENTRIES): void {
  try {
    const items = entriesUnder(key(ns, ""));
    if (items.length <= max) return;
    for (const it of items.slice(0, items.length - max)) {
      window.localStorage.removeItem(it.k);
    }
  } catch {
    // bỏ qua
  }
}

/**
 * Máy hết chỗ: bỏ bản CŨ NHẤT của mọi namespace dự báo cho tới khi bỏ đủ `n`
 * bản VÀ giải phóng đủ `needBytes`. `keep` = khoá đang định ghi (bỏ nó thì ghi
 * lại ngay, chẳng dôi ra chỗ nào). Trả về SỐ BẢN đã bỏ.
 */
function dropOldest(n: number, needBytes = 0, keep?: string): number {
  try {
    let dropped = 0;
    let freed = 0;
    for (const it of entriesUnder(PREFIX)) {
      if (dropped >= n && freed >= needBytes) break;
      if (it.k === keep) continue;
      const v = window.localStorage.getItem(it.k) ?? "";
      window.localStorage.removeItem(it.k);
      freed += (it.k.length + v.length) * 2;
      dropped++;
    }
    return dropped;
  } catch {
    return 0;
  }
}

/**
 * BẬC HY SINH khi phải bỏ bản dự báo để nhường chỗ cho dữ liệu bà con tự gõ.
 * Số NHỎ = bỏ TRƯỚC. Xếp theo "giữa biển mất thì thiệt tới đâu":
 *   0 `point`    — dự báo một toạ độ, vài KB, chạm lại là có
 *   1 `scalar`/`seascalar` — lớp dải màu (mây/mưa/nhiệt/độ mặn/nước dâng): xem cho biết
 *   2 `curdepth` — dòng chảy tầng sâu
 *   3 `grid`     — LƯỚI GIÓ/SÓNG cả vùng: an toàn tính mạng, giữa biển không tải lại được
 *   4 `fishmark` — bản đồ cá bà con chủ động ghim cho chuyến này
 * Namespace lạ (thêm sau) rơi vào bậc mặc định giữa bảng — không bao giờ bị bỏ
 * trước `point`, cũng không được ưu tiên hơn `grid`.
 */
const DROP_RANK: Record<string, number> = {
  point: 0,
  scalar: 1,
  seascalar: 1,
  curdepth: 2,
  grid: 3,
  fishmark: 4,
};
const DROP_RANK_DEFAULT = 2;

/** Bậc hy sinh của một key đầy đủ `forfish.fc.<ns>.<id>` */
function dropRank(fullKey: string): number {
  const ns = fullKey.slice(PREFIX.length).split(".")[0] ?? "";
  return DROP_RANK[ns] ?? DROP_RANK_DEFAULT;
}

/**
 * NHƯỜNG CHỖ CHO DỮ LIỆU BÀ CON TỰ NHẬP (2026-07-31, xếp lại nạn nhân 2026-08-01).
 *
 * Vì sao: dự báo tải sẵn chiếm gần hết localStorage, nên giấy tờ / bạn thuyền /
 * mốc bảo dưỡng vừa nhập có thể KHÔNG ghi xuống được — mà thứ đó bà con gõ tay,
 * mất là mất luôn, còn dự báo thì có sóng là tải lại. Vậy khi ghi dữ liệu tự
 * nhập bị máy báo hết chỗ, gọi hàm này để bỏ bớt bản dự báo rồi ghi lại.
 *
 * LỖI ĐÃ SỬA: bản đầu gọi `dropOldest(1, needBytes)` — chọn nạn nhân theo
 * `savedAt`. Nhưng `savedAt` của các lớp NẶNG là GIỜ CHẠY CRON của snapshot
 * (forecast-grid/cur-depth/scalar-field truyền `snap.savedAt`), còn bản
 * điểm-chạm tí hon lại lưu bằng `Date.now()` ⇒ lớp nặng LUÔN nằm phía "cũ".
 * Kết quả: một ghi chú 3 KB xoá nguyên lưới gió/sóng 16 ngày ~1,6 MB — thứ giữa
 * biển KHÔNG tải lại được — trong khi hàng chục bản điểm-chạm vụn vặt sống
 * nguyên. `savedAt` là TUỔI CỦA SỐ LIỆU (cho `isCacheCurrent`), không phải giá
 * trị của bản lưu ⇒ chọn nạn nhân theo BẬC HY SINH, trong cùng bậc mới xét cũ
 * trước.
 *
 * Trả về SỐ BẢN dự báo đã bỏ (0 = không còn gì để bỏ).
 */
export function reclaimForecastSpace(needBytes: number): number {
  const need = Math.max(0, needBytes);
  try {
    const items = entriesUnder(PREFIX).sort(
      (a, b) => dropRank(a.k) - dropRank(b.k) || a.savedAt - b.savedAt,
    );
    let dropped = 0;
    let freed = 0;
    for (const it of items) {
      if (dropped >= 1 && freed >= need) break;
      const v = window.localStorage.getItem(it.k) ?? "";
      window.localStorage.removeItem(it.k);
      freed += (it.k.length + v.length) * 2;
      dropped++;
    }
    return dropped;
  } catch {
    return 0;
  }
}

/** Mọi bản đã lưu trong namespace (mới nhất trước) — để đếm "trong máy có gì". */
export function loadAll<T>(
  ns: string,
): { id: string; savedAt: number; data: T }[] {
  try {
    const pre = key(ns, "");
    const out: { id: string; savedAt: number; data: T }[] = [];
    for (const { k } of entriesUnder(pre)) {
      const id = k.slice(pre.length);
      const c = loadForecast<T>(ns, id);
      if (c) out.push({ id, savedAt: c.savedAt, data: c.data });
    }
    return out.sort((a, b) => b.savedAt - a.savedAt);
  } catch {
    return [];
  }
}

/**
 * Ước lượng DUNG LƯỢNG (byte) các bản đã lưu có key bắt đầu `forfish.fc.<sub>`
 * — cho popup hiện "trong máy nặng bao nhiêu". `sub` là phần sau prefix, vd
 * "grid.", "scalar.salinity.", "" = mọi bản dự báo. localStorage là UTF-16 nên
 * ~2 byte/ký tự (ước lượng, không cần chính xác từng byte).
 */
export function bytesUnder(sub: string): number {
  try {
    const full = `${PREFIX}${sub}`;
    let n = 0;
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (!k || !k.startsWith(full)) continue;
      const v = window.localStorage.getItem(k) ?? "";
      n += (k.length + v.length) * 2;
    }
    return n;
  } catch {
    return 0;
  }
}

/** Mốc lưu MỚI NHẤT (epoch ms) trong các bản có key bắt đầu `forfish.fc.<sub>`
 *  — cho popup hiện "lưu lúc nào" + tính còn-mới theo nhịp nguồn. null nếu trống. */
export function latestSavedAt(sub: string): number | null {
  try {
    const full = `${PREFIX}${sub}`;
    let max: number | null = null;
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (!k || !k.startsWith(full)) continue;
      try {
        const s = (JSON.parse(window.localStorage.getItem(k) ?? "{}") as Cached<unknown>).savedAt;
        if (typeof s === "number" && (max == null || s > max)) max = s;
      } catch {
        /* mục hỏng — bỏ qua */
      }
    }
    return max;
  } catch {
    return null;
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
