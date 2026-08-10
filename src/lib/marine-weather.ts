// Trục 1 — gió/sóng tại MỘT ĐIỂM bất kỳ trên biển (chạm vào bản đồ ngư trường).
// Bổ trợ cho src/lib/sea.ts (dự báo theo cảng): dùng chung cách chấm điểm
// scoreDay/levelOf để cả trang nói một giọng — KHÔNG tự chế thang điểm riêng.
// Nguồn: Open-Meteo (miễn phí, không key) — đổi nguồn chỉ sửa fetchSeaPoint.

import {
  scoreDay,
  levelOf,
  estimateWaveFromWind,
  type ScoredSeaDay,
  type SeaDay,
  type SeaLevel,
} from "@/lib/sea";
import {
  saveForecast,
  loadForecast,
  coordId,
  isDefinitelyOffline,
} from "@/lib/forecast-cache";
import { forecastStoreReady } from "@/lib/forecast-store";
import {
  loadGridSnapshotClient,
  loadLongestSavedGrid,
  nearestGridCell,
  type ForecastGrid,
} from "@/lib/forecast-grid";
import { SNAPSHOT_DAY_SET } from "@/lib/weather-snapshot-id";
import { timeoutSignal } from "@/lib/abort";

export type SeaPoint = { lat: number; lon: number };

/**
 * Số này ở đâu ra — UI phải nói đúng, không gộp chung "đã lưu" một cục:
 *  · `live`        — vừa lấy về từ nguồn
 *  · `saved-point` — bản ĐẦY ĐỦ đã lưu của ĐÚNG chỗ này (có mưa/dông/điểm)
 *  · `saved-grid`  — dựng từ LƯỚI gió/sóng đã lưu (CHỈ có gió + sóng)
 */
export type SeaPointSource = "live" | "saved-point" | "saved-grid";

/**
 * Một ngày tại điểm chạm. Khác `ScoredSeaDay` ở chỗ score/level/mưa được phép
 * NULL: bản dựng từ lưới chỉ có gió + sóng, KHÔNG đủ để chấm "điểm đi biển".
 * Thà để trống còn hơn chấm điểm bằng dữ liệu thiếu rồi hiện như số thật.
 */
export type SeaPointDay = Omit<SeaDay, "precipMm"> & {
  /** null = nguồn không có số mưa cho chỗ này */
  precipMm: number | null;
  /** null = KHÔNG đủ dữ liệu để chấm điểm — UI phải ẩn phần điểm/tình trạng */
  score: number | null;
  level: SeaLevel | null;
  /** Dòng chảy đại diện GIỮA TRƯA của ngày (km/h) — nguồn SMOC chỉ tới ~10
      ngày, ngày xa hơn (và bản lưu đời cũ) là undefined/null → UI ẩn */
  curKmh?: number | null;
  /** hướng dòng CHẢY VỀ (0° = lên Bắc) — Open-Meteo ghi sẵn hướng đi của nước */
  curDirDeg?: number | null;
  /** hướng gió CHỦ ĐẠO cả ngày (0° = TỚI TỪ Bắc, quy ước khí tượng) — chỉ có ở
      bản LIVE điểm-chạm; bản dựng từ lưới / bản lưu đời cũ = undefined → UI ẩn */
  windDirDeg?: number | null;
};

export type SeaPointConditions = {
  point: SeaPoint;
  /** false = nguồn sóng không có số nào cho điểm này → gần như chắc là đất liền */
  onSea: boolean;
  /** Lúc này tại điểm đó — null khi bản dựng từ lưới (lưới chỉ có số theo giờ dự báo) */
  windKmh: number | null;
  gustKmh: number | null;
  windDirDeg: number | null;
  waveM: number | null;
  wavePeriodS: number | null;
  /** Dòng chảy LÚC NÀY (km/h) — null khi nguồn hỏng / bản dựng từ lưới /
      bản lưu đời cũ (trường optional để đọc được bản đã lưu trước đây) */
  curKmh?: number | null;
  /** hướng dòng CHẢY VỀ lúc này (0° = lên Bắc) */
  curDirDeg?: number | null;
  /** FORECAST_MAX_DAYS ngày, phần tử đầu là hôm nay (score/level có thể null) */
  days: SeaPointDay[];
  /** true = đang xem bản ĐÃ LƯU (offline/mất mạng), không phải bản mới */
  stale: boolean;
  /** epoch ms lúc bản này được lưu (chỉ có ý nghĩa khi stale) */
  savedAt: number | null;
  /** số này ở đâu ra — quyết định UI được nói gì, giấu gì */
  source: SeaPointSource;
};

/** Namespace localStorage cho dự báo điểm-chạm (offline) */
export const POINT_NS = "point";

/**
 * Tầm dự báo tối đa = TRẦN của nguồn: gió/mưa best-match (GFS 16 ngày) và SÓNG
 * từ NCEP GFS-Wave 0.25° (`WAVE_MODEL`) cũng phủ đủ 16 ngày. Best-match sóng chỉ
 * ~8 ngày nên phải chỉ định model. Ngày càng xa skill càng thấp — độ tin (bên
 * dưới) + ensemble spread nói thật, KHÔNG để mọi ngày trông chắc như nhau.
 * Đổi nguồn thì sửa số này + WAVE_MODEL tại đây, UI tự theo.
 */
export const FORECAST_MAX_DAYS = 16;
/** Model sóng phủ đủ 16 ngày (best-match chỉ ~8). */
const WAVE_MODEL = "ncep_gfswave025";

export type ForecastConfidence = {
  label: string;
  tone: "ok" | "warn";
};

/**
 * Độ tin của dự báo theo số ngày nhìn trước (0 = hôm nay) — nói thật với bà
 * con thay vì để mọi ngày trông chắc chắn như nhau. Mở tới 16 ngày.
 *
 * `dataConf` (0–1, tuỳ chọn) là độ tin ĐO ĐƯỢC từ dữ liệu — ensemble spread
 * (các thành viên mô hình lệch nhau nhiều = kém chắc) hoặc bảng skill backtest.
 * Có thì nó ưu tiên hạ nhãn xuống khi mô hình đang "cãi nhau", kể cả ngày gần.
 */
export function forecastConfidence(
  daysAhead: number,
  dataConf?: number | null,
): ForecastConfidence {
  // Nhãn nền theo tầm ngày (skill khí tượng giảm dần là quy luật, không cãi được)
  let base: ForecastConfidence;
  if (daysAhead <= 2) base = { label: "Dự báo gần — khá sát", tone: "ok" };
  else if (daysAhead <= 6)
    base = {
      label: "Dự báo 4–7 ngày — để tham khảo, gần ngày xem lại",
      tone: "warn",
    };
  else if (daysAhead <= 9)
    base = {
      label: "Dự báo xa 8–10 ngày — chỉ để liệu đường, sát ngày phải xem lại",
      tone: "warn",
    };
  else
    base = {
      label: "Dự báo rất xa 11–16 ngày — hướng chung thôi, chắc chắn xem lại",
      tone: "warn",
    };

  // Có tín hiệu đo được: mô hình lệch nhiều (conf thấp) thì kéo tone/nhãn xuống,
  // kể cả ngày gần — thời tiết đang khó đoán thì phải nói.
  if (dataConf != null && Number.isFinite(dataConf)) {
    if (dataConf < 0.4) {
      return {
        label: "Các mô hình đang lệch nhau — kém chắc, xem lại sát ngày",
        tone: "warn",
      };
    }
    if (dataConf >= 0.8 && base.tone === "warn" && daysAhead <= 6) {
      // các mô hình đồng thuận cao ở tầm vừa → bớt gắt hơn nhãn nền
      return { label: "Dự báo tham khảo — mô hình khá đồng thuận", tone: "ok" };
    }
  }
  return base;
}

/** km/h → cấp gió Beaufort (0–12), thang bà con quen nghe trên đài */
export function beaufort(kmh: number): number {
  const limits = [1, 5, 11, 19, 28, 38, 49, 61, 74, 88, 102, 117];
  for (let i = 0; i < limits.length; i++) {
    if (kmh < limits[i]) return i;
  }
  return 12;
}

/** Hướng gió 0–360° → tên hướng tiếng Việt (8 hướng) */
export function windDirectionVN(deg: number): string {
  const names = [
    "Bắc",
    "Đông Bắc",
    "Đông",
    "Đông Nam",
    "Nam",
    "Tây Nam",
    "Tây",
    "Tây Bắc",
  ];
  return names[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
}

/** Số kiểu Việt: 1.2 → "1,2" */
export function formatNumberVN(n: number, digits = 1): string {
  return n.toFixed(digits).replace(".", ",");
}

const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

/**
 * Gió + sóng cho một điểm chạm trên bản đồ. Sóng fail (điểm trên đất liền,
 * mạng chập chờn) không kéo sập cả dự báo — trả null, UI chạy bằng gió.
 */
export async function fetchSeaPoint(p: SeaPoint): Promise<SeaPointConditions> {
  const id = coordId(p.lat, p.lon);
  /* MẤT SÓNG HẲN → ĐỌC BẢN ĐÃ LƯU TRƯỚC (K3, 2026-08-02 — cùng khuôn `sea.ts`).
     Ba request Open-Meteo × 15 giây đồng hồ chặn, trong khi bản của ĐÚNG chỗ này
     đã nằm sẵn trong máy từ giây 0. Chỉ đi đường tắt khi máy KHẲNG ĐỊNH mất sóng
     (`isDefinitelyOffline`) — ca "sóng sống mà chết" vẫn đi đường thường, không
     mất bản mới. Không có bản nào thì rơi xuống đường cũ (fetch sẽ hỏng ngay). */
  /*  CHỜ KHO MỞ XONG RỒI MỚI ĐỌC (2026-08-02k — vá lỗi CHẶN).
      Đường tắt này chạy khi máy KHẲNG ĐỊNH mất sóng, tức đúng lúc giữa biển.
      Payload nay nằm ở IndexedDB (nạp bất đồng bộ lúc mở app), nên đọc trước khi
      nạp xong là trượt ⇒ rơi xuống nhánh mạng ⇒ offline thì nhánh đó hỏng TỨC
      THÌ (không có độ trễ mạng che cửa sổ đua) ⇒ màn hình báo "chưa có số nào
      lưu trong máy" trong khi kho còn nguyên. Chờ ở đây là hợp lệ: hàm đã async,
      và `forecastStoreReady()` có trần chờ nên không bao giờ treo. */
  await forecastStoreReady();
  if (isDefinitelyOffline()) {
    const saved = savedSeaPoint(p, id);
    if (saved) return saved;
  }
  try {
    const cond = await fetchSeaPointLive(p);
    // LƯU bản mới nhất để ra biển mất mạng vẫn coi được 16 ngày
    saveForecast(POINT_NS, id, cond);
    return cond;
  } catch (err) {
    // Mất mạng / nguồn treo → lùi về bản đã lưu ĐÚNG CHỖ NÀY (cùng ô lưới
    // ~0,25°). TUYỆT ĐỐI không mượn bản của chỗ khác: dán số của chỗ cách hàng
    // trăm km vào chỗ bà con vừa chạm còn nguy hiểm hơn là không có số.
    const saved = savedSeaPoint(p, id);
    if (saved) return saved;
    // NẤC CUỐI (2026-07-29, ảnh user bản web iOS "chưa có số nào lưu trong
    // máy"): máy TRỐNG TRƠN (bản web Safari mở lần đầu — kho localStorage TÁCH
    // RIÊNG với PWA đã cài) + live lỗi/429 → còn lưới SNAPSHOT server cron
    // (same-origin, không đụng quota Open-Meteo theo IP). Khung dài nhất
    // trước; khung premium bị route chặn với tài khoản thường → tự rơi về d3.
    // Vẫn là số ĐÚNG Ô phủ chỗ chạm — seaPointFromGrid tự chặn ô xa.
    for (const d of [...SNAPSHOT_DAY_SET].sort((a, b) => b - a)) {
      const snap = await loadGridSnapshotClient(d);
      const cond = snap ? seaPointFromGrid(snap, p, null) : null;
      if (cond) return cond;
    }
    throw err; // ngoài vùng lưới / máy chưa lưu gì → UI nói thật là chưa có số
  }
}

/**
 * BẢN ĐÃ LƯU CHO ĐÚNG CHỖ NÀY — dùng chung cho hai đường (mất sóng hẳn: đọc
 * TRƯỚC khi gọi mạng · live hỏng: lùi về SAU khi gọi). Một hàm cho cả hai để
 * hai đường không bao giờ trả khác nhau.
 *
 * Thứ tự: bản của CHÍNH toạ độ đó → ô lưới PHỦ chỗ chạm (vẫn là số của chỗ đó,
 * không phải mượn của toạ độ khác). null = máy chưa có gì để nói.
 */
function savedSeaPoint(p: SeaPoint, id: string): SeaPointConditions | null {
  const hit = loadForecast<SeaPointConditions>(POINT_NS, id);
  if (hit)
    return {
      ...hit.data,
      point: p,
      stale: true,
      savedAt: hit.savedAt,
      source: "saved-point",
    };
  // Chưa từng mở xem chỗ này, NHƯNG lưới gió/sóng đã lưu phủ cả vùng biển và
  // ĐÚNG vị trí đó (mũi tên đang vẽ ngay chỗ bà con vừa chạm).
  return seaPointFromSavedGrid(p);
}

/* ---------------------------------------------------------------------------
   DỰNG ĐIỀU KIỆN ĐIỂM TỪ LƯỚI ĐÃ LƯU — chỉ gió + sóng, không bịa thêm gì
--------------------------------------------------------------------------- */

/** Đọc lưới dài ngày nhất trong máy rồi dựng — null nếu không dùng được. */
export function seaPointFromSavedGrid(p: SeaPoint): SeaPointConditions | null {
  const saved = loadLongestSavedGrid();
  if (!saved) return null;
  return seaPointFromGrid(saved.grid, p, saved.savedAt);
}

/**
 * Lưới đã lưu → điều kiện tại MỘT ĐIỂM. Thuần (không đụng mạng/localStorage).
 *
 * Luật:
 *  · lấy ô lưới PHỦ chỗ chạm (`nearestGridCell`); xa hơn nửa bước lưới → null,
 *    giữ nguyên câu "chưa có số nào lưu trong máy" chứ KHÔNG nhận bừa ô xa;
 *  · gộp các mốc giờ theo NGÀY (mốc giờ của lưới đã là giờ VN) → mỗi ngày lấy
 *    GIÓ LỚN NHẤT và SÓNG CAO NHẤT, đúng như thẻ ngày đang mô tả ("gió tới…",
 *    "sóng tới…");
 *  · KHÔNG có mưa, dông, điểm đi biển → để null, UI phải ẩn.
 */
export function seaPointFromGrid(
  grid: ForecastGrid,
  p: SeaPoint,
  savedAt: number | null,
): SeaPointConditions | null {
  const near = nearestGridCell(grid, p.lat, p.lon);
  if (!near) return null;

  const times = grid.times ?? [];
  // gộp theo ngày — "2026-07-27T06:00" đã là giờ VN (nguồn xin theo Asia/Ho_Chi_Minh)
  const byDate = new Map<
    string,
    {
      wind: number | null;
      wave: number | null;
      // dòng chảy lấy MỐC GẦN GIỮA TRƯA nhất (không lấy max — hướng phải đi
      // cặp với tốc độ của CÙNG một mốc giờ)
      cur: { kmh: number; dir: number | null; distTo12: number } | null;
    }
  >();
  const order: string[] = [];
  for (let i = 0; i < times.length; i++) {
    const t = String(times[i] ?? "");
    const date = t.slice(0, 10);
    if (date.length !== 10) continue;
    const h = near.cell.hours?.[i];
    if (!h) continue;
    let acc = byDate.get(date);
    if (!acc) {
      acc = { wind: null, wave: null, cur: null };
      byDate.set(date, acc);
      order.push(date);
    }
    const w = num(h.windKmh);
    const s = num(h.waveM);
    if (w != null) acc.wind = acc.wind == null ? w : Math.max(acc.wind, w);
    if (s != null) acc.wave = acc.wave == null ? s : Math.max(acc.wave, s);
    const ck = num(h.curKmh);
    const hour = Number(t.slice(11, 13));
    if (ck != null && Number.isFinite(hour)) {
      const distTo12 = Math.abs(hour - 12);
      if (!acc.cur || distTo12 < acc.cur.distTo12)
        acc.cur = { kmh: ck, dir: num(h.curDirDeg), distTo12 };
    }
  }

  const days: SeaPointDay[] = [];
  for (const date of order) {
    const acc = byDate.get(date)!;
    if (acc.wind == null && acc.wave == null) continue; // ngày trống thì bỏ hẳn
    days.push({
      date,
      // 0 = "chưa có số" theo đúng cách UI vẫn hiểu (không phải "biển lặng")
      waveMaxM: acc.wave ?? 0,
      windMaxKmh: acc.wind ?? 0,
      gustMaxKmh: 0, // lưới không có gió giật → UI ẩn (chỉ hiện khi > 0)
      precipMm: null, // KHÔNG có mưa trong lưới — để trống, không điền 0 giả
      wmoCode: null, // KHÔNG có dông
      waveEstimated: false,
      score: null, // thiếu mưa/dông thì KHÔNG chấm điểm đi biển
      level: null,
      curKmh: acc.cur?.kmh ?? null,
      curDirDeg: acc.cur?.dir ?? null,
    });
  }
  if (days.length === 0) return null;

  // Ô không có số sóng nào suốt cả kỳ = gần như chắc điểm lưới nằm trên đất liền
  const onSea = days.some((d) => d.waveMaxM > 0);

  return {
    point: p,
    onSea,
    // Lưới chỉ có số THEO GIỜ DỰ BÁO, không có số đo "lúc này" → để trống hết
    windKmh: null,
    gustKmh: null,
    windDirDeg: null,
    waveM: null,
    wavePeriodS: null,
    curKmh: null,
    curDirDeg: null,
    days,
    stale: true,
    savedAt,
    source: "saved-grid",
  };
}

/**
 * Dòng chảy ĐẠI DIỆN theo ngày từ chuỗi GIỜ: lấy mốc GIỮA TRƯA (12h, gần nhất
 * có số) — dòng chảy đổi chậm trong ngày, một số đại diện đủ để bà con liệu
 * hướng thả trôi/kéo lưới. Thuần, test được. Ngày nguồn không phủ (SMOC ~10
 * ngày) → không có entry.
 */
export function dailyCurrentFromHourly(
  times: string[],
  vel: unknown[],
  dir: unknown[],
): Map<string, { curKmh: number; curDirDeg: number | null }> {
  const best = new Map<
    string,
    { curKmh: number; curDirDeg: number | null; distTo12: number }
  >();
  for (let i = 0; i < times.length; i++) {
    const t = String(times[i] ?? "");
    const date = t.slice(0, 10);
    const hour = Number(t.slice(11, 13));
    const v = num(vel?.[i]);
    if (date.length !== 10 || !Number.isFinite(hour) || v == null) continue;
    const d = Math.abs(hour - 12);
    const cur = best.get(date);
    if (!cur || d < cur.distTo12) {
      best.set(date, { curKmh: v, curDirDeg: num(dir?.[i]), distTo12: d });
    }
  }
  const out = new Map<string, { curKmh: number; curDirDeg: number | null }>();
  for (const [date, b] of best)
    out.set(date, { curKmh: b.curKmh, curDirDeg: b.curDirDeg });
  return out;
}

/** Gọi Open-Meteo THẬT (không cache) — tách ra để fetchSeaPoint bọc offline. */
async function fetchSeaPointLive(p: SeaPoint): Promise<SeaPointConditions> {
  const common = `latitude=${p.lat}&longitude=${p.lon}&timezone=Asia%2FHo_Chi_Minh&forecast_days=${FORECAST_MAX_DAYS}`;
  const windUrl =
    `https://api.open-meteo.com/v1/forecast?${common}` +
    `&current=wind_speed_10m,wind_gusts_10m,wind_direction_10m` +
    `&daily=wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant,precipitation_sum,weather_code`;
  const waveUrl =
    `https://marine-api.open-meteo.com/v1/marine?${common}` +
    `&current=wave_height,wave_period&daily=wave_height_max&models=${WAVE_MODEL}`;
  // DÒNG CHẢY = request riêng (SMOC best_match): ghim models sóng thì
  // ocean_current_* trả toàn null (probe 2026-07-29). Hỏng không kéo sập dự báo.
  const curUrl =
    `https://marine-api.open-meteo.com/v1/marine?${common}` +
    `&current=ocean_current_velocity,ocean_current_direction` +
    `&hourly=ocean_current_velocity,ocean_current_direction`;

  const [wind, wave, cur] = await Promise.all([
    fetch(windUrl, { signal: timeoutSignal(15000) }).then((r) => {
      if (!r.ok) throw new Error(`wind ${r.status}`);
      return r.json();
    }),
    fetch(waveUrl, { signal: timeoutSignal(15000) })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null),
    fetch(curUrl, { signal: timeoutSignal(15000) })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null),
  ]);

  const dayCur = dailyCurrentFromHourly(
    cur?.hourly?.time ?? [],
    cur?.hourly?.ocean_current_velocity ?? [],
    cur?.hourly?.ocean_current_direction ?? [],
  );

  const days: (ScoredSeaDay &
    Pick<SeaPointDay, "curKmh" | "curDirDeg" | "windDirDeg">)[] = (
    wind.daily?.time ?? []
  ).map((date: string, i: number) => {
      const windMaxKmh = num(wind.daily?.wind_speed_10m_max?.[i]) ?? 0;
      const rawWave = num(wave?.daily?.wave_height_max?.[i]);
      const waveMissing = rawWave == null;
      const d = {
        date,
        waveMaxM: waveMissing ? estimateWaveFromWind(windMaxKmh) : rawWave,
        windMaxKmh,
        gustMaxKmh: num(wind.daily?.wind_gusts_10m_max?.[i]) ?? 0,
        precipMm: num(wind.daily?.precipitation_sum?.[i]) ?? 0,
        wmoCode: num(wind.daily?.weather_code?.[i]),
        waveEstimated: waveMissing,
      };
      const score = scoreDay(d);
      const dc = dayCur.get(date);
      return {
        ...d,
        score,
        level: levelOf(score),
        curKmh: dc?.curKmh ?? null,
        curDirDeg: dc?.curDirDeg ?? null,
        windDirDeg: num(wind.daily?.wind_direction_10m_dominant?.[i]) ?? null,
      };
    },
  );
  if (days.length === 0) throw new Error("Dự báo trống");

  const waveDaily: unknown[] = wave?.daily?.wave_height_max ?? [];
  const onSea =
    num(wave?.current?.wave_height) != null ||
    waveDaily.some((v) => num(v) != null);

  return {
    point: p,
    onSea,
    windKmh: num(wind.current?.wind_speed_10m) ?? 0,
    gustKmh: num(wind.current?.wind_gusts_10m),
    windDirDeg: num(wind.current?.wind_direction_10m),
    waveM: num(wave?.current?.wave_height),
    wavePeriodS: num(wave?.current?.wave_period),
    curKmh: num(cur?.current?.ocean_current_velocity),
    curDirDeg: num(cur?.current?.ocean_current_direction),
    days,
    stale: false,
    savedAt: null,
    source: "live",
  };
}
