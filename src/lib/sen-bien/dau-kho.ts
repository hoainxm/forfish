// SEN BIỂN — ĐẦU KHO HỎI–ĐÁP của n-gram v5b (thuần, có test, không mạng).
//
// Chủ dự án 2026-10-19: hiểu LỆNH vẫn là n-gram v4 (`ngram.ts`, không tụt); v5b CHỈ dùng đầu kho — đưa ra 9 câu
// hỏi gần nhất trong kho (~2000 câu) cho Gemma chọn / tự trả lời khi chắc. Đầu ý định của v5b BỎ QUA.
// File `public/data/sen-bien-ngram.v5.bin` = `w.sbn5` repo AI Assistant `train/tro-ly/ngram-ft.mjs` (bản v5b, H=64),
// chép nguyên byte bằng `scripts/build-sen-bien-hoi-dap.mjs`. Phép tính = `topk.mjs topK` bên train (đặc trưng
// băm y hệt v4: `ngram.dacTrung`). Đổi bố cục ở đó thì đổi ở đây.

import { dacTrung, INTENTS, type NgramCtx } from "./ngram";

export const DAU_KHO_PATH = "/data/sen-bien-ngram.v5.bin";

const DIM = 1 << 16;
const NR = 5; // y_te · phap_ly · tien · tra_nguoi · khac — đầu lý do chặn của v5b (không dùng)
const NYR = INTENTS.length + NR;

/** Giữ int8 + thang mỗi hàng (giải ra số thực bảng E là 16 MB RAM). */
export type DauKho = { h: number; nq: number; qE: Int8Array; sE: Float32Array; qQ: Int8Array; sQ: Float32Array; bq: Float32Array };

/** Cỡ đúng của tệp SBN5 — ghi bởi `ngram-ft.mjs ghi()`. */
export function sbn5Bytes(h: number, nq: number): number {
  return 24 + (DIM + NYR + nq) * h + 4 * (DIM + NYR + nq) + 4 * (NYR + nq);
}

/**
 * Đọc "SBN5": magic · u32 LE DIM H NY NR NQ · i8 E[DIM×H] · i8 Wy[NYR×H] · i8 Wq[NQ×H] · f32 thang theo hàng
 * (DIM, NYR, NQ) · f32 by[NYR] · f32 bq[NQ]. Sai magic / số ý / cỡ (hỏng, bị cắt) ⇒ null ⇒ không có kho.
 */
export function loadDauKho(buf: ArrayBuffer): DauKho | null {
  if (buf.byteLength < 24) return null;
  const dv = new DataView(buf);
  if (String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3)) !== "SBN5") return null;
  const [dim, h, ny, nr, nq] = [0, 1, 2, 3, 4].map((i) => dv.getUint32(4 + 4 * i, true));
  if (dim !== DIM || ny !== INTENTS.length || nr !== NR || h < 1 || h > 1024 || nq < 1 || nq > 100000) return null;
  if (buf.byteLength !== sbn5Bytes(h, nq)) return null;
  const qE = new Int8Array(buf, 24, DIM * h);
  const qQ = new Int8Array(buf, 24 + (DIM + NYR) * h, nq * h);
  let o = 24 + (DIM + NYR + nq) * h;
  // DataView đọc LE tường minh — không phụ thuộc căn lề 4 byte
  const f32 = (n: number) => {
    const a = new Float32Array(n);
    for (let k = 0; k < n; k++) a[k] = dv.getFloat32(o + 4 * k, true);
    o += 4 * n;
    return a;
  };
  const sE = f32(DIM);
  f32(NYR); // thang hàng Wy — bỏ
  const sQ = f32(nq);
  f32(NYR); // by — bỏ
  const bq = f32(nq);
  return { h, nq, qE, sE, qQ, sQ, bq };
}

/** K lớp đầu kho xác suất cao nhất (softmax trên cả kho), giảm dần. */
export function topK(m: DauKho, cau: string, ctx: NgramCtx, k: number): { i: number; p: number }[] {
  const H = m.h;
  const h = new Float64Array(H);
  for (const [i, v] of dacTrung(cau, ctx)) {
    const o = i * H;
    const s = m.sE[i] * v;
    for (let j = 0; j < H; j++) h[j] += m.qE[o + j] * s;
  }
  const z = new Float64Array(m.nq);
  let mx = -Infinity;
  for (let c = 0; c < m.nq; c++) {
    const o = c * H;
    let s = 0;
    for (let j = 0; j < H; j++) s += m.qQ[o + j] * h[j];
    z[c] = m.bq[c] + s * m.sQ[c];
    if (z[c] > mx) mx = z[c];
  }
  let t = 0;
  for (let c = 0; c < m.nq; c++) {
    z[c] = Math.exp(z[c] - mx);
    t += z[c];
  }
  const top: { i: number; p: number }[] = [];
  for (let c = 0; c < m.nq; c++) {
    if (top.length < k || z[c] > top[top.length - 1].p) {
      top.push({ i: c, p: z[c] });
      top.sort((a, b) => b.p - a.p);
      if (top.length > k) top.pop();
    }
  }
  return top.map((x) => ({ i: x.i, p: x.p / t }));
}
