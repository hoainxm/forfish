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

/*  ═══ ĐANG BUILD THÌ ĐỪNG KÉO BẢY NGUỒN ═══ (2026-08-03)

    LỖI THẬT, dựng lại được: `npm run build` hỏng ở `/api/fish-forecast` —
    "took more than 60 seconds", ba lần rồi bỏ cuộc, cả bản build đỏ.

    VÌ SAO: route có `export const revalidate` và không đụng API động, nên Next
    DỰNG SẴN nó NGAY LÚC BUILD. Nhánh đầu đọc snapshot Supabase; đọc KHÔNG ĐƯỢC
    (thiếu `SUPABASE_SERVICE_ROLE_KEY`, key vừa xoay, Supabase chập chờn) thì
    `loadFishSnapshot()` trả `null` và route rơi thẳng vào `computeFishForecast()`
    — BẢY nguồn ngoài (ERDDAP + HYCOM OPeNDAP + Copernicus Zarr), đo thật 14–30
    giây mỗi lượt, chạy giữa ngân sách 60 giây của Next, lại còn tranh chỗ với 7
    worker build khác. Đo trên máy chủ dự án hôm nay: lượt lạnh 16,8 giây chỉ để
    trả về đúng thứ mà cron đã tính sẵn.

    VÌ SAO PHẢI CHẶN, dù prod hiện có key: **một nguồn thời tiết có ngày chậm là
    KHÔNG được phép chặn việc ship một bản vá.** Đường build không được đi qua
    bảy dịch vụ bên ngoài. Bản dựng sẵn chỉ là hạt giống cho kho ISR — thiếu nó
    thì request THẬT đầu tiên tự tính rồi lấp đầy kho, chậm đúng một lượt.

    NHÁNH NÀY CHỈ ĐÓNG LÚC BUILD. Lúc chạy thật `NEXT_PHASE` không có giá trị
    này, nên đường lùi "cron đứng → tự tính live" giữ nguyên không sứt mẻ. */

/** Next đặt biến này trong suốt `next build` (và chỉ lúc đó). */
export const NEXT_BUILD_PHASE = "phase-production-build";

/**
 * Có đang ở TRONG lượt build không — nhận `env` để test được, không đọc
 * `process` trực tiếp. THUẦN.
 */
export function isBuildPhase(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.NEXT_PHASE === NEXT_BUILD_PHASE;
}

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
  return isSnapshotFreshAt(t, nowMs);
}

/**
 * Y HỆT `isSnapshotFresh` nhưng nhận mốc dạng SỐ (epoch ms) — cho phía CLIENT,
 * chỗ đã parse sẵn `generatedAt` ra số (xem `savedFishMark().dataAt`).
 *
 * VÌ SAO PHẢI DÙNG CHUNG LUẬT NÀY (2026-08-02, sửa "banner đã cũ" nói dối):
 * bảng "trong máy có gì" từng đo lớp bản đồ cá bằng `isCacheCurrent` — nhịp của
 * Open-Meteo (4 mốc/ngày, trần 12 giờ). Nhưng bản đồ cá KHÔNG chạy theo nhịp đó:
 * cron tính ~6 giờ/lần và ROUTE CHỈ TÍNH LẠI khi snapshot quá `SNAPSHOT_MAX_AGE_MS`.
 * Client khắt khe hơn route ⇒ báo "đã cũ" trong khi chạm "Tải mới" chỉ nhận lại
 * ĐÚNG bản cũ (route thấy snapshot còn tươi, trả nguyên) ⇒ nút bấm hoài không đổi
 * gì, banner "Dự báo trong máy đã cũ — chạm tải mới" hiện vĩnh viễn.
 *
 * BẤT BIẾN: ngưỡng "còn mới" phía client KHÔNG ĐƯỢC chặt hơn ngưỡng route thật sự
 * đi tính bản mới — chặt hơn là hứa một việc app không làm được.
 */
export function isSnapshotFreshAt(
  generatedAtMs: number | null | undefined,
  nowMs: number,
): boolean {
  if (generatedAtMs == null || !Number.isFinite(generatedAtMs)) return false;
  const age = nowMs - generatedAtMs;
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
