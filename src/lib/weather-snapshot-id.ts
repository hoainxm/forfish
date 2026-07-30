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

/** id này có phải hàng PREMIUM không (khung > khung miễn phí) — thuần, test được.
 *  Độ mặn + nước dâng/xoáy LUÔN công khai (số "d4" là frame cố định, KHÔNG phải
 *  tầm dự báo premium) → không bị chặn dù có "d4". */
export function snapshotNeedsPremium(id: string): boolean {
  if (id.startsWith("salinity:") || id.startsWith("seascalar:")) return false;
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

/**
 * DÒNG CHẢY THEO TẦNG (2026-07-29): 4 tầng danh nghĩa (m) khớp nghề — mặt
 * (thả trôi/chà) · ~50 m · ~150 m (câu vàng) · ~300 m (rê đáy sâu). Nguồn
 * Copernicus phy-cur P1D theo NGÀY, ~+9 ngày; tầng 0 (mặt, trung bình ngày)
 * còn kiêm nguồn VÉT CUỐI cho dòng chảy mặt của lưới Windy khi SMOC chết.
 */
export const CUR_DEPTH_TIERS = [0, 50, 150, 300] as const;
export type CurDepthTier = (typeof CUR_DEPTH_TIERS)[number];
/** Khung ngày premium của lớp tầng sâu (nguồn chỉ ~+9 ngày, lấy trần 10) */
export const CUR_DEPTH_MAX_DAYS = 10;

/** id snapshot dòng chảy theo tầng — d3 miễn phí, d10 premium (chung luật
    snapshotNeedsPremium: >3 ngày là premium) */
export function curDepthSnapshotId(tier: number, days: number): string {
  return `curdepth:t${tier}:d${days}`;
}

/**
 * ĐỘ MẶN (Copernicus) — 1 khung d4 (SALINITY_DAYS). Snapshot server để live
 * /api/salinity lỗi (Copernicus S3 chậm/hỏng) vẫn có bản (2026-07-29). Miễn phí
 * — độ mặn không phải hàng premium.
 */
export function salinitySnapshotId(days: number): string {
  return `salinity:d${days}`;
}

/**
 * LỚP SỐ LIỆU BIỂN ERDDAP (nước dâng/xoáy SSHA…) — snapshot server để live
 * /api/sea-scalar lỗi (ERDDAP hay treo/403) vẫn có bản (2026-07-29). Miễn phí.
 */
export function seaScalarSnapshotId(kind: string): string {
  return `seascalar:${kind}`;
}

/** Chặn id lạ trước khi đụng DB / trả về client (whitelist các dạng hợp lệ) */
export function isValidSnapshotId(id: string): boolean {
  return (
    /^sea:[a-z0-9_-]+$/.test(id) ||
    /^grid:d\d+$/.test(id) ||
    /^scalar:(cloud|rain|airtemp|storm|pressure):d\d+$/.test(id) ||
    /^curdepth:t(0|50|150|300):d\d+$/.test(id) ||
    /^salinity:d\d+$/.test(id) ||
    /^seascalar:(ssha|sss)$/.test(id)
  );
}

/**
 * Hàng THÔ từng nguồn của cron ghép 2 nguồn (2026-07-29): `raw:<id>:<src>` —
 * cron giữ bản tốt gần nhất của MỖI nguồn để nguồn chết một lượt vẫn còn đồ
 * ghép. CỐ Ý không lọt whitelist trên → /api/weather-snapshot trả bad_id,
 * client không bao giờ đọc trực tiếp hàng thô.
 */
export function rawSourceId(id: string, src: string): string {
  return `raw:${id}:${src}`;
}
