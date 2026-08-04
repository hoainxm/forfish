// Trục 1 — các LỚP SỐ LIỆU BIỂN bổ sung (đủ bộ như app thương mại):
//   · ssha — dị thường mực nước (nhô = xoáy ấm, lõm = xoáy lạnh gom mồi)
//   · sss  — độ mặn mặt biển (ranh mặn–nhạt cửa sông)
// Nguồn: NOAA ERDDAP công khai (không key) — vẽ thành ô màu ~0.5° đè lên nền
// hải đồ. (Tầng nhiệt/thermocline: nguồn miễn phí đã ngừng cập nhật 2024 —
// chưa làm, KHÔNG dùng dữ liệu cũ giả làm mới.)
//
// Đổi nguồn chỉ sửa url()/parse ở đây; toán parse dùng chung fish-predict.

import { parseErddapGrid, ERDDAP_UA, type ScalarGrid } from "@/lib/fish-predict";
import { apiUrl } from "@/lib/api-base";
import { saveForecast, loadForecast } from "@/lib/forecast-cache";
import { forecastStoreReady } from "@/lib/forecast-store";
import { seaScalarSnapshotId } from "@/lib/weather-snapshot-id";
import { timeoutSignal } from "@/lib/abort";

export type SeaScalarKind = "ssha" | "sss";

/** Namespace cache offline cho lớp số liệu biển (nước dâng/xoáy…) — cùng nếp
 *  forecast-cache như gió/sóng/lớp màu, để ra khơi mất sóng vẫn xem lại được. */
export const SEA_SCALAR_NS = "seascalar";

export interface SeaScalarDef {
  id: SeaScalarKind;
  /** nhãn nút — từ đời thường */
  label: string;
  help: string;
  legend: { from: string; to: string; gradient: string };
  /** stops cho MapLibre interpolate: [v, màu, v, màu…] */
  colorStops: (number | string)[];
  /** timeSel: "(last)" | "(last-1)"… — nguồn quét theo vệt cần lùi ngày */
  url: (timeSel: string) => string;
  hasAltitude: boolean;
  /** các mốc thời gian thử lần lượt tới khi có dữ liệu */
  timeAttempts: string[];
}

const ERDDAP = "https://coastwatch.noaa.gov/erddap/griddap";
// bbox vùng biển VN, bước 0.5° (đủ cho cấu trúc xoáy/ranh mặn cỡ vài chục km)
const BBOX = `%5B(5.0):2:(22.0)%5D%5B(102.0):2:(118.0)%5D`;

/*
  Màu là nội dung bản đồ (thang khoa học quen mắt), không phải token UI.
  SLA đo bằng MÉT (đã probe −0.03…0.31 quanh VN 6/2026).
*/
export const SEA_SCALARS: Record<SeaScalarKind, SeaScalarDef> = {
  ssha: {
    id: "ssha",
    label: "Nước dâng, xoáy",
    help: "Mặt biển NHÔ lên (đỏ) là xoáy nước ấm, LÕM xuống (xanh) là xoáy lạnh gom mồi — cá hay tụ quanh rìa xoáy, chỗ màu đổi.",
    legend: {
      from: "Lõm — xoáy lạnh",
      to: "Nhô — xoáy ấm",
      gradient:
        "linear-gradient(90deg,#2166ac,#92c5de,#e8e4dd,#f4a582,#b2182b)",
    },
    colorStops: [-0.15, "#2166ac", -0.05, "#92c5de", 0.05, "#e8e4dd", 0.15, "#f4a582", 0.3, "#b2182b"],
    url: (t) =>
      `${ERDDAP}/noaacwBLENDEDsshDaily.json?sla%5B${encodeURIComponent(t)}%5D${BBOX}`,
    hasAltitude: false,
    timeAttempts: ["(last)"],
  },
  sss: {
    id: "sss",
    label: "Độ mặn",
    help: "Nước NHẠT (tím — cửa sông, sau mưa) khác nước MẶN ngoài khơi (xanh đậm); nhiều loài bám theo ranh mặn–nhạt. Vệ tinh đo theo vệt — chỗ trống là chưa quét tới, không phải thiếu cá.",
    legend: {
      from: "Nhạt — gần cửa sông",
      to: "Mặn — ngoài khơi",
      gradient:
        "linear-gradient(90deg,#7b3294,#c2a5cf,#e8e4dd,#80cdc1,#01665e)",
    },
    colorStops: [28, "#7b3294", 31, "#c2a5cf", 33, "#e8e4dd", 34, "#80cdc1", 35.5, "#01665e"],
    url: (t) =>
      `${ERDDAP}/noaacwSMOSsssDaily.json?sss%5B${encodeURIComponent(t)}%5D%5B(0.0)%5D${BBOX}`,
    hasAltitude: true,
    // vệ tinh độ mặn quét theo vệt — ngày cuối có thể trống vùng VN, lùi dần
    timeAttempts: ["(last)", "(last-1)", "(last-2)", "(last-3)"],
  },
};

// UI chỉ bày lớp CÓ nguồn sống. Độ mặn (sss) tạm rút: SMOS bị nhiễu RFI che
// trắng cả Biển Đông, SMAP (GIBS lẫn ERDDAP) ngừng cập nhật từ 2021–22 —
// code + test giữ nguyên, có nguồn sống thì thêm "sss" lại vào đây là chạy.
export const SEA_SCALAR_ORDER: SeaScalarKind[] = ["ssha"];

export interface SeaScalarCell {
  lat: number;
  lon: number;
  v: number;
}

/** Lưới → danh sách ô có số (bỏ NaN/đất liền), làm tròn gọn để trả về client */
export function buildScalarCells(grid: ScalarGrid): SeaScalarCell[] {
  const out: SeaScalarCell[] = [];
  for (let i = 0; i < grid.lats.length; i++) {
    for (let j = 0; j < grid.lons.length; j++) {
      const v = grid.values[i][j];
      if (!Number.isFinite(v)) continue;
      out.push({
        lat: Math.round(grid.lats[i] * 100) / 100,
        lon: Math.round(grid.lons[j] * 100) / 100,
        v: Math.round(v * 1000) / 1000,
      });
    }
  }
  return out;
}

export type SeaScalarResult =
  | { ok: true; kind: SeaScalarKind; date: string; cells: SeaScalarCell[] }
  | { ok: false };

/** Server route dùng: kéo nguồn + parse + dựng ô */
export async function loadSeaScalar(
  kind: SeaScalarKind,
  fetcher: typeof fetch = fetch,
): Promise<SeaScalarResult> {
  const def = SEA_SCALARS[kind];
  for (const t of def.timeAttempts) {
    try {
      // ERDDAP có thể treo → timeout/lần thử (invariant 02 §5); fail → mốc kế / {ok:false}
      // UA bắt buộc: coastwatch chặn 403 nếu thiếu (xem ERDDAP_UA fish-predict)
      const r = await fetcher(def.url(t), {
        next: { revalidate: 21600 },
        signal: timeoutSignal(20000),
        headers: { "User-Agent": ERDDAP_UA },
      });
      if (!r.ok) continue;
      const grid = parseErddapGrid(await r.json(), {
        hasAltitude: def.hasAltitude,
      });
      const cells = buildScalarCells(grid);
      // quá thưa (vệt quét lệch vùng) → lùi ngày tiếp
      if (cells.length < 20) continue;
      return { ok: true, kind, date: grid.date, cells };
    } catch {
      // thử mốc kế
    }
  }
  return { ok: false };
}

/** Snapshot lớp số liệu biển do cron tính sẵn (same-origin) — null nếu chưa có */
async function loadSeaScalarSnapshot(
  kind: SeaScalarKind,
): Promise<SeaScalarResult | null> {
  try {
    const r = await fetch(
      apiUrl(`/api/weather-snapshot?id=${seaScalarSnapshotId(kind)}`),
      { signal: timeoutSignal(10000) },
    );
    if (!r.ok) return null;
    const j = (await r.json()) as SeaScalarResult;
    return j && j.ok && Array.isArray(j.cells) && j.cells.length > 0 ? j : null;
  } catch {
    return null;
  }
}

/**
 * Client gọi lấy lớp số liệu biển. ƯU TIÊN SNAPSHOT cron (same-origin, không đập
 * ERDDAP hay treo/403) → live → bản đã lưu. LƯU vào máy khi được để mất sóng vẫn
 * xem lại được (2026-07-29: thêm snapshot server như các lớp khác).
 */
/**
 * CÓ ĐƯỢC GHI ĐÈ BẢN ĐANG CÓ KHÔNG — THUẦN, có test (thêm 2026-08-02h).
 *
 * VÌ SAO CÓ: lớp này là namespace DUY NHẤT trong họ `forfish.fc.*` không có cửa
 * ghi đè nào — `forecast-grid` có `shouldOverwriteGrid`, `scalar-field` có
 * `shouldOverwriteScalar`, `storms` vừa được cấp cửa chống đi lùi, còn đây thì
 * `saveForecast(...)` trần.
 *
 * Hai chỗ thủng, cả hai đều nổ về phía MẤT DỮ LIỆU:
 *  · cửa nhận SNAPSHOT lỏng hơn cửa ĐỌC — `loadSeaScalarSnapshot` chỉ đòi
 *    `cells.length > 0`, trong khi `loadSeaScalar` đòi `>= 20` mới coi là dùng
 *    được. Một snapshot 1 ô đè lên lưới đầy đã lưu, rồi chính app lại coi bản
 *    vừa ghi là KHÔNG dùng được;
 *  · `savedAt` lấy `Date.now()` nên bản nghèo còn trông TƯƠI HƠN bản vừa bị xoá.
 *
 * Luật: bản mới phải KHÔNG ÍT Ô HƠN bản đang giữ. Ít hơn thì từ chối ghi — phiên
 * này vẫn xem được bản vừa lấy (hàm gọi vẫn trả nó ra), chỉ là không đem bản
 * nghèo đó thay bản tốt trong kho.
 */
/** Bản đang giữ cũ hơn ngần này thì cho đè dù nghèo hơn — cửa thoát chống
 *  "kẹt vĩnh viễn" khi nguồn đổi độ phân giải / thu hẹp vùng phủ. 3 ngày: lớp
 *  này là "xem cho biết", không phải an toàn tính mạng như lưới gió/sóng. */
export const SEA_SCALAR_OVERWRITE_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;

export function shouldOverwriteSeaScalar(
  prev: { data: SeaScalarResult; savedAt?: number } | null | undefined,
  next: SeaScalarResult,
  now: number = Date.now(),
): boolean {
  const soO = (r: SeaScalarResult | null | undefined): number =>
    r && r.ok && Array.isArray(r.cells) ? r.cells.length : 0;
  const cu = soO(prev?.data);
  if (cu === 0) return true;
  /*  CỬA THOÁT (thêm 2026-08-02i — vòng đánh giá cuối bắt): không có nó thì
      nguồn Copernicus đổi độ phân giải / thu hẹp vùng phủ là **mọi bản mới đều
      ít ô hơn ⇒ không bao giờ ghi được nữa**, `savedAt` đứng yên vĩnh viễn.
      Đúng khuôn "kẹt vĩnh viễn 2026-07-25". */
  const cuLau =
    prev?.savedAt != null && now - prev.savedAt >= SEA_SCALAR_OVERWRITE_MAX_AGE_MS;
  if (cuLau) return true;
  return soO(next) >= cu;
}

/** Ghi nếu bản mới không nghèo hơn bản đang giữ. Trả `true` khi đã ghi. */
function saveSeaScalarChecked(kind: SeaScalarKind, next: SeaScalarResult): boolean {
  const prev = loadForecast<SeaScalarResult>(SEA_SCALAR_NS, kind);
  if (!shouldOverwriteSeaScalar(prev, next)) return false;
  return saveForecast(SEA_SCALAR_NS, kind, next);
}

export async function fetchSeaScalar(
  kind: SeaScalarKind,
): Promise<SeaScalarResult> {
  /*  CHỜ KHO MỞ XONG RỒI MỚI ĐỌC BẢN LƯU (2026-08-02k — vòng đánh giá cuối).
      Mất sóng thì `fetch` hỏng TỨC THÌ (không có độ trễ mạng che cửa sổ đua),
      nên nhánh lùi chạy khi gương còn rỗng ⇒ trả `null` ⇒ màn hình nói "chưa
      có" trong khi kho còn nguyên. Từ phiên thứ hai localStorage đã bị dọn nên
      không còn lớp chắn nào. Hàm đã async; `forecastStoreReady()` có trần chờ. */
  await forecastStoreReady();

  // 1) snapshot cron (nguồn ERDDAP hay chết → đây là đường chính đáng tin)
  const snap = await loadSeaScalarSnapshot(kind);
  if (snap && snap.ok) {
    saveSeaScalarChecked(kind, snap);
    return snap;
  }
  // 2) live
  try {
    const r = await fetch(apiUrl(`/api/sea-scalar?kind=${kind}`), {
      signal: timeoutSignal(25000),
    });
    if (r.ok) {
      const j = (await r.json()) as SeaScalarResult;
      if (j.ok) {
        saveSeaScalarChecked(kind, j);
        return j;
      }
    }
  } catch {
    // mạng lỗi → lùi về bản lưu bên dưới
  }
  // 3) bản đã lưu trong máy (mất sóng)
  const hit = loadForecast<SeaScalarResult>(SEA_SCALAR_NS, kind);
  return hit && hit.data.ok ? hit.data : { ok: false };
}

/** Đã lưu offline lớp số liệu biển `kind` chưa (thuần đọc — cho pretrip-status). */
export function savedSeaScalar(kind: SeaScalarKind): boolean {
  const hit = loadForecast<SeaScalarResult>(SEA_SCALAR_NS, kind);
  return !!hit && hit.data.ok;
}

/** Mốc lưu gần nhất của lớp số liệu biển `kind` (null nếu chưa lưu). */
export function savedSeaScalarAt(kind: SeaScalarKind): number | null {
  const hit = loadForecast<SeaScalarResult>(SEA_SCALAR_NS, kind);
  return hit ? hit.savedAt : null;
}
