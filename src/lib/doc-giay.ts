// ĐỌC GIẤY TỜ TÀU TỪ ẢNH — luật THUẦN + một hàm gọi mạng (ADR 0017, 2026-10-26).
//
// Anh Long: "chụp hình giấy tờ gửi lên app, app nội suy ra thời gian hết hạn các loại giấy tờ… dùng chung con hỗ trợ
// Sen Biển ấy". Đường đi: ảnh nén (lib/doc-photos compressImage) ⇒ POST /api/me/docs/doc-giay (server ForFish) ⇒ ký
// ⇒ máy nhà /gw/v1/forfish/giay ⇒ Gemma e2b (CÙNG mô hình Sen Biển, có vision) ⇒ JSON {loai, so, ngay_cap, het_han,
// ten_tau}. Máy KHÔNG tự lưu: `apDungKqDocGiay` chỉ ĐIỀN vào form, bà con xem lại rồi bấm Lưu — ngày sai là tàu bị
// phạt, nên hàng chữ "App đọc từ ảnh…" luôn hiện kèm. Mọi lỗi trả MÃ, chỗ gọi nói câu đời thường (`cauLoiDoc`);
// không bao giờ ném. Mất sóng: không gọi (ảnh giấy tờ vốn cần sóng để tải lên — doc-photos v1).

import { readToken, authedFetch } from "@/lib/device-token-store";
import { DOCUMENT_KINDS, type DocumentKind } from "@/lib/documents";

export interface KqDocGiay {
  loai: DocumentKind;
  so: string | null;
  ngayCap: string | null; // YYYY-MM-DD
  hetHan: string | null; // YYYY-MM-DD
  tenTau: string | null;
}

export type LoiDocGiay =
  | "mat_song"
  | "mang_yeu"
  | "chua_dang_nhap"
  | "qua_lon"
  | "khong_doc_duoc"
  | "may_nha_tat"
  | "timeout"
  | "rate_limited"
  | "chua_noi";

export type KqDocGiayHoacLoi = { ok: true; giay: KqDocGiay } | { ok: false; loi: LoiDocGiay };

/** Trần byte ảnh gửi đi — khớp máy nhà `ANH_GIAY_TOI_DA` 2 MB (compressImage nén ≤1,8 MB). */
export const ANH_GIAY_TOI_DA = 2 * 1024 * 1024;
/** Chờ cả đường (đẩy ảnh lên + Vercel + máy nhà ≤12 s + về). 45 s (trước 30 s) — ảnh đọc đã nhỏ, phần dư cho sóng lên yếu. */
export const DOC_GIAY_HAN_MS = 45_000;
/** Cỡ ảnh gửi ĐỌC (2026-10-26): 1280px, ≤450 KB — chữ trên giấy vẫn rõ cho mô hình (đọc ảnh ở cỡ nhỏ hơn thế),
 *  nhẹ hơn ảnh lưu 4–6 lần. Ảnh LƯU để xuất trình giữ 1600px. */
export const ANH_DOC_GIAY = { maxDim: 1280, targetBytes: 450 * 1024 } as const;

/** Lỗi nào bấm "Thử lại" (cùng ảnh, không chụp lại) có ích. */
export function coTheThuLai(loi: LoiDocGiay): boolean {
  return loi === "mang_yeu" || loi === "mat_song" || loi === "timeout" || loi === "may_nha_tat" || loi === "chua_noi" || loi === "rate_limited";
}

/** Không có phản hồi (fetch ném / quá giờ): máy báo mất mạng ⇒ mất sóng; còn lại ⇒ MẠNG YẾU (không nói dối là mất sóng). */
export function loiKhongPhanHoi(online: boolean): LoiDocGiay {
  return online ? "mang_yeu" : "mat_song";
}

const KINDS = new Set<string>(DOCUMENT_KINDS.map((k) => k.value));
const NGAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const SO_RE = /^[\p{L}\p{N}][\p{L}\p{N} /.,\-_:]{0,39}$/u;
const TEN_TAU_RE = /^[\p{L}\p{N}][\p{L}\p{N} .\-]{0,19}$/u;

/** "YYYY-MM-DD" là ngày THẬT (năm 2000–2050) ⇒ giữ; khác ⇒ null. */
export function ngayHopLe(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const m = NGAY_RE.exec(v.trim());
  if (!m) return null;
  const [y, mo, d] = [+m[1], +m[2], +m[3]];
  if (y < 2000 || y > 2050 || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d ? m[0].trim() : null;
}

/**
 * Kiểm JSON máy nhà trả về (server ForFish kiểm một lần, máy bà con kiểm lần nữa — không tin thứ đi qua mạng).
 * Loại lạ ⇒ "khac"; ô rác ⇒ null; hết hạn ≤ ngày cấp ⇒ bỏ hết hạn. Không phải object ⇒ null.
 */
export function kiemKqDocGiay(j: unknown): KqDocGiay | null {
  if (!j || typeof j !== "object" || Array.isArray(j)) return null;
  const o = j as Record<string, unknown>;
  const chu = (v: unknown, re: RegExp) => (typeof v === "string" && re.test(v.trim()) ? v.trim() : null);
  const loai = (typeof o.loai === "string" && KINDS.has(o.loai) ? o.loai : "khac") as DocumentKind;
  const ngayCap = ngayHopLe(o.ngay_cap ?? o.ngayCap);
  let hetHan = ngayHopLe(o.het_han ?? o.hetHan);
  if (ngayCap && hetHan && hetHan <= ngayCap) hetHan = null;
  return { loai, so: chu(o.so, SO_RE), ngayCap, hetHan, tenTau: chu(o.ten_tau ?? o.tenTau, TEN_TAU_RE) };
}

export interface FormGiay {
  kind: DocumentKind;
  number: string;
  issuedOn: string;
  expiresOn: string;
}
export type OGiay = keyof FormGiay;
const TEN_O: Record<OGiay, string> = { kind: "loại giấy", number: "số giấy", issuedOn: "ngày cấp", expiresOn: "ngày hết hạn" };

/**
 * ĐIỀN kết quả đọc vào form (thuần). Ô máy đọc được thì ghi đè (ảnh giấy thật hơn ô gõ tay/mặc định); ô máy không
 * đọc được thì GIỮ của bà con. Trả thêm `daDien` (ô trống được điền) + `daDoi` (ô có sẵn bị thay) để câu nhắc nói
 * đúng. Loại "khac" = máy không nhận ra loại ⇒ không đổi loại bà con đã chọn.
 */
export function apDungKqDocGiay(form: FormGiay, kq: KqDocGiay): { form: FormGiay; daDien: OGiay[]; daDoi: OGiay[] } {
  const moi: FormGiay = { ...form };
  const daDien: OGiay[] = [];
  const daDoi: OGiay[] = [];
  const dat = (o: OGiay, v: string | null) => {
    if (!v) return;
    const cu = form[o];
    if (cu === v) return;
    (moi as Record<OGiay, string>)[o] = v;
    (cu ? daDoi : daDien).push(o);
  };
  dat("kind", kq.loai === "khac" ? null : kq.loai);
  dat("number", kq.so);
  dat("issuedOn", kq.ngayCap);
  dat("expiresOn", kq.hetHan);
  return { form: moi, daDien, daDoi };
}

/** Câu sau khi đọc xong — luôn nhắc XEM LẠI (ngày sai là tàu bị phạt). */
export function cauKetQuaDoc(daDien: OGiay[], daDoi: OGiay[], hetHan: string | null): string {
  const o = [...daDien, ...daDoi];
  if (!o.length) return "App chưa đọc được chữ trên ảnh — bà con ghi tay ngày hết hạn giúp nhé.";
  const ds = o.map((k) => TEN_O[k]).join(", ");
  const dau = `App đọc từ ảnh: ${ds}.`;
  if (!hetHan) return `${dau} Chưa thấy ngày hết hạn — bà con ghi tay nếu giấy có hạn.`;
  return `${dau} Bà con xem lại cho đúng rồi mới Lưu.`;
}

/** Câu lỗi đời thường theo mã. */
export function cauLoiDoc(loi: LoiDocGiay): string {
  switch (loi) {
    // 2026-10-26 (anh Long: "ocr mà còn nhập tay? thế chụp làm gì"): câu lỗi chỉ ra việc làm TIẾP — bấm Thử lại
    // (cùng ảnh); không đẩy bà con về gõ tay như lối thoát đầu tiên.
    case "mat_song":
      return "Máy đang mất sóng. Ảnh đã giữ — có sóng bấm Thử lại.";
    case "mang_yeu":
      return "Mạng yếu, app đọc chưa xong. Bấm Thử lại.";
    case "chua_dang_nhap":
      return "Đăng nhập để app đọc giấy giúp.";
    case "qua_lon":
      return "Ảnh quá nặng, bà con chụp lại gần hơn một chút.";
    case "khong_doc_duoc":
      return "App chưa đọc rõ chữ — chụp lại thẳng, đủ sáng, rõ chỗ ngày hết hạn.";
    case "rate_limited":
      return "Bà con đọc nhiều ảnh liền quá, nghỉ một phút rồi bấm Thử lại.";
    case "timeout":
    case "may_nha_tat":
    case "chua_noi":
    default:
      return "Máy đọc giấy đang bận. Bấm Thử lại sau ít phút.";
  }
}

/** Blob ⇒ base64 (không dùng btoa(String.fromCharCode(...)) cả cục — ảnh 1,8 MB tràn stack trên WebView cũ). */
async function base64CuaBlob(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let s = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < buf.length; i += CHUNK) s += String.fromCharCode.apply(null, Array.from(buf.subarray(i, i + CHUNK)));
  return btoa(s);
}

/** Gửi ảnh (đã nén) đi đọc. Không ném; mọi lỗi về mã. */
export async function docGiayTuAnh(blob: Blob): Promise<KqDocGiayHoacLoi> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return { ok: false, loi: "mat_song" };
  if (!readToken()) return { ok: false, loi: "chua_dang_nhap" };
  if (!blob.size || blob.size > ANH_GIAY_TOI_DA) return { ok: false, loi: "qua_lon" };
  let anh: string;
  try {
    anh = await base64CuaBlob(blob);
  } catch {
    return { ok: false, loi: "qua_lon" };
  }
  const { res } = await authedFetch(
    "/api/me/docs/doc-giay",
    { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ anh }) },
    DOC_GIAY_HAN_MS,
  );
  if (!res) return { ok: false, loi: loiKhongPhanHoi(typeof navigator === "undefined" || navigator.onLine !== false) };
  const j = (await res.json().catch(() => null)) as { ok?: boolean; giay?: unknown; code?: string } | null;
  if (res.ok && j?.ok) {
    const giay = kiemKqDocGiay(j.giay);
    return giay ? { ok: true, giay } : { ok: false, loi: "khong_doc_duoc" };
  }
  const code = j?.code ?? "";
  if (res.status === 401) return { ok: false, loi: "chua_dang_nhap" };
  if (res.status === 413 || res.status === 400) return { ok: false, loi: "qua_lon" };
  if (res.status === 429) return { ok: false, loi: "rate_limited" };
  if (res.status === 504 || code === "timeout") return { ok: false, loi: "timeout" };
  if (code === "khong_doc_duoc") return { ok: false, loi: "khong_doc_duoc" };
  if (code.startsWith("chua_noi")) return { ok: false, loi: "chua_noi" };
  return { ok: false, loi: "may_nha_tat" };
}
