// Trục 4 — Tuân thủ dễ hơn. Domain logic for the document vault.

import { SOON_DAYS_DOCS, daysUntil } from "@/lib/days";

export type DocumentKind =
  | "dang_ky_tau"
  | "dang_kiem"
  | "giay_phep_khai_thac"
  | "an_toan_thuc_pham"
  | "bao_hiem"
  | "chung_chi_thuyen_truong"
  // Giấy RIÊNG của người (chỉ ở "Giấy tờ của tôi" — 17 §12.2, 2026-11-03)
  | "cccd"
  | "so_thuyen_vien"
  | "chung_chi_thuyen_vien"
  | "khac";

export interface BoatDocument {
  id: string;
  kind: DocumentKind;
  label: string;
  number?: string;
  issuedOn?: string; // ISO date
  expiresOn?: string; // ISO date, undefined = no expiry
  note?: string;
  /** Ảnh chụp giấy tờ — ĐƯỜNG DẪN Supabase Storage (P3, 2026-08-26). Bytes ở
   *  bucket private `user-docs`, đọc/ghi qua /api/me/docs/photo; path đồng bộ
   *  nhẹ qua user_docs. Rỗng/undefined = chưa có ảnh. */
  photos?: string[];
}

/*  Thứ tự + tên theo ĐÚNG bộ giấy bà con mang theo (2026-10-06, đối chiếu giấy
    thật Gia Lai): đăng ký tàu → an toàn kỹ thuật (đăng kiểm) → giấy phép khai
    thác → … Giá trị `dang_kiem` GIỮ NGUYÊN (dữ liệu cũ trong máy + user_docs),
    chỉ đổi tên hiển thị cho khớp tiêu đề in trên giấy. */
export const DOCUMENT_KINDS: { value: DocumentKind; label: string }[] = [
  { value: "dang_ky_tau", label: "Giấy chứng nhận đăng ký tàu cá" },
  { value: "dang_kiem", label: "Giấy an toàn kỹ thuật (đăng kiểm)" },
  { value: "giay_phep_khai_thac", label: "Giấy phép khai thác thủy sản" },
  { value: "an_toan_thuc_pham", label: "Chứng nhận an toàn thực phẩm" },
  { value: "bao_hiem", label: "Bảo hiểm tàu / thuyền viên" },
  { value: "chung_chi_thuyen_truong", label: "Chứng chỉ thuyền trưởng/máy trưởng" },
  { value: "khac", label: "Giấy tờ khác" },
];

/*  GIẤY TỜ CỦA TÔI (17 §12.2 `/viec/giay`, 2026-11-03): người đi bạn không có tàu vẫn có giấy riêng sắp hết hạn.
    Nằm CHUNG kho `forfish.documents.v1` (cùng đồng bộ `user_docs` kind documents, cùng ảnh, cùng nhắc hạn) — chỉ
    khác `boatId` = mốc `PERSONAL_OWNER_ID`. KHÔNG bump phiên bản kho, KHÔNG chuyển giấy cũ: giấy cũ không mang mốc
    này nên vẫn y nguyên dưới tàu. Mọi chỗ lọc theo tàu đi qua `showsUnderBoat` (lib/boats) — hàm đó loại mốc này,
    nên tủ giấy tàu / bộ chọn tàu không bao giờ thấy "tàu ma". */
export const PERSONAL_OWNER_ID = "ca-nhan";
/** Tên gọi chỗ giấy riêng trong lời nhắc (thay cho tên tàu). */
export const PERSONAL_DOCS_LABEL = "Giấy tờ của tôi";
/** Màn giấy riêng — lời nhắc mở thẳng vào đây. */
export const PERSONAL_DOCS_HREF = "/viec/giay";

export function isPersonalDoc(d: { boatId?: string | null }): boolean {
  return d.boatId === PERSONAL_OWNER_ID;
}

/** Loại giấy cho "Giấy tờ của tôi" — chỉ hiện ở tủ của người, tủ tàu giữ nguyên `DOCUMENT_KINDS`. */
export const PERSONAL_DOC_KINDS: { value: DocumentKind; label: string }[] = [
  { value: "cccd", label: "Căn cước công dân (CCCD)" },
  { value: "chung_chi_thuyen_vien", label: "Chứng chỉ thuyền viên" },
  { value: "chung_chi_thuyen_truong", label: "Chứng chỉ thuyền trưởng/máy trưởng" },
  { value: "so_thuyen_vien", label: "Sổ thuyền viên" },
  { value: "khac", label: "Giấy tờ khác" },
];

export function kindLabel(kind: DocumentKind): string {
  return (
    DOCUMENT_KINDS.find((k) => k.value === kind)?.label ??
    PERSONAL_DOC_KINDS.find((k) => k.value === kind)?.label ??
    "Giấy tờ"
  );
}

/** Loại giấy THƯỜNG KHÔNG THỜI HẠN (giấy đăng ký tàu cá in "Không thời hạn")
 *  — form nói "để trống ngày hết hạn" thay vì dọa "app không nhắc được". */
export function kindUsuallyNoExpiry(kind: DocumentKind): boolean {
  return kind === "dang_ky_tau";
}

export type ExpiryLevel = "expired" | "soon" | "ok" | "none";

export interface ExpiryStatus {
  level: ExpiryLevel;
  /** signed days until expiry; negative = already expired */
  days: number | null;
  label: string;
}

// Ngày + ngưỡng dùng chung (lib/days.ts) — tính theo lịch VN, không UTC.
// `days === 0` = hết hạn HÔM NAY = đã hết hạn (đỏ) — chốt 2026-08-18.
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
  if (days === 0) return { level: "expired", days, label: "Hết hạn hôm nay" };
  if (days <= SOON_DAYS_DOCS) {
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

/**
 * `?giay=<loại>` trong URL ⇒ loại giấy hợp lệ, không thì null. Tủ giấy tờ đọc lúc mở để bật form đúng giấy — link từ
 * khối hạn giấy dưới bài luật Sen Biển (kairos/han-giay.linkGiay, 14 §21f).
 */
export function giayTuUrl(
  search: string,
  kinds: readonly { value: DocumentKind }[] = DOCUMENT_KINDS,
): DocumentKind | null {
  const v = new URLSearchParams(search).get("giay");
  return v && kinds.some((k) => k.value === v) ? (v as DocumentKind) : null;
}
