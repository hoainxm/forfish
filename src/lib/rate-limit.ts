// GIỚI HẠN LƯỢT GỌI theo khoá (SĐT) — cửa sổ trượt, THUẦN, có test (2026-09-16).
//
// Dùng ở premiumGate cho /api/fish-forecast: một tài khoản premium cào dự báo
// hàng loạt để phát lại cho người khác thì bị chặn 429. Máy bà con gọi vài lượt
// mỗi lần mở bản đồ — xa trần.
//
// nợ: kho đếm nằm trong bộ nhớ của MỘT instance (Vercel chạy nhiều instance,
// mỗi cái đếm riêng nên trần thật cao hơn khai vài lần), nâng cấp khi có bảng
// đếm chung (Supabase/KV) — lúc đó thay `store` bằng adapter, hàm này giữ nguyên.

export type RateWindow = { limit: number; windowMs: number };

/** Kho đếm: khoá → mốc thời gian các lượt trong cửa sổ. */
export type RateStore = Map<string, number[]>;

/** Không giữ quá nhiều khoá — kho là bộ nhớ instance, không phải DB. */
const MAX_KEYS = 5000;

/**
 * Cho phép lượt này không. `true` = cho qua (và ghi nhận), `false` = vượt trần.
 * Không ném; `now` truyền vào để test tất định.
 */
export function allowRequest(
  store: RateStore,
  key: string,
  now: number,
  w: RateWindow,
): boolean {
  const limit = Number.isFinite(w.limit) && w.limit > 0 ? Math.floor(w.limit) : 1;
  const windowMs = Number.isFinite(w.windowMs) && w.windowMs > 0 ? w.windowMs : 60000;
  const from = now - windowMs;
  const prev = store.get(key) ?? [];
  const hits = prev.filter((t) => t > from);
  if (hits.length >= limit) {
    store.set(key, hits);
    return false;
  }
  hits.push(now);
  if (!store.has(key) && store.size >= MAX_KEYS) {
    // Đuổi khoá cũ nhất (Map giữ thứ tự thêm vào) — đủ để kho không phình.
    const oldest = store.keys().next().value;
    if (oldest !== undefined) store.delete(oldest);
  }
  store.set(key, hits);
  return true;
}
