// SEN BIỂN — KHO HỎI–ĐÁP trong máy (thuần, có test, không mạng).
//
// HAI TRẠNG THÁI KHO (`docKho` chỉ nhận đúng hai chữ này):
//  · `da-duyet` (từ 2026-10-22, chủ dự án "làm theo đề xuất": đưa kho v5c đã duyệt vào nhánh này) — `dap` CHỈ mang
//    câu chủ dự án đã duyệt/sửa trên trang duyệt claude.ai; mọi câu chưa duyệt (kể cả `can_kiem`) nằm trong
//    `canKiem` ⇒ Sen Biển đọc câu an toàn `CAU_CAN_KIEM`, KHÔNG BAO GIỜ đọc câu máy soạn chưa duyệt.
//    Câu trả lời đã soạn lại theo văn bản hiện hành (NĐ 41/2026, TT 81/2025, NĐ 246/2026…) + tài liệu SDVICO.
//  · `chua-duyet-chi-ban-test` (19/10, bản test cũ) — chỉ câu `can_kiem: false` mang câu trả lời.
// Ai sửa tay file sang "da-duyet" mà không qua `scripts/build-sen-bien-hoi-dap.mjs --quyet` là sai luật.
//
// File `public/data/sen-bien-hoi-dap.v2.json` (v2: đổi tên vì bản v1 định dạng khác đã nằm trong kho SW của máy
// bà con từ 20/10 — /data cache-first; sinh bằng `scripts/build-sen-bien-hoi-dap.mjs`):
// `q` = mã câu theo ĐÚNG thứ tự lớp đầu kho của `sen-bien-ngram.v5.bin` (dau-kho.ts) · `cauHoi` = câu hỏi CHUẨN
// (danh mục `hoi`) cùng thứ tự — đưa Gemma chọn · `dap` = mã → câu trả lời · `canKiem` = mã câu cần kiểm.
// Câu trùng ý đã gộp (trung.json) không có lớp — mô hình đoán thẳng về câu giữ.

export const HOI_DAP_PATH = "/data/sen-bien-hoi-dap.v2.json";

/** Bản test cũ (19/10): chưa người duyệt. */
export const KHO_CHUA_DUYET = "chua-duyet-chi-ban-test";
/** Bản đã duyệt (22/10): `dap` chỉ câu đã duyệt, còn lại vào `canKiem`. */
export const KHO_DA_DUYET = "da-duyet";

/** Câu an toàn cho câu hỏi dính luật lệ / con số — không đọc câu máy soạn khi chưa duyệt. */
export const CAU_CAN_KIEM =
  "Câu này dính tới luật lệ, con số, Sen Biển chưa dám nói chắc. Bà con hỏi Chi cục Thuỷ sản hoặc SDVICO cho đúng nhé.";

export type KhoHoiDap = {
  trangThai: typeof KHO_CHUA_DUYET | typeof KHO_DA_DUYET;
  q: string[];
  cauHoi: string[];
  dap: Record<string, string>;
  canKiem: Set<string>;
};

const chuoi = (a: unknown, n: number): a is string[] =>
  Array.isArray(a) && a.length === n && a.every((x) => typeof x === "string" && !!x.trim());

/**
 * Kiểm + bọc JSON kho. `nq` = số lớp đầu kho của mô hình đã tải — lệch ⇒ null (kho không khớp
 * mô hình, đọc là đọc nhầm câu). Sai trạng thái / hỏng ⇒ null.
 */
export function docKho(raw: unknown, nq: number): KhoHoiDap | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as { trangThai?: unknown; q?: unknown; cauHoi?: unknown; dap?: unknown; canKiem?: unknown };
  if (r.trangThai !== KHO_CHUA_DUYET && r.trangThai !== KHO_DA_DUYET) return null;
  if (!chuoi(r.q, nq) || !chuoi(r.cauHoi, nq)) return null;
  if (!r.dap || typeof r.dap !== "object" || Array.isArray(r.dap)) return null;
  if (!Array.isArray(r.canKiem)) return null;
  const canKiem = new Set(r.canKiem.filter((x): x is string => typeof x === "string"));
  const dap: Record<string, string> = {};
  for (const [k, v] of Object.entries(r.dap as Record<string, unknown>)) {
    // câu cần kiểm KHÔNG BAO GIỜ mang câu trả lời — file lẫn thì bỏ câu đó, không đọc
    if (typeof v === "string" && v.trim() && !canKiem.has(k)) dap[k] = v.trim();
  }
  return { trangThai: r.trangThai, q: r.q, cauHoi: r.cauHoi, dap, canKiem };
}

/** Câu Sen Biển đọc cho mã câu kho; null = mã lạ / không có câu (chỗ gọi coi như kho trượt). */
export function cauTraLoi(kho: KhoHoiDap, id: string): string | null {
  if (kho.canKiem.has(id)) return CAU_CAN_KIEM;
  return kho.dap[id] ?? null;
}
