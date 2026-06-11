// Giá dầu DO LIVE — cho sổ lãi lỗ chuyến biển (dầu là chi phí lớn nhất).
// Nguồn: giaxanghomnay.com (scrape Petrolimex hộ, JSON sạch không key). Theo
// kỳ điều hành giá (thường thứ Năm). DO 0,05S là dầu tàu cá dùng phổ biến.
// Nguồn fail → null, UI ẩn (không bịa giá).

export interface FuelPrice {
  /** đồng/lít, vùng 1 (gần kho) */
  do005Zone1: number;
  /** đồng/lít, vùng 2 (xa kho, cao hơn) */
  do005Zone2: number;
  /** ngày áp dụng YYYY-MM-DD */
  date: string;
}

interface FuelRow {
  title?: unknown;
  zone1_price?: unknown;
  zone2_price?: unknown;
  date?: unknown;
}

/** Tách giá DO 0,05S từ JSON giaxanghomnay (mảng lồng mảng). null nếu không thấy. */
export function parseDieselDo(json: unknown): FuelPrice | null {
  const flat: FuelRow[] = Array.isArray(json)
    ? (json.flat(2) as FuelRow[])
    : [];
  const norm = (s: string) => s.replace(/\s/g, "").toUpperCase();
  const row = flat.find(
    (x) =>
      x &&
      typeof x.title === "string" &&
      norm(x.title).startsWith("DO0,05S"),
  );
  if (!row) return null;
  const z1 = Number(row.zone1_price);
  const z2 = Number(row.zone2_price);
  if (!Number.isFinite(z1) || z1 <= 0) return null;
  return {
    do005Zone1: z1,
    do005Zone2: Number.isFinite(z2) && z2 > 0 ? z2 : z1,
    date: typeof row.date === "string" ? row.date.slice(0, 10) : "",
  };
}

export async function fetchFuelPrice(): Promise<FuelPrice | null> {
  try {
    const r = await fetch("/api/fuel-price");
    if (!r.ok) return null;
    const j = (await r.json()) as { ok: boolean; fuel?: FuelPrice };
    return j.ok && j.fuel ? j.fuel : null;
  } catch {
    return null;
  }
}
