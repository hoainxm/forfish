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

import { type ScalarGrid } from "./fish-predict";

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

/**
 * Tải lưới D20 (độ sâu đẳng nhiệt 20°C) cho vùng biển VN. TUỲ CHỌN với mô hình
 * dự báo cá — fail thì trả null, mô hình bỏ yếu tố tầng nhiệt + chia lại trọng số.
 */
export async function fetchThermoclineGrid(): Promise<ScalarGrid | null> {
  try {
    const opt = { next: { revalidate: 21600 } };
    const dds = await fetch(`${DODS}.dds`, opt).then((r) =>
      r.ok ? r.text() : "",
    );
    const n = parseTimeCount(dds);
    if (!n) return null;
    const res = await fetch(thermoGridUrl(n - 1), opt);
    if (!res.ok) return null;
    const cube = parseHycomTempAscii(await res.text());
    if (cube.lats.length === 0 || cube.depths.length === 0) return null;
    const grid = iso20Grid(cube);
    // ít nhất vài ô có D20 hợp lệ mới coi là dùng được
    const ok = grid.values.some((row) => row.some((v) => Number.isFinite(v)));
    return ok ? grid : null;
  } catch {
    return null;
  }
}
