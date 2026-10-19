// SEN BIỂN — KHO HỎI–ĐÁP trong máy (thuần, có test, không mạng).
//
// ⚠ KHO CHƯA DUYỆT — CHỈ BẢN TEST, CHƯA ĐƯỢC LÊN MAIN (chủ dự án 2026-10-19).
// 2000 câu Opus soạn (repo AI Assistant `train/tro-ly/hoi-dap.mjs`), chưa người nào duyệt.
// Bản test chỉ mang câu trả lời của câu KHÔNG cần kiểm; câu có con số / điều luật / số điện thoại
// (`can_kiem`) chỉ có mã — Sen Biển đọc câu an toàn `CAU_CAN_KIEM`, không đọc câu máy soạn.
// `docKho` chỉ nhận đúng trạng thái `chua-duyet-chi-ban-test`: ai đổi file thành "đã duyệt" mà
// chưa qua duyệt thật thì kho bị từ chối (Sen Biển trả lời như trước khi có kho), test
// `sen-bien-hoi-dap.test.ts` cũng đỏ. Lên main phải có bản duyệt + đổi luật ở đây CÓ CHỦ Ý.
//
// File `public/data/sen-bien-hoi-dap.v1.json` (sinh bằng `scripts/build-sen-bien-hoi-dap.mjs`):
// `q` = mã câu theo ĐÚNG thứ tự lớp đầu kho của `sen-bien-ngram.v5.bin` (dau-kho.ts) · `cauHoi` = câu hỏi CHUẨN
// (danh mục `hoi`) cùng thứ tự — đưa Gemma chọn · `dap` = mã → câu trả lời · `canKiem` = mã câu cần kiểm.
// Câu trùng ý đã gộp (trung.json) không có lớp — mô hình đoán thẳng về câu giữ.

export const HOI_DAP_PATH = "/data/sen-bien-hoi-dap.v1.json";

/** Trạng thái duy nhất bản test chấp nhận. */
export const KHO_CHUA_DUYET = "chua-duyet-chi-ban-test";

/** Câu an toàn cho câu hỏi dính luật lệ / con số — không đọc câu máy soạn khi chưa duyệt. */
export const CAU_CAN_KIEM =
  "Câu này dính tới luật lệ, con số, Sen Biển chưa dám nói chắc. Bà con hỏi Chi cục Thuỷ sản hoặc SDVICO cho đúng nhé.";

export type KhoHoiDap = {
  trangThai: typeof KHO_CHUA_DUYET;
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
  if (r.trangThai !== KHO_CHUA_DUYET) return null;
  if (!chuoi(r.q, nq) || !chuoi(r.cauHoi, nq)) return null;
  if (!r.dap || typeof r.dap !== "object" || Array.isArray(r.dap)) return null;
  if (!Array.isArray(r.canKiem)) return null;
  const canKiem = new Set(r.canKiem.filter((x): x is string => typeof x === "string"));
  const dap: Record<string, string> = {};
  for (const [k, v] of Object.entries(r.dap as Record<string, unknown>)) {
    // câu cần kiểm KHÔNG BAO GIỜ mang câu trả lời — file lẫn thì bỏ câu đó, không đọc
    if (typeof v === "string" && v.trim() && !canKiem.has(k)) dap[k] = v.trim();
  }
  return { trangThai: KHO_CHUA_DUYET, q: r.q, cauHoi: r.cauHoi, dap, canKiem };
}

/** Câu Sen Biển đọc cho mã câu kho; null = mã lạ / không có câu (chỗ gọi coi như kho trượt). */
export function cauTraLoi(kho: KhoHoiDap, id: string): string | null {
  if (kho.canKiem.has(id)) return CAU_CAN_KIEM;
  return kho.dap[id] ?? null;
}
