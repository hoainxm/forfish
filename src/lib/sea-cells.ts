/*
  DỰNG Ô LƯỚI SỐ NGĂN GIÓ SÓNG — hàm thuần (tách khỏi fishing-map-view 2026-10-20,
  rà Codex lần 5). Bên gọi tra sẵn con nước / cá / độ sâu (cần dữ liệu trạm,
  lưới cá trong component), ở đây chỉ quyết THỨ TỰ + CHỮ của từng ô.

  THỨ TỰ = thứ quyết chuyện ra khơi trước: gió · giật · sóng · dòng · trời →
  con nước → nhiệt nước → âm lịch/trăng → cá/mùa → độ sâu. Ngăn chỉ cao 1/3
  màn, nên hàng đầu phải là số an toàn, không phải lịch.

  SỐ "LÚC NÀY" chỉ dùng khi là số MỚI của HÔM NAY (`!cond.stale`) — cùng luật
  với viên tóm tắt (`condSummary`). Bản lưu thì lấy mức cao nhất ngày, vì số
  "lúc này" của bản lưu là lúc LƯU chứ không phải lúc này.
*/
import { amLichFromIso, amLichText } from "@/lib/am-lich";
import {
  beaufort,
  formatNumberVN,
  windDirectionVN,
  type SeaPointConditions,
  type SeaPointDay,
} from "@/lib/marine-weather";
import { moonPhase } from "@/lib/moon";
import { tideHeightText } from "@/lib/tides";
import { weatherFromCode } from "@/lib/weather-codes";

export type SeaCell = {
  k: string;
  v: string;
  /** class màu token (text-warn / text-danger / text-trim); trống = navy */
  tone?: string;
  /** chiếm trọn hàng 3 cột */
  full?: boolean;
  /** chiếm 2 cột */
  span2?: boolean;
};

export type SeaCellTide = {
  /** chỉ hôm nay: mực nước lúc này + xu hướng */
  now?: { m: number; trend: "len" | "xuong" | "dung" } | null;
  /** con nước lớn/ròng (hôm nay: hai con kế tiếp; ngày khác: cả ngày) */
  events: { kind: "high" | "low"; atMs: number; heightM: number; ngayMai?: boolean }[];
};

export type SeaCellInput = {
  day: SeaPointDay;
  cond: Pick<SeaPointConditions, "windKmh" | "windDirDeg" | "waveM" | "curKmh" | "curDirDeg" | "stale">;
  isToday: boolean;
  tide: SeaCellTide | null;
  /** dự báo cá đã mở + đủ tin: nhiệt nước + tên loài */
  fish: { tempC: number; names: string[] } | null;
  /** cá theo mùa của vùng (khi không có dự báo cá) */
  season: string[];
  depth: { label: string; tone?: "danger" | "warn" | "plain" } | null;
};

const hhmmVN = (ms: number) => new Date(ms + 7 * 3600000).toISOString().slice(11, 16);

/** mưa to / dông = cảnh báo đầu ngăn (không thành ô); mưa thường = ô "Trời" */
export function seaWeather(day: SeaPointDay) {
  return weatherFromCode(day.wmoCode);
}

export function buildSeaCells({ day, cond, isToday, tide, fish, season, depth }: SeaCellInput): SeaCell[] {
  const cells: SeaCell[] = [];
  const fresh = isToday && !cond.stale;

  // ── gió ──
  const windNow = fresh && cond.windKmh != null ? beaufort(cond.windKmh) : null;
  const windMax = beaufort(day.windMaxKmh);
  const windDir = windNow != null ? cond.windDirDeg : day.windDirDeg;
  cells.push({ k: `Gió${windDir != null ? ` · ${windDirectionVN(windDir)}` : ""}`, v: `cấp ${windNow ?? windMax}` });
  if (windNow != null && windMax > windNow) cells.push({ k: "Gió tới", v: `cấp ${windMax}` });
  if (day.gustMaxKmh > 0) cells.push({ k: "Giật", v: `cấp ${beaufort(day.gustMaxKmh)}` });

  // ── sóng ── (ước theo gió ⇒ "~" + màu cảnh báo)
  const waveNow = fresh && cond.waveM != null ? cond.waveM : null;
  const waveMaxTxt = day.waveMaxM > 0 ? `${day.waveEstimated ? "~" : ""}${formatNumberVN(day.waveMaxM)} m` : "—";
  const estTone = day.waveEstimated ? "text-warn" : undefined;
  cells.push({
    k: "Sóng",
    v: waveNow != null ? `${formatNumberVN(waveNow)} m` : waveMaxTxt,
    tone: waveNow == null ? estTone : undefined,
  });
  // so theo số ĐÃ LÀM TRÒN 1 chữ lẻ: 0,86 vs 0,9 cùng in "0,9 m" — hai ô là trùng
  if (waveNow != null && Math.round(day.waveMaxM * 10) > Math.round(waveNow * 10))
    cells.push({ k: "Sóng tới", v: waveMaxTxt, tone: estTone });

  // ── dòng chảy ──
  const curNow = fresh && cond.curKmh != null;
  const curKmh = curNow ? cond.curKmh! : (day.curKmh ?? null);
  const curDir = curNow ? (cond.curDirDeg ?? null) : (day.curDirDeg ?? null);
  if (curKmh != null)
    cells.push({ k: `Dòng${curDir != null ? ` → ${windDirectionVN(curDir)}` : ""}`, v: `${formatNumberVN(curKmh)} km/h` });

  // ── trời ── (mưa to/dông không vào ô — đã là dòng cảnh báo đầu ngăn)
  const w = seaWeather(day);
  if (w && !w.danger) cells.push({ k: "Trời", v: w.label, span2: true });

  // ── con nước ──
  if (tide) {
    if (tide.now)
      cells.push({
        k: `Nước ${tide.now.trend === "len" ? "↑ lên" : tide.now.trend === "xuong" ? "↓ xuống" : "đứng"}`,
        v: tideHeightText(tide.now.m),
      });
    for (const e of tide.events)
      cells.push({
        k: `${e.kind === "high" ? "Lớn" : "Ròng"} ${hhmmVN(e.atMs)}${e.ngayMai ? " mai" : ""}`,
        v: tideHeightText(e.heightM),
      });
  }

  if (fish) cells.push({ k: "Nhiệt nước", v: `${formatNumberVN(fish.tempC)}°C` });

  // ── lịch ── (sau số an toàn)
  const am = amLichFromIso(day.date);
  if (am) cells.push({ k: "Âm lịch", v: amLichText(am) });
  const trang = moonPhase(new Date(`${day.date}T19:00:00+07:00`)).label.split(" — ")[0].replace(/^Trăng\s+/i, "");
  cells.push({ k: "Trăng", v: trang.charAt(0).toUpperCase() + trang.slice(1), span2: true });

  // ── cá / độ sâu ── (dòng dài, trọn hàng)
  if (fish) cells.push({ k: "Cá", v: fish.names.join(", "), tone: "text-trim", full: true });
  else if (season.length > 0) cells.push({ k: "Mùa này", v: season.join(", "), full: true });
  if (depth)
    cells.push({
      k: "Độ sâu",
      v: depth.label,
      full: true,
      tone: depth.tone === "danger" ? "text-danger" : depth.tone === "warn" ? "text-warn" : undefined,
    });
  return cells;
}
