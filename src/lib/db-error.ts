// Rút GỌN lỗi Postgres/PostgREST thành 1 chuỗi ngắn để đối soát webhook.
// THUẦN — test được, không đụng Supabase client.
//
// Bối cảnh (2026-07-21): worker outbox SDWork báo hàng loạt `upsert_failed`
// nhưng route webhook NUỐT lỗi thật (chỉ trả mã chung) → không ai biết vì sao,
// phải đoán. Giờ trả kèm `detail` để CRM log ra ngay nguyên nhân.
//
// Kênh này là SDWork (hệ nội bộ, đã verify HMAC) nên trả chi tiết lỗi là an
// toàn — NHƯNG vẫn cắt ngắn và KHÔNG bao giờ kèm mật khẩu (payload có thể có
// `password`; ở đây chỉ lấy message/code/constraint của DB, không đụng payload).

/** Lỗi Supabase (PostgrestError) — chỉ lấy phần cần cho đối soát. */
type DbError = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
} | null;

const MAX_LEN = 200;

/** Mã lỗi Postgres → nghĩa nghiệp vụ, để người đọc log khỏi tra bảng mã. */
const NGHIA: Record<string, string> = {
  "23505": "trùng khoá duy nhất (vd 2 account CRM dùng chung SĐT)",
  "23503": "tham chiếu bản ghi không tồn tại",
  "23502": "thiếu cột bắt buộc",
  "22P02": "sai định dạng dữ liệu",
  "42703": "cột không tồn tại (schema lệch)",
  "42P01": "bảng không tồn tại (thiếu migration)",
};

/**
 * Gộp code + message + details thành 1 dòng ngắn, cắt ở MAX_LEN.
 * Không có gì để nói → `undefined` (bỏ hẳn field khỏi response).
 */
export function dbErrorDetail(err: DbError): string | undefined {
  if (!err) return undefined;

  const code = (err.code ?? "").trim();
  const parts: string[] = [];

  if (code) {
    const nghia = NGHIA[code];
    parts.push(nghia ? `${code} (${nghia})` : code);
  }

  // message + details: bỏ trùng lặp, bỏ rỗng
  const texts = [err.message, err.details]
    .map((t) => (t ?? "").trim())
    .filter(Boolean);
  const seen = new Set<string>();
  texts.forEach((t) => {
    if (!seen.has(t)) {
      seen.add(t);
      parts.push(t);
    }
  });

  if (parts.length === 0) return undefined;

  const joined = parts.join(" — ");
  return joined.length > MAX_LEN ? joined.slice(0, MAX_LEN - 1) + "…" : joined;
}
