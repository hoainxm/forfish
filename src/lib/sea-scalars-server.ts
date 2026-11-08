// LỚP SỐ LIỆU BIỂN — phần MÁY CHỦ: nguồn, URL, mốc thử, dựng ô (tách khỏi sea-scalars.ts 2026-11-08,
// docs/app-map/ops/khong-lo-nguon.md nợ #6). CHỈ route `/api/sea-scalar` + cron (`thoi-tiet-lam-moi`) import.
// Máy bà con chỉ thấy nhãn + thang màu + ô số (`SeaScalarCell`).
//
// Nguồn: ERDDAP công khai (không key). (Tầng nhiệt: nguồn miễn phí ngừng 2024 — chưa làm, không giả mới.)

import { parseErddapGrid, ERDDAP_UA, type ScalarGrid } from "@/lib/fish-predict";
import { timeoutSignal } from "@/lib/abort";
import type { SeaScalarCell, SeaScalarKind, SeaScalarResult } from "@/lib/sea-scalars";

const ERDDAP = "https://coastwatch.noaa.gov/erddap/griddap";
// bbox vùng biển VN, bước 0.5° (đủ cho cấu trúc xoáy/ranh mặn cỡ vài chục km)
const BBOX = `%5B(5.0):2:(22.0)%5D%5B(102.0):2:(118.0)%5D`;

export interface SeaScalarSource {
  /** timeSel: "(last)" | "(last-1)"… — nguồn quét theo vệt cần lùi ngày */
  url: (timeSel: string) => string;
  hasAltitude: boolean;
  /** các mốc thời gian thử lần lượt tới khi có dữ liệu */
  timeAttempts: string[];
}

export const NGUON: Record<SeaScalarKind, SeaScalarSource> = {
  ssha: {
    url: (t) => `${ERDDAP}/noaacwBLENDEDsshDaily.json?sla%5B${encodeURIComponent(t)}%5D${BBOX}`,
    hasAltitude: false,
    timeAttempts: ["(last)"],
  },
  sss: {
    url: (t) => `${ERDDAP}/noaacwSMOSsssDaily.json?sss%5B${encodeURIComponent(t)}%5D%5B(0.0)%5D${BBOX}`,
    hasAltitude: true,
    // vệ tinh độ mặn quét theo vệt — ngày cuối có thể trống vùng VN, lùi dần
    timeAttempts: ["(last)", "(last-1)", "(last-2)", "(last-3)"],
  },
};

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

/** Server route dùng: kéo nguồn + parse + dựng ô */
export async function loadSeaScalar(
  kind: SeaScalarKind,
  fetcher: typeof fetch = fetch,
): Promise<SeaScalarResult> {
  const def = NGUON[kind];
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

