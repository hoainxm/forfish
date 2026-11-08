// BẢN ĐỒ CÁ PHÍA MÁY — tải, lưu, đọc lại (2026-11-08, docs/app-map/ops/khong-lo-nguon.md nợ #1–2).
//
// Client CHỈ import file này (không import fish-predict.ts — file đó là mô hình, chỉ máy chủ/scripts dùng).
// Máy chỉ giữ KẾT QUẢ: ô (lat, lon, điểm, loài, nhiệt, phù du) + mốc thời gian. `toClientFish` là DANH SÁCH
// CHO PHÉP duy nhất — dùng ở route (`/api/fish-forecast`) trước khi trả VÀ ở máy khi đọc bản đã lưu, để bản
// cũ trong IndexedDB/kho SW (còn `sources`, `chain`, `hint.why`, `baseMode` dạng chữ) cũng sạch mà không mất.

import { locBanDoCaTrongVung } from "@/lib/vung-bien-vn";
import { apiUrl } from "@/lib/api-base";
import { saveForecast, loadForecast } from "@/lib/forecast-cache";
import { forecastStoreReady } from "@/lib/forecast-store";
import { timeoutSignal } from "@/lib/abort";
import { noteResponse, tokenHeader } from "@/lib/device-token-store";

/**
 * 3 MỨC CHUNG của bản đồ cá (0–100). Dùng CHUNG: lớp bản đồ (fill step) + chú giải.
 * `min` của mức Thấp = SÀN hiển thị lưới. Ngưỡng: Thấp 40–60 · Trung bình 60–75 · Cao 75–100.
 */
export const FISH_LEVEL_BANDS = [
  { key: "low", label: "Thấp", min: 40, color: "#22c55e" },
  { key: "mid", label: "Trung bình", min: 60, color: "#eab308" },
  { key: "high", label: "Cao", min: 75, color: "#ef4444" },
] as const;

/** Một ô cá như máy nhận — chỉ số. */
export interface FishCell {
  lat: number;
  lon: number;
  /** điểm 0–100 (loài tốt nhất tại ô) */
  s: number;
  /** tên ngắn các loài đạt ngưỡng, tốt nhất trước */
  top: string[];
  /** điểm theo TỪNG loài (tên ngắn → 0–100) */
  sp: Record<string, number>;
  /** nhiệt độ nước °C */
  t: number;
  /** phù du mg/m³, null nếu thiếu */
  c: number | null;
  /** dấu hiệu hôm nay 0..100 (chỉ khi `baseMode`); null = trong vụ nhưng không chấm được */
  hint?: { sat: number | null };
}

/** Bản đồ cá như máy nhận và cất offline. */
export interface FishForecast {
  ok: true;
  /** ngày ảnh (trung thực) */
  date: string;
  cells: FishCell[];
  /** loài có mặt hôm nay, mạnh nhất trước — cho bộ chọn */
  species: string[];
  /** true = điểm là NỀN "bãi cá theo mùa" (không phụ thuộc ảnh hôm nay) — màn hình không pha mùa vụ thêm */
  baseMode?: boolean;
  /** ISO lúc máy chủ tính bản này (tuổi thật của bản) */
  generatedAt?: string;
  /** ngày dữ liệu dùng lọc mùa vụ */
  targetDate?: string;
  /** true = ảnh nhiệt/phù du đã cũ — màn hình nhắc "có thể chưa sát" (`lowQualityNote`) */
  anhCu?: boolean;
}

const so = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const chu = (v: unknown): v is string => typeof v === "string";

/**
 * DANH SÁCH CHO PHÉP của bản đồ cá đi xuống máy. Không phải bản đồ cá dùng được ⇒ null.
 * Ô hỏng (thiếu toạ độ/điểm) bị bỏ, không làm hỏng cả bản.
 */
export function toClientFish(x: unknown): FishForecast | null {
  if (!x || typeof x !== "object") return null;
  const f = x as Record<string, unknown>;
  if (f.ok !== true) return null;
  const cells: FishCell[] = [];
  for (const raw of Array.isArray(f.cells) ? (f.cells as unknown[]) : []) {
    if (!raw || typeof raw !== "object") continue;
    const c = raw as Record<string, unknown>;
    if (!so(c.lat) || !so(c.lon) || !so(c.s)) continue;
    const sp: Record<string, number> = {};
    if (c.sp && typeof c.sp === "object") for (const [k, v] of Object.entries(c.sp as Record<string, unknown>)) if (so(v)) sp[k] = v;
    const o: FishCell = {
      lat: c.lat,
      lon: c.lon,
      s: c.s,
      top: Array.isArray(c.top) ? (c.top as unknown[]).filter(chu) : [],
      sp,
      t: so(c.t) ? c.t : NaN,
      c: so(c.c) ? c.c : null,
    };
    const h = c.hint as Record<string, unknown> | undefined;
    if (h && typeof h === "object") o.hint = { sat: so(h.sat) ? h.sat : null };
    cells.push(o);
  }
  const out: FishForecast = {
    ok: true,
    date: chu(f.date) ? f.date : "",
    cells,
    species: Array.isArray(f.species) ? (f.species as unknown[]).filter(chu) : [],
  };
  if (f.baseMode) out.baseMode = true;
  if (chu(f.generatedAt)) out.generatedAt = f.generatedAt;
  if (chu(f.targetDate)) out.targetDate = f.targetDate;
  // cờ ảnh cũ: máy chủ dựng từ `sources` (bản đầy đủ) — bản đã sạch thì mang sẵn `anhCu`
  const src = f.sources as Record<string, { stale?: unknown }> | undefined;
  if (f.anhCu === true || src?.sst?.stale === true || src?.chl?.stale === true) out.anhCu = true;
  return out;
}

export type FishForecastResult =
  /*  `tuKhoOffline` — bản này LẤY TỪ KHO, không phải vừa tải về (2026-08-02k,
      vòng soát 6). Mẻ tải sẵn PHẢI phân biệt được: nó chỉ ném khi `!ok`, mà từ
      khi `!r.ok` lùi về bản đã lưu thì máy chủ nổ 500 vẫn cho ra `ok:true` ⇒
      không bước nào hỏng ⇒ mẻ ghi mốc và KHOÁ 6 GIỜ trong khi bà con còn ở bờ,
      còn sóng, và chưa có bản mới nào. Chuyện 500 kéo dài gần một ngày đã xảy
      ra thật (a7c3388). */
  | (FishForecast & { tuKhoOffline?: true })
  // code "login_required"/"premium_required" = BỊ KHOÁ (middleware chặn,
  // tính năng premium) — client hiện lời mời, KHÔNG hiện "lỗi, thử lại".
  | { ok: false; code?: string };

export async function fetchFishForecast(): Promise<FishForecastResult> {
  /*  CHỜ KHO MỞ XONG RỒI MỚI ĐỌC BẢN LƯU (2026-08-02k — vòng đánh giá cuối).
      Mất sóng thì `fetch` hỏng TỨC THÌ (không có độ trễ mạng che cửa sổ đua),
      nên nhánh lùi chạy khi gương còn rỗng ⇒ trả `null` ⇒ màn hình nói "chưa
      có" trong khi kho còn nguyên. Từ phiên thứ hai localStorage đã bị dọn nên
      không còn lớp chắn nào. Hàm đã async; `forecastStoreReady()` có trần chờ. */
  await forecastStoreReady();

  try {
    // Timeout client (invariant 02 §5): route lần lạnh ~30s (lưới ERDDAP nặng,
    // maxDuration 60) → cho 35s để nhận data thật; quá thì hủy → pill thử lại.
    // Sau lần đầu, ISR cache (revalidate 6h) trả tức thì.
    const r = await fetch(apiUrl("/api/fish-forecast"), {
      headers: tokenHeader(),
      signal: timeoutSignal(35000),
    });
    /* MỘT DÒNG NÀY = chỗ này cũng phát hiện được máy bị đá. Bộ não vẫn
       nằm ở `noteResponse`; ở đây chỉ đưa phản hồi cho nó soi. */
    void noteResponse(r);
    if (r.status === 401 || r.status === 403) {
      const body = (await r.json().catch(() => null)) as {
        code?: string;
      } | null;
      return {
        ok: false,
        code:
          body?.code ??
          (r.status === 401 ? "login_required" : "premium_required"),
      };
    }
    /*  ⚠️ ĐỔI HÀNH VI (2026-08-02k): trước đây `!r.ok` trả thẳng `{ok:false}`.
        Nay lùi về bản đồ cá ĐÃ LƯU nếu có. Được: mất sóng / nguồn bận thì bà
        con vẫn có lớp cá thay vì màn trắng. Phải biết: máy chủ 500 cũng đi
        đường này, tức app sẽ hiện bản MẤY NGÀY TUỔI thay vì báo hỏng — chấp
        nhận được vì payload mang `generatedAt` và màn hình in tuổi thật của
        bản, nhưng ai đọc mã sau này phải biết là nó KHÔNG còn báo lỗi ở đây. */
    if (!r.ok) {
      const luu = banDoCaDaLuu();
      return luu ? { ...luu, tuKhoOffline: true as const } : { ok: false };
    }
    const tho = (await r.json()) as unknown;
    // chỉ giữ ô trong vùng biển VN (lib/vung-bien-vn) + chỉ trường cho phép (`toClientFish`) — máy chủ đã lọc,
    // lọc lại để bản cũ trong kho SW (từ trước 2026-11-08, còn `sources`/`chain`) cũng sạch
    const sach = toClientFish(tho);
    const data: FishForecastResult = sach ? locBanDoCaTrongVung(sach) : { ok: false };
    // DẤU "bản đồ cá đã có offline" — payload thật do Service Worker cache
    // (/api/fish-forecast, same-origin), nhưng JS không đọc được kho SW đồng bộ.
    // Ghi 1 dấu localStorage khi nhận 200 để bảng "trong máy có gì" báo được lớp
    // cá + tới ngày nào (fetchFishForecast luôn qua đây).
    if (data && (data as FishForecast).ok === true) luuBanDoCa(data as FishForecast);
    return data;
  } catch {
    const luu = banDoCaDaLuu();
    return luu ? { ...luu, tuKhoOffline: true as const } : { ok: false };
  }
}

/** Ghi bản đồ cá vừa nhận (200, ok) vào kho bền — dùng chung cho
 *  `fetchFishForecast` và `fishForecastTuKhoSW`. */
function luuBanDoCa(data: FishForecast) {
  saveForecast(FISH_MARK_NS, FISH_MARK_ID, {
    targetDate: data.targetDate ?? null,
    // GHI KÈM MỐC MÁY CHỦ TÍNH (2026-07-31): mất sóng thì service worker
    // vẫn trả 200 bằng bản CŨ, nên `savedAt` được làm mới mỗi lần vào đây
    // ⇒ bảng "trong máy có gì" báo lớp cá còn tươi trong khi số liệu đã
    // mấy ngày tuổi. `generatedAt` là tuổi THẬT của bản, không đổi.
    generatedAt: data.generatedAt ?? null,
  });
  /*  ═══ VÀ GIỮ LUÔN BẢN ĐỒ THẬT, KHÔNG CHỈ CÁI DẤU ═══ (2026-08-02k)

      Chủ dự án chốt: *"Cache API bị xoá sau 7 ngày thì cái này chỉ nên dùng
      dự phòng, còn phải lưu và lấy trực tiếp từ local và IndexedDB."*

      Đúng, và trước bản vá này thì ngược hẳn: payload bản đồ cá (~1 MB) nằm
      DUY NHẤT trong kho Service Worker, còn localStorage chỉ giữ một cái dấu
      vài chục byte nói "đã tải rồi". Nên khi WebKit dọn kho SW — 7 ngày
      không mở, hoặc máy đầy, hoặc chính `reclaimRoom` của `sw.js` — thì dấu
      vẫn còn mà bản đồ thì bay. Bảng "trong máy có gì" đọc cái dấu và báo
      XANH. Tàu ra khơi tin là có lớp cá, mở ra thì trắng.

      Nay bản thật nằm ở IndexedDB (qua `forecast-store`), kho SW tụt xuống
      làm lớp đọc nhanh. Mất kho SW cũng không mất bản đồ. */
  saveForecast(FISH_NS, FISH_ID, data);
}

/**
 * Đọc bản đồ cá THẲNG TỪ KHO SERVICE WORKER — gọi khi SW báo bản mới đã về kho
 * (lib/sw-api-fresh.ts). KHÔNG fetch: bản 3 MB vừa tải xong, tải lần hai là phí
 * sóng. Có thì ghi luôn vào kho bền như một lần tải thường. Không có kho / hỏng
 * / bản không ok ⇒ null (không bao giờ ném).
 */
export async function fishForecastTuKhoSW(): Promise<FishForecast | null> {
  if (typeof caches === "undefined") return null;
  try {
    const hit = await caches.match(apiUrl("/api/fish-forecast"), {
      ignoreVary: true,
    });
    if (!hit) return null;
    const d = toClientFish(await hit.json());
    if (!d) return null;
    const sach = locBanDoCaTrongVung(d);
    luuBanDoCa(sach);
    return sach;
  } catch {
    return null;
  }
}

const FISH_MARK_NS = "fishmark";
const FISH_MARK_ID = "latest";
/** Bản đồ cá ĐẦY ĐỦ trong kho bền — xem chú thích ở `fetchFishForecast`. */
export const FISH_NS = "fish";
export const FISH_ID = "latest";

/**
 * Bản đồ cá đã lưu trong máy (IndexedDB) — `null` nếu chưa từng tải được.
 *
 * Chỉ trả bản CÒN DÙNG ĐƯỢC (`ok === true`): kho có thể còn giữ một phản hồi
 * hỏng từ thời route trả 200-kèm-lỗi, mà đây là bản DUY NHẤT của lớp cá nên đưa
 * rác ra màn hình còn tệ hơn nói "chưa tải được".
 */
export function banDoCaDaLuu(): FishForecast | null {
  const c = loadForecast<unknown>(FISH_NS, FISH_ID);
  // bản lưu từ trước 2026-10-29 có thể còn ô ngoài vùng biển VN, từ trước 2026-11-08 còn trường chẩn đoán
  // (`sources`, `chain`…) — lọc lúc đọc, không cần tải lại, KHÔNG xoá bản (đó là lớp cá duy nhất ngoài biển)
  const d = toClientFish(c?.data);
  return d ? locBanDoCaTrongVung(d) : null;
}

/** Dấu "bản đồ cá đã tải offline" (từ lần fetchFishForecast gần nhất nhận 200).
 *  null = chưa lần nào tải được. Thuần đọc — cho pretrip-status.
 *  `dataAt` = lúc MÁY CHỦ TÍNH bản đang giữ (tuổi thật); thiếu thì đành lấy
 *  `savedAt` (bản lưu từ trước 2026-07-31, chưa ghi kèm generatedAt). */
export function savedFishMark(): {
  savedAt: number;
  dataAt: number;
  targetDate: string | null;
} | null {
  const c = loadForecast<{
    targetDate: string | null;
    generatedAt?: string | null;
  }>(FISH_MARK_NS, FISH_MARK_ID);
  if (!c) return null;
  const gen = Date.parse(c.data?.generatedAt ?? "");
  return {
    savedAt: c.savedAt,
    dataAt: Number.isFinite(gen) ? gen : c.savedAt,
    targetDate: c.data?.targetDate ?? null,
  };
}

/**
 * Câu nhắc khi bản đồ cá dựng từ ảnh CŨ — `null` = KHÔNG nói gì.
 *
 * Màn hình phải GỌN (quyết định sản phẩm 2026-07-25) nên đây KHÔNG phải badge
 * thường trực: chỉ hiện trong ca xấu, rồi tự tắt sau NOTIFY_HIDE_MS như dòng
 * "mất sóng". Nhưng im hẳn khi ảnh CŨ thì thành hứa "hôm nay" mà dữ liệu không
 * đảm bảo — bà con ra khơi theo bản đồ này (bệnh "số cũ trông như mới").
 *
 * CHỈ nói chuyện ẢNH CŨ. KHÔNG còn nói "thiếu vài nguồn": chủ dự án chốt
 * 2026-07-27 — bà con KHÔNG cần biết chuyện thiếu nguồn phụ (bản đồ vẫn dựng từ
 * nguồn còn sống, bất biến monotonic bảo đảm mất nguồn chỉ GIẢM điểm chứ không
 * bịa). Tình trạng thiếu nguồn / `dataQuality` vẫn giữ cho trang QUẢN TRỊ.
 *
 * Chữ đời thường, không nói "dataQuality", không nói tên dataset.
 */
export function lowQualityNote(cast: { anhCu?: boolean }): string | null {
  // máy chủ tính sẵn cờ `anhCu` (ảnh nhiệt/phù du cũ = cả bản đồ lệch) — máy không cần biết nguồn nào
  return cast.anhCu ? "Số biển hôm nay lấy từ ảnh cũ — có thể chưa sát." : null;
}

/**
 * CÂU NÓI khi lớp cá KHÔNG tải được — phân biệt LỖI TẢI với KHOÁ QUYỀN.
 * `null` = ĐỪNG hiện nút "chạm để thử lại" (bấm bao nhiêu lần cũng vô ích).
 *
 * ⚠️ VÌ SAO CÓ (2026-08-18, chủ dự án gửi ảnh màn hình thật): màn Ra khơi gộp
 * MỌI ca `!ok` thành một câu *"Dự báo cá chưa tải được — chạm để thử lại"*,
 * kể cả khi máy chủ đã trả lời rất rõ là **chưa đăng nhập** (401 `login_required`
 * / `no_token`) hay **chưa premium** (403 `premium_required`). Bà con bấm mãi
 * không được gì — đúng hai khuôn mà cả mạch này đang diệt: "nói sai lý do" và
 * "nút bấm không được gì". Hai ca đó đã có thẻ khoá riêng (`PremiumLock`) lo,
 * nên ở đây trả `null` để không chồng hai thông điệp lên nhau.
 *
 * Đo cùng ngày: snapshot cá trên máy chủ khoẻ (0,5 giờ tuổi, chất lượng 1,
 * 2187 ô) — tức câu "chưa tải được" hôm đó gần như chắc chắn là chuyện QUYỀN,
 * không phải nguồn.
 */
export function fishFailNote(code?: string | null): string | null {
  switch (code) {
    case "login_required":
    case "no_token":
    case "unknown_token":
    case "token_revoked":
    case "premium_required":
      return null; // thẻ khoá quyền lo phần này
    case "unavailable":
      return "Máy chủ đang bận — chạm thử lại sau ít phút";
    default:
      return "Dự báo cá chưa tải được — chạm để thử lại";
  }
}
