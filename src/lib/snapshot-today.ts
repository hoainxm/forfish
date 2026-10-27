// SNAPSHOT "CHỈ HÔM NAY" cho khách + tài khoản thường (2026-10-27, anh Long: "thường ko có dự báo, chỉ có ngày hôm nay
// thôi"). Thuần. Route /api/weather-snapshot DỰNG id `…:d1` từ bản cron đã có (không bắt cron tính thêm, không lệch
// với bản đủ ngày): `grid:d1` ← cắt `grid:d3`; `scalar:<k>:d1` ← cắt `scalar:<k>:d3`; `sea:<cảng>:d1` ← ngày đầu của
// `sea:<cảng>`. Cắt theo đúng luật lấy mẫu của lưới (`truncateGrid` / `stepHourIndices`) nên bản cắt là TIỀN TỐ của
// bản đủ — y hệt thứ nguồn trả nếu xin 1 ngày.

import { stepHourIndices, truncateGrid, type ForecastGrid } from "@/lib/forecast-grid";

/** id hôm nay ⇒ id bản gốc để cắt; id thường ⇒ null. */
export function goc1Ngay(id: string): string | null {
  let m = /^grid:d1$/.exec(id);
  if (m) return "grid:d3";
  m = /^(scalar:[a-z]+):d1$/.exec(id);
  if (m) return `${m[1]}:d3`;
  m = /^(sea:[a-z0-9_-]+):d1$/.exec(id);
  if (m) return m[1];
  return null;
}

type Grid = { times?: string[]; cells?: { values?: unknown[]; hours?: unknown[] }[] };

/** Cắt payload gốc về hôm nay theo loại id. Payload lạ ⇒ trả nguyên (route vẫn đúng hợp đồng cũ). */
export function cat1Ngay(id: string, payload: unknown): unknown {
  if (payload == null || typeof payload !== "object") return payload;
  if (id.startsWith("grid:")) return truncateGrid(payload as ForecastGrid, 1);
  if (id.startsWith("scalar:")) {
    const g = payload as Grid;
    const times = g.times ?? [];
    const n = stepHourIndices(1, 25).length;
    if (times.length <= n) return payload;
    return { ...g, times: times.slice(0, n), cells: (g.cells ?? []).map((c) => ({ ...c, values: (c.values ?? []).slice(0, n) })) };
  }
  if (id.startsWith("sea:")) {
    if (Array.isArray(payload)) return payload.slice(0, 1);
    const p = payload as { days?: unknown[] };
    return Array.isArray(p.days) ? { ...p, days: p.days.slice(0, 1) } : payload;
  }
  return payload;
}
