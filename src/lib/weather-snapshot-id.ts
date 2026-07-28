// Khoá snapshot thời tiết (Open-Meteo) — THUẦN, client-safe (dùng cả 2 phía).
//
// Snapshot thời tiết là LƯỚI AN TOÀN: live Open-Meteo vẫn là CHÍNH (nhanh, tải
// phân tán theo IP từng máy — tốt cho rate-limit), snapshot server chỉ dùng khi
// live lỗi. Cron ghi các khoá này; client đọc lại qua /api/weather-snapshot.

/** Dự báo biển theo cảng (10 cảng) — client vốn đã tải đủ 16 ngày nên không lộ thêm */
export function seaSnapshotId(portId: string): string {
  return `sea:${portId}`;
}

/**
 * Lưới gió/sóng Windy theo khung ngày. CHỈ snapshot khung MIỄN PHÍ (d3): khung
 * >3 ngày là premium, non-premium không hề tải d7/d16 từ live → serve public sẽ
 * LỘ. Premium vẫn có fallback riêng (pretrip + localStorage).
 */
export function gridSnapshotId(days: number): string {
  return `grid:d${days}`;
}

/** Khung ngày lưới MIỄN PHÍ — snapshot đọc được không cần đăng nhập */
export const SNAPSHOT_GRID_DAYS = 3;

/**
 * Khung ngày PREMIUM cũng được snapshot (2026-07-29). Vì sao: từ khi bỏ chip
 * chọn khung, màn Ra khơi TỰ đặt tầm theo hạng — premium LUÔN xin 16 ngày, nên
 * trước đây họ KHÔNG BAO GIỜ chạm tới lưới an toàn (chỉ có d3) và gặp
 * "chưa tải được khung 16 ngày" mỗi khi Open-Meteo lỗi/429. Không lộ premium:
 * `/api/weather-snapshot` CHẶN THẬT các id khung >3 ngày (snapshotNeedsPremium).
 */
export const SNAPSHOT_PREMIUM_GRID_DAYS = 16;

/** Các khung được cron tính sẵn (client chỉ lùi về snapshot ở đúng các khung này) */
export const SNAPSHOT_DAY_SET: readonly number[] = [
  SNAPSHOT_GRID_DAYS,
  SNAPSHOT_PREMIUM_GRID_DAYS,
];

/** id này có phải hàng PREMIUM không (khung > khung miễn phí) — thuần, test được */
export function snapshotNeedsPremium(id: string): boolean {
  const d = Number(/:d(\d+)$/.exec(id)?.[1]);
  return Number.isFinite(d) && d > SNAPSHOT_GRID_DAYS;
}

/**
 * Lớp DẢI MÀU Open-Meteo (mây/mưa/nhiệt/dông/áp suất) theo khung ngày — cùng
 * luật với lưới gió: CHỈ snapshot khung MIỄN PHÍ d3. Vì sao cần (2026-07-29):
 * lưới mở 156 điểm × 5 biến làm request live NẶNG theo cách Open-Meteo tính
 * trọng số — dính 429 khi gọi dày; snapshot server là lưới an toàn khi live lỗi.
 * (Độ mặn KHÔNG ở đây — Copernicus đã server-side qua /api/salinity.)
 */
export function scalarSnapshotId(kind: string, days: number): string {
  return `scalar:${kind}:d${days}`;
}

/** Chặn id lạ trước khi đụng DB / trả về client (whitelist đúng 3 dạng) */
export function isValidSnapshotId(id: string): boolean {
  return (
    /^sea:[a-z0-9_-]+$/.test(id) ||
    /^grid:d\d+$/.test(id) ||
    /^scalar:(cloud|rain|airtemp|storm|pressure):d\d+$/.test(id)
  );
}
