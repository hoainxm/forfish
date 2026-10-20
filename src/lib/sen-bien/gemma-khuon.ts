// SEN BIỂN — KHUÔN câu hỏi Gemma, dùng chung MÁY (gemma.ts) và MÁY CHỦ (route /api/sen-bien/gemma).
// Thuần, không Capacitor, không window — route import được. Prompt phải KHỚP TỪNG CHỮ lúc train
// (repo AI Assistant train/tro-ly/chung.mjs SYSTEM) và máy chủ Gemma (train/tro-ly/gemma-may-chu.py chỉ nhận đúng SYSTEM này).

export const SYSTEM =
  'Bộ hiểu ý Trợ lý Forfish. Đọc câu ngư dân nói, trả đúng một dòng JSON {"y":ý định,"s":tham số,"f":ý thứ hai,"r":lý do chặn}.';

/** Trần độ dài lượt người (ngữ cảnh + câu) — cùng số với máy chủ Gemma. */
export const TRAN_CAU_GEMMA = 600;

/** Kiểm lượt người ở RANH GIỚI (route): chuỗi khác rỗng, ≤ trần, đúng khuôn `xn=… | cang=… | diem=… | tau=…\ncau: …`. Sai ⇒ null. */
export function kiemCauGemma(x: unknown): string | null {
  if (typeof x !== "string") return null;
  if (!x.trim() || x.length > TRAN_CAU_GEMMA) return null;
  if (!/^xn=[01] \| cang=[^\n]* \| diem=[^\n]* \| tau=[^\n]*\ncau: [^\n]+$/.test(x)) return null;
  return x;
}
