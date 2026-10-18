// ĐIỂM ĐÁNH GIÁ — THUẦN, cùng luật với RPC market_recount_rating (0060 §9):
// chỉ đếm đánh giá KHÔNG ẩn, avg làm tròn 2 số. file-store + test seed dùng.

export interface RatingSource { productId: string; shopId: string; rating: number; hidden: boolean }
export interface RatingCache { avg: number; count: number }

function agg(rows: RatingSource[]): RatingCache {
  const live = rows.filter((r) => !r.hidden);
  if (live.length === 0) return { avg: 0, count: 0 };
  const sum = live.reduce((s, r) => s + r.rating, 0);
  return { avg: Math.round((sum / live.length) * 100) / 100, count: live.length };
}

/** Điểm cache của MỘT sản phẩm + shop của nó, tính lại từ toàn bộ đánh giá. */
export function recountRating(
  reviews: RatingSource[],
  productId: string,
  shopId: string,
): { product: RatingCache; shop: RatingCache } {
  return {
    product: agg(reviews.filter((r) => r.productId === productId)),
    shop: agg(reviews.filter((r) => r.shopId === shopId)),
  };
}
