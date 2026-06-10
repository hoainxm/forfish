// Sản phẩm SDVICO của tôi — vật tư/thiết bị bà con đã MUA của SDVICO, kèm nhắc
// hạn bảo hành. Lưu local theo `boatId` của tàu đang chọn; sau này đăng nhập
// SDWork sẽ tự đồng bộ về đây. Logic trạng thái thuần (mirror documents.ts).

export interface BoatProduct {
  id: string;
  boatId?: string; // tàu sở hữu sản phẩm (null = chưa gắn tàu)
  name: string; // tên sản phẩm SDVICO
  serial?: string; // số serial nếu có
  purchasedOn?: string; // ISO date ngày mua
  warrantyUntil?: string; // ISO date hết hạn bảo hành (undefined = không rõ hạn)
  note?: string;
}

export type WarrantyLevel = "expired" | "soon" | "ok" | "none";

export interface WarrantyStatus {
  level: WarrantyLevel;
  /** signed days until warranty ends; negative = already expired */
  days: number | null;
  label: string;
}

const SOON_DAYS = 30;

/** Days between today and an ISO date, computed in UTC to avoid TZ drift. */
function daysUntil(isoDate: string, today: Date): number {
  const target = new Date(isoDate + "T00:00:00Z");
  const base = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
  );
  return Math.round((target.getTime() - base) / 86_400_000);
}

/** Trạng thái bảo hành từ warrantyUntil (mirror getExpiryStatus). */
export function getWarrantyStatus(
  product: BoatProduct,
  today: Date,
): WarrantyStatus {
  if (!product.warrantyUntil) {
    return { level: "none", days: null, label: "Không rõ hạn bảo hành" };
  }
  const days = daysUntil(product.warrantyUntil, today);
  if (days < 0) {
    return {
      level: "expired",
      days,
      label: `Hết bảo hành ${Math.abs(days)} ngày`,
    };
  }
  if (days === 0) {
    return { level: "soon", days, label: "Hết bảo hành hôm nay" };
  }
  if (days <= SOON_DAYS) {
    return { level: "soon", days, label: `Còn bảo hành ${days} ngày` };
  }
  return { level: "ok", days, label: `Còn bảo hành ${days} ngày` };
}

/** Sort so the most urgent (expired, then soonest) float to the top;
 *  items with no warranty date sink to the bottom. */
export function byWarrantyUrgency(today: Date) {
  return (a: BoatProduct, b: BoatProduct) => {
    const da = getWarrantyStatus(a, today).days;
    const db = getWarrantyStatus(b, today).days;
    if (da === null && db === null) return 0;
    if (da === null) return 1;
    if (db === null) return -1;
    return da - db;
  };
}

/** Demo seed scoped to a boat, so the screen demonstrates itself before
 *  first use (and before SDWork sync exists). */
export function demoProducts(today: Date, boatId?: string): BoatProduct[] {
  const d = (offsetDays: number) => {
    const t = new Date(today);
    t.setUTCDate(t.getUTCDate() + offsetDays);
    return t.toISOString().slice(0, 10);
  };
  return [
    {
      id: "demo-sp-1",
      boatId,
      name: "Máy giám sát hành trình (VMS)",
      serial: "VMS-STK-2024-0188",
      purchasedOn: d(-345),
      warrantyUntil: d(20),
      note: "Liên hệ SDVICO để gia hạn dịch vụ giám sát.",
    },
    {
      id: "demo-sp-2",
      boatId,
      name: "Bộ đàm ICOM IC-M324",
      serial: "ICOM-M324-77310",
      purchasedOn: d(-160),
      warrantyUntil: d(200),
    },
  ];
}
