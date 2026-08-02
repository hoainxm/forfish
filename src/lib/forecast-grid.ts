// Trục 1 — LƯỚI DỰ BÁO VẼ LÊN BẢN ĐỒ (kiểu Windy): gió / sóng / DÒNG CHẢY theo
// GIỜ, khung ngày 3/16 theo hạng, kéo thanh thời gian là cả vùng biển đổi theo.
//
// Nguồn: Open-Meteo (miễn phí, không key) — một lượt gọi lấy ~80 điểm lưới
// phủ vùng biển VN. Quy tắc adapter: đổi nguồn chỉ sửa fetchForecastGrid,
// phần dựng hình (arrowFeatures) là logic thuần test được.
//
// Càng xa càng thưa khung để KHÔNG phình tải/khung hình: ≤3 ngày lấy mỗi 3h,
// 4–7 ngày mỗi 6h, >7 ngày mỗi 12h. Sóng dùng model ncep_gfswave025 (best-match
// sóng theo giờ chỉ ~9 ngày; model này phủ đủ 16). Gió best-match phủ 16 ngày.
//
// OFFLINE: lấy được thì LƯU localStorage; ra biển mất mạng lùi về bản đã lưu
// (lib/forecast-cache) — kéo thanh giờ vẫn xem được lưới đã tải trước lúc đi.

import {
  saveForecast,
  loadForecast,
  loadAll,
  noteForecastKept,
  isDefinitelyOffline,
  type ForecastSaveOutcome,
} from "@/lib/forecast-cache";
import { apiUrl } from "@/lib/api-base";
import { gridSnapshotId, SNAPSHOT_DAY_SET } from "@/lib/weather-snapshot-id";
import { isCacheCurrent } from "@/lib/source-cadence";
import { timeoutSignal } from "@/lib/abort";
import { noteResponse, tokenHeader } from "@/lib/device-token-store";

export type ForecastKind = "wind" | "wave" | "current";

export interface GridHour {
  windKmh: number | null;
  windDirDeg: number | null; // hướng gió THỔI TỪ (chuẩn khí tượng)
  waveM: number | null;
  waveDirDeg: number | null; // hướng sóng TỚI TỪ
  /** dòng chảy mặt (km/h) — nguồn MeteoFrance SMOC qua Open-Meteo, tới ~10 ngày;
      bản lưu đời cũ không có trường này → undefined, đọc bằng `?? null` */
  curKmh?: number | null;
  /** hướng dòng CHẢY VỀ (0° = chảy lên Bắc) — NGƯỢC quy ước gió/sóng "tới từ",
      docs Open-Meteo: "where the current is heading towards". KHÔNG +180° khi vẽ */
  curDirDeg?: number | null;
}

export interface GridCell {
  lat: number;
  lon: number;
  hours: GridHour[];
}

export interface ForecastGrid {
  cells: GridCell[];
  /** mốc giờ ISO (giờ VN), dùng chung cho mọi cell */
  times: string[];
  /** true = bản ĐÃ LƯU (offline/mất mạng), không phải bản mới */
  stale?: boolean;
  /** epoch ms lúc lưu (chỉ có ý nghĩa khi stale) */
  savedAt?: number | null;
}

/** Bước nhảy GẦN của thanh thời gian: 3 giờ một nấc (giữ cho tầm ≤3 ngày) */
export const TIME_STEP_HOURS = 3;
export const FORECAST_GRID_HOURS = 72;

/** Các khung ngày bà con chọn được cho lớp vẽ động */
export const GRID_DAY_OPTIONS = [3, 5, 7, 10, 16] as const;
export type GridDays = (typeof GRID_DAY_OPTIONS)[number];

/** Model sóng phủ đủ 16 ngày theo giờ (best-match sóng chỉ ~9 ngày) */
const WAVE_MODEL = "ncep_gfswave025";

/** Model DỰ PHÒNG (cron ghép snapshot 2 nguồn, 2026-07-29): ECMWF qua cùng API
    Open-Meteo — khác model thật (IFS ≠ GFS), probe thật phủ tới ~+14,5 ngày
    (gió + đủ 5 biến dải màu) / ~+14,5 ngày (sóng WAM). CHỈ cron gọi. */
export const BACKUP_WIND_MODEL = "ecmwf_ifs025";
export const BACKUP_WAVE_MODEL = "ecmwf_wam025";

/**
 * Chỉ số GIỜ cho từng khung của thanh thời gian: dày (3h) ở gần, thưa dần khi
 * ra xa để chặn số khung (16 ngày ~ 50 khung thay vì 128). `availableHours` là
 * số giờ nguồn thật trả về — không lấy quá.
 */
export function stepHourIndices(days: number, availableHours: number): number[] {
  const maxH = Math.min(days * 24, Math.max(0, availableHours - 1));
  const idx: number[] = [];
  let h = 0;
  while (h <= maxH) {
    idx.push(h);
    h += h < 72 ? 3 : h < 168 ? 6 : 12;
  }
  return idx;
}

// Lưới phủ vùng lớn (98–123°Đ, 1–24°B) — MỞ RỘNG 2026-07-28 để lớp màu/gió
// KHÔNG "hụt" mép khi zoom thoải mái; thưa (~2,5°) vì là nền, mỗi mũi tên đại
// diện ô lớn. Open-Meteo nhận ~120 điểm/lượt → giữ 10×11 = 110.
const LON_MIN = 98;
const LON_MAX = 123;
const LAT_MIN = 1;
const LAT_MAX = 24;
const N_LON = 13;
const N_LAT = 12; // 13×12 = 156 điểm (~150, user 2026-07-28) · bước ~2° đều

/** Bước lưới THẬT theo từng chiều (độ) — suy từ khung trên, không gõ số rời */
export const GRID_STEP_LAT_DEG = (LAT_MAX - LAT_MIN) / (N_LAT - 1); // ≈ 1,70°
export const GRID_STEP_LON_DEG = (LON_MAX - LON_MIN) / (N_LON - 1); // ≈ 2,11°

/** Số điểm lưới mỗi chiều — export để dựng WeatherField offline cho DẪN ĐƯỜNG
    (route-weather.ts lùi về lưới này khi mất sóng). Đổi khung ở trên là đủ. */
export const GRID_N_LAT = N_LAT;
export const GRID_N_LON = N_LON;

/**
 * TRẦN SNAP = NỬA BƯỚC LƯỚI, tính RIÊNG từng chiều. Xa hơn thì ô lưới KHÔNG CÒN
 * PHỦ chỗ bà con vừa chạm → cấm lấy số của nó (chỗ chạm thuộc ô KHÁC, dán số ô
 * khác vào là quay lại đúng lỗi "mượn số của toạ độ khác").
 *
 * Vì sao TỪNG CHIỀU chứ không một bán kính tròn: lưới này dẹt (ngang ~2,11° mà
 * dọc ~1,70°). Một bán kính tròn nửa-bước-lớn vẫn để THỦNG mấy góc ô — chạm vào
 * đó bị từ chối trong khi mũi tên đang vẽ ngay chỗ đó, đúng cái mâu thuẫn bà con
 * kêu. Hai nửa-bước theo hai chiều phủ KÍN đúng ô, không thừa không thiếu.
 *
 * KHÔNG đặt nhỏ hơn (vd 0,5°): lưới thưa ~2°, đặt 0,5° thì quá nửa số lần chạm
 * giữa hai mũi tên sẽ báo "chưa có số" trong khi số đang có ngay đó.
 */
/** Toạ độ ô làm tròn 0,01° (xem gridPoints) → khe thật giữa hai ô có thể nhỉnh
    hơn bước lý thuyết đúng ngần này; cộng bù cho khỏi thủng đúng CHÍNH GIỮA. */
const GRID_ROUND_DEG = 0.01;
export const GRID_SNAP_MAX_LAT_DEG = (GRID_STEP_LAT_DEG + GRID_ROUND_DEG) / 2; // ≈ 0,86°
export const GRID_SNAP_MAX_LON_DEG = (GRID_STEP_LON_DEG + GRID_ROUND_DEG) / 2; // ≈ 1,06°
/** Trần xa nhất theo bất kỳ chiều nào — con số để nói/ghi doc (≈ 1,05°) */
export const GRID_SNAP_MAX_DEG = Math.max(
  GRID_SNAP_MAX_LAT_DEG,
  GRID_SNAP_MAX_LON_DEG,
);

/**
 * Ô lưới PHỦ chỗ vừa chạm — null nếu lưới rỗng hoặc chỗ đó nằm NGOÀI vùng lưới.
 * Chọn ô có khoảng cách CHUẨN HOÁ theo nửa-bước nhỏ nhất; ≤ 1 nghĩa là chỗ chạm
 * nằm trong ô đó. Thuần, test được.
 */
export function nearestGridCell(
  grid: ForecastGrid,
  lat: number,
  lon: number,
): { cell: GridCell; distDeg: number } | null {
  let best: GridCell | null = null;
  let bestScore = Infinity;
  for (const c of grid.cells ?? []) {
    const score = Math.max(
      Math.abs(c.lat - lat) / GRID_SNAP_MAX_LAT_DEG,
      Math.abs(c.lon - lon) / GRID_SNAP_MAX_LON_DEG,
    );
    if (score < bestScore) {
      bestScore = score;
      best = c;
    }
  }
  if (!best || bestScore > 1) return null;
  return { cell: best, distDeg: Math.hypot(best.lat - lat, best.lon - lon) };
}

/** Toạ độ các điểm lưới — xuất riêng để test */
export function gridPoints(): { lat: number; lon: number }[] {
  const pts: { lat: number; lon: number }[] = [];
  for (let i = 0; i < N_LAT; i++) {
    for (let j = 0; j < N_LON; j++) {
      pts.push({
        lat: Math.round((LAT_MIN + (i * (LAT_MAX - LAT_MIN)) / (N_LAT - 1)) * 100) / 100,
        lon: Math.round((LON_MIN + (j * (LON_MAX - LON_MIN)) / (N_LON - 1)) * 100) / 100,
      });
    }
  }
  return pts;
}

const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

/** Namespace localStorage cho lưới Windy (offline) */
export const GRID_NS = "grid";

/** id bản lưu theo khung ngày — "d3", "d16"… (một khung một bản) */
export function gridCacheId(days: number): string {
  return `d${Math.round(days)}`;
}

/**
 * Lưới Windy có cache offline: lấy được thì LƯU (theo khung ngày); mất mạng →
 * lùi về bản đã lưu ĐÚNG KHUNG NGÀY ĐÓ + cờ `stale`.
 *
 * LỖI CŨ (đã sửa 2026-07-25): mất mạng mà chưa lưu khung đang xin thì lấy đại
 * "bản gần nhất" — xin 16 ngày, nhận lưới 3 ngày đã lưu, mà chip vẫn sáng "16
 * ngày". Bà con kéo thanh giờ tưởng đang xem nửa tháng tới. Nay không có đúng
 * khung thì BÁO LỖI, UI nói thật + chỉ ra khung nào thật sự đang có trong máy.
 */
/**
 * Bản lưu có khớp ĐỊNH NGHĨA LƯỚI hiện tại không (đủ số ô + đúng 4 góc bbox).
 * Vì sao (2026-07-29): mở lưới 80→156 điểm phủ vùng RỘNG hơn — bản lưu đời cũ
 * chỉ phủ "cửa sổ nhỏ" cũ; live lỗi (429) mà nhận bản cũ thì lớp màu/hạt co
 * cụm một góc trong khi khung nhìn đã mở rộng. Bản không khớp coi như KHÔNG CÓ.
 */
export function gridIsCurrent(g: ForecastGrid | null | undefined): boolean {
  const cells = g?.cells;
  if (!cells || cells.length < 20) return false;
  // CHỈ xét VÙNG PHỦ (4 góc), KHÔNG xét mật độ (2026-07-29 sửa lại): bản lưu
  // thưa hơn (110 ô) vẫn phủ ĐÚNG vùng — vẽ thô hơn chút nhưng dùng tốt, và
  // mọi chỗ dựng hình đều tự suy kích thước lưới. Chỉ bản đời CŨ HẲN (bbox nhỏ
  // 102,5–117,25 / 6–21,3) mới bị loại vì nó gây "co cụm một góc".
  const eps = 0.02; // toạ độ ô làm tròn 0,01°
  const last = cells[cells.length - 1];
  return (
    Math.abs(cells[0].lat - LAT_MIN) < eps &&
    Math.abs(cells[0].lon - LON_MIN) < eps &&
    Math.abs(last.lat - LAT_MAX) < eps &&
    Math.abs(last.lon - LON_MAX) < eps
  );
}

/** Lưới có SỐ DÒNG CHẢY chưa (bản lưu/snapshot đời trước 2026-07-29 chưa có) —
    lớp Dòng chảy cần thật, các lớp khác kệ. Chỉ cần MỘT ô một mốc có số. */
export function gridHasCurrent(g: ForecastGrid | null | undefined): boolean {
  return !!g?.cells?.some((c) => c.hours?.some((h) => h?.curKmh != null));
}

/** Lưới có SỐ SÓNG chưa — nhánh sóng `.catch(() => null)` nên lưới vẫn "hợp lệ"
    (đủ ô, đủ times) mà mọi `waveM` là null: lớp Sóng vẽ 0 mũi tên, trống câm. */
export function gridHasWave(g: ForecastGrid | null | undefined): boolean {
  return !!g?.cells?.some((c) => c.hours?.some((h) => h?.waveM != null));
}

/**
 * ⚠️ HẰNG SỐ NÀY ĐÃ BỎ KHỎI CỬA GHI ĐÈ (2026-08-02h). Giữ tên để chỗ gọi/test cũ
 * không vỡ, nhưng KHÔNG được dùng lại làm cớ mở cửa — đọc `shouldOverwriteGrid`.
 */
export const GRID_OVERWRITE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * SỐ SÓNG ĐÃ LƯU CÒN DÙNG ĐƯỢC KHÔNG — tức trục thời gian của nó còn với tới
 * HÔM NAY trở đi. THUẦN, có test.
 *
 * Đây là thứ THAY CHO trần tuổi 24 giờ. Câu hỏi đúng không phải "bản này lưu lâu
 * chưa" mà là "số sóng trong đó còn nói về tương lai không": lưới 16 ngày tải ở
 * bờ, sang ngày thứ hai của chuyến vẫn còn 15 ngày phía trước — cực kỳ đáng giữ,
 * dù đã 25 giờ tuổi.
 */
export function gridWaveStillUseful(
  g: ForecastGrid | null | undefined,
  now: number = Date.now(),
): boolean {
  const times = g?.times ?? [];
  if (times.length === 0) return false;
  const last = Date.parse(times[times.length - 1]);
  return Number.isFinite(last) && last >= now;
}

/**
 * CÓ ĐƯỢC GHI ĐÈ BẢN ĐANG CÓ KHÔNG (thuần, 2026-08-02).
 *
 * Vì sao: nhánh sóng + dòng chảy trong `fetchGridCore` kết bằng `.catch(() =>
 * null)` — nguồn marine 429/timeout thì lưới VẪN dựng xong với `waveM`/`curKmh`
 * toàn null, rồi `saveForecast` ghi ĐÈ THẲNG lên bản đầy đủ đã tải ở bờ. Ra
 * biển: lớp Sóng vẽ 0 mũi tên, không báo lỗi gì (times[] còn nguyên nên chip vẫn
 * nói "Đã lưu đủ"). `gridHasCurrent` có sẵn từ 2026-07-29 nhưng CHỈ dùng ở
 * đường ĐỌC — đường GHI không có cửa nào.
 *
 * Luật: bản mới phải KHÔNG NGHÈO HƠN bản đang giữ VỀ MẶT SÓNG. Nghèo hơn thì
 * TỪ CHỐI ghi — giữ bản đầy đủ cho offline; phiên đang có sóng vẫn xem được bản
 * live vừa lấy (hàm gọi vẫn trả nó ra).
 *
 * CHỈ XÉT SÓNG, KHÔNG XÉT DÒNG CHẢY (sửa 2026-08-02 — hồi quy do chính bản vá
 * trên gây ra): bản đầu đặt `curKmh` NGANG HÀNG `waveM`. Nhưng sóng là AN TOÀN
 * TÍNH MẠNG, còn dòng chảy mặt là lớp "xem cho biết" — và hai thứ đến từ HAI
 * request khác nhau. Nguồn dòng chảy (SMOC) chết trong khi gió/sóng vẫn tươi là
 * chuyện thường; luật cũ chặn luôn cả lưới GIÓ/SÓNG MỚI, máy ôm bản tới 23 giờ
 * tuổi — đúng chỗ không được phép cũ. Phần dòng chảy cũ KHÔNG mất: `saveGridChecked`
 * ghép lại từ bản cũ khi trục thời gian khớp (xem mergeGridCurrent).
 */
export function shouldOverwriteGrid(
  prev: { data: ForecastGrid; savedAt: number } | null | undefined,
  next: ForecastGrid,
  now: number = Date.now(),
): boolean {
  if (!prev?.data) return true;
  // bản đời cũ (vùng phủ nhỏ) coi như không có — đè thoải mái
  if (!gridIsCurrent(prev.data)) return true;
  /*  ═══ TUỔI KHÔNG PHẢI LÀ CỚ ĐỂ MẤT SỐ SÓNG ═══ (sửa 2026-08-02h — lỗi NẶNG)

      LỖI ĐÃ SỬA: cửa cũ là `now - prev.savedAt >= 24 giờ → cho đè vô điều kiện`.
      Sang NGÀY THỨ HAI của chuyến biển thì MỌI bản trong máy đều quá 24 giờ —
      đó là trạng thái BÌNH THƯỜNG của một chuyến, không phải ca hiếm. Lúc đó chỉ
      cần bắt được một vạch sóng trong khi nguồn marine trả 429 (chuyện thường)
      là `fetchGridCore` dựng xong lưới với `waveM` toàn null và ĐÈ THẲNG lên
      lưới có sóng đã tải ở bờ. `mergeGridCurrent` ghép lại dòng chảy nhưng
      KHÔNG ghép lại sóng ⇒ mất hẳn, giữa biển không tải lại được.

      Câu hỏi đúng không phải "bản này lưu lâu chưa" mà là "số sóng trong đó còn
      nói về tương lai không". Lưới 16 ngày tải ở bờ, sang ngày thứ hai vẫn còn
      15 ngày phía trước — đáng giữ. Còn bản mà trục thời gian đã trôi qua hết
      thì giữ cũng vô nghĩa, cho đè để lưới GIÓ mới vào được máy (đó mới là ca
      "nguồn sóng chết dài ngày" mà trần 24 giờ định chữa). */
  if (
    gridHasWave(prev.data) &&
    !gridHasWave(next) &&
    gridWaveStillUseful(prev.data, now)
  ) {
    /*  ⚠️ CHỈ TỪ CHỐI KHI KHÔNG GHÉP ĐƯỢC (siết 2026-08-02h — vòng soát chéo).
        Từ chối thẳng là vứt luôn số GIÓ mới, và nguồn marine 429 dài ngày sẽ
        khoá máy ở số gió của ngày rời bờ tới 16 ngày. Ghép được (cùng trục thời
        gian, cùng bộ ô) thì `saveGridChecked` lấy gió mới + sóng cũ — được cả
        hai, không phải chọn. Ghép không được (trục lệch, đổi bộ ô) thì mới đúng
        là bài toán đánh đổi, và lúc đó giữ sóng là đúng. */
    return mergeGridCurrent(prev.data, next) !== next;
  }
  return true;
}

/**
 * GHÉP DÒNG CHẢY CŨ VÀO LƯỚI MỚI (thuần, 2026-08-02).
 *
 * Ca thật: nguồn dòng chảy 429 nhưng gió/sóng vẫn về. Lưới mới đáng ghi (số gió
 * sóng tươi hơn), nhưng ghi thẳng là XOÁ SẠCH lớp Dòng chảy đã tải sẵn ở bờ —
 * `fetchForecastGrid(..., { needCurrent: true })` sau đó coi bản trong máy là
 * không dùng được, giữa biển bật lớp lên là trống câm.
 *
 * Chỉ ghép khi CHẮC CHẮN cùng một trục thời gian và cùng bộ ô: `times[]` khớp
 * TỪNG PHẦN TỬ + số ô bằng nhau + toạ độ từng ô trùng. Không khớp thì trả `next`
 * NGUYÊN XI — thà mất lớp "xem cho biết" còn hơn dán số dòng chảy của giờ khác
 * lên giờ đang xem (đúng lỗi "mượn số của toạ độ/khung khác" đã cấm).
 *
 * Số ghép vào là số THẬT của đúng mốc giờ đó, chỉ lấy từ lượt tải trước — không
 * bịa, không nội suy.
 */
export function mergeGridCurrent(
  prev: ForecastGrid | null | undefined,
  next: ForecastGrid,
): ForecastGrid {
  /*  GHÉP CẢ SÓNG, KHÔNG CHỈ DÒNG CHẢY (mở rộng 2026-08-02h — vòng soát chéo).

      LỖI ĐÃ SỬA: cửa `shouldOverwriteGrid` từ chối lưới rỗng-sóng để giữ số sóng
      đã tải ở bờ. Đúng, nhưng từ chối là vứt CẢ lưới mới — gồm số GIÓ vừa lấy
      tươi. Nguồn marine 429 dài ngày là chuyện thường, nên máy có thể ôm số gió
      của ngày rời bờ suốt tới 16 ngày. Gió cũng là an toàn tính mạng.

      Lối ra đúng: lấy GIÓ mới, ghép SÓNG cũ vào — được cả hai. Điều kiện khớp
      (cùng trục thời gian, cùng bộ ô) đã có sẵn cho dòng chảy, dùng lại nguyên. */
  const thieuCur = !!prev && gridHasCurrent(prev) && !gridHasCurrent(next);
  const thieuWave = !!prev && gridHasWave(prev) && !gridHasWave(next);
  if (!prev || (!thieuCur && !thieuWave)) return next;
  const a = prev.cells ?? [];
  const b = next.cells ?? [];
  if (a.length === 0 || a.length !== b.length) return next;
  const ta = prev.times ?? [];
  const tb = next.times ?? [];
  if (ta.length === 0 || tb.length === 0) return next;
  for (let i = 0; i < a.length; i++) {
    if (a[i].lat !== b[i].lat || a[i].lon !== b[i].lon) return next;
  }
  /*  ⚠️ GHÉP THEO PHẦN GIAO CỦA TRỤC THỜI GIAN, KHÔNG ĐÒI KHỚP TOÀN PHẦN
      (sửa 2026-08-02i — vòng đánh giá cuối bắt).

      LỖI ĐÃ SỬA: điều kiện cũ đòi `ta` và `tb` khớp TỪNG PHẦN TỬ. Nhưng `times`
      dựng từ `hourly.time` TUYỆT ĐỐI của Open-Meteo nên nó **trượt mỗi ngày**.
      Nghĩa là qua ngày thứ hai của chuyến, nhánh ghép gần như KHÔNG BAO GIỜ
      chạy ⇒ `shouldOverwriteGrid` từ chối ⇒ **lưới GIÓ kẹt ở ngày rời bờ suốt
      tới 16 ngày**, đúng lúc nguồn marine 429 (chuyện thường). Gió cũng là an
      toàn tính mạng, và chú thích thì vẫn khoe "được cả hai".

      Hai lưới cách nhau một ngày vẫn trùng 15/16 ngày — thừa sức ghép. Chỉ số
      giờ NÀO CÓ Ở CẢ HAI mới được ghép; giờ mới hoàn toàn thì để nguyên giá trị
      của bản mới (thường là null, đúng: mình không có số cũ cho giờ đó). */
  const viTriCu = new Map<string, number>();
  for (let i = 0; i < ta.length; i++) viTriCu.set(ta[i], i);
  let trung = 0;
  for (const t of tb) if (viTriCu.has(t)) trung++;
  // không có giờ nào chung ⇒ hai bản nói về hai quãng khác hẳn, đừng dán vào nhau
  if (trung === 0) return next;
  return {
    ...next,
    cells: b.map((c, i) => ({
      ...c,
      hours: c.hours.map((h, k) => {
        // giờ này ở bản MỚI ứng với vị trí nào trong bản CŨ (có thể lệch)
        const kCu = viTriCu.get(tb[k]);
        const old = kCu == null ? undefined : a[i].hours?.[kCu];
        if (!old) return h;
        let out = h;
        if (thieuCur && old.curKmh != null) {
          out = { ...out, curKmh: old.curKmh, curDirDeg: old.curDirDeg ?? null };
        }
        if (thieuWave && old.waveM != null) {
          out = { ...out, waveM: old.waveM, waveDirDeg: old.waveDirDeg ?? null };
        }
        return out;
      }),
    })),
  };
}

/** Ghi lưới vào máy QUA CỬA "bản mới có tốt bằng bản cũ không". `dataAt` = tuổi
    THẬT của số liệu (snapshot cron) — khác mốc sự cố, xem forecast-cache.
    Trả về BA trạng thái: `kept` (kho đang giữ bản tốt hơn — coi như xong việc)
    khác hẳn `failed` (máy hết chỗ). Gộp hai thứ này vào một chữ `false` là gốc
    của vòng đốt sóng 2 phút/lượt — xem ForecastSaveOutcome. */
function saveGridChecked(
  id: string,
  g: ForecastGrid,
  dataAt?: number,
): ForecastSaveOutcome {
  const prev = loadForecast<ForecastGrid>(GRID_NS, id);
  if (!shouldOverwriteGrid(prev, g)) {
    noteForecastKept(GRID_NS);
    return "kept";
  }
  // giữ lại phần dòng chảy của bản cũ nếu bản mới thiếu (và trục giờ khớp)
  const merged = mergeGridCurrent(prev?.data, g);
  return saveForecast(GRID_NS, id, merged, dataAt) ? "written" : "failed";
}

export async function fetchForecastGrid(
  days = 3,
  opts?: { needCurrent?: boolean },
): Promise<ForecastGrid> {
  const id = gridCacheId(days);
  const needCur = !!opts?.needCurrent;
  // dùng được cho lớp đang xin không: lưới hiện hành + (lớp Dòng chảy thì phải
  // CÓ số dòng chảy — bản đời cũ thiếu trường này, nhận vào là lớp trống câm)
  const usable = (g: ForecastGrid | null | undefined): g is ForecastGrid =>
    gridIsCurrent(g) && (!needCur || gridHasCurrent(g));
  // TIẾT CHẾ NGUỒN (2026-07-29): bản trong máy còn là BẢN HIỆN HÀNH (nguồn chưa
  // ra bản mới — lib/source-cadence) thì dùng luôn, KHÔNG gọi Open-Meteo. Trước
  // đây bật/tắt lớp chục lần là chục lượt tải cùng một con số → cháy hạn ngạch
  // IP (429) làm CẢ APP mất dự báo. KHÔNG gắn stale: đây đúng là bản mới nhất.
  const fresh = loadForecast<ForecastGrid>(GRID_NS, id);
  if (fresh && usable(fresh.data) && isCacheCurrent(fresh.savedAt, Date.now())) {
    return fresh.data;
  }
  /* MẤT SÓNG HẲN → ĐỌC BẢN ĐÃ LƯU TRƯỚC (K3, 2026-08-02 — cùng khuôn `sea.ts`).
     Đường thường ở dưới đốt ~30 giây (10 s snapshot + 20 s live) rồi mới lấy ra
     thứ đã nằm sẵn trong máy. Bà con nhìn màn hình quay 30 giây mỗi lần bật lớp
     gió/sóng, mỗi lần đổi khung ngày. Chỉ đi tắt khi máy KHẲNG ĐỊNH mất sóng;
     ca "sóng sống mà chết" vẫn đi đường thường (không mất bản mới). Giữ NGUYÊN
     thứ tự nạn nhân của đường cũ: bản đúng khung trước, rồi khung ngắn hơn. */
  if (isDefinitelyOffline()) {
    const saved = savedGridFallback(id, days, usable);
    if (saved) return saved;
  }
  // ƯU TIÊN SNAPSHOT (user 2026-07-29: "luôn ưu tiên snapshot để hạn chế bị
  // lock do IP tải nhiều"): trước khi gọi Open-Meteo bằng IP của MÁY BÀ CON,
  // hỏi snapshot server do cron tính sẵn (same-origin, CDN + SW cache — không
  // đụng hạn ngạch nguồn). Chỉ nhận khi bản snapshot CÒN HIỆN HÀNH theo nhịp
  // phát hành (cron nhét savedAt vào payload); cũ hơn thì mới đi live — không
  // hy sinh độ tươi. KHÔNG gắn stale: đây đúng là bản mới nhất nguồn có.
  if (SNAPSHOT_DAY_SET.includes(days)) {
    const snap = await loadGridSnapshotClient(days);
    if (snap && usable(snap) && isCacheCurrent(snap.savedAt, Date.now())) {
      // LƯU vào máy với ĐÚNG TUỔI THẬT của snapshot (không phải Date.now()):
      // pretrip/offline trông cậy bản localStorage, còn tuổi thật giữ cho
      // isCacheCurrent lần sau không tưởng bản cũ là bản vừa tải.
      saveGridChecked(id, snap, snap.savedAt ?? undefined);
      return snap;
    }
  }
  try {
    const g = await fetchForecastGridLive(days);
    // QUA CỬA: nguồn sóng/dòng chảy hỏng thì `g` thiếu hẳn một lớp — không được
    // đè lên bản đầy đủ đã tải ở bờ (xem shouldOverwriteGrid).
    saveGridChecked(id, g);
    return g;
  } catch (err) {
    // LƯỚI AN TOÀN khi live lỗi: bản trong máy trước; nếu chưa có mà là khung
    // MIỄN PHÍ (d3) thì thử snapshot server cron tính sẵn (khung premium không
    // snapshot công khai — xem weather-snapshot-id.ts). Giữ cờ stale để UI nói
    // thật. Bản lưu ĐỜI CŨ (vùng phủ nhỏ hơn) bị LOẠI — xem gridIsCurrent.
    // usable (KHÔNG chỉ gridIsCurrent): lớp Dòng chảy đòi grid CÓ số dòng chảy —
    // bản thiếu current mà nhận vào là "loaded mà không vẽ mũi tên" (blank câm).
    const hit = loadForecast<ForecastGrid>(GRID_NS, id);
    if (hit && usable(hit.data))
      return { ...hit.data, stale: true, savedAt: hit.savedAt };
    // Snapshot cron: CẢ khung miễn phí d3 LẪN khung premium d16 (2026-07-29 —
    // premium luôn xin d16 nên trước đây không bao giờ có lưới an toàn). Khung
    // premium bị route chặn thật nếu chưa đủ hạng → trả null, báo lỗi như cũ.
    if (SNAPSHOT_DAY_SET.includes(days)) {
      const snap = await loadGridSnapshotClient(days);
      if (snap && usable(snap)) {
        // LƯU khi live 429 (2026-07-29): trước chỉ trả stale mà không ghi →
        // "Tải lại" trong popup coi như hỏng (savedGridDays vẫn trống) dù đã
        // lấy được snapshot. Ghi để offline có bản + hàng đổi xanh.
        saveGridChecked(id, snap, snap.savedAt ?? undefined);
        return { ...snap, stale: true, savedAt: snap.savedAt ?? null };
      }
    }
    // CUỐI CÙNG: mượn khung NGẮN HƠN đã lưu (2026-07-29). An toàn từ khi BỎ chip
    // chọn khung: thanh ngày vẽ THEO times[] thật nên xin 16 mà chỉ có 3 thì bà
    // con thấy đúng 3 ngày — không còn nhãn "16 ngày" nói dối như lúc chặn luật
    // này (2026-07-25). Thà 3 ngày thật còn hơn màn hình trắng khi nguồn 429.
    const shorter = savedCurrentGridDays().filter((d) => d < days);
    for (let i = shorter.length - 1; i >= 0; i--) {
      const alt = loadForecast<ForecastGrid>(GRID_NS, gridCacheId(shorter[i]));
      if (alt && usable(alt.data))
        return { ...alt.data, stale: true, savedAt: alt.savedAt };
    }
    // …và SNAPSHOT SERVER của khung ngắn hơn (user 2026-07-29: "không live được
    // thì lấy snapshot"). Máy chưa từng tải được lần nào (429 ngay từ đầu) thì
    // localStorage trống — server vẫn có bản cron tính sẵn.
    for (const d of [...SNAPSHOT_DAY_SET].filter((x) => x < days).sort((a, b) => b - a)) {
      const snap = await loadGridSnapshotClient(d);
      if (snap && usable(snap))
        return { ...snap, stale: true, savedAt: snap.savedAt ?? null };
    }
    throw err;
  }
}

/**
 * BẢN LƯỚI ĐÃ LƯU TRONG MÁY dùng được cho khung đang xin — bản ĐÚNG khung
 * trước, hết thì mượn khung NGẮN HƠN (thanh ngày vẽ theo `times[]` thật nên
 * không nói dối). Thuần đọc localStorage, KHÔNG gọi mạng: đây là nhánh cho lúc
 * mất sóng hẳn. null = máy chưa có gì dùng được.
 */
function savedGridFallback(
  id: string,
  days: number,
  usable: (g: ForecastGrid | null | undefined) => g is ForecastGrid,
): ForecastGrid | null {
  const hit = loadForecast<ForecastGrid>(GRID_NS, id);
  if (hit && usable(hit.data))
    return { ...hit.data, stale: true, savedAt: hit.savedAt };
  const shorter = savedCurrentGridDays().filter((d) => d < days);
  for (let i = shorter.length - 1; i >= 0; i--) {
    const alt = loadForecast<ForecastGrid>(GRID_NS, gridCacheId(shorter[i]));
    if (alt && usable(alt.data))
      return { ...alt.data, stale: true, savedAt: alt.savedAt };
  }
  return null;
}

/** LƯỚI AN TOÀN: snapshot lưới do cron tính sẵn (same-origin) — null nếu chưa
    có / route chặn premium. Export cho marine-weather dùng làm nấc cuối của
    DỰ BÁO ĐIỂM (2026-07-29: bản web mở lần đầu máy trống trơn + live 429). */
export async function loadGridSnapshotClient(days: number): Promise<ForecastGrid | null> {
  try {
    const r = await fetch(apiUrl(`/api/weather-snapshot?id=${gridSnapshotId(days)}`), {
      headers: tokenHeader(),
      signal: timeoutSignal(10000),
    });
    /* MỘT DÒNG NÀY = chỗ này cũng phát hiện được máy bị đá. Bộ não vẫn
       nằm ở `noteResponse`; ở đây chỉ đưa phản hồi cho nó soi. */
    void noteResponse(r);
    if (!r.ok) return null;
    const g = (await r.json()) as ForecastGrid;
    return g && Array.isArray(g.times) && g.times.length > 0 ? g : null;
  } catch {
    return null;
  }
}

/** Các khung ngày ĐANG CÓ bản lưu trong máy (tăng dần). Bản ĐỜI CŨ (vùng phủ
    nhỏ) VẪN đếm: tra ĐIỂM/tuyến dùng được (nearestGridCell tự chặn ngoài vùng
    phủ). Đường HIỂN THỊ LƯỚI dùng savedCurrentGridDays. */
export function savedGridDays(): number[] {
  return loadAll<ForecastGrid>(GRID_NS)
    .map((e) => Number(/^d(\d+)$/.exec(e.id)?.[1]))
    .filter((d) => Number.isFinite(d) && d > 0)
    .sort((a, b) => a - b);
}

/** Ngày (ISO) xa nhất lưới gió/sóng trong máy phủ tới — đọc times[] THẬT của
 *  khung rộng nhất đã lưu. null nếu chưa có. Cho popup "dự báo tới ngày nào". */
export function savedGridUntil(): string | null {
  let best: { days: number; until: string | null } | null = null;
  for (const e of loadAll<ForecastGrid>(GRID_NS)) {
    const m = /^d(\d+)$/.exec(e.id);
    if (!m) continue;
    const d = Number(m[1]);
    const t = e.data?.times;
    const until = t && t.length ? t[t.length - 1].slice(0, 10) : null;
    if (!best || d > best.days) best = { days: d, until };
  }
  return best?.until ?? null;
}

/** Như savedGridDays nhưng CHỈ bản khớp lưới hiện tại — cho UI chọn khung của
    LỚP VẼ (chip "Trong máy đang có"): mời bà con sang khung mà fetchForecastGrid
    sẽ từ chối (bản cũ) là mời vào ngõ cụt. */
export function savedCurrentGridDays(): number[] {
  return loadAll<ForecastGrid>(GRID_NS)
    .filter((e) => gridIsCurrent(e.data))
    .map((e) => Number(/^d(\d+)$/.exec(e.id)?.[1]))
    .filter((d) => Number.isFinite(d) && d > 0)
    .sort((a, b) => a - b);
}

/**
 * Bản lưới ĐÃ LƯU DÀI NGÀY NHẤT còn trong máy (d16 → d7 → d3…) — phủ được nhiều
 * ngày nhất cho chuyến dài. Dùng khi mất sóng mà chỗ vừa chạm chưa từng mở xem:
 * lưới phủ CẢ VÙNG BIỂN nên vẫn có gió/sóng ĐÚNG chỗ đó (xem marine-weather).
 * null = trong máy chưa có lưới nào dùng được.
 */
export function loadLongestSavedGrid(): {
  grid: ForecastGrid;
  savedAt: number;
  days: number;
} | null {
  const days = savedGridDays();
  for (let i = days.length - 1; i >= 0; i--) {
    const hit = loadForecast<ForecastGrid>(GRID_NS, gridCacheId(days[i]));
    const g = hit?.data;
    if (!g?.cells?.length || !g.times?.length) continue;
    return { grid: g, savedAt: hit!.savedAt, days: days[i] };
  }
  return null;
}

/** LIVE Open-Meteo THẲNG — export để cron precompute dùng chung (client vẫn gọi
    qua fetchForecastGrid có cache + fallback). */
export async function fetchForecastGridLive(days = 3): Promise<ForecastGrid> {
  return fetchGridCore(days, { withCurrent: true });
}

/** NGUỒN DỰ PHÒNG cho cron ghép snapshot (2026-07-29): ECMWF IFS/WAM — cùng
    API, khác model. KHÔNG lấy dòng chảy (Open-Meteo chỉ có SMOC; dự phòng dòng
    chảy là Copernicus, cron lo riêng). Client KHÔNG gọi hàm này. */
export async function fetchForecastGridBackupLive(days = 3): Promise<ForecastGrid> {
  return fetchGridCore(days, {
    windModel: BACKUP_WIND_MODEL,
    waveModel: BACKUP_WAVE_MODEL,
    withCurrent: false,
  });
}

async function fetchGridCore(
  days: number,
  opts: { windModel?: string; waveModel?: string; withCurrent: boolean },
): Promise<ForecastGrid> {
  const pts = gridPoints();
  const lats = pts.map((p) => p.lat).join(",");
  const lons = pts.map((p) => p.lon).join(",");
  // +1 ngày đệm để mốc cuối đủ giờ; trần nguồn 16 ngày
  const fd = Math.min(16, Math.max(1, Math.round(days)) + 1);
  const common = `latitude=${lats}&longitude=${lons}&timezone=Asia%2FHo_Chi_Minh&forecast_days=${fd}`;

  // Timeout 20s (tầm 16 ngày × 80 điểm là payload lớn) — thà báo lỗi rõ còn hơn treo UI
  // DÒNG CHẢY là REQUEST RIÊNG (không models): probe 2026-07-29 cho thấy ghim
  // models=ncep_gfswave025 thì ocean_current_* trả toàn null (model sóng không
  // có biến dòng chảy). Nguồn dòng chảy = MeteoFrance SMOC (best_match), phủ
  // ~10 ngày — ngày 11–16 null, lớp vẽ tự trống, KHÔNG bịa số.
  const windModelQ = opts.windModel ? `&models=${opts.windModel}` : "";
  const [windRes, waveRes, curRes] = await Promise.all([
    fetch(
      `https://api.open-meteo.com/v1/forecast?${common}&hourly=wind_speed_10m,wind_direction_10m&wind_speed_unit=kmh${windModelQ}`,
      { signal: timeoutSignal(20000) },
    ).then((r) => {
      if (!r.ok) throw new Error(`wind grid ${r.status}`);
      return r.json();
    }),
    fetch(
      `https://marine-api.open-meteo.com/v1/marine?${common}&hourly=wave_height,wave_direction&models=${opts.waveModel ?? WAVE_MODEL}`,
      { signal: timeoutSignal(20000) },
    )
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null),
    opts.withCurrent
      ? fetch(
          `https://marine-api.open-meteo.com/v1/marine?${common}&hourly=ocean_current_velocity,ocean_current_direction`,
          { signal: timeoutSignal(20000) },
        )
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null)
      : Promise.resolve(null),
  ]);

  const windArr: unknown[] = Array.isArray(windRes) ? windRes : [windRes];
  const waveArr: unknown[] = Array.isArray(waveRes)
    ? waveRes
    : waveRes
      ? [waveRes]
      : [];
  const curArr: unknown[] = Array.isArray(curRes)
    ? curRes
    : curRes
      ? [curRes]
      : [];

  const first = windArr[0] as { hourly?: { time?: string[] } };
  const allTimes: string[] = first?.hourly?.time ?? [];
  // chỉ số GIỜ từng khung: dày ở gần, thưa dần khi xa (chặn số khung)
  const hourIdx = stepHourIndices(days, allTimes.length);
  const times: string[] = hourIdx.map((h) => allTimes[h]);

  const cells: GridCell[] = pts.map((p, idx) => {
    const w = windArr[idx] as {
      hourly?: {
        wind_speed_10m?: unknown[];
        wind_direction_10m?: unknown[];
      };
    };
    const v = waveArr[idx] as
      | { hourly?: { wave_height?: unknown[]; wave_direction?: unknown[] } }
      | undefined;
    const cu = curArr[idx] as
      | {
          hourly?: {
            ocean_current_velocity?: unknown[];
            ocean_current_direction?: unknown[];
          };
        }
      | undefined;
    const hours: GridHour[] = hourIdx.map((h) => ({
      windKmh: num(w?.hourly?.wind_speed_10m?.[h]),
      windDirDeg: num(w?.hourly?.wind_direction_10m?.[h]),
      waveM: num(v?.hourly?.wave_height?.[h]),
      waveDirDeg: num(v?.hourly?.wave_direction?.[h]),
      curKmh: num(cu?.hourly?.ocean_current_velocity?.[h]),
      curDirDeg: num(cu?.hourly?.ocean_current_direction?.[h]),
    }));
    return { lat: p.lat, lon: p.lon, hours };
  });

  return { cells, times };
}

/* ---------------------------------------------------------------------------
   Dựng mũi tên GeoJSON — logic thuần, test được.
   Mũi tên chỉ HƯỚNG ĐI của gió/sóng (nguồn cho hướng-tới-từ → cộng 180°).
--------------------------------------------------------------------------- */

const SHAFT_DEG = 0.55; // chiều dài thân mũi tên (độ) — hợp với lưới ~2°
const HEAD_DEG = 0.2;

function destPoint(
  lon: number,
  lat: number,
  bearingDeg: number,
  distDeg: number,
): [number, number] {
  const rad = (bearingDeg * Math.PI) / 180;
  // xấp xỉ phẳng: đủ chính xác cho hình vẽ vài chục km
  const dLat = Math.cos(rad) * distDeg;
  const dLon =
    (Math.sin(rad) * distDeg) / Math.max(0.2, Math.cos((lat * Math.PI) / 180));
  return [
    Math.round((lon + dLon) * 10000) / 10000,
    Math.round((lat + dLat) * 10000) / 10000,
  ];
}

/**
 * FeatureCollection mũi tên cho một mốc thời gian.
 * properties.v = độ lớn (km/h với gió/dòng chảy, mét với sóng) để tô màu.
 * Cell thiếu dữ liệu (đất liền với sóng/dòng chảy; ngày >10 với dòng chảy) bỏ qua.
 *
 * HƯỚNG: gió/sóng nguồn ghi "TỚI TỪ" → +180° ra hướng đi; DÒNG CHẢY nguồn ghi
 * sẵn hướng CHẢY VỀ (0° = lên Bắc) → dùng THẲNG, +180° là vẽ ngược dòng.
 */
export function arrowFeatures(
  grid: ForecastGrid,
  timeIdx: number,
  kind: ForecastKind,
): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const c of grid.cells) {
    const h = c.hours[timeIdx];
    if (!h) continue;
    const mag =
      kind === "wind" ? h.windKmh : kind === "wave" ? h.waveM : h.curKmh ?? null;
    const dirDeg =
      kind === "wind"
        ? h.windDirDeg
        : kind === "wave"
          ? h.waveDirDeg
          : h.curDirDeg ?? null;
    if (mag == null || dirDeg == null) continue;

    const toDeg = kind === "current" ? dirDeg % 360 : (dirDeg + 180) % 360;
    // thân ngắn dài theo độ lớn một chút cho có "nhịp" (dòng chảy 0–4 km/h)
    const scale =
      kind === "wind"
        ? Math.min(1.25, 0.55 + mag / 60)
        : kind === "wave"
          ? Math.min(1.25, 0.55 + mag / 4)
          : Math.min(1.25, 0.55 + mag / 3);
    const tail: [number, number] = [c.lon, c.lat];
    const head = destPoint(c.lon, c.lat, toDeg, SHAFT_DEG * scale);
    const barbL = destPoint(head[0], head[1], toDeg + 150, HEAD_DEG * scale);
    const barbR = destPoint(head[0], head[1], toDeg - 150, HEAD_DEG * scale);

    features.push({
      type: "Feature",
      properties: { v: mag },
      geometry: {
        type: "MultiLineString",
        coordinates: [
          [tail, head],
          [head, barbL],
          [head, barbR],
        ],
      },
    });
  }
  return { type: "FeatureCollection", features };
}

/*
  Thang màu mũi tên (màu nội dung bản đồ, không phải token UI):
  xanh dịu = êm → vàng/cam = chú ý → đỏ = dữ. Ngưỡng khớp với mức cảnh báo
  của scoreDay/route-plan (gió 39 km/h ~ cấp 6, sóng 2,5 m = dữ).
*/
export const WIND_COLOR_EXPR = [
  "interpolate",
  ["linear"],
  ["get", "v"],
  5, "#74add1",
  20, "#3d7fb5",
  30, "#e8b339",
  39, "#e06c1f",
  55, "#b71d1d",
] as const;

// Sóng (m): bám thang Windy — teal nhạt (êm) → lam → chàm → đỏ (dữ). KHÔNG
// dùng vàng/cam như trước (Windy sóng đi thẳng lam→đỏ tím).
export const WAVE_COLOR_EXPR = [
  "interpolate",
  ["linear"],
  ["get", "v"],
  0.3, "#75c8be",
  1.0, "#4682c8",
  2.0, "#5a50b4",
  3.0, "#b43c78",
  4.5, "#c62828",
] as const;

// Dòng chảy (km/h): biển VN mặt phần lớn 0,3–3 km/h, dòng mạnh (mùa gió, eo) tới
// ~5. Lam nhạt (êm) → lục lam → vàng → cam (xiết) — kiểu Windy currents.
export const CURRENT_COLOR_EXPR = [
  "interpolate",
  ["linear"],
  ["get", "v"],
  0.2, "#79b8d1",
  1.0, "#3f96a8",
  2.0, "#d9b83c",
  3.5, "#e0851f",
  5.0, "#c0392b",
] as const;

const WD_SHORT = ["CN", "Th 2", "Th 3", "Th 4", "Th 5", "Th 6", "Th 7"];

/** "2026-06-12T13:00" → "Th 6 12/6 · 13h" (hôm nay/mai nói thẳng) */
export function timeLabelVN(iso: string, todayIso?: string): string {
  const [datePart, timePart] = iso.split("T");
  const [, m, d] = datePart.split("-");
  const hour = timePart?.slice(0, 2) ?? "00";
  let dayName: string;
  if (todayIso && datePart === todayIso) {
    dayName = "Hôm nay";
  } else {
    const dt = new Date(`${datePart}T12:00:00Z`);
    dayName = `${WD_SHORT[dt.getUTCDay()]} ${Number(d)}/${Number(m)}`;
  }
  return `${dayName} · ${Number(hour)}h`;
}

// ── THANH THỜI GIAN KIỂU WINDY ────────────────────────────────────────────
// Dải ngày cuộn ngang: mỗi ngày một khối, dưới có nấc GIỜ (không ghi số
// gió/sóng lên thanh — chỉ ngày + giờ). Nấc giờ ánh xạ về đúng chỉ số trong
// mảng times[] để chạm là nhảy tới khung đó.

/** Nhãn ngắn cho ĐẦU khối ngày trên thanh: "Hôm nay" / "Mai" / "Th 6 12/6" */
export function scrubDayLabel(isoDate: string, todayIso?: string): string {
  if (todayIso) {
    const a = Date.parse(`${todayIso}T00:00:00Z`);
    const b = Date.parse(`${isoDate}T00:00:00Z`);
    if (Number.isFinite(a) && Number.isFinite(b)) {
      const diff = Math.round((b - a) / (24 * 60 * 60 * 1000));
      if (diff === 0) return "Hôm nay";
      if (diff === 1) return "Mai";
    }
  }
  const dt = new Date(`${isoDate}T12:00:00Z`);
  return `${WD_SHORT[dt.getUTCDay()]} ${dt.getUTCDate()}/${dt.getUTCMonth() + 1}`;
}

export interface ScrubDay {
  /** ngày lịch "YYYY-MM-DD" (giờ VN) */
  iso: string;
  /** các nấc giờ trong ngày, kèm chỉ số vào mảng times[] để seek */
  ticks: { idx: number; hour: number }[];
}

/**
 * Gom mảng times[] (ISO giờ VN, đã thưa dần theo tầm) thành các KHỐI NGÀY để
 * vẽ thanh cuộn. Giữ nguyên chỉ số gốc — chạm nấc giờ là seek đúng khung đó.
 */
export function groupTimesByDay(times: string[]): ScrubDay[] {
  const days: ScrubDay[] = [];
  times.forEach((t, idx) => {
    const [date, time] = t.split("T");
    const hour = Number(time?.slice(0, 2) ?? "0");
    const last = days[days.length - 1];
    if (last && last.iso === date) last.ticks.push({ idx, hour });
    else days.push({ iso: date, ticks: [{ idx, hour: Number.isFinite(hour) ? hour : 0 }] });
  });
  return days;
}

export interface LegendStop {
  /** ngưỡng: gió km/h · sóng m */
  value: number;
  color: string;
}

/**
 * Thang màu cường độ (chú giải "thanh cường độ" kiểu Windy) — suy THẲNG từ
 * WIND/WAVE_COLOR_EXPR để chú giải KHÔNG BAO GIỜ lệch với màu vẽ trên bản đồ.
 */
export function legendStops(kind: ForecastKind): LegendStop[] {
  const expr =
    kind === "wind"
      ? WIND_COLOR_EXPR
      : kind === "wave"
        ? WAVE_COLOR_EXPR
        : CURRENT_COLOR_EXPR;
  const stops: LegendStop[] = [];
  // cấu trúc: [..., value, color, value, color, ...] bắt đầu ở chỉ số 3
  for (let i = 3; i + 1 < expr.length; i += 2) {
    stops.push({ value: expr[i] as number, color: expr[i + 1] as string });
  }
  return stops;
}

/** CSS gradient cho thanh cường độ — vị trí mỗi chặng theo TỶ LỆ giá trị thật
    (khớp cách MapLibre nội suy tuyến tính), không chia đều giả tạo. */
export function legendGradientCss(kind: ForecastKind): string {
  const stops = legendStops(kind);
  if (stops.length === 0) return "var(--field)";
  const min = stops[0].value;
  const max = stops[stops.length - 1].value;
  const span = max - min || 1;
  const parts = stops.map(
    (s) => `${s.color} ${Math.round(((s.value - min) / span) * 100)}%`,
  );
  return `linear-gradient(90deg, ${parts.join(", ")})`;
}

/** Đơn vị hiển thị trên thanh cường độ — GIỮ đơn vị của app (không đổi sang
    knot như Windy): gió + dòng chảy km/h, sóng m. */
export function legendUnit(kind: ForecastKind): string {
  return kind === "wave" ? "m" : "km/h";
}
