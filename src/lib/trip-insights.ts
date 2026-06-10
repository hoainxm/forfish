// PHÂN TÍCH HIỆU QUẢ chuyến biển — logic thuần trên sổ lãi/lỗ bà con tự ghi
// (trip-log, localStorage). Mô tả con số, KHÔNG phán "nên đi hay không".

export interface TripLike {
  revenueVnd: number;
  fuelVnd: number;
  otherVnd: number;
}

export interface TripStats {
  /** số chuyến đã ghi */
  count: number;
  totalRevenue: number;
  totalProfit: number;
  /** lãi trung bình mỗi chuyến */
  avgProfit: number;
  /** số chuyến có lãi (> 0) */
  profitableCount: number;
  /** tiền dầu chiếm bao nhiêu phần tiền bán (0–1); null khi chưa có doanh thu */
  fuelShare: number | null;
  /** chuyến lãi nhất / lỗ nặng nhất */
  bestProfit: number;
  worstProfit: number;
}

export function profitOf(t: TripLike): number {
  return t.revenueVnd - t.fuelVnd - t.otherVnd;
}

export function tripStats(trips: TripLike[]): TripStats | null {
  if (trips.length === 0) return null;
  let totalRevenue = 0;
  let totalFuel = 0;
  let totalProfit = 0;
  let profitableCount = 0;
  let bestProfit = -Infinity;
  let worstProfit = Infinity;
  for (const t of trips) {
    const p = profitOf(t);
    totalRevenue += t.revenueVnd;
    totalFuel += t.fuelVnd;
    totalProfit += p;
    if (p > 0) profitableCount++;
    if (p > bestProfit) bestProfit = p;
    if (p < worstProfit) worstProfit = p;
  }
  return {
    count: trips.length,
    totalRevenue,
    totalProfit,
    avgProfit: Math.round(totalProfit / trips.length),
    profitableCount,
    fuelShare: totalRevenue > 0 ? totalFuel / totalRevenue : null,
    bestProfit,
    worstProfit,
  };
}
