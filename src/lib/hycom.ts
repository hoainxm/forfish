// Trục 1 — TẦNG NHIỆT (thermocline) từ HYCOM ESPC-D-V02 cho dự báo cá.
//
// Nguồn: HYCOM/NRL Navy ESPC-D-V02 (công khai, KHÔNG cần key) qua OPeNDAP
// THREDDS — lưới toàn cầu 1/12° (lat 0.04°, lon 0.08°), 40 tầng sâu 0–5000 m,
// nhiệt độ nước theo tầng, cập nhật ~3 giờ/lần, trễ ~1–2 ngày (nowcast).
//
// Yếu tố rút ra: ĐỘ SÂU ĐẲNG NHIỆT 20°C (D20) — chỉ báo tầng cá ngừ/cá nổi lớn
// (cá ngừ vây vàng, mắt to, cá cờ bám rìa tầng nhiệt). D20 sâu = lớp nước ấm
// dày, vừa = ngư trường tốt; quá nông (nước trồi lạnh sát mặt) hoặc quá sâu
// (không có cấu trúc tầng) thì kém hấp dẫn cá ngừ.
//
// Giải mã đã kiểm chứng (2026-06-11): water_temp Int16 → °C = giá_trị*0.001+20;
// _FillValue = -30000 (đáy biển / đất → NaN). Trục: lat[k]=0.04*k-80 (tăng),
// lon[m]=0.08*m (tăng). Bản ascii OPeNDAP tự kèm mảng depth/lat/lon thật.

import { ERDDAP_UA, type ScalarGrid } from "./fish-predict";

const DODS = "https://tds.hycom.org/thredds/dodsC/ESPC-D-V02/t3z";

// Hộp vùng biển VN, bước thưa (~0.48°) — trường tầng nhiệt mượt, cỡ này đủ và
// gọn (~21k số/lần). Chỉ số đã verify: lat 2125→5.0°N, 2545→21.8°N;
// lon 1275→102.0°E, 1473→117.84°E; depth 8→20 m, 24→300 m.
const LAT_RANGE = "2125:12:2545"; // 5–21.8°N
const LON_RANGE = "1275:6:1473"; // 102–117.8°E
const DEPTH_RANGE = "8:1:24"; // 20–300 m (17 tầng — phủ dải cắt 20°C)

const HYCOM_SCALE = 0.001;
const HYCOM_OFFSET = 20;
const HYCOM_FILL = -30000;

/** Giải mã 1 ô Int16 → °C, fill → NaN */
export function decodeTemp(raw: number): number {
  return raw === HYCOM_FILL ? NaN : raw * HYCOM_SCALE + HYCOM_OFFSET;
}

/** Giờ-từ-2000-01-01 (UTC) → 'YYYY-MM-DD' */
export function hycomHoursToISO(hours: number): string {
  const ms = Date.UTC(2000, 0, 1) + hours * 3600_000;
  return new Date(ms).toISOString().slice(0, 10);
}

export interface HycomTempCube {
  depths: number[]; // m, tăng dần
  lats: number[]; // °N, tăng dần
  lons: number[]; // °E, tăng dần
  /** temp[iDepth][iLat][iLon] °C, NaN = thiếu/đáy */
  temp: number[][][];
  /** ngày dữ liệu YYYY-MM-DD (từ trục time) */
  date: string;
}

/**
 * Parse bản OPeNDAP ascii của water_temp[time=1][depth][lat][lon].
 * Dòng dữ liệu: `[t][d][la], v0, v1, …` (các v theo lon). Cuối bản có các mảng
 * `water_temp.depth/lat/lon/time` cho toạ độ THẬT — đọc thẳng, khỏi tự suy chỉ số.
 */
export function parseHycomTempAscii(text: string): HycomTempCube {
  const lines = text.split("\n");
  // các mảng toạ độ ở cuối
  const readArray = (name: string): number[] => {
    const idx = lines.findIndex((l) => l.trim().startsWith(`water_temp.${name}[`));
    if (idx < 0) return [];
    // giá trị nằm ở (các) dòng ngay sau nhãn, tới dòng trống
    const out: number[] = [];
    for (let k = idx + 1; k < lines.length; k++) {
      const s = lines[k].trim();
      if (!s) break;
      for (const tok of s.split(",")) {
        const v = Number(tok.trim());
        if (Number.isFinite(v)) out.push(v);
      }
    }
    return out;
  };
  const depths = readArray("depth");
  const lats = readArray("lat");
  const lons = readArray("lon");
  const time = readArray("time");
  const date = time.length ? hycomHoursToISO(time[0]) : "";

  const nD = depths.length;
  const nLa = lats.length;
  const nLo = lons.length;
  const temp: number[][][] = depths.map(() =>
    lats.map(() => new Array<number>(nLo).fill(NaN)),
  );

  // dòng dữ liệu: "[t][d][la], v0, v1, ..."
  const rowRe = /^\[(\d+)\]\[(\d+)\]\[(\d+)\],\s*(.+)$/;
  for (const raw of lines) {
    const m = rowRe.exec(raw.trim());
    if (!m) continue;
    const d = Number(m[2]);
    const la = Number(m[3]);
    if (d >= nD || la >= nLa) continue;
    const vals = m[4].split(",");
    for (let lo = 0; lo < nLo && lo < vals.length; lo++) {
      temp[d][la][lo] = decodeTemp(Number(vals[lo].trim()));
    }
  }
  return { depths, lats, lons, temp, date };
}

/**
 * Độ sâu đẳng nhiệt 20°C (m) của MỘT cột nước: quét nông→sâu, tìm lần đầu
 * nhiệt độ vượt xuống dưới 20°C, nội suy tuyến tính. NaN nếu cột không cắt 20°C
 * (đáy nông luôn >20°C, hoặc thiếu dữ liệu).
 */
export function iso20Depth(depths: number[], temps: number[]): number {
  let prevD = NaN;
  let prevT = NaN;
  for (let i = 0; i < depths.length; i++) {
    const t = temps[i];
    if (!Number.isFinite(t)) continue;
    if (Number.isFinite(prevT)) {
      if (prevT >= 20 && t < 20) {
        // nội suy giữa (prevD,prevT) và (depths[i],t)
        const f = (prevT - 20) / (prevT - t);
        return prevD + f * (depths[i] - prevD);
      }
    }
    prevD = depths[i];
    prevT = t;
  }
  return NaN;
}

/** Cube nhiệt theo tầng → lưới D20 (ScalarGrid, values = m) */
export function iso20Grid(cube: HycomTempCube): ScalarGrid {
  const values = cube.lats.map((_, la) =>
    cube.lons.map((__, lo) => {
      const col = cube.depths.map((_, d) => cube.temp[d][la][lo]);
      return iso20Depth(cube.depths, col);
    }),
  );
  return { lats: cube.lats, lons: cube.lons, values, date: cube.date };
}

/**
 * Nhiệt độ ĐÁY (°C) mỗi ô: nhiệt của TẦNG SÂU NHẤT CÒN HỮU HẠN trong cột (đáy
 * trong dải tải 20–300 m). HYCOM đánh dấu tầng dưới đáy/đất = fill → NaN, nên
 * tầng hữu hạn sâu nhất là lớp nước sát đáy (ở nơi đáy < 300 m) hoặc lớp 300 m
 * (nơi sâu hơn dải tải). TỰ NHẤT QUÁN theo cube — KHÔNG trộn độ sâu ETOPO
 * (bathymetry khác → NaN rải rác/sai). Cột không có tầng hữu hạn nào → NaN.
 */
export function bottomTempGrid(cube: HycomTempCube): ScalarGrid {
  const nD = cube.depths.length;
  const values = cube.lats.map((_, la) =>
    cube.lons.map((__, lo) => {
      for (let d = nD - 1; d >= 0; d--) {
        const t = cube.temp[d][la][lo];
        if (Number.isFinite(t)) return t;
      }
      return NaN;
    }),
  );
  return { lats: cube.lats, lons: cube.lons, values, date: cube.date };
}

/**
 * Nhiệt độ (°C) tại TẦNG gần `depthM` nhất mỗi ô (vd 250 m cho cá ngừ mắt to
 * lặn ngày). Chọn tầng theo khoảng cách độ sâu; ô mà tầng đó là fill (đáy nông
 * hơn depthM) → NaN (mô hình sẽ fallback về nhiệt mặt cho ô đó). Dùng lại CÙNG
 * cube — không fetch thêm.
 */
export function tempAtDepthGrid(cube: HycomTempCube, depthM: number): ScalarGrid {
  const di = nearestDepthIndex(cube.depths, depthM);
  const values = cube.lats.map((_, la) =>
    cube.lons.map((__, lo) =>
      di >= 0 ? cube.temp[di][la][lo] : NaN,
    ),
  );
  return { lats: cube.lats, lons: cube.lons, values, date: cube.date };
}

/** Chỉ số tầng gần `depthM` nhất trong mảng độ sâu (rỗng → -1) */
function nearestDepthIndex(depths: number[], depthM: number): number {
  let best = -1;
  let bd = Infinity;
  for (let i = 0; i < depths.length; i++) {
    const d = Math.abs(depths[i] - depthM);
    if (d < bd) {
      bd = d;
      best = i;
    }
  }
  return best;
}

/** Lấy số mốc thời gian hiện có từ .dds (để lấy mốc mới nhất = nowcast) */
export function parseTimeCount(dds: string): number {
  const m = /time\s*=\s*(\d+)\s*\]/.exec(dds);
  return m ? Number(m[1]) : 0;
}

export function thermoGridUrl(timeIdx: number): string {
  const enc = (s: string) => s.replace(/\[/g, "%5B").replace(/\]/g, "%5D");
  // OPeNDAP ascii: ràng buộc = .ascii?<biến>[time][depth][lat][lon]
  return `${DODS}.ascii?water_temp${enc(
    `[${timeIdx}][${DEPTH_RANGE}][${LAT_RANGE}][${LON_RANGE}]`,
  )}`;
}

/** Độ sâu (m) lấy nhiệt cho loài đáy-sâu (cá ngừ mắt to lặn ngày ~250 m) */
export const DEEP_TUNA_DEPTH_M = 250;

/**
 * Bộ lưới rút từ MỘT cube HYCOM (fetch 1 lần, dùng lại cho nhiều yếu tố):
 *   `d20`     — độ sâu đẳng nhiệt 20°C (m) cho tầng cá ngừ nổi
 *   `bottom`  — nhiệt độ ĐÁY (°C) cho loài sống đáy/rạn/giáp xác
 *   `deep250` — nhiệt độ tầng ~250 m (°C) cho cá ngừ mắt to lặn ngày
 * Mỗi lưới TUỲ CHỌN (null nếu không đủ ô hữu hạn); cả bộ null nếu cube vỡ.
 */
export interface HycomGrids {
  d20: ScalarGrid | null;
  bottom: ScalarGrid | null;
  deep250: ScalarGrid | null;
}

/** true nếu lưới có ít nhất 1 ô hữu hạn (đáng dùng), ngược lại null-hoá */
function usable(g: ScalarGrid): ScalarGrid | null {
  return g.values.some((row) => row.some((v) => Number.isFinite(v))) ? g : null;
}

/**
 * Tải cube nhiệt HYCOM 1 LẦN cho vùng biển VN rồi rút NHIỀU lưới (D20 tầng cá
 * ngừ + nhiệt đáy + nhiệt 250 m). TUỲ CHỌN với mô hình dự báo cá — cube vỡ/timeout
 * → trả null, mô hình fallback (loài đáy về nhiệt mặt, cá ngừ bỏ yếu tố tầng nhiệt).
 * KHÔNG mở rộng DEPTH_RANGE / KHÔNG fetch thêm — route sát maxDuration 60 s.
 */
export async function fetchHycomGrids(): Promise<HycomGrids | null> {
  try {
    // OPeNDAP HYCOM có thể treo → BẮT BUỘC timeout (invariant 02 §5); fail-fast
    // null để không treo `await hycomP` trong route fish-forecast.
    const opt = () => ({
      next: { revalidate: 21600 },
      signal: AbortSignal.timeout(20000),
      // UA "thật" — nhiều host khoa học (NOAA/HYCOM) chặn undici mặc định 403
      headers: { "User-Agent": ERDDAP_UA },
    });
    const dds = await fetch(`${DODS}.dds`, opt()).then((r) =>
      r.ok ? r.text() : "",
    );
    const n = parseTimeCount(dds);
    if (!n) return null;
    const res = await fetch(thermoGridUrl(n - 1), opt());
    if (!res.ok) return null;
    const cube = parseHycomTempAscii(await res.text());
    if (cube.lats.length === 0 || cube.depths.length === 0) return null;
    return {
      d20: usable(iso20Grid(cube)),
      bottom: usable(bottomTempGrid(cube)),
      deep250: usable(tempAtDepthGrid(cube, DEEP_TUNA_DEPTH_M)),
    };
  } catch {
    return null;
  }
}

/**
 * Tương thích ngược: chỉ lưới D20 (độ sâu đẳng nhiệt 20°C). Dùng lại
 * `fetchHycomGrids` để không fetch trùng.
 */
export async function fetchThermoclineGrid(): Promise<ScalarGrid | null> {
  return (await fetchHycomGrids())?.d20 ?? null;
}
