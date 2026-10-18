// LỖI CÓ MÃ của sàn — adapter ném, route map sang {ok:false, code} + status.
export type MarketErrorCode =
  | "unavailable"        // 503 — không tra được (env thiếu, DB nghẹt, file khoá)
  | "not_found"          // 404
  | "forbidden"          // 403 — không phải chủ shop / không phải chủ đơn
  | "shop_not_active"    // 403 — shop chưa duyệt / tạm khoá / bị từ chối
  | "shop_paused"        // 409 — shop tự tạm nghỉ (LEAD §4 #8) — chỉ chặn ĐẶT, không chặn xem
  | "no_shop"            // 404 — SĐT này chưa có shop
  | "invalid"            // 400 — validate thuần trả câu lỗi (kèm message VN)
  | "bad_type"           // 415 — ảnh không phải jpeg/png/webp (mime HOẶC magic bytes sai)
  | "bad_size"           // 413 — ảnh > 500 KB
  | "line_unavailable"   // 409 — hết hàng / ngừng bán / sai biến thể (kèm productIds)
  | "price_changed"      // 409 — giá đổi giữa lúc xem và lúc đặt
  | "bad_transition"     // 409 — trạng thái đã đổi bởi người khác
  | "review_not_allowed" // 409
  | "already_reviewed"   // 409
  | "slug_taken"         // 409 — tên shop đã có người dùng
  | "insert_failed";     // 500

export const MARKET_ERROR_STATUS: Record<MarketErrorCode, number> = {
  unavailable: 503, not_found: 404, forbidden: 403, shop_not_active: 403, shop_paused: 409, no_shop: 404,
  invalid: 400, bad_type: 415, bad_size: 413, line_unavailable: 409, price_changed: 409, bad_transition: 409,
  review_not_allowed: 409, already_reviewed: 409, slug_taken: 409, insert_failed: 500,
};

export class MarketError extends Error {
  constructor(
    public readonly code: MarketErrorCode,
    /** câu tiếng Việt cho người dùng (validate) — tuỳ chọn */
    message?: string,
    public readonly productIds: string[] = [],
  ) {
    super(message ?? code);
    this.name = "MarketError";
  }
  get status(): number { return MARKET_ERROR_STATUS[this.code]; }
}
/**
 * Nhận diện theo HÌNH DẠNG, không chỉ `instanceof`: kho chợ là singleton trên
 * `globalThis` (store.ts), được tạo bởi bundle của route ĐẦU TIÊN gọi nó; route
 * khác trong Next dev/prod có bản `MarketError` riêng ⇒ `instanceof` trả false và
 * mọi lỗi có mã đội lốt 500 `internal` (dính thật 2026-09-06: /api/dev/login
 * persona lạ trả 500 thay vì 404). `status` cũng tra bảng thay vì tin getter.
 */
export const isMarketError = (e: unknown): e is MarketError => {
  if (e instanceof MarketError) return true;
  if (!e || typeof e !== "object") return false;
  const x = e as { name?: unknown; code?: unknown };
  return x.name === "MarketError" && typeof x.code === "string" && x.code in MARKET_ERROR_STATUS;
};
/** HTTP status của một MarketError — tra bảng theo `code` (không phụ thuộc getter của class ở bundle nào). */
export const marketErrorStatus = (e: MarketError): number => MARKET_ERROR_STATUS[e.code] ?? 500;
