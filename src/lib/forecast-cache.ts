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
  /**
   * KHOÁ ĐẦY ĐỦ của những bản CHÍNH PHẠM VI NÀY vừa ghi (`forfish.fc.<ns>.<id>`).
   * Có nó thì `debitScopes` mới trừ đúng bản của mình — xem chú thích ở đó.
   */
  written: Set<string>;
  /**
   * SỐ BẢN PHẢI XOÁ ĐI ĐỂ CÓ CHỖ GHI trong lúc phạm vi này đang mở (máy hết chỗ).
   * Dùng để dòng báo nói ĐÚNG NGUYÊN NHÂN: mẻ chẳng giữ được gì mà kho phải dọn
   * mấy bản mới nhét nổi thì đó là CHỖ NHỚ, không phải "chưa có sóng" (T4).
   * KHÔNG đếm `trim` (dọn thường lệ khi quá 40 bản điểm-chạm — chuyện bình
   * thường, máy không hề chật).
   */
  evicted: number;
  /** đóng phạm vi — gọi trong `finally`, gọi thừa cũng không sao */
  end: () => void;
}

const scopeStack: ForecastWriteScope[] = [];

/** Mở một phạm vi đếm ghi cho mẻ đang chạy. */
export function beginForecastWrites(): ForecastWriteScope {
  const s: ForecastWriteScope = {
    counts: {},
    kept: {},
    written: new Set<string>(),
    evicted: 0,
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
 * TRỪ CÔNG khi một bản VỪA ĐƯỢC GHI TRONG PHẠM VI lại bị xoá đi (T3, 2026-08-02).
 *
 * Vì sao bắt buộc: `saveForecast` chỉ CỘNG `counts[ns]`, còn BA đường xoá (trim ·
 * dropOldest · reclaimForecastSpace) không đường nào trừ. Kịch bản dựng lại được:
 * bước ghi điểm ghim xong (`gained.point = 3`), bước ghi `scalar.cloud.d16` làm
 * `setItem` ném ⇒ dropOldest xoá luôn ba bản `point` VỪA ghi ⇒ `gained.point` vẫn
 * 3 ⇒ `shouldMarkPretripRun` true ⇒ KHOÁ 6 GIỜ, mà `savedSummary()` chạy sau nên
 * `untilIso = null` ⇒ dòng báo xanh "Đã lưu dự báo mới về máy." ngay cạnh chip
 * "Còn thiếu N lớp". Tàu đi biển với máy trống mà app nói đã lưu xong.
 *
 * TRỪ ĐÚNG BẢN CỦA MÌNH, KHÔNG TRỪ THEO NAMESPACE (sửa 2026-08-02, hồi quy do
 * chính bản vá T3 đẻ ra): bản đầu chỉ so `nsOf(key)`, không so id, không so mốc.
 * Mà `rankedVictims()` xếp CŨ TRƯỚC ⇒ nạn nhân điển hình là bản `point` của
 * CHUYẾN TRƯỚC, chẳng liên quan mẻ đang chạy. Cảnh thật: mẻ ghi 3 điểm ghim
 * (`gained.point = 3`), bước `scalar.cloud.d16` làm `dropOldest` xoá 3 bản
 * `point` ĐỜI CŨ ⇒ `gained.point` về 0 trong khi 3 bản MỚI vẫn nằm nguyên trong
 * máy ⇒ không ghi mốc ⇒ cửa 2 phút mở lại, mỗi lần bà con liếc điện thoại là
 * một mẻ ~3 MB tiền sóng. "Đếm thiếu là lệch về phía an toàn" KHÔNG đúng: đếm
 * thiếu đẻ ra vòng tải lại vô tận.
 *
 * Nay chỉ trừ phạm vi nào THẬT SỰ đã ghi đúng khoá đó (`s.written`), và trừ
 * ĐÚNG MỘT lần (xoá khỏi `written` luôn) — mẻ lồng nhau không còn bị trừ hai
 * lần cho một lần cộng.
 */
function debitScopes(fullKey: string): void {
  const ns = nsOf(fullKey);
  for (const s of scopeStack) {
    if (!s.written.delete(fullKey)) continue;
    if ((s.counts[ns] ?? 0) > 0) s.counts[ns]! -= 1;
  }
}

/** Ghi nhận "đã phải XOÁ một bản để có chỗ" cho mọi phạm vi đang mở (xem
    `ForecastWriteScope.evicted`). */
function noteEvicted(): void {
  for (const s of scopeStack) s.evicted += 1;
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
  let freedTotal = 0;
  /*  ═══ XOÁ MỘT BẢN → THỬ GHI LẠI NGAY ═══ (sửa 2026-08-02h)

      Chủ dự án chốt: "nó phải down được cái mới nó mới xoá cái cũ đi chứ."
      localStorage không cho ghi-rồi-xoá thật (đầy thì không ghi nổi), nên cái
      gần nhất làm được là: **xoá ĐÚNG MỘT bản rồi thử lại ngay**.

      LỖI ĐÃ SỬA: vòng cũ nới dần 1/4 → 1/2 → 3/4 `needBytes` MỖI LƯỢT, tức
      trước khi cầu dao kịp nhận ra dọn vô ích thì đã xoá tới ~1,5 lần chỗ cần —
      với lưới 16 ngày (~1,6 MB) là ~2,4 MB dự báo bay mà **không ghi được byte
      nào**. Ca kích hoạt rất thường trên iOS: localStorage dùng CHUNG hạn ngạch
      origin với Cache API, nên ô bản đồ 12 MB vừa tải làm `setItem` ném dù
      localStorage còn rộng.

      Nay mỗi lượt chỉ mất đúng một bản, và mất tới đâu thử tới đó. Hai cửa dừng:
        · giải phóng ĐỦ chỗ cần mà vẫn ném ⇒ sức ép nằm ở kho khác, DỪNG;
        · không còn nạn nhân hợp lệ (`dropOne` trả null) ⇒ DỪNG.
      Vòng LUÔN tiến: mỗi lượt bỏ hẳn một mục khỏi danh sách đã tính sẵn, nên
      `dropOne` chắc chắn trả 0 sau hữu hạn lượt — không cần trần giả. */
  let nanNhan: { k: string; savedAt: number }[] | null = null;
  /*  ═══ XOÁ THÌ GIỮ BẢN SAO — GHI KHÔNG ĐƯỢC THÌ TRẢ LẠI ═══ (2026-08-02i)

      Chủ dự án chốt từ đầu: *"nó phải down được cái mới nó mới xoá cái cũ đi
      chứ."* localStorage không cho ghi-trước-xoá-sau, nhưng cho **hoàn tác**.

      LỖI ĐÃ SỬA (vòng đánh giá cuối bắt): cầu dao chỉ nổ khi đã giải phóng đủ
      byte, nên khi tổng nạn nhân vẫn nhỏ hơn chỗ cần thì vòng xoá SẠCH danh sách
      rồi mới chịu thua — mất hết mà không ghi được gì. Ca cụ thể: máy gần đầy,
      ghi `grid.d16` (~1,6 MB), nạn nhân cùng lớp chỉ có `d3`+`d7` vài trăm KB ⇒
      cả hai bay, d16 không vào ⇒ tàu ra khơi KHÔNG CÒN lưới gió/sóng nào.

      Nay mỗi bản gỡ ra được giữ nguyên nội dung; cú ghi cuối cùng vẫn hỏng thì
      trả lại hết. Thành công (đường thường ngày) thì thả ngay, không giữ gì.
      Chi phí RAM chỉ tồn tại trong đúng mấy lượt thử, và cùng cỡ với payload
      đang cầm sẵn trên tay. */
  const daGo: DaGo[] = [];
  for (;;) {
    try {
      window.localStorage.setItem(k, payload);
      const s = activeScope();
      if (s) {
        s.counts[ns] = (s.counts[ns] ?? 0) + 1;
        s.written.add(k); // để `debitScopes` trừ đúng bản này, không trừ bản khác
      }
      return true;
    } catch {
      /*  ═══ MẤT SÓNG THÌ KHÔNG XOÁ GÌ HẾT ═══ (chủ dự án chốt 2026-08-02i)

          "Đã lưu offline mà chưa online lại thì cứ dùng kho offline chứ xoá cái
          gì? Offline thì làm sao tăng kích thước kho offline nữa mà phải xoá?"

          Đúng, và kiểm được bằng mã: MỌI lời gọi `saveForecast` đều nằm sau một
          lượt fetch THÀNH CÔNG (grid · scalar · sea-scalar · cur-depth · storms ·
          fish-mark · price · marine-weather). Nhập tệp sao lưu thì ghi thẳng
          `setItem`, không đi qua đây. Nên offline, kho dự báo KHÔNG THỂ phình —
          và cũng không có gì đáng đổi chỗ.

          Trước đây đây là LẬP LUẬN. Nay là LUẬT có cổng gác: mất sóng thì tuyệt
          đối không xoá một bản nào, chỉ báo "không ghi được". Ai thêm một đường
          ghi chạy offline sau này cũng không thể vô tình ăn vào kho của bà con.
          `navigator.onLine === false` là tín hiệu ĐÁNG TIN theo CHIỀU NÀY: nó
          hay báo `true` nhầm (wifi nội bộ trên tàu), chứ báo `false` thì gần như
          chắc chắn là mất sóng thật. */
      if (typeof navigator !== "undefined" && navigator.onLine === false) break;
      /* CẦU DAO "DỌN KHÔNG ĂN THUA" (T2): đã giải phóng đủ chỗ cần mà vẫn ném ⇒
         sức ép KHÔNG nằm ở localStorage; xoá tiếp chỉ mất thêm dự báo mà vẫn
         không ghi được. Thà dừng và nói thật "máy hết chỗ". */
      if (freedTotal >= needBytes) break;
      /* ĐÚNG MỘT BẢN mỗi lượt. `eligibleVictims(k)` đã lọc sẵn: cùng lớp với
         thứ đang ghi, và khung ngắn không giết khung dài. */
      /*  ⚠️ LUÔN CHỪA LẠI MỘT BẢN CỦA LỚP (sửa 2026-08-02i — vòng đánh giá cuối).

          LỖI ĐÃ SỬA: cầu dao chỉ nổ khi `freedTotal >= needBytes`. Nếu tổng byte
          của toàn bộ nạn nhân vẫn nhỏ hơn chỗ cần, vòng xoá SẠCH danh sách rồi
          mới chịu thua ⇒ mất hết mà không ghi được gì. Ca cụ thể: máy gần đầy,
          mẻ tải sẵn ghi `grid.d16` (~1,6 MB), nạn nhân cùng lớp chỉ có `d3` +
          `d7` (vài trăm KB) ⇒ **cả hai bị xoá, d16 không ghi được** ⇒ tàu ra
          khơi KHÔNG CÒN lưới gió/sóng nào.

          Không đo tổng trước được: trình duyệt không cho hỏi còn trống bao
          nhiêu, nên "tổng nạn nhân < chỗ cần" KHÔNG có nghĩa là vô vọng (phần
          trống sẵn có cũng góp vào) — đo kiểu đó là chặn oan cả ca ghi được.

          Bảo đảm rẻ mà chắc: **bỏ bản QUÝ NHẤT ra khỏi danh sách nạn nhân**.
          `eligibleVictims` xếp rẻ/cũ trước, nên phần tử cuối là bản đáng giữ
          nhất của lớp. Xấu nhất bây giờ: mất mấy bản cũ, nhưng lớp đó **luôn còn
          ít nhất một bản dùng được** — đúng lời hứa "16 ngày luôn đủ info". */
      nanNhan ??= eligibleVictims(k);
      const go = dropOne(nanNhan);
      if (!go) break; // không còn nạn nhân hợp lệ
      daGo.push(go);
      freedTotal += go.bytes;
    }
  }
  /*  KHÔNG GHI ĐƯỢC ⇒ TRẢ LẠI HẾT. Đây là vế làm cho luật "chỉ xoá khi đã ghi
      được bản mới" thành đúng, chứ không chỉ là lời hứa. */
  hoanTac(daGo);
  /* MỐC SỰ CỐ, KHÔNG phải tuổi số liệu (sửa 2026-08-02): `now` là tuổi của SỐ
     LIỆU (giờ chạy cron của snapshot, thường mấy giờ TRƯỚC), ghi nó vào đây thì
     `lastStorageFullAt() >= startedAt` luôn sai ⇒ bà con KHÔNG bao giờ thấy dòng
     "Máy hết chỗ nhớ" dù lưới 16 ngày không lưu nổi. */
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

/**
 * MÁY NÓI CHẮC LÀ ĐANG MẤT SÓNG — cửa duy nhất cho luật "đọc bản đã lưu TRƯỚC
 * khi đốt đồng hồ mạng" (K3, 2026-08-02).
 *
 * Vì sao phải là `=== false` chứ KHÔNG phải `!== true`: `navigator.onLine` vắng
 * mặt (WebView cũ, môi trường test) hoặc `undefined` thì `!== true` là TRUE ⇒ ở
 * cảng sóng đầy vạch app cũng trả bản cũ, bà con không bao giờ lấy được bản mới
 * — đúng chiều hỏng nguy hiểm hơn. Chỉ khi máy KHẲNG ĐỊNH mình mất sóng mới đi
 * đường tắt; ca "sóng sống mà chết" (`onLine` vẫn true) vẫn đi đường thường.
 *
 * Ngược lại, `onLine === false` mà vẫn gọi mạng là ném cả phút đồng hồ chờ đi:
 * `cur-depth` ~55 giây · `scalar-field` ≤60 giây/lớp × 5 lớp · `forecast-grid`
 * ~30 giây · `marine-weather` ~15 giây, trong khi bản cần xem đã nằm sẵn trong
 * máy từ giây 0.
 */
export function isDefinitelyOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
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
      debitScopes(it.k); // bản vừa ghi trong mẻ mà bị trim thì phải TRỪ công
      window.localStorage.removeItem(it.k);
    }
  } catch {
    // bỏ qua
  }
}

/**
 * Máy hết chỗ: bỏ bản RẺ NHẤT (bậc hy sinh DROP_RANK) cho tới khi giải phóng đủ
 * `needBytes`. `keep` = khoá đang định ghi (bỏ nó thì ghi lại ngay, chẳng dôi ra
 * chỗ nào). Trả về SỐ BYTE đã giải phóng (0 = không bỏ được bản nào) — đổi từ
 * "số bản" 2026-08-02 để `saveForecast` biết dọn có ĂN THUA không (xem cầu dao
 * T2 trong saveForecast).
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
/**
 * DANH SÁCH NẠN NHÂN HỢP LỆ, ĐÃ XẾP THỨ TỰ ĐEM BỎ — tính MỘT LẦN.
 *
 * ⚠️ VÌ SAO TÁCH RA (2026-08-02h — vòng soát chéo bắt): `rankedVictims()` gọi
 * `entriesUnder()`, mà hàm đó `JSON.parse` **TOÀN BỘ payload của mọi bản** chỉ để
 * đọc `savedAt` — kể cả `grid.d16` ~1,6 MB. Vòng "xoá một bản rồi thử lại" gọi
 * `dropOldest` mỗi lượt, tức quét lại cả kho ~5 MB ĐỒNG BỘ mỗi lượt: vài chục
 * lượt là vài giây đơ luồng chính, ngay lúc bà con đang tải sẵn trước chuyến.
 * Danh sách chỉ ngắn đi trong lúc dọn nên tính một lần là đủ.
 */
function eligibleVictims(keep?: string): { k: string; savedAt: number }[] {
  /*  ═══ CHỈ ĂN TRONG CHÍNH LỚP CỦA MÌNH ═══ (chủ dự án chốt 2026-08-02i)

      "Chỉ dọn khi down được 1 bản ghi mới thôi (online và down về thành công)
      thì nó luôn tối ưu và đảm bảo cái offline luôn đủ info truy cập được mọi
      lúc trong 16 ngày đã down về. Hành vi qua ngày 2, 3, 4 … 16 offline là
      giống nhau, đều đọc từ bản ghi local thôi."

      Vế thứ nhất đã đúng sẵn: mọi lời gọi `saveForecast` đều nằm sau một lượt
      fetch THÀNH CÔNG. Vế thứ hai thì CHƯA — và đây là chỗ vá.

      LỖI ĐÃ SỬA: bậc hy sinh `DROP_RANK` cho phép ăn XUYÊN LỚP. Ghi một lưới
      gió/sóng mới có thể xoá điểm ghim, lớp dải màu, giá cá — tức **ăn vào chính
      cái gói 16 ngày vừa tải về**. Kết cục: gói đó không còn "đủ info", và ngày
      thứ mấy của chuyến mở ra thấy gì thì tuỳ vào lượt ghi nào tình cờ chạy
      trước — đúng thứ làm hành vi ngày 2 khác ngày 9.

      Nay: nạn nhân phải CÙNG LỚP với thứ đang ghi. Lưới mới thay lưới cũ, điểm
      ghim thay điểm ghim — đúng nghĩa "bản mới thế chỗ bản nó thay thế". Không
      còn lớp nào ăn được lớp khác, nên gói đã tải giữ nguyên vẹn suốt chuyến.
      Không còn nạn nhân cùng lớp ⇒ TỪ CHỐI GHI và báo "máy hết chỗ" — nói thật,
      đúng luật đã áp cho dữ liệu bà con tự gõ.

      `DROP_RANK` giữ lại vì nó vẫn là thứ tự đúng để xếp nạn nhân TRONG cùng
      một lớp (`rankedVictims`). */
  const nsKeep = keep == null ? null : nsOf(keep);
  const keepGridDays = keep == null ? null : gridFrameDays(keep);
  const out: { k: string; savedAt: number }[] = [];
  for (const it of rankedVictims()) {
    if (it.k === keep) continue;
    if (nsKeep != null && nsOf(it.k) !== nsKeep) continue;
    if (keepGridDays != null) {
      const d = gridFrameDays(it.k);
      // khung DÀI HƠN thứ đang ghi → bỏ qua (khung ngắn không giết khung dài)
      if (d != null && d > keepGridDays) continue;
    }
    out.push(it);
  }
  return out;
}

/** Một bản vừa bị gỡ ra — giữ nguyên nội dung để CÒN TRẢ LẠI ĐƯỢC. */
interface DaGo {
  k: string;
  v: string;
  bytes: number;
}

/** Gỡ ĐÚNG MỘT bản trong danh sách đã tính sẵn. `null` = hết nạn nhân. */
function dropOne(list: { k: string; savedAt: number }[]): DaGo | null {
  const it = list.shift();
  if (!it) return null;
  try {
    const v = window.localStorage.getItem(it.k) ?? "";
    debitScopes(it.k);
    noteEvicted();
    window.localStorage.removeItem(it.k);
    return { k: it.k, v, bytes: (it.k.length + v.length) * 2 };
  } catch {
    return null;
  }
}

/** Trả lại những bản đã gỡ khi cú ghi cuối cùng vẫn không thành. */
function hoanTac(daGo: DaGo[]): void {
  for (const it of daGo) {
    try {
      window.localStorage.setItem(it.k, it.v);
    } catch {
      /* trả lại cũng không nổi thì thôi — đã cố hết sức */
    }
  }
}

/*  `dropOldest` ĐÃ XOÁ (2026-08-02i): vòng ghi nay dùng `eligibleVictims` +
    `dropOne` để khỏi quét-parse cả kho mỗi lượt, và để còn HOÀN TÁC được. Không
    chỗ nào trong `src/` gọi nó nữa. */


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


/** Namespace của một key đầy đủ `forfish.fc.<ns>.<id>` */
function nsOf(fullKey: string): string {
  return fullKey.slice(PREFIX.length).split(".")[0] ?? "";
}

/** Bậc hy sinh của một key đầy đủ `forfish.fc.<ns>.<id>` */
function dropRank(fullKey: string): number {
  return DROP_RANK[nsOf(fullKey)] ?? DROP_RANK_DEFAULT;
}

/** Số NGÀY của một bản lưới gió/sóng (`forfish.fc.grid.d16` → 16); null nếu key
    không phải lưới. Dùng để cấm khung ngắn hy sinh khung dài — xem dropOldest. */
function gridFrameDays(fullKey: string): number | null {
  const m = /^grid\.d(\d+)$/.exec(fullKey.slice(PREFIX.length));
  return m ? Number(m[1]) : null;
}

/** Mọi bản dự báo, XẾP THEO THỨ TỰ ĐEM BỎ: bậc rẻ trước, cùng bậc thì cũ trước.
    MỘT nguồn sự thật cho cả hai đường dọn (máy đầy lúc ghi dự báo · nhường chỗ
    cho dữ liệu bà con tự gõ) — trước đây hai đường xếp nạn nhân KHÁC NHAU. */
function rankedVictims(): { k: string; savedAt: number }[] {
  return entriesUnder(PREFIX).sort(
    (a, b) => dropRank(a.k) - dropRank(b.k) || a.savedAt - b.savedAt,
  );
}

/*  `reclaimForecastSpace` ĐÃ XOÁ HẲN (2026-08-02h) — chủ dự án chốt: "hết chỗ
    thì TỪ CHỐI GHI và nói thật, KHÔNG đi xoá đồ của bà con để lấy chỗ."

    Nó là đường ghi dữ liệu bà con TỰ GÕ (giấy tờ, thuyền viên, tàu) mượn chỗ của
    DỰ BÁO. Ba chỗ hỏng, cả ba nổ đúng lúc đang ngoài biển: không có cầu dao "dọn
    không ăn thua" (iOS dùng CHUNG hạn ngạch cho localStorage và Cache API, nên
    máy đầy vì kho service worker vẫn ăn 4 bản dự báo mà không ghi nổi một byte);
    trần bậc chỉ dừng trước `storm` nên lưới gió/sóng và bản đồ cá VẪN bị xoá
    được; và nó chạy lúc MỞ MÀN chứ không phải lúc bà con gõ.
    `saveUserJson` (lib/user-store.ts) nay chỉ thử ghi rồi trả `false`, màn hình
    đã có sẵn banner đỏ "chưa lưu được". Có cổng chặn khuôn trong
    `__tests__/user-store.test.ts` cấm file đó biết tới bất kỳ hàm dọn nào. */


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
