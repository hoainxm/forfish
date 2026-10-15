// Trục 1 — DANH SÁCH ĐIỂM TRÊN TUYẾN (đọc toạ độ từng điểm, khuôn tab Tuyến
// của SDNavi: Đầu · #1 · #2 … · Đích — số LIỀN MẠCH, không nhảy cóc). Tuyến máy tính ra là chuỗi `waypoints`
// — chỗ tàu ĐỔI HƯỚNG sau khi đã kéo căng dây — nhưng bản đồ chỉ vẽ vạch, bà
// con không đọc được toạ độ chỗ bẻ lái để gõ sang máy định vị của tàu.
// THUẦN LOGIC (không React, không MapLibre) để test được.

import type { LatLon } from "@/lib/route-plan";
import { cumulativeKmAt } from "@/lib/route-legs";

/** start = nơi xuất phát · turn = chỗ đổi hướng · stop = chỗ ghé giữa đường · dest = điểm cuối */
export type RoutePointKind = "start" | "turn" | "stop" | "dest";

export interface RoutePointRow {
  /** chỉ số trong `plan.waypoints` — cũng là số "#idx" in trên bản đồ */
  idx: number;
  lat: number;
  lon: number;
  kind: RoutePointKind;
  /** chỗ ghé thứ mấy (1-based, đếm cả điểm cuối) — chỉ có ở `stop`/`dest` */
  stopNo?: number;
  /** chỗ đổi hướng thứ mấy (1-based, LIỀN MẠCH, bỏ qua chỗ ghé) — chỉ có ở
   *  `turn`. Danh sách và chấm trên bản đồ cùng in số này. Trước đây in thẳng
   *  `idx` nên chỗ ghé chiếm số: "Điểm 4 → Điểm dừng 1 → Điểm dừng 2 → Điểm 7",
   *  bà con tưởng mất Điểm 5, 6. */
  turnNo?: number;
  /** km dọc tuyến tính từ nơi xuất phát */
  km: number;
  /** giờ chạy máy cộng dồn tới điểm này — null khi tuyến không mang `hoursAt` khớp độ dài */
  hours: number | null;
}

/**
 * Dựng hàng cho từng waypoint. `stopWpIdx` = chỉ số của từng chỗ ghé trong
 * `waypoints` (phần tử cuối = điểm cuối). `hoursAt` lệch độ dài thì bỏ cột
 * giờ chứ KHÔNG đoán — con số giờ sai là bà con tính dầu sai.
 */
export function routePointRows(
  waypoints: LatLon[],
  stopWpIdx: number[],
  hoursAt?: number[],
): RoutePointRow[] {
  const n = waypoints.length;
  if (n === 0) return [];
  const km = cumulativeKmAt(
    waypoints,
    waypoints.map((_, i) => i),
  );
  const hoursOk = Array.isArray(hoursAt) && hoursAt.length === n;
  const stopNoAt = new Map<number, number>();
  stopWpIdx.forEach((wi, k) => {
    // trùng chỉ số (chặng 0 km) thì giữ số ghé ĐẦU TIÊN — không nhảy số
    if (wi > 0 && wi < n && !stopNoAt.has(wi)) stopNoAt.set(wi, k + 1);
  });

  let turns = 0;
  return waypoints.map((p, i) => {
    const kind: RoutePointKind =
      i === 0 ? "start" : i === n - 1 ? "dest" : stopNoAt.has(i) ? "stop" : "turn";
    const row: RoutePointRow = {
      idx: i,
      lat: p.lat,
      lon: p.lon,
      kind,
      km: km[i],
      hours: hoursOk && Number.isFinite(hoursAt![i]) ? hoursAt![i] : null,
    };
    if (kind === "dest") row.stopNo = stopWpIdx.length || 1;
    else if (kind === "stop") row.stopNo = stopNoAt.get(i);
    else if (kind === "turn") row.turnNo = ++turns;
    return row;
  });
}
