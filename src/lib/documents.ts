// Trục 4 — Tuân thủ dễ hơn. Domain logic for the document vault.

export type DocumentKind =
  | "dang_kiem"
  | "giay_phep_khai_thac"
  | "an_toan_thuc_pham"
  | "bao_hiem"
  | "chung_chi_thuyen_truong"
  | "khac";

export interface BoatDocument {
  id: string;
  kind: DocumentKind;
  label: string;
  number?: string;
  issuedOn?: string; // ISO date
  expiresOn?: string; // ISO date, undefined = no expiry
  note?: string;
}

export const DOCUMENT_KINDS: { value: DocumentKind; label: string }[] = [
  { value: "dang_kiem", label: "Đăng kiểm tàu cá" },
  { value: "giay_phep_khai_thac", label: "Giấy phép khai thác thủy sản" },
  { value: "an_toan_thuc_pham", label: "Chứng nhận an toàn thực phẩm" },
  { value: "bao_hiem", label: "Bảo hiểm tàu / thuyền viên" },
  { value: "chung_chi_thuyen_truong", label: "Chứng chỉ thuyền trưởng/máy trưởng" },
  { value: "khac", label: "Giấy tờ khác" },
];

export function kindLabel(kind: DocumentKind): string {
  return DOCUMENT_KINDS.find((k) => k.value === kind)?.label ?? "Giấy tờ";
}

export type ExpiryLevel = "expired" | "soon" | "ok" | "none";

export interface ExpiryStatus {
  level: ExpiryLevel;
  /** signed days until expiry; negative = already expired */
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

export function getExpiryStatus(doc: BoatDocument, today: Date): ExpiryStatus {
  if (!doc.expiresOn) {
    return { level: "none", days: null, label: "Không có hạn" };
  }
  const days = daysUntil(doc.expiresOn, today);
  if (days < 0) {
    return {
      level: "expired",
      days,
      label: `Đã quá hạn ${Math.abs(days)} ngày`,
    };
  }
  if (days === 0) return { level: "soon", days, label: "Hết hạn hôm nay" };
  if (days <= SOON_DAYS) {
    return { level: "soon", days, label: `Còn ${days} ngày` };
  }
  return { level: "ok", days, label: `Còn ${days} ngày` };
}

/** Sort so the most urgent (expired, then soonest) float to the top. */
export function byUrgency(today: Date) {
  return (a: BoatDocument, b: BoatDocument) => {
    const da = getExpiryStatus(a, today).days;
    const db = getExpiryStatus(b, today).days;
    if (da === null && db === null) return 0;
    if (da === null) return 1;
    if (db === null) return -1;
    return da - db;
  };
}

/** Demo data used before Supabase is connected, so the app is never empty. */
export function demoDocuments(today: Date): BoatDocument[] {
  const d = (offsetDays: number) => {
    const t = new Date(today);
    t.setUTCDate(t.getUTCDate() + offsetDays);
    return t.toISOString().slice(0, 10);
  };
  return [
    {
      id: "demo-1",
      kind: "dang_kiem",
      label: "Đăng kiểm tàu cá",
      number: "ĐK-2024-0571",
      expiresOn: d(-12),
      note: "Liên hệ chi cục đăng kiểm để gia hạn.",
    },
    {
      id: "demo-2",
      kind: "giay_phep_khai_thac",
      label: "Giấy phép khai thác thủy sản",
      number: "GP-VBT-3391",
      expiresOn: d(18),
    },
    {
      id: "demo-3",
      kind: "bao_hiem",
      label: "Bảo hiểm thân tàu",
      number: "BH-PVI-88102",
      expiresOn: d(140),
    },
    {
      id: "demo-4",
      kind: "chung_chi_thuyen_truong",
      label: "Chứng chỉ thuyền trưởng hạng IV",
      expiresOn: undefined,
    },
  ];
}
