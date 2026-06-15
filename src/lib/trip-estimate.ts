// MÁY TÍNH CHUYẾN BIỂN (A2, roadmap 01-product §7 / 06-jtbd nhóm A+C) —
// tổn DỰ KIẾN trước khi đổ dầu + "cần đánh tối thiểu X kg giá Y mới hòa vốn".
// Logic thuần, KHÔNG phán "nên đi hay không"; giá dầu prefill từ DO LIVE
// (lib/fuel-price) nhưng bà con sửa tay được. Ước lượng tham khảo.

export interface TripEstimateInput {
  /** số ngày đi biển dự kiến */
  days: number;
  /** lít dầu tiêu hao mỗi ngày */
  fuelPerDayL: number;
  /** giá dầu đ/lít (prefill từ giá DO LIVE) */
  fuelPriceVnd: number;
  /** chi phí khác gộp: đá + lương thực + ngư cụ + công… (đồng) */
  otherCostVnd: number;
  /** giá cá kỳ vọng đ/kg — tuỳ chọn, để tính sản lượng hoà vốn */
  fishPricePerKgVnd?: number;
}

export interface TripEstimate {
  /** tiền dầu = ngày × lít/ngày × giá */
  fuelCostVnd: number;
  /** tổn dự kiến = dầu + chi khác */
  totalCostVnd: number;
  /** tiền dầu chiếm bao nhiêu phần tổn (0–1); null khi tổn = 0 */
  fuelShare: number | null;
  /** sản lượng tối thiểu để hoà vốn (kg, làm tròn lên); null khi chưa nhập giá cá */
  breakevenKg: number | null;
}

/** Làm sạch số âm/NaN về 0 — input người dùng gõ có thể trống/âm. */
function clean(n: number): number {
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function estimateTrip(i: TripEstimateInput): TripEstimate {
  const days = clean(i.days);
  const fuelPerDayL = clean(i.fuelPerDayL);
  const fuelPriceVnd = clean(i.fuelPriceVnd);
  const otherCostVnd = clean(i.otherCostVnd);
  const fishPrice = clean(i.fishPricePerKgVnd ?? 0);

  const fuelCostVnd = Math.round(days * fuelPerDayL * fuelPriceVnd);
  const totalCostVnd = fuelCostVnd + otherCostVnd;

  return {
    fuelCostVnd,
    totalCostVnd,
    fuelShare: totalCostVnd > 0 ? fuelCostVnd / totalCostVnd : null,
    breakevenKg:
      fishPrice > 0 && totalCostVnd > 0
        ? Math.ceil(totalCostVnd / fishPrice)
        : null,
  };
}
