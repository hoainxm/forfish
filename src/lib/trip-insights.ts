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

// ── Báo cáo theo năm (A1) ───────────────────────────────────────────────
// Chuyến biển có ngày về bờ → tổng kết lãi/lỗ theo năm + tách theo tháng.
// Vẫn là MÔ TẢ con số, không phán. date là ISO yyyy-mm-dd (slice, không parse
// Date để tránh lệch múi giờ).

export interface DatedTrip extends TripLike {
  /** ISO yyyy-mm-dd — ngày về bờ */
  date: string;
}

export interface MonthStat {
  /** 1–12 */
  month: number;
  count: number;
  profit: number;
  revenue: number;
}

export interface YearReport {
  year: number;
  count: number;
  totalRevenue: number;
  totalProfit: number;
  profitableCount: number;
  /** tiền dầu / tiền bán (0–1); null khi chưa có doanh thu */
  fuelShare: number | null;
  bestProfit: number;
  worstProfit: number;
  /** chỉ những tháng CÓ chuyến, xếp tháng tăng dần */
  months: MonthStat[];
}

export function yearOf(dateIso: string): number {
  return Number(dateIso.slice(0, 4));
}

export function monthOf(dateIso: string): number {
  return Number(dateIso.slice(5, 7));
}

/** Các năm có trong sổ, mới nhất trước. */
export function listYears(trips: DatedTrip[]): number[] {
  const years = new Set<number>();
  for (const t of trips) {
    const y = yearOf(t.date);
    if (Number.isFinite(y) && y > 0) years.add(y);
  }
  return [...years].sort((a, b) => b - a);
}

/** Tổng kết một năm + tách theo tháng. null khi năm đó không có chuyến nào. */
export function yearlyReport(
  trips: DatedTrip[],
  year: number,
): YearReport | null {
  const inYear = trips.filter((t) => yearOf(t.date) === year);
  if (inYear.length === 0) return null;

  const base = tripStats(inYear);
  if (!base) return null;

  const byMonth = new Map<number, MonthStat>();
  for (const t of inYear) {
    const m = monthOf(t.date);
    const slot = byMonth.get(m) ?? {
      month: m,
      count: 0,
      profit: 0,
      revenue: 0,
    };
    slot.count += 1;
    slot.profit += profitOf(t);
    slot.revenue += t.revenueVnd;
    byMonth.set(m, slot);
  }
  const months = [...byMonth.values()].sort((a, b) => a.month - b.month);

  return {
    year,
    count: base.count,
    totalRevenue: base.totalRevenue,
    totalProfit: base.totalProfit,
    profitableCount: base.profitableCount,
    fuelShare: base.fuelShare,
    bestProfit: base.bestProfit,
    worstProfit: base.worstProfit,
    months,
  };
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
