// XUẤT TRÌNH GIẤY TỜ CHO CÁN BỘ — luật THUẦN của màn components/xuat-trinh-giay.tsx (ADR 0017, rà UI 2026-10-26).

import { type BoatDocument, DOCUMENT_KINDS, getExpiryStatus } from "@/lib/documents";
import { formatVnDate } from "@/lib/format";

/** Thứ tự trình: theo bộ giấy bà con mang theo (đăng ký → đăng kiểm → phép → ATTP → bảo hiểm → chứng chỉ → khác),
 *  cùng loại thì theo tên — cán bộ xem đúng thứ tự họ hỏi. Không đổi mảng gốc. */
export function thuTuXuatTrinh<T extends BoatDocument>(docs: readonly T[]): T[] {
  const bac = new Map(DOCUMENT_KINDS.map((k, i) => [k.value, i]));
  return [...docs].sort((a, b) => (bac.get(a.kind) ?? 99) - (bac.get(b.kind) ?? 99) || a.label.localeCompare(b.label, "vi"));
}

export type MucHan = "expired" | "soon" | "ok" | "none";

/** Chữ chip hạn: NGÀY hết hạn đứng trước (thứ cán bộ cần), số ngày sau. Hết hạn hôm nay = quá hạn (đỏ, 07 §8). */
export function chuHanXuatTrinh(doc: BoatDocument, today: Date): { muc: MucHan; text: string } {
  const st = getExpiryStatus(doc, today);
  if (!doc.expiresOn || st.days === null) return { muc: "none", text: "Không thời hạn" };
  const ngay = `Hết hạn ${formatVnDate(doc.expiresOn)}`;
  if (st.days < 0) return { muc: "expired", text: `${ngay} · đã quá ${-st.days} ngày` };
  if (st.days === 0) return { muc: "expired", text: `${ngay} · hôm nay` };
  return { muc: st.level === "soon" ? "soon" : "ok", text: `${ngay} · còn ${st.days} ngày` };
}

/** Dòng nhận diện tàu trên đầu màn: "Tàu <tên> · <mã>" — tên đã bắt đầu bằng "Tàu" thì giữ nguyên; thiếu gì bỏ nấy,
 *  không có gì ⇒ "Giấy tờ tàu". */
export function dongTauXuatTrinh(tenTau?: string, maTau?: string): string {
  const ten = tenTau?.trim();
  const ma = maTau?.trim();
  // tên bà con đặt hay đã có chữ "Tàu" ("Tàu Hai Lúa") ⇒ không thêm lần nữa (thấy "Tàu Tàu Hai Lúa" trên prod 26/10)
  const coTau = !!ten && /^tàu\s/i.test(ten.normalize("NFC"));
  return [ten && (coTau ? ten : `Tàu ${ten}`), ma].filter(Boolean).join(" · ") || "Giấy tờ tàu";
}
