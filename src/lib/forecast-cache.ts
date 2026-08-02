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

/**
 * KẾT CỤC MỘT LẦN GHI DỰ BÁO — ba trạng thái, KHÔNG phải boolean (2026-08-02).
 *
 * Vì sao cần trạng thái thứ ba: cửa "đừng đè bản đầy đủ bằng bản thiếu"
 * (shouldOverwriteGrid / shouldOverwriteScalar) trả false cho HAI chuyện khác
 * hẳn nhau — "kho đang giữ bản TỐT HƠN, khỏi ghi" (mừng) và "máy hết chỗ" (lo).
 * Gộp cả hai vào một chữ `false` là gốc của vòng đốt sóng 2 phút/lượt: mẻ tải
 * sẵn tưởng mình chẳng giữ được gì nên không ghi mốc, rồi mỗi lần bà con liếc
 * điện thoại lại bắn lại cả mẻ ~2,5–3 MB.
 *  · `written` — đã nằm xuống máy
 *  · `kept`    — KHÔNG ghi vì kho đang giữ bản tốt hơn/còn dùng được (coi như xong)
 *  · `failed`  — không giữ được (máy hết chỗ / không có localStorage)
 */
export type ForecastSaveOutcome = "written" | "kept" | "failed";

/**
 * PHẠM VI ĐẾM GHI của MỘT mẻ (2026-08-02) — mẻ tải sẵn cần biết mình VỪA GIỮ
 * ĐƯỢC GÌ THẬT, không phải "trong kho đang có gì".
 *
 * Vì sao: `shouldMarkPretripRun` từng soi KHO (`saved.places > 0`). Máy đã có
 * bản 3 hôm trước + mẻ sáng nay hỏng sạch ⇒ vẫn ghi mốc, khoá 6 giờ, tàu đi biển
 * 10 ngày với dự báo 3 ngày tuổi.
 *
 * Vì sao THEO PHẠM VI chứ không phải bộ đếm mức module như bản đầu: nút "Tải
 * lại" từng lớp trong popup (`runLayer`) cũng ghi qua `saveForecast`, mà cờ
 * `running` chỉ chặn hai mẻ TỰ ĐỘNG. Bà con chạm "Tải lại" trong lúc mẻ tự động
 * đang chạy ⇒ bản do NÚT ghi được cộng vào `gained` của mẻ tự động ⇒ mẻ hỏng
 * sạch vẫn ra "xanh" + khoá 6 giờ. Nay mỗi mẻ mở phạm vi riêng, một lần ghi chỉ
 * ghi công cho phạm vi MỞ SAU CÙNG. Hai mẻ đan xen thì phạm vi ngoài bị đếm
 * THIẾU — lệch về phía AN TOÀN (đếm thiếu thì cùng lắm thử lại; đếm thừa mới là
 * khoá 6 giờ oan giữa lúc cần dự báo).
 */
export interface ForecastWriteScope {
  /** số bản GHI ĐƯỢC theo namespace trong phạm vi này */
  counts: Record<string, number>;
  /** số lần TỪ CHỐI GHI VÌ KHO ĐANG GIỮ BẢN TỐT HƠN, theo namespace */
  kept: Record<string, number>;
  /** đóng phạm vi — gọi trong `finally`, gọi thừa cũng không sao */
  end: () => void;
}

const scopeStack: ForecastWriteScope[] = [];

/** Mở một phạm vi đếm ghi cho mẻ đang chạy. */
export function beginForecastWrites(): ForecastWriteScope {
  const s: ForecastWriteScope = {
    counts: {},
    kept: {},
    end: () => {
      const i = scopeStack.indexOf(s);
      if (i >= 0) scopeStack.splice(i, 1);
    },
  };
  scopeStack.push(s);
  return s;
}

function activeScope(): ForecastWriteScope | null {
  return scopeStack[scopeStack.length - 1] ?? null;
}

/**
 * Ghi nhận "kho đang giữ bản TỐT HƠN nên khỏi ghi" — gọi từ cửa ghi đè của lưới
 * gió/sóng và lớp dải màu. Không có phạm vi nào mở thì bỏ qua êm.
 */
export function noteForecastKept(ns: string): void {
  const s = activeScope();
  if (s) s.kept[ns] = (s.kept[ns] ?? 0) + 1;
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
      const s = activeScope();
      if (s) s.counts[ns] = (s.counts[ns] ?? 0) + 1;
      return true;
    } catch {
      // Hết chỗ: bỏ bản RẺ NHẤT trước (bậc hy sinh), rồi mới tới bản cũ trong
      // cùng bậc. Dọn theo BYTE chứ không theo số bản (sửa 2026-07-31): bỏ 4
      // bản điểm ghim ~3 KB không bao giờ đủ chỗ cho một lưới 16 ngày ~800 KB
      // ⇒ các lớp chạy CUỐI (độ mặn, nước dâng, dòng chảy tầng sâu) không bao
      // giờ lưu được.
      // Nới DẦN (1/4 → 1/2 → 3/4): trình duyệt không cho hỏi còn trống bao
      // nhiêu, nên thiếu một tí cũng đừng dọn sạch cả kho ngay lượt đầu. GIỮ
      // vòng nới dần này — bỏ nó là dựng lại đúng lỗi "kẹt vĩnh viễn" 2026-07-25.
      const want = Math.ceil((needBytes * (attempt + 1)) / (MAX_RETRY + 1));
      if (attempt === MAX_RETRY || dropOldest(want, k) === 0) {
        // MỐC SỰ CỐ, KHÔNG phải tuổi số liệu (sửa 2026-08-02): `now` là tuổi
        // của SỐ LIỆU (giờ chạy cron của snapshot, thường mấy giờ TRƯỚC), ghi
        // nó vào đây thì `lastStorageFullAt() >= startedAt` luôn sai ⇒ bà con
        // KHÔNG bao giờ thấy dòng "Máy hết chỗ nhớ" dù lưới 16 ngày không lưu
        // nổi; tệ hơn, mốc thật do bước khác đặt bị kéo LÙI, xoá luôn cảnh báo.
        lastFullAt = Date.now();
        return false;
      }
    }
  }
  lastFullAt = Date.now();
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
 * Máy hết chỗ: bỏ bản RẺ NHẤT (bậc hy sinh DROP_RANK) cho tới khi giải phóng đủ
 * `needBytes`. `keep` = khoá đang định ghi (bỏ nó thì ghi lại ngay, chẳng dôi ra
 * chỗ nào). Trả về SỐ BẢN đã bỏ.
 *
 * BA LỖI ĐÃ SỬA (2026-08-02):
 *  1. Xếp nạn nhân theo `savedAt` — mà `savedAt` của lưới gió/sóng là GIỜ CHẠY
 *     CRON (luôn trông "cũ"), còn lớp mây vừa tải mang giờ máy ⇒ lưới 16 ngày
 *     ~1,6 MB bị xoá để nhường chỗ cho lớp "xem cho biết". Nay xếp theo BẬC
 *     trước, trong cùng bậc mới xét cũ trước — cùng luật với reclaimForecastSpace.
 *  2. Luôn bỏ TỐI THIỂU 4 bản dù chỉ cần vài KB. Nay đủ chỗ là dừng (vẫn phải bỏ
 *     ít nhất 1 bản, không thì vòng nới dần ở saveForecast quay vòng vô ích).
 *  3. THIẾU TRẦN BẬC: xếp đúng thứ tự nạn nhân nhưng không có luật DỪNG, nên vòng
 *     lặp cứ đi tiếp lên các bậc quý hơn. Ghi một lớp độ mặn ~500 KB (bậc 2) lúc
 *     máy đầy: dọn hết price + point + scalar vẫn thiếu ⇒ đi tiếp sang grid,
 *     fishmark, rồi **storm** — BẢN TIN BÃO bị xoá để nhét một lớp dải màu "xem
 *     cho biết". Đúng thứ mà DROP_RANK tuyên bố đang bảo vệ. Nay dừng ngay khi
 *     nạn nhân kế tiếp QUÝ HƠN thứ đang ghi.
 */
function dropOldest(needBytes = 0, keep?: string): number {
  try {
    /* TRẦN BẬC: chỉ được hy sinh thứ RẺ HƠN HOẶC NGANG HÀNG với thứ đang ghi.
       `keep` không truyền (không biết đang ghi gì) → không đặt trần, giữ nguyên
       hành vi cũ.

       Vì sao `>` chứ không `>=` (đừng đổi mà không đọc chỗ này): NGANG HÀNG =
       cùng một hạng giá trị, bỏ bản CŨ để nhận bản MỚI cùng loại là đúng việc —
       `rankedVictims` trong cùng bậc đã xếp cũ trước. Đặt `>=` là cấm luôn cả
       chuyện đó: 40 bản điểm-chạm lấp đầy máy thì KHÔNG bản điểm nào ghi được
       nữa, tức dựng lại đúng lỗi "kẹt vĩnh viễn" 2026-07-25 mà vòng MAX_RETRY
       nới dần sinh ra để chống. */
    const ceiling = keep == null ? Infinity : dropRank(keep);
    const victims = rankedVictims();
    let dropped = 0;
    let freed = 0;
    for (const it of victims) {
      if (dropped >= 1 && freed >= needBytes) break;
      if (it.k === keep) continue;
      // nạn nhân kế tiếp quý hơn thứ đang ghi → THÀ KHÔNG GHI. Trả về số đã bỏ;
      // saveForecast thấy 0 thì báo "máy hết chỗ" — nói thật còn hơn âm thầm
      // xoá tin bão.
      if (dropRank(it.k) > ceiling) break;
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
 * BẬC HY SINH khi phải bỏ bản dự báo (nhường chỗ cho dữ liệu bà con tự gõ, HOẶC
 * cho một bản dự báo quý hơn). Số NHỎ = bỏ TRƯỚC. Xếp theo "giữa biển mất thì
 * thiệt tới đâu":
 *   0 `price`    — bảng giá cá/dầu: vài KB, mất cũng chỉ là không biết giá lúc rời bờ
 *   1 `point`    — dự báo một toạ độ, vài KB, chạm lại là có
 *   2 `scalar`/`seascalar` — lớp dải màu (mây/mưa/nhiệt/độ mặn/nước dâng): xem cho biết
 *   3 `curdepth` — dòng chảy tầng sâu
 *   4 `grid`     — LƯỚI GIÓ/SÓNG cả vùng: an toàn tính mạng, giữa biển không tải lại được
 *   5 `fishmark` — bản đồ cá bà con chủ động ghim cho chuyến này
 *   6 `storm`    — TIN BÃO: an toàn TÍNH MẠNG và chỉ vài KB. Bỏ nó chẳng giải
 *                  phóng được chỗ nào đáng kể mà lại lấy mất đúng thứ cứu người
 *                  ⇒ bỏ SAU CÙNG (2026-08-02: trước đây `storm` và `price` không
 *                  có trong bảng nên rơi vào bậc mặc định, tin bão bị hy sinh
 *                  TRƯỚC cả lưới gió).
 * Namespace lạ (thêm sau) rơi vào bậc mặc định giữa bảng — không bao giờ bị bỏ
 * trước `point`, cũng không được ưu tiên hơn `grid`.
 */
const DROP_RANK: Record<string, number> = {
  price: 0,
  point: 1,
  scalar: 2,
  seascalar: 2,
  curdepth: 3,
  grid: 4,
  fishmark: 5,
  storm: 6,
};
const DROP_RANK_DEFAULT = 3;

/** Bậc hy sinh của một key đầy đủ `forfish.fc.<ns>.<id>` */
function dropRank(fullKey: string): number {
  const ns = fullKey.slice(PREFIX.length).split(".")[0] ?? "";
  return DROP_RANK[ns] ?? DROP_RANK_DEFAULT;
}

/** Mọi bản dự báo, XẾP THEO THỨ TỰ ĐEM BỎ: bậc rẻ trước, cùng bậc thì cũ trước.
    MỘT nguồn sự thật cho cả hai đường dọn (máy đầy lúc ghi dự báo · nhường chỗ
    cho dữ liệu bà con tự gõ) — trước đây hai đường xếp nạn nhân KHÁC NHAU. */
function rankedVictims(): { k: string; savedAt: number }[] {
  return entriesUnder(PREFIX).sort(
    (a, b) => dropRank(a.k) - dropRank(b.k) || a.savedAt - b.savedAt,
  );
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
    const items = rankedVictims();
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
