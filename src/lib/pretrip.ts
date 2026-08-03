// Trục 1 — "CHUẨN BỊ ĐI BIỂN": tải sẵn trước khi rời bờ.
//
// Vì sao có file này: máy VẪN giữ dự báo để xem lúc mất sóng, nhưng trước đây
// chỉ giữ được thứ bà con TÌNH CỜ mở ra xem (chạm điểm, bật lớp gió). Ra khơi 5–16
// ngày mà không biết trong máy có gì = may rủi. Nay máy TỰ tải đủ lúc còn sóng
// (bà con không phải bấm gì) — cửa chặn 6 giờ cho khỏi tốn tiền sóng nằm ở
// lib/pretrip-auto.ts, file này chỉ lo phần tải.
//
// Nguyên tắc: KHÔNG thêm nguồn dữ liệu mới — chỉ gọi đúng những hàm màn Ra khơi
// vẫn gọi (fetchSeaPoint / fetchFishForecast / fetchForecastGrid), vì bản thân
// chúng đã tự lưu vào máy. Chạy TUẦN TỰ cho khỏi dội nguồn miễn phí.

import { fetchSeaPoint, POINT_NS, type SeaPointConditions } from "@/lib/marine-weather";
import { fetchFishForecast, savedFishMark, FISH_NS } from "@/lib/fish-predict";
import { fetchClimatology } from "@/lib/fish-blend";
import {
  fetchForecastGrid,
  gridCacheId,
  savedGridDays,
  savedGridUntil,
} from "@/lib/forecast-grid";
import {
  fetchScalarField,
  savedScalarDays,
  savedScalarUntil,
  SALINITY_DAYS,
} from "@/lib/scalar-field";
import {
  fetchCurDepthGridClient,
  savedCurDepthTiers,
  savedCurDepthDays,
  savedCurDepthUntil,
} from "@/lib/cur-depth";
import { isCacheCurrent } from "@/lib/source-cadence";
import { isSnapshotFreshAt } from "@/lib/fish-snapshot-policy";
import { CUR_DEPTH_MAX_DAYS } from "@/lib/weather-snapshot-id";
import {
  fetchSeaScalar,
  savedSeaScalar,
  savedSeaScalarAt,
  SEA_SCALAR_NS,
} from "@/lib/sea-scalars";
import {
  beginForecastWrites,
  bytesUnder,
  coordId,
  lastStorageFullAt,
  latestSavedAt,
  loadAll,
} from "@/lib/forecast-cache";
import { forecastStoreFlush } from "@/lib/forecast-store";
import { formatDateVN } from "@/lib/ocean-map";
import { fetchStormCheck, savedStormAt, STORM_NS } from "@/lib/storms";
import {
  fetchLivePrices,
  savedPricesAt,
  PRICE_NS,
} from "@/lib/port-price-source";
import { fetchFuelPrice } from "@/lib/fuel-price";

/** Tầng SÂU tải sẵn (tầng mặt đã nằm trong lưới gió/sóng SMOC) */
export const CUR_DEPTH_PRETRIP_TIERS = [50, 150, 300] as const;

/**
 * Khung ngày lưới gió/sóng tải sẵn: gần (3) · giữa (7) · cả chuyến dài (16).
 * KHÔNG lấy đủ cả 5 khung: mỗi khung là một lưới 156 ô × mấy chục mốc giờ —
 * ĐO THẬT (2026-07-31): khung 3 ≈ 0,7 MB · khung 7 ≈ 1,1 MB · khung 16 ≈ 1,6 MB
 * trong localStorage (UTF-16), tức CẢ MẺ tải sẵn ~5 MB, sát trần một số trình
 * duyệt. (Comment cũ ghi "~0,2–0,4 MB mỗi khung" — sai gấp ~4 lần.) 3 khung đã
 * phủ mọi tầm nhìn; thêm khung nữa chỉ tổ chiếm chỗ và tốn sóng lúc còn ở bờ.
 */
export const PRETRIP_GRID_DAYS = [3, 7, 16] as const;

/**
 * Khung ngày LỚP DẢI MÀU (mây/mưa/nhiệt/dông/áp suất) tải sẵn — màn Ra khơi
 * chỉ xin đúng 3 (thường) hoặc 16 (premium) từ khi bỏ chip chọn khung, nên tải
 * cả hai là offline chạy được ở mọi hạng. MỖI lượt là MỘT request Open-Meteo
 * ra cả 5 lớp (fetchScalarField tự lưu cả 5).
 */
export const PRETRIP_SCALAR_DAYS = [3, 16] as const;

export interface PretripStep {
  /** câu bà con đọc được, vd "Gió sóng — Cảng nhà" */
  label: string;
  /**
   * MÃ MÁY ĐỌC của bước (vd `grid.d16`) — để `PretripResult.failedSteps` nói
   * được ĐÚNG BƯỚC NÀO hỏng, không phải chỉ "có N việc hỏng". Chỉ đặt cho
   * những bước mà cửa chặn cần phân biệt; nhãn tiếng Việt KHÔNG dùng làm mã
   * (đổi câu chữ là hỏng cửa chặn trong im lặng).
   */
  id?: string;
  run: () => Promise<void>;
}

/** Mã bước tải lưới gió/sóng khung `days` — khuôn khoá cùng
    `PRETRIP_GRID_LONGEST_STEP_ID` bên `pretrip-auto.ts` (có test giữ hai chỗ). */
export function gridStepId(days: number): string {
  return `grid.d${days}`;
}

export interface PretripProgress {
  /** đã xong mấy việc */
  done: number;
  /** tổng số việc */
  total: number;
  /** đang làm việc gì */
  label: string;
}

export interface PretripResult {
  /** số việc tải được */
  ok: number;
  /** số việc hỏng (mạng chập chờn) */
  failed: number;
  /**
   * MÃ NHỮNG BƯỚC HỎNG VÌ MẠNG (bước có `id`, vd `["grid.d16"]`) — 2026-08-02.
   *
   * Vì sao cần riêng, không dùng `failed`: `failed` là một con số gộp cả mẻ.
   * Cửa `pretripGridTooShort` cần biết CHÍNH bước khung dài có thử-và-hỏng
   * không; lấy `failed > 0` thay thế thì một bước chẳng liên quan (dòng chảy
   * tầng sâu) hỏng cũng đủ giữ cửa 6 giờ đóng, và app rơi lại vòng thử-lại 2
   * phút/lượt. Bước KHÔNG ném (mượn được khung ngắn hơn, trả bản `stale`) thì
   * KHÔNG có tên ở đây — đó là "lấy được hết mức có thể", không phải hỏng.
   */
  failedSteps: string[];
  /** máy hết chỗ nhớ — có tải cũng không giữ được */
  full: boolean;
  /** tóm tắt "trong máy đang có gì" sau khi tải */
  saved: SavedSummary;
  /**
   * MẺ NÀY GIỮ ĐƯỢC GÌ THẬT: số bản GHI ĐƯỢC theo namespace trong lúc chạy
   * (`{ point: 3, grid: 2 }`). Khác hẳn `saved` — `saved` là ảnh chụp cả KHO,
   * trong đó có cả bản 3 hôm trước. Cửa chặn 6 giờ và dòng báo phải soi trường
   * này, không được soi `saved` (xem shouldMarkPretripRun / autoPretripLine).
   */
  gained: Record<string, number>;
  /**
   * SỐ LẦN "KHO ĐANG GIỮ BẢN TỐT HƠN NÊN KHỎI GHI" theo namespace (2026-08-02).
   *
   * Vì sao phải tách khỏi `gained`: cửa `shouldOverwriteGrid` từ chối ghi khi
   * bản mới nghèo hơn bản đang giữ. Ca thật hay gặp — nguồn marine 429 (chuyện
   * thường), máy đang giữ lưới đầy đủ lưu 7 giờ trước, bà con chưa ghim điểm nào
   * ⇒ cả 3 khung [3,7,16] đều bị từ chối ⇒ `gained` rỗng ⇒ không ghi mốc ⇒ cửa 2
   * PHÚT mở lại ở MỖI lần bà con liếc điện thoại, mỗi lần một mẻ 13 bước ~2,5–3
   * MB. Sim của bà con trả tiền theo dung lượng. "Từ chối vì kho đang giữ bản
   * tốt hơn" là ĐÃ GIỮ ĐƯỢC, không phải hỏng.
   */
  kept: Record<string, number>;
  /**
   * KHO ĐANG GIỮ LỚP CỐT LÕI CÒN TƯƠI (theo nhịp phát hành nguồn) sau mẻ này.
   * Bọc nốt ca không có lần ghi nào: mọi bước đều thấy bản trong máy còn hiện
   * hành nên trả thẳng từ kho, không gọi mạng, không ghi gì — `gained` và `kept`
   * đều rỗng mà máy thật sự đã sẵn sàng đi biển.
   *
   * KHÔNG dựng lại lỗi C-5 ("kho có bản 3 hôm trước → khoá 6 giờ oan"): `fresh`
   * đo bằng `isCacheCurrent`, bản quá nhịp phát hành / quá 12 giờ là false.
   */
  coreFresh: boolean;
  /**
   * MẺ BỊ CẮT GIỮA CHỪNG vì chạm trần `PRETRIP_MAX_MS` — CÒN VIỆC CHƯA CHẠY.
   * Bắt buộc phải có (2026-08-02): điểm ghim chạy ĐẦU danh sách, nên ở cảng sóng
   * chậm-mà-sống mẻ ăn hết 240 giây tại bước 6–7 vẫn có `gained.point > 0` ⇒ ghi
   * mốc, KHOÁ 6 GIỜ với 6–8 lớp chưa tải, mà dòng báo lại xanh "Đã lưu dự báo
   * tới ngày …" ngay cạnh chip vàng "Còn thiếu 6 lớp" — hai chỗ trên cùng màn
   * hình nói ngược nhau.
   */
  timedOut: boolean;
  /**
   * SỐ BẢN PHẢI XOÁ ĐI ĐỂ CÓ CHỖ GHI trong mẻ này (T4, 2026-08-02).
   *
   * Vì sao: máy đầy, `dropOldest` dọn được chỗ nên cú `setItem` CUỐI thành công
   * ⇒ `full = false`; nhưng thứ bị dọn lại chính là bản mẻ này vừa ghi ⇒
   * `gained` rỗng ⇒ dòng báo đổ cho "chưa có sóng" trong khi sóng đầy vạch và
   * nguyên nhân là CHỖ NHỚ. Có con số này thì `autoPretripLine` nói đúng bệnh.
   */
  evicted: number;
}

export interface PretripPoint {
  lat: number;
  lon: number;
  /** tên chỗ để hiện trong thanh tiến trình */
  name: string;
}

/* --------------------------------------------------------------------------
   TRONG MÁY ĐANG CÓ GÌ — đọc thẳng bản đã lưu, không đoán
-------------------------------------------------------------------------- */

export interface SavedSummary {
  /** số CHỖ có dự báo gió sóng trong máy */
  places: number;
  /** ngày xa nhất còn dự báo (ISO) — null nếu chưa có gì */
  untilIso: string | null;
  /** các khung ngày lưới gió/sóng đang giữ (3/7/16…) */
  gridDays: number[];
}

/** Đọc localStorage → "trong máy đang có gì" (thuần đọc, không gọi mạng). */
export function savedSummary(): SavedSummary {
  const pts = loadAll<SeaPointConditions>(POINT_NS);
  let untilIso: string | null = null;
  for (const p of pts) {
    const days = p.data?.days ?? [];
    const last = days.length ? days[days.length - 1]?.date : null;
    if (last && (untilIso == null || last > untilIso)) untilIso = last;
  }
  return { places: pts.length, untilIso, gridDays: savedGridDays() };
}

/* Câu chữ cho màn hình KHÔNG còn ở đây: từ 2026-07-25 bà con không bấm nút nữa
   (máy tự tải) và chỉ thấy MỘT dòng báo tự tắt — dòng đó dựng ở
   lib/pretrip-auto.ts (autoPretripLine). File này chỉ còn lo phần TẢI. */

/* --------------------------------------------------------------------------
   TRONG MÁY CÓ GÌ — THEO TỪNG LỚP (cho popup "đã lưu những gì" + tải lại lẻ).
   savedSummary ở trên chỉ đo GIÓ SÓNG THEO ĐIỂM; dòng "đã lưu tới ngày X" vì
   thế TRƯỚC ĐÂY nói quá (cá/lưới/lớp màu/độ mặn/dòng chảy chưa chắc đã có). Bảng
   dưới soi TỪNG lớp để câu chữ trung thực và cho tải lại đúng lớp còn thiếu.
-------------------------------------------------------------------------- */

export type SavedLayerId =
  | "point"
  | "fish"
  | "grid"
  | "scalar"
  | "salinity"
  | "seascalar"
  | "curdepth"
  | "storm"
  | "price";

export interface SavedLayer {
  id: SavedLayerId;
  /** tên bà con đọc được */
  label: string;
  /** đủ để xem offline chưa */
  saved: boolean;
  /** câu ngắn: "3 chỗ · tới 13/8" / "khung 3, 16 ngày" / "chưa lưu" */
  detail: string;
  /** epoch ms lưu gần nhất (null nếu không đo được / chưa lưu) */
  savedAt: number | null;
  /** DUNG LƯỢNG ước lượng lớp này chiếm trong máy (byte; 0 nếu không đo được /
   *  nằm ở kho khác như bản đồ cá) */
  sizeBytes: number;
  /** true = bản trong máy CÒN MỚI theo nhịp nguồn (chưa cần tải lại). false khi
   *  chưa lưu HOẶC đã quá chu kỳ cập nhật (nên tải lại). */
  fresh: boolean;
  /** false = không tự tải ở đây (vd bản đồ cá đang khoá premium) */
  retriable: boolean;
  /**
   * NGÀY XA NHẤT (ISO) lớp này phủ tới — đọc `times[]`/`days[]` THẬT của bản đã
   * lưu; null khi lớp không có trục ngày (tin bão, bảng giá) hoặc chưa lưu.
   *
   * Vì sao đưa lên đây (2026-08-02): con số này vốn đã được tính trong
   * `savedLayers` để dựng câu `detail`, rồi bị bỏ đi — nên `savedCoverage` phải
   * gọi `savedSummary()` đọc LẠI kho điểm ghim và kho lưới lần nữa. Kho lưới là
   * namespace NẶNG NHẤT (`loadAll` parse HAI lượt mỗi bản: `entriesUnder` rồi
   * `loadForecast` — cỡ ~7 MB chuỗi cho một kho đầy), đọc lại lần hai là tự
   * đánh thuế mỗi lần dựng chip.
   */
  untilIso: string | null;
}

export interface SavedLayersOpts {
  /** bản đồ cá đang khoá (chưa đăng nhập / chưa premium) → không tính là thiếu */
  fishLocked?: boolean;
}

/** Soi TỪNG lớp trong máy (thuần đọc, không gọi mạng). */
export function savedLayers(opts: SavedLayersOpts = {}): SavedLayer[] {
  const pts = loadAll<SeaPointConditions>(POINT_NS);
  let untilIso: string | null = null;
  let ptSavedAt: number | null = null;
  for (const p of pts) {
    const days = p.data?.days ?? [];
    const last = days.length ? days[days.length - 1]?.date : null;
    if (last && (untilIso == null || last > untilIso)) untilIso = last;
    if (ptSavedAt == null || p.savedAt > ptSavedAt) ptSavedAt = p.savedAt;
  }
  const now = Date.now();
  const gridDays = savedGridDays();
  const gMax = gridDays.length ? Math.max(...gridDays) : 0;
  const gridUntil = savedGridUntil();
  const scalarDays = savedScalarDays("cloud");
  const sMax = scalarDays.length ? Math.max(...scalarDays) : 0;
  const scalarUntil = savedScalarUntil("cloud");
  const salOk = savedScalarDays("salinity").includes(SALINITY_DAYS);
  const salUntil = savedScalarUntil("salinity");
  const tiers = savedCurDepthTiers();
  const cdDays = savedCurDepthDays();
  const cdUntil = savedCurDepthUntil();
  const fish = opts.fishLocked ? null : savedFishMark();
  const sshaOk = savedSeaScalar("ssha");

  // dung lượng theo key-prefix (byte); scalar tách salinity ra khỏi 5 lớp màu
  const salinityBytes = bytesUnder("scalar.salinity.");
  const scalarBytes = bytesUnder("scalar.") - salinityBytes;

  // "{cái gì} · {N} ngày · tới {ngày}" — chỉ ghép phần nào có
  const line = (what: string, days: number, iso: string | null) =>
    [what, days ? `${days} ngày` : null, iso ? `tới ${formatDateVN(iso)}` : null]
      .filter(Boolean)
      .join(" · ");

  /**
   * `extra.fresh` — luật "còn mới" RIÊNG của lớp (mặc định: nhịp Open-Meteo).
   * Chỉ lớp nào có nhịp phát hành KHÁC mới được truyền, và phải truyền đúng nhịp
   * mà nguồn của lớp đó thật sự ra bản mới — xem chú thích lớp "fish".
   */
  const mk = (
    id: SavedLayerId,
    label: string,
    saved: boolean,
    savedAt: number | null,
    sizeBytes: number,
    detail: string,
    extra: {
      retriable?: boolean;
      fresh?: boolean;
      /** ngày xa nhất lớp phủ tới — chỉ lớp có trục ngày mới truyền */
      untilIso?: string | null;
    } = {},
  ): SavedLayer => ({
    id,
    label,
    saved,
    detail,
    savedAt,
    sizeBytes,
    fresh: extra.fresh ?? (saved && isCacheCurrent(savedAt, now)),
    retriable: extra.retriable ?? true,
    untilIso: saved ? (extra.untilIso ?? null) : null,
  });

  const stormAt = savedStormAt();
  const priceAt = savedPricesAt();

  return [
    /* TIN BÃO đứng ĐẦU danh sách (2026-08-01): thứ duy nhất trong đây dính
       TÍNH MẠNG. Trước không có dòng này vì bản tin chỉ nằm trong kho service
       worker — tải sẵn không đụng tới, popup không đếm, tệp sao lưu không có. */
    mk(
      "storm",
      "Tin bão Biển Đông",
      stormAt != null,
      stormAt,
      bytesUnder(`${STORM_NS}.`),
      stormAt != null ? "bản tin mới nhất hỏi được" : "chưa lưu",
    ),
    mk(
      "grid",
      "Gió sóng CẢ VÙNG biển",
      gridDays.length > 0,
      /* ĐO BẰNG KHUNG DÀI NHẤT, KHÔNG GỘP MỌI KHUNG (C-5 đường 2, 2026-08-02).
         `latestSavedAt("grid.")` lấy mốc MỚI NHẤT trong cả `d3`/`d7`/`d16`: chỉ
         cần khung 3 ngày vừa tải là cả lớp được gọi là "còn mới", dù khung 16
         ngày — thứ bà con thật sự dựa vào cho chuyến 10 ngày — đã cũ mấy chục
         giờ. Chip đó là lời hứa nặng nhất trong app (bà con liếc trước lúc nhổ
         neo), nên phải đo đúng bản dài nhất máy đang giữ. */
      gMax > 0 ? latestSavedAt(`grid.${gridCacheId(gMax)}`) : null,
      bytesUnder("grid."),
      gridDays.length ? line("cả Biển Đông", gMax, gridUntil) : "chưa lưu",
      { untilIso: gridUntil },
    ),
    mk(
      "point",
      "Gió sóng chi tiết điểm ghim",
      pts.length > 0,
      ptSavedAt,
      bytesUnder("point."),
      pts.length ? line(`${pts.length} điểm bất kỳ`, 16, untilIso) : "chưa lưu",
      { untilIso },
    ),
    // Bản đồ cá là PFZ NGẮN NGÀY (ảnh vệ tinh không có kỹ năng 16 ngày như
    // gió/sóng) — KHÔNG hiện ngày ảnh kèm "tới" (gây hiểu nhầm "chỉ tới 27/7").
    mk(
      "fish",
      "Bản đồ cá",
      !opts.fishLocked && !!fish,
      // TUỔI THẬT của bản (lúc máy chủ tính), KHÔNG phải lúc ghi dấu: mất sóng
      // thì service worker trả lại bản cũ mà vẫn 200 ⇒ dấu được ghi lại mỗi
      // lần hỏi ⇒ dòng này báo "còn mới" cho số liệu mấy ngày tuổi.
      fish?.dataAt ?? null,
      /*  ĐẾM THẬT (2026-08-02k): payload bản đồ cá ~1 MB nay nằm ở kho bền
          (`forfish.fc.fish.latest`), không còn chỉ ở kho service worker. Để
          cứng `0` như trước thì tổng "trong máy nặng bao nhiêu" (bytesUnder(""))
          KHÔNG bằng tổng các dòng cộng lại — đúng trong bảng mà bà con soi để
          quyết có nhổ neo được không. */
      bytesUnder(`${FISH_NS}.`),
      opts.fishLocked
        ? "cần premium — có gói sẽ tự tải"
        : fish
          ? "bản đồ mới nhất · vài ngày tới"
          : "chưa lưu",
      {
        retriable: !opts.fishLocked,
        /* NHỊP RIÊNG, KHÔNG DÙNG isCacheCurrent (sửa 2026-08-02).
           Bản đồ cá do CRON tính ~6 giờ/lần rồi ghi snapshot; `/api/fish-forecast`
           CHỈ đi tính bản mới khi snapshot quá `SNAPSHOT_MAX_AGE_MS` (30 giờ),
           còn trong hạn thì trả nguyên bản đang có. Đo bằng nhịp Open-Meteo
           (4 mốc/ngày, trần 12 giờ) là client khắt khe hơn máy chủ ⇒ mỗi bản
           mới tính xong vài giờ đã bị gọi là "đã cũ", chip đỏ "Dự báo trong máy
           đã cũ — chạm tải mới" hiện hoài, mà chạm "Tải mới" thì nhận lại ĐÚNG
           bản cũ (route thấy snapshot còn tươi) ⇒ nút bấm không đổi gì. Nay
           dùng CHUNG luật với route: cũ quá 30 giờ mới là cũ — và đúng lúc đó
           chạm "Tải mới" là route tính live thật, nút có tác dụng. */
        fresh: !opts.fishLocked && !!fish && isSnapshotFreshAt(fish.dataAt, now),
      },
    ),
    mk(
      "scalar",
      "Lớp màu mây · mưa · nhiệt",
      scalarDays.length > 0,
      latestSavedAt("scalar.cloud."),
      scalarBytes,
      scalarDays.length
        ? line("mây, mưa, nhiệt, dông, áp suất", sMax, scalarUntil)
        : "chưa lưu",
      { untilIso: scalarUntil },
    ),
    mk(
      "salinity",
      "Độ mặn",
      salOk,
      latestSavedAt("scalar.salinity."),
      salinityBytes,
      salOk ? line("độ mặn", SALINITY_DAYS, salUntil) : "chưa lưu",
      { untilIso: salUntil },
    ),
    mk(
      "seascalar",
      "Nước dâng / xoáy",
      sshaOk,
      savedSeaScalarAt("ssha"),
      bytesUnder(`${SEA_SCALAR_NS}.`),
      sshaOk ? "ảnh mới nhất · nay" : "chưa lưu",
    ),
    mk(
      "price",
      "Giá cá, giá dầu",
      priceAt != null,
      priceAt,
      bytesUnder(`${PRICE_NS}.`),
      priceAt != null ? "bảng giá tuần gần nhất" : "chưa lưu",
    ),
    // Mặt (surface) đi cùng lưới CẢ VÙNG; đây thêm 3 tầng SÂU 50/150/300 m
    mk(
      "curdepth",
      "Dòng chảy: Mặt + 3 tầng sâu",
      tiers.length > 0,
      latestSavedAt("curdepth."),
      bytesUnder("curdepth."),
      tiers.length
        ? line(`Mặt + ${tiers.length}/3 tầng sâu (50/150/300m)`, cdDays, cdUntil)
        : "chưa lưu",
      { untilIso: cdUntil },
    ),
  ];
}

export interface SavedCoverage {
  layers: SavedLayer[];
  /** đủ MỌI lớp tự-tải-được chưa */
  allSaved: boolean;
  /** số lớp tự-tải-được còn thiếu */
  missing: number;
  /** ngày xa nhất còn dự báo gió sóng theo ĐIỂM GHIM (nghĩa cũ, giữ nguyên) */
  untilIso: string | null;
  /**
   * NGÀY PHỦ CỐT LÕI — ngày SỚM NHẤT giữa LƯỚI CẢ VÙNG và ĐIỂM GHIM; `null` khi
   * thiếu một trong hai lớp cốt lõi (không dám khẳng định).
   *
   * VÌ SAO CÓ (2026-08-02): chip màn Ra khơi trước đây nói theo `untilIso` = CHỈ
   * lớp điểm ghim, còn lớp "Gió sóng CẢ VÙNG" chỉ cần `gridDays.length > 0` là
   * tính `saved`. Máy còn mỗi `grid.d3` ⇒ chip XANH "Trong máy còn dự báo tới
   * ngày 18/8" trong khi lưới chỉ tới ngày 5/8 — mà chuyến đi 10 ngày và giữa
   * biển KHÔNG tải lại được. Chip đó là lời hứa nặng nhất trong app.
   *
   * CÙNG LUẬT với `coreSavedUntil` (lib/heartbeat.ts) mà nhịp báo về máy chủ
   * dùng — hai chỗ phải nói CÙNG một ngày, có test khoá lại. Không import chéo:
   * `heartbeat.ts` là tầng gọi mạng, kéo nó vào đây là kéo cả vào mọi màn.
   */
  coreUntilIso: string | null;
  /** TỔNG dung lượng dự báo trong máy (byte) — mọi bản `forfish.fc.*` */
  totalBytes: number;
  /** số lớp ĐÃ có trong máy — 0 = máy trắng tinh (bản vừa cài trên iOS) */
  savedCount: number;
}

/** Gộp per-layer → tình trạng tổng để dựng câu chữ chip. */
export function savedCoverage(opts: SavedLayersOpts = {}): SavedCoverage {
  const layers = savedLayers(opts);
  const essential = layers.filter((l) => l.retriable);
  const missing = essential.filter((l) => !l.saved).length;
  /* DÙNG LẠI SỐ ĐÃ TÍNH, KHÔNG ĐỌC KHO LẦN HAI (2026-08-02): bản cũ gọi
     `savedSummary()` ở đây, mà hàm đó đọc lại CẢ kho điểm ghim LẪN kho lưới —
     hai namespace `savedLayers` vừa duyệt xong. `loadAll` parse HAI lượt mỗi
     bản (`entriesUnder` rồi `loadForecast`), kho lưới đầy là ~7 MB chuỗi mỗi
     lượt; chip này dựng lại mỗi lần mở màn Ra khơi và mỗi nhịp heartbeat. */
  const pointUntil = layers.find((l) => l.id === "point")?.untilIso ?? null;
  const gridUntil = layers.find((l) => l.id === "grid")?.untilIso ?? null;
  return {
    layers,
    allSaved: essential.length > 0 && missing === 0,
    missing,
    untilIso: pointUntil,
    // thiếu một lớp cốt lõi → null (xem SavedCoverage.coreUntilIso). So chuỗi
    // ISO `YYYY-MM-DD` là so ngày, không cần Date.parse.
    coreUntilIso:
      !gridUntil || !pointUntil
        ? null
        : gridUntil < pointUntil
          ? gridUntil
          : pointUntil,
    totalBytes: bytesUnder(""),
    savedCount: layers.filter((l) => l.saved).length,
  };
}

/**
 * TẢI LẠI đúng MỘT lớp (bà con chạm "Tải lại" ở dòng còn thiếu trong popup).
 * Dùng lại đúng các hàm màn Ra khơi vẫn gọi — chúng tự lưu vào máy. Giữ ĐỒNG BỘ
 * với `pretripSteps` bên dưới (cùng nguồn, khác cách gói).
 */
export async function runLayer(
  id: SavedLayerId,
  points: PretripPoint[],
): Promise<void> {
  /* PHẠM VI ĐẾM RIÊNG (2026-08-02): nút này KHÔNG bị cờ `running` của mẻ tự động
     chặn, mà cũng ghi qua `saveForecast`. Không có phạm vi riêng thì bản do bà
     con bấm tay tải được sẽ bị cộng vào `gained` của mẻ tự động đang chạy — mẻ
     hỏng sạch vẫn ra "xanh" rồi khoá 6 giờ. */
  const scope = beginForecastWrites();
  let daGhi: string[] = [];
  try {
    await runLayerInner(id, points);
  } finally {
    daGhi = [...scope.written]; // chụp TRƯỚC khi đóng phạm vi
    scope.end();
  }
  /*  Nút "Tải lại" cũng phải đợi đĩa nhận thật rồi mới được coi là xong — cùng
      lý do với mẻ tự động (xem chú thích ở `runPretrip`). Đĩa từ chối thì NÉM,
      để dòng lớp đó ở lại trạng thái đỏ thay vì nhảy xanh rồi mất sau khi tắt.
      HỎI ĐÚNG MẺ CỦA MÌNH: hỏi cả kho thì một lưới kẹt lại (quá trần xả ngược)
      làm dòng TIN BÃO vừa tải trót lọt cũng đỏ, bấm lại bao nhiêu lần cũng đỏ. */
  if (!(await forecastStoreFlush(daGhi)))
    throw new Error("máy hết chỗ, chưa lưu được");
}

async function runLayerInner(
  id: SavedLayerId,
  points: PretripPoint[],
): Promise<void> {
  switch (id) {
    case "point":
      for (const p of dedupePoints(points))
        await fetchSeaPoint({ lat: p.lat, lon: p.lon });
      return;
    case "fish": {
      const r = await fetchFishForecast();
      if (
        !r.ok &&
        !(r.code === "login_required" || r.code === "premium_required")
      )
        throw new Error("bản đồ cá chưa tải được");
      /*  BẢN LẤY TỪ KHO KHÔNG TÍNH LÀ "ĐÃ TẢI" (vòng soát 6). `!r.ok` nay lùi
          về bản đã lưu, nên máy chủ 500 vẫn cho `ok:true` ⇒ bước này không ném
          ⇒ mẻ tự động ghi mốc và KHOÁ 6 GIỜ dù chẳng lấy được byte mới nào. */
      if (r.ok && (r as { tuKhoOffline?: true }).tuKhoOffline)
        throw new Error("bản đồ cá: nguồn đang lỗi, mới có bản cũ trong máy");
      return;
    }
    case "grid":
      for (const d of PRETRIP_GRID_DAYS) await fetchForecastGrid(d);
      return;
    case "scalar":
      for (const d of PRETRIP_SCALAR_DAYS) await fetchScalarField("cloud", d);
      return;
    case "salinity":
      await fetchScalarField("salinity");
      return;
    case "seascalar":
      await fetchSeaScalar("ssha");
      return;
    case "storm": {
      // Nguồn hỏng → fetchStormCheck trả {ok:false} chứ không ném; ném ở đây
      // để nút "Tải lại" của lớp này nói thật là chưa lấy được.
      const st = await fetchStormCheck();
      if (!st.ok) throw new Error("tin bão chưa hỏi được");
      return;
    }
    case "price": {
      const [live, fuel] = await Promise.all([
        fetchLivePrices(),
        fetchFuelPrice(),
      ]);
      // giá cá là chính; thiếu giá dầu thì thôi, không kéo cả lớp thành đỏ
      if (!live.ok && fuel == null) throw new Error("giá chưa tải được");
      return;
    }
    case "curdepth":
      await runCurDepthTiers();
      return;
  }
}

/**
 * TRẦN THỜI GIAN cho riêng bước "Dòng chảy theo tầng".
 *
 * Vì sao: bước này là 3 tầng × 2 lần thử × 55 giây = 330 GIÂY — hơn nửa ngân
 * sách của cả mẻ, chỉ cho MỘT lớp "xem cho biết". Ở ca sóng "sống mà chết"
 * (bắt tay được nhưng không gói tin nào về) nó vắt kiệt từng đồng hồ một, đẩy
 * các bước SAU (bản đồ mùa vụ) ra khỏi trần chung. 90 giây đủ cho 1–2 tầng khi
 * sóng còn dùng được, và cắt sớm khi sóng đã chết.
 */
export const CURDEPTH_STEP_MAX_MS = 90_000;

/** Tải 3 tầng dòng chảy sâu, có trần thời gian. Một tầng được là coi như xong. */
async function runCurDepthTiers(maxMs: number = CURDEPTH_STEP_MAX_MS): Promise<void> {
  const until = Date.now() + maxMs;
  let ok = 0;
  for (const t of CUR_DEPTH_PRETRIP_TIERS) {
    if (Date.now() >= until) break;
    try {
      await fetchCurDepthGridClient(t, CUR_DEPTH_MAX_DAYS);
      ok++;
      continue;
    } catch {}
    // hết giờ thì đừng thử tiếp khung ngắn — mỗi lần thử là thêm 55 giây
    if (Date.now() >= until) break;
    try {
      await fetchCurDepthGridClient(t, 3);
      ok++;
    } catch {}
  }
  if (ok === 0) throw new Error("dòng chảy theo tầng chưa tải được");
}

/* --------------------------------------------------------------------------
   DANH SÁCH VIỆC + CHẠY
-------------------------------------------------------------------------- */

/** Bỏ các chỗ trùng ô lưới ~0,25° (chạm mấy lần quanh một chỗ = một bản lưu) */
export function dedupePoints(points: PretripPoint[]): PretripPoint[] {
  const seen = new Set<string>();
  const out: PretripPoint[] = [];
  for (const p of points) {
    const id = coordId(p.lat, p.lon);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(p);
  }
  return out;
}

/** Dựng danh sách việc — tách riêng để test được thứ tự/số việc, không gọi mạng. */
export function pretripSteps(points: PretripPoint[]): PretripStep[] {
  const steps: PretripStep[] = [];
  for (const p of dedupePoints(points)) {
    steps.push({
      label: `Gió sóng — ${p.name}`,
      run: async () => {
        await fetchSeaPoint({ lat: p.lat, lon: p.lon });
      },
    });
  }
  /* TIN BÃO — việc AN TOÀN TÍNH MẠNG, phải nằm trong gói tải sẵn (2026-08-01).
     Trước đây bản tin chỉ sống nhờ kho service worker: không ai tải sẵn, không
     ai kiểm, không vào tệp sao lưu. Nay fetchStormCheck tự ghi localStorage nên
     bước này vừa tải vừa ghi. KHÔNG ném khi nguồn hỏng: bản tin bão hỏng không
     được làm cả mẻ tải sẵn đỏ lòm — nhưng có ghi vào độ phủ để popup nói thật. */
  steps.push({
    label: "Tin bão",
    run: async () => {
      await fetchStormCheck();
    },
  });
  /* GIÁ CÁ + GIÁ DẦU — nhẹ (vài KB), bản tin theo tuần/kỳ nên tải một lần dùng
     cả chuyến. Ra khơi còn biết giá lúc rời bờ mà tính toán. */
  steps.push({
    label: "Giá cá, giá dầu",
    run: async () => {
      await Promise.allSettled([fetchLivePrices(), fetchFuelPrice()]);
    },
  });
  steps.push({
    label: "Bản đồ cá",
    run: async () => {
      const r = await fetchFishForecast();
      // BỊ KHOÁ (chưa đăng nhập / chưa premium) ≠ lỗi mạng: bỏ qua ÊM —
      // auto-pretrip chạy mỗi lần mở app, không được ngày nào cũng báo
      // "thiếu bản đồ cá" với người vốn không có quyền xem nó.
      if (!r.ok && (r.code === "login_required" || r.code === "premium_required"))
        return;
      if (!r.ok) throw new Error("bản đồ cá chưa tải được");
      /*  Cùng lý do với `runLayerInner`: bản LẤY TỪ KHO không phải "đã tải".
          Thiếu vế này thì máy chủ 500 kéo dài vẫn cho mẻ ra "xanh" + khoá 6 giờ. */
      if ((r as { tuKhoOffline?: true }).tuKhoOffline)
        throw new Error("bản đồ cá: nguồn đang lỗi, mới có bản cũ trong máy");
    },
  });
  for (const d of PRETRIP_GRID_DAYS) {
    steps.push({
      label: `Gió sóng cả vùng biển — ${d} ngày`,
      // có MÃ vì cửa 6 giờ phải phân biệt "khung dài thử-và-hỏng vì mạng" với
      // "khung dài lấy được hết mức có thể" — xem PretripResult.failedSteps
      id: gridStepId(d),
      run: async () => {
        await fetchForecastGrid(d);
      },
    });
  }
  // LỚP DẢI MÀU (mây/mưa/nhiệt/dông/áp suất) — một request/khung ra cả 5 lớp,
  // tự lưu vào máy (2026-07-29: trước đây KHÔNG tải sẵn → ra khơi mở lớp lần
  // đầu là trống).
  for (const d of PRETRIP_SCALAR_DAYS) {
    steps.push({
      label: `Lớp mây mưa nhiệt — ${d} ngày`,
      run: async () => {
        await fetchScalarField("cloud", d);
      },
    });
  }
  // ĐỘ MẶN (Copernicus, same-origin ~140 KB, 4 mốc ngày) — một khoá cache duy
  // nhất nên một lần tải là đủ mọi hạng.
  steps.push({
    label: "Độ mặn",
    run: async () => {
      await fetchScalarField("salinity");
    },
  });
  // NƯỚC DÂNG / XOÁY (SSHA, ERDDAP qua /api/sea-scalar) — 2026-07-29: đưa vào
  // flow tải sẵn + lưu localStorage để ra khơi mất sóng vẫn xem được (trước chỉ
  // dựa Service Worker, không tải sẵn được). Nguồn có thể trống → bỏ qua êm.
  steps.push({
    label: "Nước dâng / xoáy",
    run: async () => {
      await fetchSeaScalar("ssha");
    },
  });
  // DÒNG CHẢY THEO TẦNG (2026-07-29, same-origin ~50 KB/tầng từ snapshot) —
  // 3 tầng sâu; thử khung premium 10 ngày trước, bị chặn thì rơi về 3 (không
  // biết hạng ở đây — route tự chặn). Một tầng tải được là coi như xong việc.
  steps.push({
    label: "Dòng chảy theo tầng",
    run: () => runCurDepthTiers(),
  });
  // BẢN ĐỒ MÙA VỤ — asset tĩnh cùng origin (~70 KB), lớp cá của chuyến dài pha
  // trộn với nó. Service worker đã pre-cache lúc cài app; gọi ở đây là lưới an
  // toàn cho máy cài từ bản cũ (chưa có file trong kho). Không bao giờ ném.
  steps.push({
    label: "Bản đồ mùa vụ",
    run: async () => {
      await fetchClimatology();
    },
  });
  return steps;
}

/**
 * TRẦN THỜI GIAN CẢ MẺ (2026-08-02).
 *
 * Vì sao: chuỗi 12–14 bước chạy TUẦN TỰ, mỗi bước ôm đồng hồ riêng (20–55 giây).
 * Ở ca sóng "sống mà chết" nó vắt kiệt từng cái một — đo trên giấy ~740–810
 * GIÂY (13 phút). Suốt thời gian đó cờ `running` khoá mọi lần thử khác, không có
 * nút hủy, rời màn cũng không dừng (cờ nằm ở mức module). 4 phút là quá đủ cho
 * một mẻ khi sóng còn dùng được; quá đó thì mạng đang chết, chờ thêm chỉ tốn pin.
 *
 * ĐI KÈM BẮT BUỘC với `gained`: cắt sớm mà cửa chặn vẫn soi KHO thì mẻ bị cắt
 * cũng ghi mốc khoá 6 giờ — đúng lỗi C-5.
 */
export const PRETRIP_MAX_MS = 240_000;

/** Hết giờ chưa (thuần, test được). Đồng hồ máy chỉnh lùi → chưa, không cắt oan. */
export function pretripTimedOut(
  startedAt: number,
  now: number,
  maxMs: number = PRETRIP_MAX_MS,
): boolean {
  return now - startedAt >= maxMs;
}

/*  ═══ BAO NHIÊU VIỆC CHẠY CÙNG LÚC ═══ (2026-08-03)

    Trước đây mẻ chạy XẾP HÀNG MỘT: 12–14 bước, mỗi bước ôm đồng hồ 20–55 giây,
    cộng lại chạm trần 240 giây khi sóng yếu — nên các bước CUỐI (bản đồ mùa vụ,
    nước dâng) gần như không bao giờ tới lượt. Cùng ngần ấy giây, chạy ba việc
    một lúc thì phủ được nhiều lớp hơn hẳn.

    VÌ SAO ĐÚNG **BA**, không phải sáu hay mười:
     · Open-Meteo tính hạn ngạch theo IP, mà 429 thì CẢ APP mất dự báo (bài học
       2026-07-29, cả kiến trúc snapshot dựng lên vì chuyện đó). Ba là bó hoa
       nhỏ, không phải cơn lũ.
     · Sóng yếu là con dao hai lưỡi THẬT: ba dòng tải chia nhau một đường truyền
       hẹp thì mỗi dòng chậm đi, có khi cùng hết giờ trong khi chạy tuần tự thì
       ít nhất xong được một. Ba là mức còn giữ được phần lớn cái lợi mà chưa
       biến mỗi bước thành một phần ba băng thông.
    Thứ tự ƯU TIÊN vẫn nguyên: pool lấy việc theo đúng thứ tự `pretripSteps`
    (gió sóng điểm ghim → tin bão → giá → bản đồ cá → lưới → …), nên khi hết giờ
    thì thứ bị bỏ vẫn là thứ ít quan trọng nhất. */
export const PRETRIP_CONCURRENCY = 3;

export interface PoolResult {
  ok: number;
  failed: number;
  failedSteps: string[];
  /** hết trần thời gian khi còn việc chưa chạy → KHÔNG được khoá 6 giờ */
  timedOut: boolean;
  /** số việc THẬT SỰ được nhặt ra chạy (phần còn lại là chưa hề thử) */
  started: number;
}

/**
 * CHẠY DANH SÁCH VIỆC theo pool `PRETRIP_CONCURRENCY`, tôn trọng trần
 * `PRETRIP_MAX_MS` tính từ `startedAt`. Tách khỏi `runPretrip` để test được mà
 * không phải giả lập cả cụm nguồn dữ liệu.
 *
 * Bất biến phải giữ y như bản chạy tuần tự cũ:
 *  · một việc hỏng KHÔNG dừng cả mẻ;
 *  · việc CHƯA HỀ CHẠY (hết giờ) tính vào `failed` nhưng KHÔNG vào `failedSteps`
 *    — `pretripGridTooShort` đọc `failedSteps` để kết luận "khung dài đã thử và
 *    hỏng", nhét việc chưa thử vào đó là nói dối nó;
 *  · thứ tự ƯU TIÊN của danh sách được giữ (luồng nào rảnh thì nhặt việc kế
 *    tiếp), nên hết giờ thì thứ bị bỏ là thứ cuối danh sách.
 */
export async function runStepsPooled(
  steps: PretripStep[],
  startedAt: number,
  onProgress?: (p: PretripProgress) => void,
  concurrency: number = PRETRIP_CONCURRENCY,
): Promise<PoolResult> {
  const total = steps.length;
  let next = 0;
  let started = 0;
  let ok = 0;
  let failed = 0;
  let timedOut = false;
  const failedSteps: string[] = [];
  const motLuong = async () => {
    for (;;) {
      const i = next;
      if (i >= total) return;
      // Kiểm TRƯỚC MỖI BƯỚC: bước vừa rồi có thể đã ngốn cả phút.
      if (pretripTimedOut(startedAt, Date.now())) {
        timedOut = true;
        return;
      }
      next = i + 1;
      started++;
      onProgress?.({ done: started - 1, total, label: steps[i].label });
      try {
        await steps[i].run();
        ok++;
      } catch {
        failed++;
        const id = steps[i].id;
        if (id) failedSteps.push(id);
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(concurrency, total)) }, motLuong),
  );
  // việc không kịp chạy = chưa tải được, nói thật
  return { ok, failed: failed + (total - started), failedSteps, timedOut, started };
}

/**
 * Chạy song song CÓ GIỚI HẠN, báo tiến trình. Một việc hỏng KHÔNG dừng cả mẻ —
 * tải được gì giữ nấy, rồi nói thật còn thiếu bao nhiêu.
 */
export async function runPretrip(
  points: PretripPoint[],
  onProgress?: (p: PretripProgress) => void,
): Promise<PretripResult> {
  const steps = pretripSteps(points);
  const total = steps.length;
  const startedAt = Date.now();
  // PHẠM VI ĐẾM RIÊNG CHO MẺ NÀY: chỉ bản do CHÍNH mẻ này ghi mới được tính.
  // Bộ đếm mức module (bản cũ) đếm cả bản do nút "Tải lại" từng lớp trong popup
  // ghi xuống — mẻ auto hỏng sạch vẫn ra "xanh" + khoá 6 giờ (xem
  // beginForecastWrites / runLayer).
  const scope = beginForecastWrites();
  let ok = 0;
  let failed = 0;
  let timedOut = false;
  const failedSteps: string[] = [];
  let mePool: PoolResult;
  try {
    mePool = await runStepsPooled(steps, startedAt, onProgress);
  } finally {
    scope.end();
  }
  ok = mePool.ok;
  failed = mePool.failed;
  timedOut = mePool.timedOut;
  failedSteps.push(...mePool.failedSteps);
  onProgress?.({ done: total, total, label: "Xong" });
  /*  ═══ ĐỢI ĐĨA NHẬN THẬT RỒI MỚI DÁM KẾT LUẬN ═══ (2026-08-02k)

      Từ khi kho dự báo xuống IndexedDB, `saveForecast` ghi vào GƯƠNG RAM rồi
      trả `true` ngay — gương thì gần như không bao giờ từ chối. Không chờ ở đây
      thì mẻ tải sẵn kết luận "giữ được 14 lớp", ghi mốc, khoá 6 giờ, trong khi
      giao dịch xuống đĩa hỏng (máy hết chỗ) và tắt app đi mở lại là TRẮNG.
      Đúng khuôn nói dối mà cả mạch offline đi vá.

      Đĩa từ chối ⇒ coi như `full`: nguyên nhân áp đảo của một giao dịch
      IndexedDB hỏng là hết chỗ, và `full` đã có sẵn đường nói thật với bà con
      ("Máy hết chỗ nhớ") lẫn luật khỏi bắn lại mẻ ~3 MB mỗi 2 phút. */
  const daNamXuongDia = await forecastStoreFlush([...scope.written]);
  const full = lastStorageFullAt() >= startedAt || !daNamXuongDia;
  const gained = { ...scope.counts };
  const kept = { ...scope.kept };
  return {
    ok,
    failed,
    failedSteps,
    full,
    saved: savedSummary(),
    gained,
    kept,
    coreFresh: coreLayersFresh(),
    timedOut,
    evicted: scope.evicted,
  };
}

/**
 * KHO CÓ ĐANG GIỮ LỚP CỐT LÕI CÒN TƯƠI KHÔNG (lưới cả vùng HOẶC gió sóng điểm
 * ghim). "Tươi" = `isCacheCurrent` bên trong `savedLayers` — nguồn chưa ra bản
 * mới, kéo lại cũng nhận đúng con số cũ. Thuần đọc, không gọi mạng.
 *
 * Chỉ soi HAI lớp cốt lõi: kho có mỗi bản tin bão vài KB còn tươi thì chưa phải
 * là máy đã sẵn sàng đi biển.
 */
function coreLayersFresh(): boolean {
  return savedLayers().some(
    (l) => (l.id === "grid" || l.id === "point") && l.saved && l.fresh,
  );
}
