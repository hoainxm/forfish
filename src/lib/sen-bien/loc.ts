// SEN BIỂN — BỘ LỌC "câu hỏi kiến thức hay câu lệnh" (thuần, có test, không mạng).
//
// Hồi quy logistic 2 lớp trên ĐÚNG đặc trưng băm của v4 (`ngram.dacTrung`, có ngữ cảnh). Dùng để đưa câu hỏi
// kiến thức mà n-gram v4 đoán lạc sang ý khác vào kho hỏi–đáp (`hoi-kho.ts`). Train: repo AI Assistant
// (`tro-ly-v5r/sp/loc.mjs`, phạt cướp lệnh ×3) ⇒ `troly-loc-v1/{w.loc, meta.json}`; `scripts/build-sen-bien-hoi-dap.mjs`
// gói thành `public/data/sen-bien-loc.v1.bin`: "SBL1" · f32 LE thang · f32 LE b · i8 w[65536] (65 548 byte).
// p = sigmoid(b + Σ w[i]·thang·v_i). Sai cỡ / sai magic ⇒ null ⇒ chỉ ý hoi_mo / khong_hieu của v4 vào kho.

import { dacTrung, type NgramCtx } from "./ngram";

export const LOC_PATH = "/data/sen-bien-loc.v1.bin";
const DIM = 1 << 16;
export const LOC_BYTES = 12 + DIM;

/** Ngưỡng lọc từ đó coi là câu hỏi kiến thức. 0,8 là mốc khởi điểm (điều phối 2026-10-19) — chờ số đo cướp lệnh. */
export const LOC_NGUONG = 0.8;

export type BoLoc = { w: Int8Array; thang: number; b: number };

export function loadLoc(buf: ArrayBuffer): BoLoc | null {
  if (buf.byteLength !== LOC_BYTES) return null;
  const dv = new DataView(buf);
  if (String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3)) !== "SBL1") return null;
  const thang = dv.getFloat32(4, true);
  const b = dv.getFloat32(8, true);
  if (!Number.isFinite(thang) || !Number.isFinite(b)) return null;
  return { w: new Int8Array(buf, 12, DIM), thang, b };
}

/** Xác suất câu là CÂU HỎI kiến thức (không phải lệnh). */
export function pHoi(m: BoLoc, cau: string, ctx: NgramCtx = {}): number {
  let z = m.b;
  for (const [i, v] of dacTrung(cau, ctx)) z += m.w[i] * m.thang * v;
  return 1 / (1 + Math.exp(-z));
}
