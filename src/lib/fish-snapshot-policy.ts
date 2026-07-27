// Luật THUẦN cho snapshot dự báo cá (test được, KHÔNG I/O, không server-only)
// — tách khỏi fish-snapshot.ts để test node env import được mà không kéo
// service-role client / "server-only".

/** Route đọc snapshot: 30 phút đủ tươi (cron ghi mỗi ~6h), nhẹ tải DB */
export const SNAPSHOT_REVALIDATE = 1800;

/**
 * Snapshot GIÀ hơn ngần này = coi như CRON ĐỨNG → route bỏ snapshot, tự tính live
 * cho tươi (khỏi âm thầm dọn số cũ như số mới). Cron chạy mỗi ~24h nên 30h cho
 * dư 6h trễ; quá 30h là bản làm mới đã quá hạn thật.
 */
export const SNAPSHOT_MAX_AGE_MS = 30 * 60 * 60 * 1000;

/**
 * Snapshot còn TƯƠI không — đo bằng `generated_at` (lúc cron TÍNH, không phải
 * ngày ảnh). `generated_at` đứng yên = pipeline đã chết. Thuần để test.
 *  · thiếu / hỏng ngày → KHÔNG tươi (đi tính live)
 *  · ở tương lai xa (đồng hồ lệch) → KHÔNG tin được → không tươi
 *  · trong hạn → tươi
 */
export function isSnapshotFresh(
  generatedAt: string | null | undefined,
  nowMs: number,
): boolean {
  if (!generatedAt) return false;
  const t = Date.parse(generatedAt);
  if (!Number.isFinite(t)) return false;
  const age = nowMs - t;
  if (age < -60 * 60 * 1000) return false;
  return age <= SNAPSHOT_MAX_AGE_MS;
}

export interface SnapshotMeta {
  ok?: boolean;
  /** ngày ảnh cũ hơn trong SST/phù du — mốc so "không lùi ngày" */
  targetDate?: string;
}

/**
 * Có nên GHI ĐÈ snapshot đang có bằng bản mới tính không.
 *  · bản mới hỏng (`ok !== true`) → KHÔNG (đừng thay bản tốt bằng số không —
 *    cron một lần vồ nhằm lúc SST/phù du sập không được xoá bản đang phục vụ)
 *  · chưa có bản nào → CÓ
 *  · bản mới thiếu `targetDate` → KHÔNG (không đủ căn cứ so)
 *  · `targetDate` mới < cũ → KHÔNG (không lùi ngày)
 *  · `targetDate` mới ≥ cũ → CÓ (bằng ngày vẫn ghi: làm tươi `generatedAt` +
 *    có thể đủ nguồn tuỳ chọn hơn nếu lần trước dính nguồn treo)
 */
export function shouldReplaceSnapshot(
  existingTargetDate: string | null | undefined,
  incoming: SnapshotMeta | null | undefined,
): boolean {
  if (!incoming || incoming.ok !== true) return false;
  if (!existingTargetDate) return true;
  const inc = incoming.targetDate;
  if (!inc) return false;
  return inc >= existingTargetDate;
}
