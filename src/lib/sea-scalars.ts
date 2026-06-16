// Trục 1 — các LỚP SỐ LIỆU BIỂN bổ sung (đủ bộ như app thương mại):
//   · ssha — dị thường mực nước (nhô = xoáy ấm, lõm = xoáy lạnh gom mồi)
//   · sss  — độ mặn mặt biển (ranh mặn–nhạt cửa sông)
// Nguồn: NOAA ERDDAP công khai (không key) — vẽ thành ô màu ~0.5° đè lên nền
// hải đồ. (Tầng nhiệt/thermocline: nguồn miễn phí đã ngừng cập nhật 2024 —
// chưa làm, KHÔNG dùng dữ liệu cũ giả làm mới.)
//
// Đổi nguồn chỉ sửa url()/parse ở đây; toán parse dùng chung fish-predict.

import { parseErddapGrid, type ScalarGrid } from "@/lib/fish-predict";
import { apiUrl } from "@/lib/api-base";

export type SeaScalarKind = "ssha" | "sss";

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
      const r = await fetcher(def.url(t), { next: { revalidate: 21600 } });
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

/** Client gọi route nội bộ */
export async function fetchSeaScalar(
  kind: SeaScalarKind,
): Promise<SeaScalarResult> {
  try {
    const r = await fetch(apiUrl(`/api/sea-scalar?kind=${kind}`));
    if (!r.ok) return { ok: false };
    return (await r.json()) as SeaScalarResult;
  } catch {
    return { ok: false };
  }
}
