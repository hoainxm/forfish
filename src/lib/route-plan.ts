// Trục 1 — dẫn đường tiết kiệm dầu. THUẦN LOGIC (test được, không fetch).
//
// Thuật toán theo các nghiên cứu đã công bố (chi tiết + nguồn:
// docs/research/06-weather-routing.md):
//   · VISIR-1/2 (Mannarini et al., Geosci. Model Dev. 2016, 2024 — mô hình
//     mã nguồn mở cho TÀU NHỎ kể cả tàu cá): đồ thị lưới phủ cả vùng biển,
//     tìm đường time-dependent, ràng buộc TĨNH (độ sâu, bờ) + ĐỘNG (an toàn
//     theo sóng). QUAN TRỌNG (audit 2026-06-10): VISIR coi an toàn là RÀNG
//     BUỘC CỨNG và tối ưu nhiên liệu THUẦN trong tập tuyến khả thi — tuyến
//     tối ưu của họ chỉ dài hơn chim bay ~3%, hiếm khi quá 10%. KHÔNG trộn
//     "độ sợ" vào chi phí bằng nhân tử lớn (bản cũ ×3 cho phép vòng tới
//     ~6,8× quãng đường để né sóng 2,5 m → ra tuyến 400 km cho chuyến
//     100 km — vô nghĩa với ngư dân).
//   · Giảm tốc trong sóng CÓ HƯỚNG theo hệ số Kwon/Townsin–Kwon 4 bậc góc
//     (mũi 1,0 / chếch mũi 0,8 / ngang 0,45 / đuôi 0,15 — sóng đuôi đẩy
//     tàu đi, ít cản).
//   · Ngưỡng an toàn đối chiếu thang gió–sóng KTTV VN (QĐ 18/2021):
//     cấp 6 / sóng 2–3 m = "cẩn thận" (phạt nhẹ 1,15) · cấp 7 / 3–4 m =
//     "không nên đi" (phạt 1,5 + cảnh báo đỏ) · cấp 8 / ≥4 m = chặn cứng.
//   · Sóng đuôi ≥2 m chu kỳ ngắn (<6 s): nguy cơ trượt sóng/broaching
//     (IMO MSC.1/Circ.1228) — phạt nhẹ + CẢNH BÁO; cách xử lý đúng là giảm
//     ga/đổi hướng tại chỗ, không phải vòng tuyến cả trăm km.
//   · TRẦN ĐƯỜNG VÒNG (bounded detour): tuyến dài hơn chim bay quá 30%
//     trong khi đường thẳng vẫn đi được vật lý → trả ĐƯỜNG THẲNG + cảnh báo
//     thật, để thuyền trưởng tự quyết — không bán đường vòng vô lý.
//
// Tìm đường: Dijkstra trên lưới ≤ ~7500 nút, trọng số đổi theo giờ dự báo
// (xấp xỉ time-dependent — nhãn là chi phí, giờ đi ké nhãn rẻ nhất; đủ tốt
// cho dự báo nội suy giờ, không tuyên bố "đúng nghiệm" tuyệt đối).
// Chi phí cạnh = lít dầu ước tính: máy ga cố định → dầu/giờ ≈ hằng số,
// sóng làm tàu CHẬM nên cùng quãng đường tốn nhiều giờ máy hơn; ngược gió
// cũng LÀM CHẬM (cùng tiền đề ga cố định — không đội lít/giờ); dòng chảy
// cộng vector vào tốc độ (VISIR-2).
// Team review 2026-07-26 (5 lăng kính + verify chéo) chốt thêm 3 bất biến:
//   · Thời tiết lấy mẫu DỌC CHẶNG mỗi ≤ WEATHER_SAMPLE_KM (như độ sâu) —
//     chặn cứng/cờ cảnh báo không được lọt khe giữa hai mẫu của chặng dài.
//   · Kéo căng dây (string-pulling) phải KIỂM CHI PHÍ — chord không được
//     đắt hơn các cạnh nó thay, kẻo cắt thẳng lại vào vùng Dijkstra vừa né.
//   · Chạy quá cửa sổ dự báo → beyondForecastH > 0, UI phải nói thật phần
//     đuôi tuyến tính bằng dự báo giờ cuối (không được "êm giả").
// Mô hình là ƯỚC LƯỢNG THAM KHẢO — UI luôn dặn dò hải đồ + nghe đài.
//
// ## Assumptions (Đợt 2, 2026-09-04 — nối kho hải đồ vào chặn cứng)
// - Chỉ CHẶN thứ đâm vào là hỏng tàu: vật chìm/xác tàu/chướng ngại, giàn khoan,
//   phao hiểm hoạ cô lập, lồng bè, vùng CẤM VÀO. Cáp/ống, khu cấm neo, luồng,
//   ranh giới VMS, triều KHÔNG chặn — chúng sinh CÂU ở `route-hazards`, không
//   sinh đường vòng (quyết định thiết kế §1.6).
// - VÙNG CẤM VÀO đi HAI ĐƯỜNG theo cỡ (sửa 2026-09-04, review đợt 4):
//   · Vùng có đường chéo hộp bao ≤ DEPTH_SAMPLE_KM → CHỈ MỤC VẬT ĐIỂM, tâm là
//     tâm hộp bao, `rKm` = bán kính ngoại tiếp + NO_GO_PAD_KM. `maskWithinSegment`
//     đo điểm→đoạn nên không có khe, và đệm 500 m ở đây là đệm THẬT.
//   · Vùng lớn hơn giữ điểm-trong-đa-giác tại mẫu 2 km; ở nhánh này đệm 500 m
//     chỉ nới HỘP LỌC, không nới phép quyết định. Đo khoảng cách tới từng cạnh
//     trong vòng nóng Dijkstra là trả tiền ở chỗ chạy 120.000 lượt cho một dải
//     500 m mà `auditRoute` đã gọi tên bằng câu đỏ "chạy sát khu cấm vào" trên
//     chính tuyến trả về.
//   nợ: dải cấm hẹp-mà-dài (300 m × 30 km) vẫn lọt khe mẫu 2 km, nâng cấp bằng
//   `buildSegmentIndex` trên CẠNH vùng + đo đoạn→đoạn ≤ NO_GO_PAD_KM ngay khi
//   kho có một hình như vậy (hôm nay không có: đa giác cấm-vào duy nhất trong
//   `vn-sea-lanes.v1.json` rộng 0,2 × 0,2 km).
// - "Sát cảng" xét theo VỊ TRÍ CỦA VẬT, không theo chặng: vòng chặn với tới
//   trong `VICINITY_LAND_KM` quanh nơi xuất phát/điểm đến thì chỉ cắm cờ. Xét
//   theo chặng thì chặng đầu (4–9 km, chord tới 30 km) không bao giờ nằm trọn
//   trong 5 km ⇒ lồng bè cách bến 2 km chặn luôn lối ra bến.
// - Vùng cấm-vào CHỨA nơi xuất phát/điểm đến cũng chỉ cắm cờ, cùng lý lẽ.

import { depthClassAt, type DepthGrid } from "@/lib/depth-grid";
import {
  NO_GO_PAD_KM,
  requiredDepthM,
  type HazardPacked,
  type NoGoZone,
} from "@/lib/hazards";
import { estimateWaveFromWind } from "@/lib/sea";
import {
  buildIndex,
  maskWithinSegment,
  pointInRing,
  type SpatialIndex,
} from "@/lib/spatial-index";

/*  `LatLon` + `haversineKm` sống ở module lá `geo.ts` (gỡ chu trình import với
    spatial-index — review đợt 4 G3); re-export để mọi chỗ gọi cũ giữ nguyên. */
import { haversineKm, type LatLon } from "@/lib/geo";
export type { LatLon } from "@/lib/geo";
export { haversineKm } from "@/lib/geo";

export type BoatProfile = {
  /** tốc độ lúc trời êm, hải lý/giờ */
  speedKn: number;
  /** máy ăn dầu, lít/giờ */
  litersPerHour: number;
  /*  MỚN NƯỚC (2026-09-02) — "làm mớn" là một món trong danh sách bán hàng của
      máy hải đồ 5 triệu, và là đầu vào của `tideDraftWarning` (lib/tides): độ
      sâu hải đồ + con nước ròng + mớn tàu = câu "chờ nước lên hãy qua".

      `null` = chủ tàu CHƯA khai — mọi cảnh báo mớn phải IM, không được đoán
      một mớn "trung bình" rồi doạ sai người (tàu thúng 0,3 m và tàu vỏ thép
      3 m cùng dùng app này). Vắng số không phải là số. */
  draftM?: number | null;
};

export const DEFAULT_BOAT: BoatProfile = { speedKn: 7, litersPerHour: 20, draftM: null };
export const KMH_PER_KNOT = 1.852;

// ── hình học ─────────────────────────────────────────────────────────────

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** Hướng chạy từ a tới b, 0–360° (0 = Bắc, 90 = Đông) */
export function bearingDeg(a: LatLon, b: LatLon): number {
  const dLon = rad(b.lon - a.lon);
  const y = Math.sin(dLon) * Math.cos(rad(b.lat));
  const x =
    Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) -
    Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(dLon);
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

export function kmToNm(km: number): number {
  return km / KMH_PER_KNOT;
}

/** Góc lệch a−b chuẩn hoá về [−180, 180] */
export function angleDiffDeg(a: number, b: number): number {
  return ((a - b + 540) % 360) - 180;
}

const lerp = (a: LatLon, b: LatLon, t: number): LatLon => ({
  lat: a.lat + (b.lat - a.lat) * t,
  lon: a.lon + (b.lon - a.lon) * t,
});

// ── vùng tính toán ───────────────────────────────────────────────────────

export type BBox = {
  latMin: number;
  latMax: number;
  lonMin: number;
  lonMax: number;
};

/**
 * Khung chữ nhật bao TRỌN một chuỗi điểm, nở thêm marginKm mỗi phía. Đường đi
 * nhiều điểm (start → ghé 1 → ghé 2 → …) cần MỘT khung phủ cả chuỗi để chỉ
 * phải hỏi dự báo một lần cho cả tuyến — mất sóng giữa biển thì mỗi lượt gọi
 * mạng là một lượt có thể treo.
 */
export function bboxOfPoints(points: LatLon[], marginKm: number): BBox {
  const lats = points.map((p) => p.lat);
  const lons = points.map((p) => p.lon);
  const latMin = Math.min(...lats);
  const latMax = Math.max(...lats);
  const midLat = (latMin + latMax) / 2;
  const dLat = marginKm / 111.32;
  const dLon = marginKm / (111.32 * Math.cos(rad(midLat)));
  return {
    latMin: latMin - dLat,
    latMax: latMax + dLat,
    lonMin: Math.min(...lons) - dLon,
    lonMax: Math.max(...lons) + dLon,
  };
}

/** Khung chữ nhật quanh start–dest nở thêm marginKm mỗi phía */
export function bboxFor(start: LatLon, dest: LatLon, marginKm: number): BBox {
  return bboxOfPoints([start, dest], marginKm);
}

// ── trường thời tiết: lưới thô + nội suy song tuyến ─────────────────────

/** Dự báo một giờ tại một ô thời tiết */
export type HourSample = {
  waveM: number | null;
  /** hướng sóng TỚI TỪ, độ — null khi nguồn không có */
  waveFromDeg: number | null;
  /** chu kỳ sóng, giây — phân biệt sóng gió ngắn với swell dài */
  wavePeriodS: number | null;
  windKmh: number;
  /** hướng gió THỔI TỪ, độ */
  windFromDeg: number;
  /** dòng chảy mặt biển, km/h (0 khi nguồn không có) */
  currentKmh: number;
  /** hướng dòng CHẢY TỚI, độ — QUY ƯỚC NGƯỢC với gió/sóng (chuẩn hải dương) */
  currentToDeg: number | null;
};

export type WeatherCellSeries = {
  /** false = nguồn sóng không có số nào → ô trên đất liền */
  onSea: boolean;
  hours: HourSample[];
};

/** Lưới thời tiết thô phủ bbox — nội suy xuống lưới tìm đường mịn hơn */
export type WeatherField = {
  lat0: number;
  lon0: number;
  dLat: number;
  dLon: number;
  nLat: number;
  nLon: number;
  /** row-major i*nLon+j, i theo vĩ độ tăng dần */
  cells: WeatherCellSeries[];
  /**
   * Nguồn lưới: 'live' = Open-Meteo mới (mặc định, undefined) · 'grid' = dựng
   * từ lưới Windy ĐÃ LƯU trong máy lúc mất sóng (route-weather.offlineFieldFromGrid).
   * Bản 'grid' THÔ hơn (~2° thay vì ~0,35°) và KHÔNG có dòng chảy/chu kỳ sóng —
   * UI phải nói thật (memory: "dữ liệu cũ đội lốt mới" là lỗi nặng nhất).
   */
  source?: "live" | "grid";
  /** epoch ms lúc lưới offline được lưu — chỉ có nghĩa khi source='grid' */
  savedAt?: number | null;
};

const EMPTY_HOUR: HourSample = {
  waveM: null,
  waveFromDeg: null,
  wavePeriodS: null,
  windKmh: 0,
  windFromDeg: 0,
  currentKmh: 0,
  currentToDeg: null,
};

function hourAt(c: WeatherCellSeries, hourIdx: number): HourSample {
  const idx = Math.max(0, Math.min(Math.round(hourIdx), c.hours.length - 1));
  return c.hours[idx] ?? EMPTY_HOUR;
}

/**
 * Nội suy song tuyến giữa 4 ô góc, bỏ ô đất liền khỏi phép nội suy (trọng số
 * chuẩn hoá lại theo ô biển). Hướng gió/sóng nội suy theo vector đơn vị;
 * DÒNG CHẢY nội suy theo vector u/v đầy đủ (hai ô chảy ngược nhau → giữa
 * gần đứng nước). Trả null khi cả 4 góc là đất/ngoài lưới.
 */
export function sampleField(
  f: WeatherField,
  lat: number,
  lon: number,
  hourIdx: number,
): HourSample | null {
  const x = (lon - f.lon0) / f.dLon;
  const y = (lat - f.lat0) / f.dLat;
  const j0 = Math.floor(x);
  const i0 = Math.floor(y);
  let wSum = 0;
  let wave = 0;
  let waveW = 0; // sóng có thể null riêng từng ô
  let period = 0;
  let periodW = 0;
  let wind = 0;
  let wvSin = 0,
    wvCos = 0,
    wdSin = 0,
    wdCos = 0;
  let curU = 0,
    curV = 0;
  for (const [di, dj] of [
    [0, 0],
    [0, 1],
    [1, 0],
    [1, 1],
  ]) {
    const i = i0 + di;
    const j = j0 + dj;
    if (i < 0 || i >= f.nLat || j < 0 || j >= f.nLon) continue;
    const cell = f.cells[i * f.nLon + j];
    if (!cell?.onSea) continue;
    const w =
      (di === 0 ? 1 - (y - i0) : y - i0) * (dj === 0 ? 1 - (x - j0) : x - j0);
    if (w <= 0) continue;
    const h = hourAt(cell, hourIdx);
    wSum += w;
    wind += w * h.windKmh;
    wdSin += w * Math.sin(rad(h.windFromDeg));
    wdCos += w * Math.cos(rad(h.windFromDeg));
    if (h.currentToDeg != null) {
      curU += w * h.currentKmh * Math.sin(rad(h.currentToDeg));
      curV += w * h.currentKmh * Math.cos(rad(h.currentToDeg));
    }
    if (h.waveM != null) {
      wave += w * h.waveM;
      waveW += w;
      if (h.waveFromDeg != null) {
        wvSin += w * Math.sin(rad(h.waveFromDeg));
        wvCos += w * Math.cos(rad(h.waveFromDeg));
      }
      if (h.wavePeriodS != null) {
        period += w * h.wavePeriodS;
        periodW += w;
      }
    }
  }
  if (wSum <= 0) return null;
  const curKmh = Math.hypot(curU, curV) / wSum;
  return {
    waveM: waveW > 0 ? wave / waveW : null,
    waveFromDeg:
      waveW > 0 && (wvSin !== 0 || wvCos !== 0)
        ? (deg(Math.atan2(wvSin, wvCos)) + 360) % 360
        : null,
    wavePeriodS: periodW > 0 ? period / periodW : null,
    windKmh: wind / wSum,
    windFromDeg: (deg(Math.atan2(wdSin, wdCos)) + 360) % 360,
    currentKmh: curKmh,
    currentToDeg:
      curKmh > 0.01 ? (deg(Math.atan2(curU, curV)) + 360) % 360 : null,
  };
}

// ── mô hình tàu trong sóng gió (Kwon) ────────────────────────────────────

/**
 * Hệ số hướng sóng so với hướng chạy — 4 bậc góc theo Kwon/Townsin–Kwon:
 * sóng mũi cản nặng nhất, sóng đuôi gần như đẩy tàu đi (audit 2026-06-10:
 * bản cũ cho sóng đuôi 0,4 là cao gấp ~2,5 lần văn liệu → phạt oan tuyến
 * xuôi sóng). Không có hướng sóng → coi như sóng mũi (ước tính tốn hơn).
 */
export function waveDirFactor(
  waveFromDeg: number | null,
  headingDeg: number,
): number {
  if (waveFromDeg == null) return 1;
  const d = Math.abs(angleDiffDeg(waveFromDeg, headingDeg));
  if (d <= 30) return 1; // sóng mũi
  if (d <= 60) return 0.8; // chếch mũi
  if (d <= 150) return 0.45; // sóng ngang
  return 0.15; // sóng đuôi
}

/** Tàu chậm đi bao nhiêu trong sóng: ~10%/m trên 0,5 m × hệ số hướng, sàn 55% */
export function speedFactor(waveM: number, dirFactor: number): number {
  return Math.max(0.55, 1 - 0.1 * dirFactor * Math.max(0, waveM - 0.5));
}

/**
 * Sức cản gió theo hướng chạy: ngược gió chậm đi tới ~20% (1/1,25), xuôi gió
 * nhanh thêm ~9% (1/0,92). Áp vào TỐC ĐỘ (chia stw cho 1+hệ số) — ga cố định
 * thì dầu/giờ hằng số, gió xấu quy thành thêm giờ máy (đúng tiền đề header;
 * bản cũ đội lít/giờ nên ETA bỏ qua gió — team review 2026-07-26).
 */
export function windDragFactor(
  windKmh: number,
  windFromDeg: number,
  headingDeg: number,
): number {
  const headwindKmh = windKmh * Math.cos(rad(windFromDeg - headingDeg));
  return Math.min(0.25, Math.max(-0.08, headwindKmh * 0.004));
}

/** Thành phần dòng chảy DỌC hướng chạy (>0 = nước đẩy đi) */
export function currentAlongKmh(
  h: Pick<HourSample, "currentKmh" | "currentToDeg">,
  headingDeg: number,
): number {
  if (h.currentToDeg == null) return 0;
  return h.currentKmh * Math.cos(rad(h.currentToDeg - headingDeg));
}

/** Thành phần dòng chảy NGANG hướng chạy (phải vát mũi bù) */
export function currentCrossKmh(
  h: Pick<HourSample, "currentKmh" | "currentToDeg">,
  headingDeg: number,
): number {
  if (h.currentToDeg == null) return 0;
  return h.currentKmh * Math.sin(rad(h.currentToDeg - headingDeg));
}

/**
 * Sóng đuôi ±45°, cao ≥2 m, CHU KỲ NGẮN (<6 s — sóng gió; swell dài tàu
 * cưỡi êm) — nguy cơ trượt sóng/broaching theo IMO MSC.1/Circ.1228 với tàu
 * chạy ~7 hải lý (đúng dải tốc độ tới hạn 1,8√L của tàu 15 m). Xử lý đúng
 * là GIẢM GA/đổi hướng tại chỗ → chỉ phạt nhẹ + cảnh báo, không vòng tuyến.
 */
export function followingSeaRisk(
  waveM: number,
  waveFromDeg: number | null,
  headingDeg: number,
  wavePeriodS: number | null,
): boolean {
  if (waveFromDeg == null || waveM < 2) return false;
  if (wavePeriodS != null && wavePeriodS >= 6) return false;
  return Math.abs(angleDiffDeg(waveFromDeg, headingDeg)) > 135;
}

// ── ngưỡng an toàn (thang KTTV VN, QĐ 18/2021) ──────────────────────────

/** ≥ cấp 8 / sóng ≥4 m: chặn cứng — không vẽ tuyến qua */
export const HARD_WAVE_M = 4;
export const HARD_WIND_KMH = 62;
/** cấp 7 / sóng 3–4 m: "không nên đi" — phạt 1,5 + cảnh báo đỏ */
export const DANGER_WAVE_M = 3;
export const DANGER_WIND_KMH = 50;
/** cấp 6 / sóng 2–3 m: "cẩn thận" — mùa gió Tây Nam đi thường xuyên */
export const CAUTION_WAVE_M = 2;
export const CAUTION_WIND_KMH = 39;

// Penalty nhỏ — chỉ để chọn giữa các tuyến gần bằng nhau. Penalty P cho
// phép vòng tối đa (P−1)×100% quãng đường: 1,15 = "đáng vòng ≤15% để né
// sóng cấp cẩn thận"; 1,5 = "đáng vòng ≤50% để né mức không-nên-đi".
const PEN_CAUTION = 1.15;
const PEN_DANGER = 1.5;
const PEN_BROACH = 1.2;
const SHALLOW_PENALTY = 1.15; // nước nông 4–12 m: đi được nhưng ưu tiên né

/*  PHẠT CỰC NẶNG cho đoạn ≥ ngưỡng CỨNG (sóng ≥4 m / gió ≥ cấp 8) — CHỈ dùng ở
    chế độ BEST-EFFORT (`seaAsPenalty`, xem `planRoute`): khi biển động tới mức
    KHÔNG còn đường "sạch" nào, thay vì bỏ hẳn (trả null), ta hạ chặn-cứng-sóng
    xuống thành phạt để VẪN ra được "đường ít dữ nhất". Đặt cao (×6) để Dijkstra
    chỉ dẫm vào ô ≥4 m khi thật sự không tránh được, và luôn chọn đường qua ít
    ô như vậy nhất / ô nhẹ hơn. KHÔNG áp cho đất/cạn/vật chặn/vùng cấm/bão — mấy
    thứ đó vẫn chặn cứng tuyệt đối (đâm vào là hỏng tàu, không phải "liều thì đi
    được"). */
const PEN_IMPASSABLE_SEA = 6;

/**
 * TRẦN ĐƯỜNG VÒNG: đường thẳng vẫn đi được vật lý mà tuyến tối ưu dài hơn
 * chim bay quá mức này → trả đường thẳng + cảnh báo (VISIR ghi nhận tuyến
 * tối ưu điển hình chỉ dài hơn ~3%, hiếm khi quá 10%).
 */
export const MAX_DETOUR_RATIO = 1.3;

/** Quanh nơi xuất phát/điểm đến: nới chặn cạn (cảng sát bờ; tàu thuộc con nước nhà) */
const VICINITY_SHALLOW_KM = 12;
/** Nới chặn Ô ĐẤT chỉ trong bán kính nhỏ hơn — không cho tuyến cắt doi đất */
const VICINITY_LAND_KM = 5;

/*  MỚN NƯỚC VÀO LUẬT ĐỘ SÂU (Đợt 0, 2026-09-04 — quyết định thiết kế §1.9).
    Lưới 6 lớp (depth-grid.ts): 0 đất · 1 mặt nạ rạn · 2 nước <2 m · 3 nước
    2–4 m · 4 nước 4–12 m · 5 đủ sâu. Lớp 3 là dải mới: bãi bùn vịnh Thái Lan,
    cửa lạch Đông Nam — tàu mớn 1–2 m làm nghề ở đó hằng ngày, còn tàu vỏ thép
    mớn 3 m thì không. Nên lớp 3 CHỈ mở cho tàu ĐÃ KHAI MỚN và cần
    (`requiredDepthM`) ≤ DRAFT_SHALLOW_MAX_NEED_M; chưa khai thì giữ chặn như
    lớp 1–2 (luật 6 brief-01: vắng số không phải là số — không đoán mớn
    "trung bình" rồi vẽ tuyến qua bãi cho tàu thúng lẫn tàu sắt).
    Trần 2,0 m = đáy dải (2 m) trừ ròng ~0,5 m vịnh Thái Lan cộng lại với phần
    dự trữ đã nằm trong `requiredDepthM`. */
const DRAFT_SHALLOW_MAX_NEED_M = 2.0;

/*  NƯỚC CẦN DƯỚI ĐÁY TÀU — MỘT BẢN DUY NHẤT, ở `lib/hazards.ts` (hợp nhất
    2026-09-04, Đợt 2). Đợt 0 để tạm một bản cùng tên ngay tại đây vì H1 chưa
    tồn tại; nay `route-plan` (luật dải 2–4 m), `route-hazards` (câu "chờ nước
    lên") và `route-planner` (lọc hiểm hoạ theo mớn) đều đọc CÙNG một công thức
    — hai bản trôi nhau là đúng kiểu lỗi không bao giờ tự lộ (án lệ
    `haversineKm`/`nearestIndex` từng có hai bản trong repo này).
    Vẫn `export` ở đây để chỗ gọi cũ và test cũ không phải đổi đường dẫn. */
export { requiredDepthM } from "@/lib/hazards";

/**
 * Bước lấy mẫu THỜI TIẾT dọc chặng (km). Trước đây mỗi chặng chỉ lấy MỘT mẫu
 * tại trung điểm — chặng dài (lưới thô 25–30 km, nước mã ×√5, chord kéo căng
 * dây) có thể xuyên mép vùng ≥4 m mà trung điểm đọc dưới ngưỡng (team review
 * 2026-07-26, phát hiện đã verify). Mẫu mỗi ≤12 km: dày hơn hẳn dải ≥4 m hẹp
 * nhất mà nội suy song tuyến tạo ra quanh một mắt lưới bão, nên chặng cắt
 * vùng cấm chắc chắn dính ít nhất một mẫu.
 */
const WEATHER_SAMPLE_KM = 12;

/**
 * Bước lấy mẫu ĐỘ SÂU (và vùng cấm vào dạng đa giác) dọc chặng, km. Trước là
 * hằng số 2 viết thẳng trong `legCost`; tách tên ra vì chỗ dựng vùng cấm phải
 * đọc ĐÚNG con số này để biết vùng nào nhỏ hơn một bước mẫu — vùng nhỏ hơn
 * bước mẫu thì phép điểm-trong-đa-giác tại mẫu gần như không bao giờ trúng
 * (vùng 0,2 km giữa hai mẫu 2 km: ~10 %), nên nó đi đường chỉ mục vật điểm.
 */
const DEPTH_SAMPLE_KM = 2;

/**
 * "CHẤM CHẶN" — một vật điểm có vòng chặn, đã gộp hai nguồn (vật của kho hải
 * đồ + vùng cấm vào nhỏ hơn bước mẫu, xem `## Assumptions` đầu file) và mang
 * sẵn MỨC trên từng phần tử: `DOT_CHAN` (chặn cứng) hay `DOT_CO` (chỉ cắm cờ,
 * luật 7 sát bến). Một chỉ mục, một lượt quét mỗi chặng (O1 tối ưu 2026-09-04
 * — trước là bốn chỉ mục, bốn lượt).
 */
type Dot = { lat: number; lon: number; rKm: number; mask: number };
/** bit "chỉ cắm cờ `hazardNearPort`" */
const DOT_CO = 1;
/** bit "chặn cứng (hoặc `hazard` khi relaxed)" */
const DOT_CHAN = 2;
/*  Ba callback khai Ở CẤP MODULE, không phải trong `planRoute`:
    `maskWithinSegment` nhớ bán kính lớn nhất theo DANH TÍNH hàm (xem docstring
    của nó) — arrow mới mỗi lượt là quét lại cả danh sách 120.000 lần. */
const dotRKm = (d: Dot): number => d.rKm;
const dotMask = (d: Dot): number => d.mask;
const dotPos = (d: Dot): LatLon => d;

// ── lưới tìm đường + Dijkstra ────────────────────────────────────────────

const MAX_NODES = 7500;
const NEIGHBORS: ReadonlyArray<readonly [number, number]> = [
  // 8 ô kề + 8 nước "mã" — 16 hướng để tuyến không bị gãy bậc thang (VISIR
  // dùng connectivity bậc cao cùng lý do)
  [0, 1], [1, 1], [1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [-1, 1],
  [1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2],
];

/** đỏ = phải lưu ý · cam = chú ý vừa · xanh = không có gì (route-legs re-export) */
export type LegRisk = "red" | "amber" | "blue";

export type RoutePlan = {
  /** start … dest — vẽ thẳng lên bản đồ */
  waypoints: LatLon[];
  distKm: number;
  hours: number;
  fuelL: number;
  maxWaveM: number;
  maxWindKmh: number;
  /** có đoạn mức "không nên đi" (sóng ≥3 m / gió ≥cấp 7) — cảnh báo đỏ */
  hasRoughLeg: boolean;
  /** có đoạn nước nông 4–12 m (lớp 4) */
  hasShallowLeg: boolean;
  /**
   * có đoạn đè lên vùng RẤT CẠN (lớp 1 mặt nạ rạn · lớp 2 nước <2 m · lớp 3
   * nước 2–4 m KHI chưa khai mớn/không đủ nước) trong bán kính nới quanh nơi
   * xuất phát/điểm đến. Đi được (tàu thuộc con nước nhà) nhưng UI PHẢI cảnh
   * báo — trước đây đi qua im lặng trong khi copy nói "đã né rạn".
   */
  hasVeryShallowLeg: boolean;
  /**
   * có đoạn qua dải 2–4 m (lớp 3) NGOÀI bán kính nới, đi được CHỈ VÌ chủ tàu
   * đã khai mớn và `requiredDepthM` ≤ 2,0 m (Đợt 0, 2026-09-04). Không khai
   * mớn thì đoạn này là chặn cứng — cờ này không bao giờ bật khi draftM null.
   */
  hasDraftShallowLeg: boolean;
  /**
   * MỌI mẫu lớp 0–3 trên tuyến đều nằm trong bán kính nới quanh hai đầu (0
   * trong 5 km, 1–3 trong 12 km) — tức cạn/bờ chỉ là "chuyện ở cảng", không
   * có chỗ cạn nào giữa đường. false khi tuyến không có mẫu thấp nào, hoặc có
   * mẫu lớp 3 giữa đường đi qua nhờ mớn. UI (R1) gộp ca true thành MỘT dòng
   * vàng "sát cảng, máy nới cho đi" thay vì hai mục đỏ luôn bật (briefing-03
   * phát hiện 2).
   */
  nearPortOnly: boolean;
  /**
   * Giờ chạy CỘNG DỒN tới từng waypoint (cùng độ dài `waypoints`, [0] = 0,
   * cuối = `hours`). Hậu kiểm triều/hiểm hoạ tại ETA từng điểm đọc mảng này —
   * `hoursAcc` của Dijkstra là theo NÚT LƯỚI, sau kéo dây không còn dùng được.
   */
  hoursAt: number[];
  /*  BA CỜ HIỂM HOẠ (nối vào legCost 2026-09-04, Đợt 2).
      · `hazardChecked` false = CHƯA soi kho hiểm hoạ (chỗ gọi không truyền
        `hazards`), KHÔNG phải "đã soi và sạch" — UI không được đọc false thành
        an toàn, phải nói "chưa đối chiếu".
      · `hasHazardLeg` = tuyến TRẢ VỀ có chặng đi vào vòng chặn của một vật
        (xác tàu, giàn khoan, lồng bè, vùng cấm-vào) NGOÀI bán kính nới quanh
        hai đầu. Đường trả về đã qua `walk` nghiêm nên bình thường luôn false;
        bật là dấu hiệu tuyến lọt lưới — UI phải kêu đỏ chứ không im.
      · `hasHazardNearPortLeg` = có vật chặn nhưng nằm trong 5 km quanh nơi
        xuất phát/điểm đến ⇒ KHÔNG chặn (luật 7: cảng nào cũng có lồng bè, đăng
        đáy, xác tàu cũ — chặn là không tàu nào ra khỏi bến), nhưng phải cắm cờ:
        nới là nới cho đi, không nới cho im. */
  hazardChecked: boolean;
  hasHazardLeg: boolean;
  hasHazardNearPortLeg: boolean;
  /**
   * có đoạn ĐÈ LÊN ĐẤT theo lưới độ sâu, đi qua được chỉ vì nằm trong bán kính
   * nới `VICINITY_LAND_KM` quanh nơi xuất phát/điểm đến (2026-08-16, thẩm định
   * P0). Nới là ĐÚNG — cảng nằm trong đất liền theo lưới thô, không nới thì
   * không tuyến nào xuất phát nổi. Nhưng trước đây ca này đi qua HOÀN TOÀN im
   * lặng: không cờ, không câu chữ, trong khi `hasVeryShallowLeg` (nhẹ hơn) thì
   * có. Bà con phải biết đoạn đầu/cuối tuyến máy KHÔNG bảo đảm được.
   */
  hasNearLandLeg: boolean;
  /** có đoạn sóng đuôi ngắn ≥2 m (nguy cơ trượt sóng — giảm ga, đổi hướng nhẹ) */
  hasFollowingSeaRisk: boolean;
  /** false = thiếu dữ liệu độ sâu, tuyến CHƯA né vùng cạn */
  depthChecked: boolean;
  /**
   * true = tuyến tối ưu vòng quá trần MAX_DETOUR_RATIO trong khi đường
   * thẳng vẫn đi được → ĐÃ TRẢ đường thẳng kèm cảnh báo, không bán đường
   * vòng vô lý. UI phải nói rõ.
   */
  cappedToDirect: boolean;
  /** đường thẳng để so sánh — null khi đường thẳng vướng đất/cạn/sóng cấm */
  direct: {
    distKm: number;
    hours: number;
    fuelL: number;
    maxWaveM: number;
  } | null;
  /**
   * Chênh dầu CÓ DẤU so với chạy thẳng: âm = tuyến đỡ dầu hơn, dương =
   * tuyến tốn THÊM (đi vòng né sóng — người dùng phải được biết con số
   * thật, không cắt về 0). null khi không có direct để so.
   */
  fuelDeltaL: number | null;
  /**
   * Số giờ phần ĐUÔI tuyến chạy QUÁ cửa sổ dự báo (0 = cả tuyến có số liệu
   * thật). Quá cửa sổ thì mô hình đóng băng giờ cuối (hourAt kẹp chỉ số) —
   * UI phải nói thật đoạn đó chưa được kiểm, không được để "êm giả".
   */
  beyondForecastH: number;
  /**
   * BEST-EFFORT VÌ BIỂN QUÁ ĐỘNG (2026-09-09). true = KHÔNG còn đường "sạch"
   * (mọi đường đều dính sóng ≥4 m / gió ≥ cấp 8), nên đây là "ĐƯỜNG ÍT DỮ NHẤT"
   * — có đi qua vùng ĐÁNG LẼ CHẶN CỨNG. UI PHẢI cảnh báo đỏ mạnh "app KHÔNG
   * khuyên đi". Đất/cạn/vật chặn/bão vẫn chặn cứng như thường (không nằm ở đây).
   */
  bestEffortSeas: boolean;
  /**
   * Mức nguy hiểm TỪNG KHÚC (mỗi cặp waypoint liền nhau) — độ dài =
   * `waypoints.length - 1`. Để bản đồ tô đỏ/cam ĐÚNG đoạn có sóng dữ/cạn, không
   * chỉ theo chặng chỗ-ghé. "red" cũng gồm khúc best-effort dẫm sóng ≥4 m.
   */
  segRisks: LegRisk[];
};

type LegInfo = {
  feasible: boolean;
  distKm: number;
  hours: number;
  fuelL: number;
  cost: number;
  waveM: number;
  windKmh: number;
  rough: boolean;
  shallow: boolean;
  veryShallow: boolean;
  /** chặng đè lên ĐẤT nhưng được nới vì sát nơi xuất phát/điểm đến */
  nearLand: boolean;
  /** chặng qua dải 2–4 m ngoài vicinity, đi được nhờ mớn đã khai */
  draftShallow: boolean;
  /** chặng chạm vòng chặn của một vật/vùng cấm NGOÀI bán kính nới hai đầu */
  hazard: boolean;
  /** chặng chạm vật chặn nhưng cả chặng nằm trong 5 km quanh một đầu */
  hazardNearPort: boolean;
  /** có ít nhất một mẫu lớp 0–3 */
  lowSeen: boolean;
  /** có mẫu lớp 0–3 NGOÀI bán kính nới của lớp đó (⇒ không phải chuyện ở cảng) */
  lowFar: boolean;
  following: boolean;
  /** chặng có mẫu ≥ ngưỡng CỨNG (sóng ≥4 m / gió ≥ cấp 8) — chỉ lọt qua ở chế
      độ best-effort (`seaAsPenalty`); ở chế độ nghiêm chặng này đã INFEASIBLE */
  seaImpassable: boolean;
};

// bất biến + dùng lại cho mọi chặng không đi được — tránh cấp phát object
// trong vòng lặp nóng của Dijkstra (~120k lần gọi legCost một lượt tính)
const INFEASIBLE_LEG: LegInfo = Object.freeze({
  feasible: false, distKm: 0, hours: 0, fuelL: 0, cost: 0,
  waveM: 0, windKmh: 0, rough: false, shallow: false,
  veryShallow: false, nearLand: false, draftShallow: false,
  hazard: false, hazardNearPort: false,
  lowSeen: false, lowFar: false, following: false, seaImpassable: false,
});

// export cho route-plan.worker.ts (structured clone nguyên args qua worker)
export type PlanArgs = {
  start: LatLon;
  dest: LatLon;
  boat: BoatProfile;
  /** giờ xuất phát tính từ 0h hôm nay giờ VN (trục giờ của WeatherField) */
  departHourIdx: number;
  field: WeatherField;
  /** null = nguồn độ sâu không tải được — vẫn tính, plan.depthChecked=false */
  depth: DepthGrid | null;
  bbox: BBox;
  /*  HIỂM HOẠ ĐIỂM đã lọc theo khung, dạng PHẲNG (`packHazards`) — ba
      `Float64Array` + mảng id, structured-clone được sang worker (`SpatialIndex`
      thì không: nó giữ `PosFn`). Bỏ trống/null = chỗ gọi CHƯA soi kho ⇒
      `plan.hazardChecked = false`, UI phải nói "chưa đối chiếu", KHÔNG được
      hiểu thành "đã soi và sạch". */
  hazards?: HazardPacked | null;
  /*  Vùng CẤM VÀO dạng đa giác (`buildHazardList().noGo`). Ring là mảng số
      thuần nên clone được. Cũng lọc theo khung ở phía gọi. */
  noGo?: NoGoZone[] | null;
};

// hàng đợi ưu tiên nhị phân tối giản
class MinHeap {
  keys: number[] = [];
  vals: number[] = [];
  get size() {
    return this.keys.length;
  }
  push(key: number, val: number) {
    const k = this.keys;
    const v = this.vals;
    k.push(key);
    v.push(val);
    let i = k.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (k[p] <= k[i]) break;
      [k[p], k[i]] = [k[i], k[p]];
      [v[p], v[i]] = [v[i], v[p]];
      i = p;
    }
  }
  pop(): number {
    const k = this.keys;
    const v = this.vals;
    const top = v[0];
    const lastK = k.pop()!;
    const lastV = v.pop()!;
    if (k.length > 0) {
      k[0] = lastK;
      v[0] = lastV;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < k.length && k[l] < k[m]) m = l;
        if (r < k.length && k[r] < k[m]) m = r;
        if (m === i) break;
        [k[m], k[i]] = [k[i], k[m]];
        [v[m], v[i]] = [v[i], v[m]];
        i = m;
      }
    }
    return top;
  }
}

/**
 * @param seaAsPenalty BEST-EFFORT — nội bộ, mặc định false. Lượt NGHIÊM (false)
 * bí (không có đường vì sóng ≥4 m / gió ≥ cấp 8) thì planRoute TỰ GỌI LẠI CHÍNH
 * NÓ một lần với true: hạ chặn-cứng-sóng xuống phạt cực nặng để ra "đường ít dữ
 * nhất", cắm `bestEffortSeas`. Đất/cạn/vật chặn/vùng cấm vẫn chặn cứng ⇒ nếu
 * lượt true CŨNG null thì đúng là KHÔNG có đường vật lý (đất chắn), trả null.
 * Chặn đệ quy vô hạn: chỉ gọi lại khi `!seaAsPenalty`.
 */
export function planRoute(args: PlanArgs, seaAsPenalty = false): RoutePlan | null {
  const { start, dest, boat, departHourIdx, field, depth, bbox } = args;
  const midLat = (bbox.latMin + bbox.latMax) / 2;
  const spanLatKm = (bbox.latMax - bbox.latMin) * 111.32;
  const spanLonKm = (bbox.lonMax - bbox.lonMin) * 111.32 * Math.cos(rad(midLat));
  // bước lưới: mịn nhất 4 km, thô dần để tổng nút ≤ MAX_NODES
  let stepKm = Math.max(4, Math.max(spanLatKm, spanLonKm) / 90);
  for (;;) {
    const nI = Math.floor(spanLatKm / stepKm) + 1;
    const nJ = Math.floor(spanLonKm / stepKm) + 1;
    if (nI * nJ <= MAX_NODES) break;
    stepKm *= 1.2;
  }
  const dLat = stepKm / 111.32;
  const dLon = stepKm / (111.32 * Math.cos(rad(midLat)));
  const nI = Math.floor((bbox.latMax - bbox.latMin) / dLat) + 1;
  const nJ = Math.floor((bbox.lonMax - bbox.lonMin) / dLon) + 1;
  const n = nI * nJ;
  const pointOf = (idx: number): LatLon => ({
    lat: bbox.latMin + Math.floor(idx / nJ) * dLat,
    lon: bbox.lonMin + (idx % nJ) * dLon,
  });
  const snap = (p: LatLon): number => {
    const i = Math.max(0, Math.min(nI - 1, Math.round((p.lat - bbox.latMin) / dLat)));
    const j = Math.max(0, Math.min(nJ - 1, Math.round((p.lon - bbox.lonMin) / dLon)));
    return i * nJ + j;
  };
  const sIdx = snap(start);
  const dIdx = snap(dest);

  const nearEndpoints = (p: LatLon, radiusKm: number) =>
    haversineKm(p, start) <= radiusKm || haversineKm(p, dest) <= radiusKm;

  /*  ── HIỂM HOẠ: DỰNG CHỈ MỤC MỘT LẦN CHO CẢ LƯỢT TÍNH ────────────────────
      `legCost` chạy ~120.000 lượt; dựng lưới ô ở đây (O(n) một lần, 285 vật
      trên cả nước, sau khi lọc khung thường vài chục) rồi mỗi chặng chỉ quét
      mấy ô cắt hộp bao.
      Vì sao ĐO TỚI ĐOẠN (`maskWithinSegment`) chứ không lấy mẫu điểm: một vòng
      chặn 300 m (phao hiểm hoạ cô lập) lọt gọn giữa hai mẫu 2 km — đúng bài
      học `REEF_BUFFER_M` của lưới độ sâu. Khoảng cách điểm→đoạn thì không có
      khe nào để lọt.
      `dotRKm`/`dotMask` khai một lần ở cấp module: `maskWithinSegment` nhớ bán
      kính lớn nhất theo DANH TÍNH hàm — tạo arrow mới mỗi lượt là quét lại cả
      danh sách 120.000 lần.

      MỨC GHI TRÊN TỪNG VẬT, KHÔNG XÉT THEO CHẶNG (sửa 2026-09-04 sau khi test
      bắt): vật "sát bến" phải được đánh dấu từ lúc DỰNG, chứ không phải xét
      theo chặng lúc chạy. Bản đầu hỏi "cả chặng có nằm trong 5 km quanh một
      đầu không" — nhưng chặng lưới dài 4–9 km và chord kéo dây tới 30 km, nên
      chặng ĐẦU TIÊN xuất phát từ bến gần như không bao giờ nằm trọn trong 5 km
      ⇒ một cái lồng bè cách bến 2 km chặn luôn mọi lối ra, `planRoute` trả
      null: bà con mất hẳn tính năng vì đúng cái mà luật 7 định tha. Đánh dấu
      theo VỊ TRÍ CỦA VẬT thì hết mơ hồ: vật có vòng chặn với tới trong 5 km
      quanh một đầu = chuyện ở cảng (`DOT_CO`, chỉ cắm cờ), còn lại = `DOT_CHAN`,
      chặn cứng ở mọi chặng. Trước đây hai mức là HAI chỉ mục (rồi vùng cấm nhỏ
      thêm hai nữa = bốn lượt quét mỗi chặng); O1 gộp về MỘT chỉ mục `dotIx`,
      mức nằm trên phần tử, một lượt quét trả cả hai bit. */
  const hzPack = args.hazards ?? null;
  /*  Kiểm ở RANH GIỚI (không cắt được — nguyên tắc 4): gói méo (ba mảng lệch
      độ dài, ids không phải mảng) thì coi như không có hiểm hoạ chứ không ném
      giữa Dijkstra. */
  const hazardN = (() => {
    if (!hzPack || !Array.isArray(hzPack.ids)) return 0;
    const n = hzPack.ids.length;
    const du = (a: { length: number } | null | undefined) => !!a && a.length >= n;
    return du(hzPack.lat) && du(hzPack.lon) && du(hzPack.rKm) ? n : 0;
  })();
  /*  `hazardChecked` = có gói VÀ gói đọc được trọn (review đợt 4, G2): gói méo
      thì máy KHÔNG chặn gì, mà thứ bà con đọc là "đã đối chiếu vật chặn" — sai.
      Gói rỗng hợp lệ (0 vật trong khung) vẫn là đã đối chiếu. */
  const hazardChecked =
    hzPack != null && Array.isArray(hzPack.ids) && hazardN === hzPack.ids.length;
  /** mọi "chấm chặn" của lượt tính — vật kho + vùng cấm nhỏ, mức trên từng phần tử */
  const dots: Dot[] = [];
  if (hzPack && hazardN > 0) {
    for (let i = 0; i < hazardN; i++) {
      const r = hzPack.rKm[i];
      const dot: Dot = { lat: hzPack.lat[i], lon: hzPack.lon[i], rKm: r, mask: DOT_CHAN };
      const toi = (q: LatLon) => haversineKm(dot, q) - (r > 0 ? r : 0);
      if (toi(start) <= VICINITY_LAND_KM || toi(dest) <= VICINITY_LAND_KM)
        dot.mask = DOT_CO;
      dots.push(dot);
    }
  }

  /*  VÙNG CẤM VÀO: lọc theo khung tính toán MỘT LẦN (dữ liệu thật có 6 vùng
      trên cả nước), rồi trong vòng nóng chỉ còn hộp bao + điểm-trong-đa-giác
      tại chính các mẫu 2 km của lớp độ sâu — không thêm vòng lặp nào.
      Vùng CHỨA nơi xuất phát hoặc điểm đến (cảng nằm trong khu cấm vào của
      cảng vụ chẳng hạn) thì không chặn nổi — chặn là bà con không rời bến được
      — nên hạ xuống cắm cờ, đúng luật 7. */
  const noGoPadDeg = NO_GO_PAD_KM / 111.32;
  const noGoAll = (args.noGo ?? []).filter(
    (z) =>
      z &&
      Array.isArray(z.ring) &&
      z.ring.length >= 3 &&
      z.bbox &&
      z.bbox.latMin - noGoPadDeg <= bbox.latMax &&
      z.bbox.latMax + noGoPadDeg >= bbox.latMin &&
      z.bbox.lonMin - noGoPadDeg <= bbox.lonMax &&
      z.bbox.lonMax + noGoPadDeg >= bbox.lonMin,
  );
  /*  HAI ĐƯỜNG THEO CỠ VÙNG (sửa 2026-09-04 sau review đợt 4). Dữ liệu thật chỉ
      có MỘT đa giác cấm-vào và nó rộng 0,2 × 0,2 km: kiểm điểm-trong-đa-giác tại
      mẫu 2 km bắt được chừng 10 % số lần chặng cắt qua — lớp chặn trên giấy.
      Vùng nhỏ hơn một bước mẫu vì thế được quy về VẬT ĐIỂM (tâm hộp bao, bán
      kính ngoại tiếp + đệm 500 m) và đi chung máy móc với xác tàu/giàn khoan:
      `maskWithinSegment` đo điểm→đoạn nên không còn khe nào để lọt, mà cũng
      không thêm vòng lặp nào vào `legCost` (chung chỉ mục `dotIx` luôn).
      Vùng LỚN giữ nguyên đường cũ (đúng và rẻ: hộp bao loại gần hết, tia chỉ
      chạy khi mẫu rơi vào hộp).
      "Sát bến" xét CÙNG luật với vật chặn (luật 7): vùng CHỨA một đầu, hoặc
      vòng chặn của vùng nhỏ với tới trong `VICINITY_LAND_KM` quanh một đầu, thì
      chỉ cắm cờ — chặn là bà con không rời bến được. */
  const noGoZones: NoGoZone[] = [];
  const noGoPortZones: NoGoZone[] = [];
  for (const z of noGoAll) {
    const chuaDau = pointInRing(start, z.ring) || pointInRing(dest, z.ring);
    const cLat = (z.bbox.latMin + z.bbox.latMax) / 2;
    const cLon = (z.bbox.lonMin + z.bbox.lonMax) / 2;
    const caoKm = (z.bbox.latMax - z.bbox.latMin) * 111.32;
    const rongKm = (z.bbox.lonMax - z.bbox.lonMin) * 111.32 * Math.cos(rad(cLat));
    const cheoKm = Math.hypot(caoKm, rongKm);
    if (cheoKm > DEPTH_SAMPLE_KM) {
      (chuaDau ? noGoPortZones : noGoZones).push(z);
      continue;
    }
    const dot: Dot = { lat: cLat, lon: cLon, rKm: cheoKm / 2 + NO_GO_PAD_KM, mask: DOT_CHAN };
    const toi = (q: LatLon) => haversineKm(dot, q) - dot.rKm;
    if (chuaDau || toi(start) <= VICINITY_LAND_KM || toi(dest) <= VICINITY_LAND_KM)
      dot.mask = DOT_CO;
    dots.push(dot);
  }
  /** MỘT chỉ mục cho mọi chấm chặn; null = không có gì để hỏi */
  const dotIx: SpatialIndex<Dot> | null = dots.length > 0 ? buildIndex(dots, dotPos) : null;
  /*  Điểm dùng lại cho `pointInRing`/`nearEndpoints` — cấp phát một object mỗi
      mẫu × 120.000 chặng là rác cho bộ gom rác của máy yếu. Cả hai chỉ ĐỌC hai
      trường, không giữ lại tham chiếu. */
  const noGoProbe = { lat: 0, lon: 0 };

  const calmKmh = boat.speedKn * KMH_PER_KNOT;

  /**
   * Chi phí chặng from→to. Thời tiết lấy mẫu DỌC CHẶNG mỗi ≤WEATHER_SAMPLE_KM
   * (trước đây một mẫu trung điểm — chặng dài xuyên được mép vùng ≥4 m; team
   * review 2026-07-26): chặn cứng/cờ lấy theo MẪU XẤU NHẤT, giờ/dầu cộng dồn
   * từng đoạn con. Giờ của mẫu ước lượng bằng tốc độ êm — đủ tốt. Độ sâu kiểm
   * mẫu mỗi ≤2 km dọc chặng để rạn/đảo không lọt khe giữa hai đầu cạnh.
   * relaxed=true (chỉ dùng khi TÍNH LẠI số liệu tuyến đã chọn): không chặn
   * nữa nhưng vẫn đo đủ cờ/maxWave — tổng hiển thị luôn là CẢ tuyến.
   */
  const legCost = (
    from: LatLon,
    to: LatLon,
    atHour: number,
    relaxed: boolean,
    /*  BEST-EFFORT: sóng ≥4 m / gió ≥ cấp 8 KHÔNG còn chặn cứng mà thành phạt
        cực nặng (PEN_IMPASSABLE_SEA) + cắm cờ `seaImpassable`. Đất/cạn/vật
        chặn/vùng cấm VẪN chặn cứng. Chỉ `planRoute` bật khi lượt nghiêm bí. */
    seaAsPenalty = false,
  ): LegInfo => {
    const distKm = haversineKm(from, to);
    const dLatLeg = to.lat - from.lat;
    const dLonLeg = to.lon - from.lon;

    // ràng buộc tĩnh: độ sâu/bờ (VISIR static constraint) — mẫu dày dọc chặng
    let shallow = false;
    let veryShallow = false;
    let nearLand = false;
    let draftShallow = false;
    let lowSeen = false;
    let lowFar = false;
    let hazard = false;
    let hazardNearPort = false;
    if (depth || noGoZones.length > 0 || noGoPortZones.length > 0) {
      /*  BƯỚC MẪU 2 KM, TRƯỚC LÀ 5 (2026-08-16, thẩm định P0). Lưới độ sâu có
          bước 15" ≈ 450 m (từ 2026-08-29; bản trước 0,05° ≈ 5,5 km), nhưng mẫu
          mỗi 5 km vẫn để lọt: một chấm đảo/đá ngầm nhỏ hơn khoảng cách hai mẫu
          nằm gọn giữa chúng thì không ai thấy (mặt nạ rạn trong script đã nở
          ≥ 2,4 km để không lọt khe 2 km này). Nó cũng làm cờ `nearLand` không
          đáng tin ở cạnh dài: chord kéo dây tới ~30 km chỉ lấy mẫu từ km thứ 5
          trở đi ⇒ dải bờ 0–4 km quanh nơi xuất phát đi qua im lặng.
          Giá phải trả: ~2,5 lần số lượt `depthClassAt` trong vòng nóng của
          Dijkstra. `depthClassAt` là vài phép dịch bit trên `Uint8Array`, rẻ
          hơn hẳn `sampleField` (nội suy thời tiết) chạy ngay dưới, và cả lượt
          tính nằm trong Web Worker. Đo lại nếu có ngày thấy "Đang tính đường…"
          lâu hơn trước. */
      const nSamples = Math.max(2, Math.ceil(distKm / DEPTH_SAMPLE_KM));
      for (let s = 1; s <= nSamples; s++) {
        const t = s / nSamples;
        const pLat = from.lat + dLatLeg * t;
        const pLon = from.lon + dLonLeg * t;
        noGoProbe.lat = pLat;
        noGoProbe.lon = pLon;

        /*  VÙNG CẤM VÀO LỚN (đa giác rộng hơn một bước mẫu) — kiểm TẠI CHÍNH
            MẪU NÀY, không thêm vòng lặp. Hộp bao loại gần hết trước khi phải
            chạy tia; đệm 500 m chỉ nới ở HỘP, còn phép chặn là điểm-trong-đa-
            giác (xem ## Assumptions đầu file: dải 500 m sát ranh do `auditRoute`
            gọi tên, không chặn ở đây). Vùng NHỎ không đi đường này — nó nằm
            trong `dotIx`, đo điểm→đoạn dưới kia. */
        for (let z = 0; z < noGoZones.length; z++) {
          const zn = noGoZones[z];
          if (
            pLat < zn.bbox.latMin - noGoPadDeg ||
            pLat > zn.bbox.latMax + noGoPadDeg ||
            pLon < zn.bbox.lonMin - noGoPadDeg ||
            pLon > zn.bbox.lonMax + noGoPadDeg
          )
            continue;
          if (!pointInRing(noGoProbe, zn.ring)) continue;
          if (!relaxed) return INFEASIBLE_LEG;
          hazard = true;
        }
        for (let z = 0; z < noGoPortZones.length; z++) {
          const zn = noGoPortZones[z];
          if (
            pLat < zn.bbox.latMin ||
            pLat > zn.bbox.latMax ||
            pLon < zn.bbox.lonMin ||
            pLon > zn.bbox.lonMax
          )
            continue;
          if (pointInRing(noGoProbe, zn.ring)) hazardNearPort = true;
        }

        const cls = depth ? depthClassAt(depth, pLat, pLon) : -1;
        if (cls === 0) {
          lowSeen = true;
          // đất liền: chỉ nới trong bán kính nhỏ sát cảng
          if (!nearEndpoints(noGoProbe,VICINITY_LAND_KM)) {
            if (!relaxed) return INFEASIBLE_LEG;
            lowFar = true;
          }
          /*  ĐI QUA ĐƯỢC THÌ PHẢI CẮM CỜ (2026-08-16). Cùng lý lẽ với
              `veryShallow` ngay dưới: nới là nới cho đi, không phải nới cho im.
              Ở nhánh `relaxed` (tính lại số liệu) cũng cắm — tổng hiển thị luôn
              là của CẢ tuyến, kể cả đoạn chỉ đi được nhờ nới. */
          nearLand = true;
        } else if (cls === 1 || cls === 2) {
          lowSeen = true;
          // mặt nạ rạn / nước <2 m: "rất cạn" — chỉ nới sát cảng/điểm đến
          if (!nearEndpoints(noGoProbe,VICINITY_SHALLOW_KM)) {
            if (!relaxed) return INFEASIBLE_LEG;
            lowFar = true;
          }
          // đi qua nhờ nới sát cảng/điểm đến — vẫn PHẢI cắm cờ + tính phạt
          // (trước đây im lặng và còn RẺ hơn nước nông 4–12 m hợp lệ)
          veryShallow = true;
        } else if (cls === 3) {
          lowSeen = true;
          if (nearEndpoints(noGoProbe,VICINITY_SHALLOW_KM)) {
            // sát cảng: như "rất cạn" cũ — nới cho đi, cắm cờ
            veryShallow = true;
          } else {
            /*  Dải 2–4 m GIỮA ĐƯỜNG: mở khi đã khai mớn và đủ nước tại mẫu
                (sóng tại ETA của mẫu — sóng cao thì cần thêm nước dưới đáy).
                Chỉ hỏi thời tiết ở nhánh hiếm này (mẫu lớp 3 ngoài cảng), không
                đội chi phí vòng nóng cho mọi mẫu. */
            let ok = false;
            if (boat.draftM != null) {
              const hw = sampleField(field, pLat, pLon, atHour + (distKm * t) / calmKmh);
              const waveHere = hw ? (hw.waveM ?? estimateWaveFromWind(hw.windKmh)) : null;
              const need = requiredDepthM(boat.draftM ?? null, waveHere);
              ok = need != null && need <= DRAFT_SHALLOW_MAX_NEED_M;
            }
            lowFar = true;
            if (ok) {
              draftShallow = true;
            } else {
              if (!relaxed) return INFEASIBLE_LEG;
              veryShallow = true;
            }
          }
        } else if (cls === 4) {
          shallow = true;
        }
      }
    }

    /*  ── VẬT CHẶN (xác tàu · chướng ngại · giàn khoan · phao hiểm hoạ cô lập ·
        lồng bè) ─────────────────────────────────────────────────────────────
        Đứng SAU kiểm độ sâu vì độ sâu loại được phần lớn chặng bằng phép rẻ
        hơn. Trả lời đúng/sai là đủ cho Dijkstra — "dính cái gì, cách bao xa" là
        việc của hậu kiểm `auditRoute`.
        Vật có vòng chặn với tới trong 5 km quanh MỘT đầu đã được đánh dấu
        `DOT_CO` lúc dựng: chạm nó chỉ CẮM CỜ, không chặn (luật 7) — cảng nào
        cũng có lồng bè, đăng đáy, xác tàu cũ nằm trong luồng ra vào; chặn thì
        không tàu nào rời bến được, mà bà con lại rành khúc đó hơn máy.
        Vùng cấm vào NHỎ HƠN BƯỚC MẪU nằm chung chỉ mục này (lý do ở chỗ dựng
        `dots`) — đây là chỗ đệm 500 m của quyết định §1.5 thật sự có hiệu lực:
        bán kính ngoại tiếp đã cộng `NO_GO_PAD_KM`.
        MỘT lượt quét trả bit-OR của mức: nghiêm thì dừng ngay khi thấy bit CHẶN
        (chặng hỏng, cờ không còn nghĩa); relaxed thì lấy đủ cả hai bit vì tổng
        hiển thị là của CẢ tuyến. */
    if (dotIx) {
      const m = maskWithinSegment(
        dotIx, from, to, dotRKm, dotMask,
        relaxed ? DOT_CHAN | DOT_CO : DOT_CHAN,
      );
      if (m & DOT_CHAN) {
        if (!relaxed) return INFEASIBLE_LEG;
        hazard = true;
      }
      if (m & DOT_CO) hazardNearPort = true;
    }

    const heading = bearingDeg(from, to);
    // mẫu thời tiết dọc chặng — mỗi đoạn con tự tính tốc độ/dầu của nó
    const nW = Math.max(1, Math.ceil(distKm / WEATHER_SAMPLE_KM));
    const subKm = distKm / nW;
    let hours = 0;
    let fuelL = 0;
    let weatherCost = 0;
    let maxWave = 0;
    let maxWind = 0;
    let rough = false;
    let following = false;
    let seaImpassable = false;
    for (let s = 0; s < nW; s++) {
      const t = (s + 0.5) / nW;
      const h = sampleField(
        field,
        from.lat + dLatLeg * t,
        from.lon + dLonLeg * t,
        atHour + (distKm * t) / calmKmh,
      );
      if (!h) {
        // ngoài lưới thời tiết / cả 4 góc đất liền
        if (
          !relaxed &&
          !nearEndpoints({ lat: from.lat + dLatLeg * t, lon: from.lon + dLonLeg * t }, VICINITY_SHALLOW_KM)
        )
          return INFEASIBLE_LEG;
        // sát cảng: chạy bằng số 0 an toàn (đoạn ngắn)
        const h0 = subKm / calmKmh;
        hours += h0;
        fuelL += h0 * boat.litersPerHour;
        weatherCost += h0 * boat.litersPerHour;
        continue;
      }

      // Ô biển mà GIỜ này thiếu số sóng (nguồn marine thủng) → ƯỚC từ gió
      // thay vì coi 0 = biển lặng: 0 giả tắt cả giảm tốc lẫn phạt an toàn
      // đúng lúc dữ liệu kém nhất. Cùng công thức estimateWaveFromWind của
      // sea.ts — có số sóng thật thì luôn ưu tiên số thật.
      const waveM = h.waveM ?? estimateWaveFromWind(h.windKmh);
      const hard = waveM >= HARD_WAVE_M || h.windKmh >= HARD_WIND_KMH;
      // ≥ cấp 8 — CHẶN CỨNG ở lượt nghiêm; best-effort thì cho qua kèm phạt cực
      // nặng + cắm cờ (relaxed = tính lại số liệu tuyến đã chọn, cũng không chặn)
      if (hard && !relaxed && !seaAsPenalty) return INFEASIBLE_LEG;
      if (hard) seaImpassable = true;

      const dirF = waveDirFactor(h.waveFromDeg, heading);
      // tốc độ QUA NƯỚC sau khi sóng làm chậm; ngược gió cũng làm CHẬM
      // (ga cố định → dầu/giờ hằng số — trước đây gió đội lít/giờ mà giờ
      // đến lại y như ngày lặng gió, sai cả ETA lẫn trục giờ lấy dự báo)
      const stwKmh =
        (calmKmh * speedFactor(waveM, dirF)) /
        (1 + windDragFactor(h.windKmh, h.windFromDeg, heading));
      // cộng vector dòng chảy (VISIR-2): dọc cộng thẳng, ngang vát mũi bù;
      // dòng nguồn ≤ ~4 km/h, kẹp sàn 25% để không chia 0
      const speedKmh = Math.max(
        stwKmh * 0.25,
        currentAlongKmh(h, heading) +
          Math.sqrt(Math.max(stwKmh ** 2 - currentCrossKmh(h, heading) ** 2, 0)),
      );
      const subH = subKm / speedKmh;
      const subFuel = subH * boat.litersPerHour;
      hours += subH;
      fuelL += subFuel;

      const fol = followingSeaRisk(waveM, h.waveFromDeg, heading, h.wavePeriodS);
      // sóng ≥3 m trên nền nước nông 4–12 m: sóng bạc đầu/vỡ — nguy hiểm hơn
      // hẳn cùng độ cao ngoài khơi → nâng lên mức "không nên đi"
      const danger =
        hard ||
        waveM >= DANGER_WAVE_M ||
        h.windKmh >= DANGER_WIND_KMH ||
        (shallow && waveM >= DANGER_WAVE_M - 0.5);
      const caution = waveM >= CAUTION_WAVE_M || h.windKmh >= CAUTION_WIND_KMH;
      // đoạn ≥ ngưỡng cứng (chỉ tới đây khi best-effort/relaxed) phạt CỰC nặng
      // để tuyến chỉ dẫm vào khi không tránh được và chọn ô nhẹ nhất
      let pen = hard ? PEN_IMPASSABLE_SEA : danger ? PEN_DANGER : caution ? PEN_CAUTION : 1;
      if (fol) pen *= PEN_BROACH;
      weatherCost += subFuel * pen;

      following = following || fol;
      rough = rough || danger;
      if (waveM > maxWave) maxWave = waveM;
      if (h.windKmh > maxWind) maxWind = h.windKmh;
    }

    let cost = weatherCost;
    if (shallow) cost *= SHALLOW_PENALTY;
    if (veryShallow) cost *= SHALLOW_PENALTY;
    // qua dải 2–4 m nhờ mớn: đi được nhưng chỗ sâu hơn cùng giá thì ưu tiên
    if (draftShallow) cost *= SHALLOW_PENALTY;

    return {
      feasible: true, distKm, hours, fuelL, cost,
      waveM: maxWave, windKmh: maxWind, rough, shallow, veryShallow, nearLand,
      draftShallow, hazard, hazardNearPort, lowSeen, lowFar, following, seaImpassable,
    };
  };

  /*  MỨC NGUY HIỂM MỘT KHÚC (mỗi cặp waypoint) — cùng THỨ TỰ ưu tiên và cùng
      ngưỡng với `legRisk` của route-legs (một nghĩa, một bộ số). Dùng để tô đỏ/
      cam ĐÚNG khúc trên bản đồ. Không xét `depthChecked` (đó là chuyện cả tuyến
      — UI nói bằng dòng cảnh báo riêng, không nhuộm cả tuyến cam). */
  const legInfoRisk = (leg: LegInfo): LegRisk => {
    if (
      leg.hazard ||
      leg.veryShallow ||
      leg.nearLand ||
      leg.seaImpassable ||
      leg.waveM >= DANGER_WAVE_M ||
      leg.windKmh >= DANGER_WIND_KMH ||
      leg.rough
    )
      return "red";
    if (
      leg.draftShallow ||
      leg.shallow ||
      leg.following ||
      leg.waveM >= CAUTION_WAVE_M ||
      leg.windKmh >= CAUTION_WIND_KMH
    )
      return "amber";
    return "blue";
  };

  // Dijkstra: nhãn = chi phí (dầu × phạt nhẹ) tích luỹ; giờ ETA đi ké nhãn
  // rẻ nhất — xấp xỉ time-dependent, đủ tốt cho dự báo nội suy theo giờ
  const cost = new Float64Array(n).fill(Infinity);
  const hoursAcc = new Float64Array(n);
  const prev = new Int32Array(n).fill(-1);
  const done = new Uint8Array(n);
  const heap = new MinHeap();
  cost[sIdx] = 0;
  heap.push(0, sIdx);

  while (heap.size > 0) {
    const u = heap.pop();
    if (done[u]) continue;
    done[u] = 1;
    if (u === dIdx) break;
    const pu = pointOf(u);
    const ui = Math.floor(u / nJ);
    const uj = u % nJ;
    for (const [di, dj] of NEIGHBORS) {
      const vi = ui + di;
      const vj = uj + dj;
      if (vi < 0 || vi >= nI || vj < 0 || vj >= nJ) continue;
      const v = vi * nJ + vj;
      if (done[v]) continue;
      const leg = legCost(pu, pointOf(v), departHourIdx + hoursAcc[u], false, seaAsPenalty);
      if (!leg.feasible) continue;
      const c = cost[u] + leg.cost;
      if (c < cost[v]) {
        cost[v] = c;
        hoursAcc[v] = hoursAcc[u] + leg.hours;
        prev[v] = u;
        heap.push(c, v);
      }
    }
  }

  // Không tới được đích ở lượt nghiêm → thử BEST-EFFORT (biển động); lượt
  // best-effort cũng không tới → đất chắn thật, trả null.
  if (!Number.isFinite(cost[dIdx]))
    return seaAsPenalty ? null : planRoute(args, true);

  // dựng lại tuyến node, thay hai đầu bằng toạ độ thật
  const nodePath: number[] = [];
  for (let v = dIdx; v !== -1; v = prev[v]) nodePath.unshift(v);
  let waypoints: LatLon[] = [
    start,
    ...nodePath.slice(1, -1).map(pointOf),
    dest,
  ];

  // kéo căng dây (string-pulling) CÓ KIỂM CHI PHÍ: bỏ nút trung gian chỉ khi
  // chord đi được VÀ không đắt hơn các cạnh nó thay — chord chỉ-cần-feasible
  // (bản cũ) cắt góc thẳng lại vào vùng phạt 3–4 m mà Dijkstra vừa trả thêm
  // chi phí để né (team review 2026-07-26). Khử zigzag bậc thang trước khi
  // đo quãng đường/vẽ.
  const smoothed: LatLon[] = [waypoints[0]];
  let hoursEst = 0;
  let i = 0;
  while (i < waypoints.length - 1) {
    const maxJ = Math.min(i + 6, waypoints.length - 1);
    let bestJ = i + 1;
    let bestHours =
      haversineKm(waypoints[i], waypoints[i + 1]) / calmKmh;
    {
      const first = legCost(waypoints[i], waypoints[i + 1], departHourIdx + hoursEst, false, seaAsPenalty);
      // cộng dồn chi phí/giờ của chuỗi cạnh gốc i..j để so với chord
      let sumCost = first.feasible ? first.cost : Infinity;
      let sumHours = first.feasible ? first.hours : bestHours;
      if (first.feasible) bestHours = first.hours;
      for (let j = i + 2; j <= maxJ; j++) {
        const orig = legCost(
          waypoints[j - 1], waypoints[j],
          departHourIdx + hoursEst + sumHours, false, seaAsPenalty,
        );
        sumCost += orig.feasible ? orig.cost : Infinity;
        sumHours += orig.feasible
          ? orig.hours
          : haversineKm(waypoints[j - 1], waypoints[j]) / calmKmh;
        const chord = legCost(waypoints[i], waypoints[j], departHourIdx + hoursEst, false, seaAsPenalty);
        if (chord.feasible && chord.cost <= sumCost * 1.001) {
          bestJ = j;
          bestHours = chord.hours;
        }
      }
    }
    hoursEst += bestHours;
    smoothed.push(waypoints[bestJ]);
    i = bestJ;
  }
  waypoints = smoothed;

  /**
   * Tính lại số liệu trọn tuyến theo đúng mô hình (relaxed → không bao giờ cụt
   * giữa chừng). `hoursAt[k]` = giờ cộng dồn tới `pts[k]` ([0] = 0) — mảng này
   * đi ra ngoài theo `RoutePlan.hoursAt` cho hậu kiểm triều/hiểm hoạ tại ETA.
   */
  const walk = (pts: LatLon[], relaxed: boolean, seaAsPenalty = false) => {
    let hoursSum = 0,
      fuelSum = 0,
      distSum = 0,
      maxWave = 0,
      maxWind = 0;
    let rough = false,
      shallowFlag = false,
      veryShallowFlag = false,
      nearLandFlag = false,
      draftShallowFlag = false,
      hazardFlag = false,
      hazardNearPortFlag = false,
      lowSeen = false,
      lowFar = false,
      following = false,
      seaImpassableFlag = false,
      ok = true;
    const hoursAt: number[] = [0];
    const segRisks: LegRisk[] = [];
    for (let k = 1; k < pts.length; k++) {
      const leg = legCost(pts[k - 1], pts[k], departHourIdx + hoursSum, relaxed, seaAsPenalty);
      if (!leg.feasible) {
        ok = false;
        break;
      }
      hoursSum += leg.hours;
      hoursAt.push(hoursSum);
      fuelSum += leg.fuelL;
      distSum += leg.distKm;
      maxWave = Math.max(maxWave, leg.waveM);
      maxWind = Math.max(maxWind, leg.windKmh);
      rough = rough || leg.rough;
      shallowFlag = shallowFlag || leg.shallow;
      veryShallowFlag = veryShallowFlag || leg.veryShallow;
      nearLandFlag = nearLandFlag || leg.nearLand;
      draftShallowFlag = draftShallowFlag || leg.draftShallow;
      hazardFlag = hazardFlag || leg.hazard;
      hazardNearPortFlag = hazardNearPortFlag || leg.hazardNearPort;
      lowSeen = lowSeen || leg.lowSeen;
      lowFar = lowFar || leg.lowFar;
      following = following || leg.following;
      seaImpassableFlag = seaImpassableFlag || leg.seaImpassable;
      segRisks.push(legInfoRisk(leg));
    }
    return {
      ok, hoursSum, hoursAt, fuelSum, distSum, maxWave, maxWind,
      rough, shallowFlag, veryShallowFlag, nearLandFlag, draftShallowFlag,
      hazardFlag, hazardNearPortFlag,
      // có chỗ thấp, và MỌI chỗ thấp đều là chuyện ở cảng
      nearPortOnly: lowSeen && !lowFar,
      following, seaImpassable: seaImpassableFlag, segRisks,
    };
  };

  /*  ═══ MỌI CẠNH TRẢ VỀ PHẢI QUA KIỂM NGHIÊM ═══ (2026-08-16, thẩm định P0)

      LỖI ĐÃ SỬA: Dijkstra chỉ chứng minh đi được giữa các NÚT LƯỚI đã snap,
      rồi hai đầu bị thay bằng toạ độ THẬT của bà con (`waypoints` dựng ở trên).
      Cạnh `start → nút thứ hai` và `nút kế cuối → dest` chưa ai kiểm. Vòng kéo
      dây có gọi `legCost(..., false)` nhưng khi cạnh gốc `!feasible` nó vẫn
      giữ nguyên `bestJ = i + 1` — tức GIỮ LẠI cạnh không đi được. Và bước cuối
      `walk(waypoints, true)` chạy **relaxed** (không chặn gì) mà `ok` thì
      KHÔNG AI ĐỌC ⇒ tuyến cắt đất/bãi cạn/vùng sóng cấm vẫn được trả về, kèm
      số liệu đẹp và câu chữ "đã né rạn".

      Nay: đi lại trọn tuyến ở chế độ NGHIÊM. Hỏng thì lùi về đường Dijkstra
      chưa kéo dây (nó đi theo nút lưới nên an toàn hơn, chỉ xấu hơn về hình
      dáng); vẫn hỏng thì `null` — chỗ gọi đã có đường xử đúng: nới bbox thử
      lại, hết margin thì nói thẳng "chưa tìm được đường an toàn". Thà không có
      tuyến còn hơn một tuyến cắt qua đảo.  */
  if (!walk(waypoints, false, seaAsPenalty).ok) {
    const raw: LatLon[] = [start, ...nodePath.slice(1, -1).map(pointOf), dest];
    // kéo dây lẫn đường Dijkstra thô đều hỏng ở lượt nghiêm → thử best-effort
    if (!walk(raw, false, seaAsPenalty).ok)
      return seaAsPenalty ? null : planRoute(args, true);
    waypoints = raw;
  }

  /*  `relaxed: true` ở đây CHỈ để gom số liệu hiển thị của tuyến VỪA ĐƯỢC KIỂM
      ở trên — không bao giờ cụt giữa chừng nên tổng luôn là của cả tuyến. Nó
      KHÔNG còn là chỗ quyết định tuyến có hợp lệ hay không. */
  const chosen = walk(waypoints, true, seaAsPenalty);

  // cửa sổ dự báo thật sự có số liệu — quá mốc này hourAt đóng băng giờ cuối,
  // phải báo ra ngoài thay vì để phần đuôi tuyến "êm giả"
  let fieldHours = 0;
  for (const c of field.cells) {
    if (c.onSea && c.hours.length > fieldHours) fieldHours = c.hours.length;
  }
  const beyondH = (tripHours: number) =>
    Math.max(0, Math.ceil(departHourIdx + tripHours - fieldHours));

  // đường thẳng để so sánh trung thực — chia nhỏ theo bước lưới
  const directDist = haversineKm(start, dest);
  const nSeg = Math.max(2, Math.ceil(directDist / stepKm));
  const directPts: LatLon[] = Array.from({ length: nSeg + 1 }, (_, k) =>
    lerp(start, dest, k / nSeg),
  );
  const directWalk = walk(directPts, false, seaAsPenalty);
  const direct = directWalk.ok
    ? {
        distKm: directWalk.distSum,
        hours: directWalk.hoursSum,
        fuelL: directWalk.fuelSum,
        maxWaveM: directWalk.maxWave,
      }
    : null;

  // TRẦN ĐƯỜNG VÒNG: đường thẳng đi được vật lý mà tuyến vòng quá 30% →
  // trả đường thẳng + cảnh báo thật, thuyền trưởng tự quyết.
  // BEST-EFFORT KHÔNG áp trần: lúc biển động, một đường vòng dài né bớt ô ≥4 m
  // đáng giá hơn đường thẳng đâm thẳng vào sóng dữ — đừng ép về chạy thẳng.
  if (!seaAsPenalty && direct && chosen.distSum > directDist * MAX_DETOUR_RATIO) {
    return {
      waypoints: directPts,
      distKm: directWalk.distSum,
      hours: directWalk.hoursSum,
      hoursAt: directWalk.hoursAt,
      fuelL: directWalk.fuelSum,
      maxWaveM: directWalk.maxWave,
      maxWindKmh: directWalk.maxWind,
      hasRoughLeg: directWalk.rough,
      hasShallowLeg: directWalk.shallowFlag,
      hasVeryShallowLeg: directWalk.veryShallowFlag,
      hasNearLandLeg: directWalk.nearLandFlag,
      hasDraftShallowLeg: directWalk.draftShallowFlag,
      nearPortOnly: directWalk.nearPortOnly,
      hasFollowingSeaRisk: directWalk.following,
      depthChecked: depth != null,
      /*  Nhánh trần-đường-vòng CHỈ chạy khi `direct` khác null, mà `direct` là
          kết quả của `walk(directPts, false)` — đi qua đúng `legCost` nghiêm.
          Nên đường thẳng trả về ở đây KHÔNG THỂ xuyên xác tàu/giàn/vùng cấm;
          có xuyên thì `direct` đã null và nhánh này không tồn tại. (Test
          `route-plan-hazards` canh đúng điều này.) */
      hazardChecked,
      hasHazardLeg: directWalk.hazardFlag,
      hasHazardNearPortLeg: directWalk.hazardNearPortFlag,
      cappedToDirect: true,
      direct,
      fuelDeltaL: 0,
      beyondForecastH: beyondH(directWalk.hoursSum),
      bestEffortSeas: directWalk.seaImpassable,
      segRisks: directWalk.segRisks,
    };
  }

  return {
    waypoints,
    distKm: chosen.distSum,
    hours: chosen.hoursSum,
    hoursAt: chosen.hoursAt,
    fuelL: chosen.fuelSum,
    maxWaveM: chosen.maxWave,
    maxWindKmh: chosen.maxWind,
    hasRoughLeg: chosen.rough,
    hasShallowLeg: chosen.shallowFlag,
    hasVeryShallowLeg: chosen.veryShallowFlag,
    hasNearLandLeg: chosen.nearLandFlag,
    hasDraftShallowLeg: chosen.draftShallowFlag,
    nearPortOnly: chosen.nearPortOnly,
    hasFollowingSeaRisk: chosen.following,
    depthChecked: depth != null,
    hazardChecked,
    hasHazardLeg: chosen.hazardFlag,
    hasHazardNearPortLeg: chosen.hazardNearPortFlag,
    cappedToDirect: false,
    direct,
    fuelDeltaL: direct ? chosen.fuelSum - direct.fuelL : null,
    beyondForecastH: beyondH(chosen.hoursSum),
    bestEffortSeas: chosen.seaImpassable,
    segRisks: chosen.segRisks,
  };
}

// ── helpers hiển thị / thời gian ─────────────────────────────────────────

/** 9,58 giờ → "9 giờ 35 phút" (làm tròn 5 phút) */
export function formatHoursVN(h: number): string {
  const totalMin = Math.round((h * 60) / 5) * 5;
  const hh = Math.floor(totalMin / 60);
  const mm = totalMin % 60;
  if (hh === 0) return `${mm} phút`;
  return mm === 0 ? `${hh} giờ` : `${hh} giờ ${mm} phút`;
}

/** Giờ hiện tại theo múi giờ VN (0–23) — khớp trục giờ dự báo Open-Meteo */
export function vnHourIndex(now: Date): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", {
      hour: "numeric",
      hour12: false,
      timeZone: "Asia/Ho_Chi_Minh",
    }).format(now),
  );
}
