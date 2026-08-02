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
import { fetchFishForecast, savedFishMark } from "@/lib/fish-predict";
import { fetchClimatology } from "@/lib/fish-blend";
import { fetchForecastGrid, savedGridDays, savedGridUntil } from "@/lib/forecast-grid";
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
  run: () => Promise<void>;
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

  const mk = (
    id: SavedLayerId,
    label: string,
    saved: boolean,
    savedAt: number | null,
    sizeBytes: number,
    detail: string,
    retriable = true,
  ): SavedLayer => ({
    id,
    label,
    saved,
    detail,
    savedAt,
    sizeBytes,
    fresh: saved && isCacheCurrent(savedAt, now),
    retriable,
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
      latestSavedAt("grid."),
      bytesUnder("grid."),
      gridDays.length ? line("cả Biển Đông", gMax, gridUntil) : "chưa lưu",
    ),
    mk(
      "point",
      "Gió sóng chi tiết điểm ghim",
      pts.length > 0,
      ptSavedAt,
      bytesUnder("point."),
      pts.length ? line(`${pts.length} điểm bất kỳ`, 16, untilIso) : "chưa lưu",
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
      0, // payload ở kho ứng dụng (SW), không phải localStorage
      opts.fishLocked
        ? "cần premium — có gói sẽ tự tải"
        : fish
          ? "bản đồ mới nhất · vài ngày tới"
          : "chưa lưu",
      !opts.fishLocked,
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
    ),
    mk(
      "salinity",
      "Độ mặn",
      salOk,
      latestSavedAt("scalar.salinity."),
      salinityBytes,
      salOk ? line("độ mặn", SALINITY_DAYS, salUntil) : "chưa lưu",
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
    ),
  ];
}

export interface SavedCoverage {
  layers: SavedLayer[];
  /** đủ MỌI lớp tự-tải-được chưa */
  allSaved: boolean;
  /** số lớp tự-tải-được còn thiếu */
  missing: number;
  /** ngày xa nhất còn dự báo gió sóng theo điểm (mốc hiện trên chip) */
  untilIso: string | null;
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
  return {
    layers,
    allSaved: essential.length > 0 && missing === 0,
    missing,
    untilIso: savedSummary().untilIso,
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
  try {
    await runLayerInner(id, points);
  } finally {
    scope.end();
  }
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
    },
  });
  for (const d of PRETRIP_GRID_DAYS) {
    steps.push({
      label: `Gió sóng cả vùng biển — ${d} ngày`,
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

/**
 * Chạy tuần tự, báo tiến trình từng bước. Một việc hỏng KHÔNG dừng cả mẻ —
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
  try {
    for (let i = 0; i < total; i++) {
      // Kiểm TRƯỚC MỖI BƯỚC: bước vừa rồi có thể đã ngốn cả phút.
      if (pretripTimedOut(startedAt, Date.now())) {
        failed += total - i; // các việc chưa kịp làm = chưa tải được, nói thật
        timedOut = true; // còn việc chưa chạy → KHÔNG được khoá 6 giờ
        break;
      }
      onProgress?.({ done: i, total, label: steps[i].label });
      try {
        await steps[i].run();
        ok++;
      } catch {
        failed++;
      }
    }
  } finally {
    scope.end();
  }
  onProgress?.({ done: total, total, label: "Xong" });
  // Tầng lưu báo HẾT CHỖ trong lúc chạy → nói thật, đừng để bà con tưởng máy đã
  // giữ đủ rồi ra khơi mới biết trống.
  const full = lastStorageFullAt() >= startedAt;
  const gained = { ...scope.counts };
  const kept = { ...scope.kept };
  return {
    ok,
    failed,
    full,
    saved: savedSummary(),
    gained,
    kept,
    coreFresh: coreLayersFresh(),
    timedOut,
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
