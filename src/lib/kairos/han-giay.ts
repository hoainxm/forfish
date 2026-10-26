/*
  HẠN GIẤY CỦA CHÍNH BÀ CON DƯỚI BÀI LUẬT (14 §21f — anh Long 2026-10-26: "cái gia hạn thì theo luồng thông tin bà con
  có sẵn, rồi yêu cầu bà con nhập thông tin để sen biển hỗ trợ theo dõi và nhắc bà con khi gần tới hạn để tránh bị
  phạt").

  Bài Sen Biển tuyên truyền luật (§21e) nói về giấy có hạn (giấy phép khai thác, đăng kiểm, đăng ký, bảo hiểm và chứng
  chỉ thuyền viên) ⇒ dưới bài hiện hạn giấy ĐÚNG LOẠI ĐÓ của tàu bà con, đọc từ tủ giấy tờ + sổ thuyền viên TRONG MÁY
  (không request, chạy cả khi mất sóng). Chưa lưu / chưa có ngày hết hạn ⇒ mời nhập; có ngày rồi thì nhắc hạn sẵn có
  (lib/doc-reminders: 30·25·20·15·10 rồi 5→0 ngày, thông báo điện thoại + khi mở app) tự lo.

  THUẦN — component `components/kairos/han-giay-luat.tsx` đọc kho rồi gọi vào đây.
*/

import { showsUnderBoat } from "@/lib/boats";
import { byUrgency, getExpiryStatus, kindLabel, kindUsuallyNoExpiry, type BoatDocument, type DocumentKind } from "@/lib/documents";
import { daysUntil } from "@/lib/days";
import { MUC, type MucLuat } from "./tuyen-truyen-luat.mjs";

export type GiayTheoDoi = { loai: "giay"; kind: DocumentKind } | { loai: "thuyen-vien"; muc: "bao-hiem" | "chung-chi" };

/**
 * Mục luật ⇒ giấy cần theo dõi. CHỈ mục nói về việc CÓ/HẾT HẠN một giấy bà con giữ. Mục không có giấy hạn (nhật ký,
 * vùng biển, VMS, nghề cấm…) không có khối này.
 */
export const GIAY_CUA_MUC: Readonly<Record<string, readonly GiayTheoDoi[]>> = {
  "d21-k2-a": [{ loai: "giay", kind: "giay_phep_khai_thac" }],
  "d21-k4-a": [{ loai: "giay", kind: "giay_phep_khai_thac" }],
  "d24-khong-mang-giay-phep": [{ loai: "giay", kind: "giay_phep_khai_thac" }],
  "d24-tau-nho-khong-giay-phep": [{ loai: "giay", kind: "giay_phep_khai_thac" }],
  "d34-k3-an-toan-ky-thuat": [{ loai: "giay", kind: "dang_kiem" }],
  "d36-khong-dang-ky": [{ loai: "giay", kind: "dang_ky_tau" }],
  "d39-k4-bao-hiem": [{ loai: "thuyen-vien", muc: "bao-hiem" }],
  "d39-thuyen-vien-giay-to": [{ loai: "thuyen-vien", muc: "chung-chi" }],
};

/** Bài Sen Biển tuyên truyền luật ⇒ mục luật của nó (nhận theo nguyên văn trích trong ngoặc kép). Không phải ⇒ null. */
export function mucCuaBai(post: { kind?: string; body?: string | null }): MucLuat | null {
  if (post.kind !== "chinh-thuc" || !post.body) return null;
  return MUC.find((m) => post.body!.includes(`“${m.trich}”`)) ?? null;
}

/** Giấy cần theo dõi dưới một bài (rỗng ⇒ không vẽ khối). */
export function giayCuaBai(post: { kind?: string; body?: string | null }): readonly GiayTheoDoi[] {
  const m = mucCuaBai(post);
  return m ? (GIAY_CUA_MUC[m.id] ?? []) : [];
}

export type MucHan = "het" | "sap" | "con" | "khong-han" | "chua-han" | "chua-co";

export interface HanGiay {
  kind: DocumentKind;
  ten: string;
  muc: MucHan;
  /** ngày còn lại (âm = đã quá); null khi không có ngày */
  days: number | null;
  expiresOn?: string;
}

/**
 * Hạn của MỘT loại giấy trên tàu đang xem. Nhiều giấy cùng loại (đổi giấy, giấy cũ chưa xoá) ⇒ lấy giấy CÒN HẠN XA NHẤT
 * — bà con vừa gia hạn mà giấy cũ còn trong tủ thì không báo đỏ oan; không giấy nào có ngày ⇒ "chưa có ngày".
 */
export function hanGiay(
  kind: DocumentKind,
  docs: readonly (BoatDocument & { boatId?: string })[],
  ctx: { currentId: string | null; knownIds: ReadonlySet<string> | null; today: Date },
): HanGiay {
  const ten = kindLabel(kind);
  const cua = docs.filter((d) => d.kind === kind && showsUnderBoat(d.boatId, ctx.currentId, ctx.knownIds));
  if (!cua.length) return { kind, ten, muc: "chua-co", days: null };
  const coNgay = cua.filter((d) => !!d.expiresOn).sort(byUrgency(ctx.today));
  if (!coNgay.length) return { kind, ten, muc: kindUsuallyNoExpiry(kind) ? "khong-han" : "chua-han", days: null };
  const d = coNgay[coNgay.length - 1];
  const s = getExpiryStatus(d, ctx.today);
  return { kind, ten, muc: s.level === "expired" ? "het" : s.level === "soon" ? "sap" : "con", days: s.days, expiresOn: d.expiresOn };
}

export interface TomTatThuyenVien {
  muc: "bao-hiem" | "chung-chi";
  /** số người trong sổ */
  tong: number;
  /** số người có ghi giấy này (bảo hiểm: có bảo hiểm; chứng chỉ: có tên chứng chỉ hoặc ngày hết hạn) */
  coGiay: number;
  het: number;
  sap: number;
  /** có giấy mà chưa ghi ngày hết hạn (bảo hiểm: kể cả người chưa ghi có bảo hiểm) */
  chuaNgay: number;
  /** ngày còn lại của người hết hạn sớm nhất (null khi không ai có ngày) */
  ganNhat: number | null;
}

type Crew = { name?: unknown; hasInsurance?: unknown; insuranceExpiry?: unknown; certLabel?: unknown; certExpiry?: unknown };
const ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Sổ thuyền viên ⇒ tóm tắt bảo hiểm / chứng chỉ. Sổ theo CHỦ (không gắn tàu, crew-list R2) nên không lọc tàu.
 * `soonDays` = ngưỡng "sắp hết" của tủ giấy tờ (SOON_DAYS_DOCS).
 */
export function tomTatThuyenVien(muc: "bao-hiem" | "chung-chi", crew: readonly unknown[], today: Date, soonDays: number): TomTatThuyenVien {
  const out: TomTatThuyenVien = { muc, tong: 0, coGiay: 0, het: 0, sap: 0, chuaNgay: 0, ganNhat: null };
  for (const raw of crew) {
    if (!raw || typeof raw !== "object") continue;
    const c = raw as Crew;
    out.tong++;
    const ngay = muc === "bao-hiem" ? c.insuranceExpiry : c.certExpiry;
    const co = muc === "bao-hiem" ? c.hasInsurance === true : (typeof c.certLabel === "string" && c.certLabel.trim() !== "") || typeof ngay === "string";
    if (!co) {
      // chưa ghi bảo hiểm = cần nhập (luật bắt chủ tàu mua cho từng người); chưa ghi chứng chỉ = người không giữ bằng, bỏ qua
      if (muc === "bao-hiem") out.chuaNgay++;
      continue;
    }
    out.coGiay++;
    if (typeof ngay !== "string" || !ISO.test(ngay)) {
      out.chuaNgay++;
      continue;
    }
    const days = daysUntil(ngay, today);
    if (days <= 0) out.het++;
    else if (days <= soonDays) out.sap++;
    out.ganNhat = out.ganNhat == null ? days : Math.min(out.ganNhat, days);
  }
  return out;
}

/** Câu trạng thái của một dòng thuyền viên + mức màu. */
export function cauThuyenVien(t: TomTatThuyenVien): { cau: string; muc: "het" | "sap" | "con" | "chua-co" } {
  const giay = t.muc === "bao-hiem" ? "bảo hiểm" : "chứng chỉ";
  if (t.tong === 0) return { cau: "Sổ thuyền viên chưa có ai", muc: "chua-co" };
  const phan: string[] = [];
  if (t.het) phan.push(`${t.het} người đã hết hạn`);
  if (t.sap) phan.push(`${t.sap} người sắp hết hạn`);
  if (t.chuaNgay) phan.push(t.muc === "bao-hiem" ? `${t.chuaNgay} người chưa ghi ${giay}` : `${t.chuaNgay} người chưa ghi ngày hết hạn`);
  if (!phan.length) {
    if (t.coGiay === 0) return { cau: `Chưa ghi ${giay} của ai`, muc: "chua-co" };
    return { cau: `Còn hạn cả ${t.coGiay} người`, muc: "con" };
  }
  return { cau: phan.join(" · "), muc: t.het ? "het" : t.sap ? "sap" : "chua-co" };
}

/** Link mở đúng giấy trong tủ (tủ đọc `giay=` qua documents.giayTuUrl ⇒ có rồi thì sửa, chưa có thì thêm mới). */
export const linkGiay = (kind: DocumentKind): string => `/tau?tab=giay-to&giay=${kind}`;
