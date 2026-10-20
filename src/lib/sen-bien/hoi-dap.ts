// SEN BIỂN — KHO HỎI–ĐÁP trong máy (v5, chủ dự án 2026-10-19: "nâng n-gram lên phân biệt hơn 2000 câu hỏi").
//
// Hai file, cả hai chạy không mạng:
//  · `sen-bien-hoi-dap.v1.bin` — mô hình kiểu fastText (train ở repo AI Assistant `train/tro-ly/ngram-ft.mjs`):
//    cùng đặc trưng băm với n-gram v4 (`dacTrung`) ⇒ tầng ẩn H chiều ⇒ đầu ý định (để biết câu là hỏi kiến thức,
//    `hoi_mo`) + đầu kho (chọn câu hỏi nào). Định dạng "SBN5": int8, MỖI HÀNG một thang.
//  · `sen-bien-hoi-dap.v1.json` — `q` = mã câu theo đúng thứ tự lớp của mô hình; `dap` = CHỈ câu chủ dự án đã
//    duyệt/sửa (trang duyệt claude.ai). Câu chưa duyệt không có ở đây ⇒ máy không bao giờ đọc câu chưa duyệt.
//
// LỆNH KHÔNG ĐỔI: n-gram v4 vẫn quyết lệnh. Cho mô hình lệnh học thêm câu kiến thức thì cổng lệnh tụt (đo 19/10:
// thêm 5k câu ⇒ −0,6 điểm, tụt > 1 ở 2 bộ) ⇒ kho chỉ lên tiếng khi v4 KHÔNG giành câu: v4 ra hoi_mo / khong_hieu /
// ngoai_pham_vi, HOẶC v4 kém chắc (< NGUONG_V4). Đo trên 2.240 câu lệnh kín: kho "cướp" 0,4–0,8 % câu lệnh.

import { dacTrung, INTENTS } from "./ngram";

export const HOI_DAP_BIN = "/data/sen-bien-hoi-dap.v1.bin";
export const HOI_DAP_KHO = "/data/sen-bien-hoi-dap.v1.json";

/** p của câu đứng đầu ≥ ngưỡng này ⇒ đọc câu trả lời luôn (đo 19/10: đúng ~80 %). */
export const NGUONG_DAP = 0.7;
/** p trong [NGUONG_GOI_Y, NGUONG_DAP) ⇒ hỏi lại "Có phải bà con hỏi…" kèm 3 câu gần nhất (đúng trong 3: ~77 %). */
export const NGUONG_GOI_Y = 0.3;
/** v4 chắc từ mức này trở lên về một LỆNH thì kho không chen vào. */
export const NGUONG_V4 = 0.5;
/** v4 ra các ý này thì câu không phải lệnh — kho được trả lời. */
const NHUONG = new Set(["hoi_mo", "khong_hieu", "ngoai_pham_vi"]);

const NR = 5; // đầu lý do chặn (y_te, phap_ly, tien, tra_nguoi, khac) — cùng thứ tự bên train
const HOI_MO = INTENTS.indexOf("hoi_mo");

export type KhoHoiDap = { q: string[]; dap: Record<string, { hoi: string; dap: string }> };
export type HoiDapModel = {
  dim: number; h: number; nq: number;
  E: Int8Array; sE: Float32Array; Wy: Int8Array; sY: Float32Array; Wq: Int8Array; sQ: Float32Array;
  by: Float32Array; bq: Float32Array;
  kho: KhoHoiDap;
};

/** Bọc bytes "SBN5" + kho. Sai định dạng / lệch danh sách ý / lệch số câu ⇒ null (Sen Biển chạy như chưa có kho). */
export function loadHoiDap(buf: ArrayBuffer, kho: unknown): HoiDapModel | null {
  const k = kho as KhoHoiDap | null;
  if (!k || !Array.isArray(k.q) || typeof k.dap !== "object" || k.dap === null) return null;
  if (buf.byteLength < 24) return null;
  const u8 = new Uint8Array(buf);
  if (String.fromCharCode(u8[0], u8[1], u8[2], u8[3]) !== "SBN5") return null;
  const dv = new DataView(buf);
  const [dim, h, ny, nr, nq] = [0, 1, 2, 3, 4].map((i) => dv.getUint32(4 + 4 * i, true));
  if (ny !== INTENTS.length || nr !== NR || nq !== k.q.length || !h) return null;
  const nyr = ny + nr;
  const can = 24 + dim * h + nyr * h + nq * h + 4 * (dim + nyr + nq) + 4 * (nyr + nq);
  if (buf.byteLength !== can) return null;
  let o = 24;
  const i8 = (n: number) => { const a = new Int8Array(buf, o, n); o += n; return a; };
  const E = i8(dim * h), Wy = i8(nyr * h), Wq = i8(nq * h);
  // f32 có thể lệch hàng 4 byte (khối int8 phía trước cỡ lẻ) ⇒ chép ra
  const f32 = (n: number) => { const a = new Float32Array(buf.slice(o, o + 4 * n)); o += 4 * n; return a; };
  const sE = f32(dim), sY = f32(nyr), sQ = f32(nq), by = f32(nyr), bq = f32(nq);
  return { dim, h, nq, E, sE, Wy, sY, Wq, sQ, by, bq, kho: k };
}

function softmax(z: Float32Array, a: number, b: number): void {
  let m = -Infinity;
  for (let c = a; c < b; c++) if (z[c] > m) m = z[c];
  let s = 0;
  for (let c = a; c < b; c++) { z[c] = Math.exp(z[c] - m); s += z[c]; }
  for (let c = a; c < b; c++) z[c] /= s;
}

/** Câu ⇒ { laHoi: mô hình cho là câu hỏi kiến thức, top: 3 câu kho gần nhất kèm p }. Thuần, không mạng. */
export function doanHoiDap(m: HoiDapModel, cau: string): { laHoi: boolean; top: { id: string; p: number }[] } {
  const { dim, h, E, sE, Wy, sY, Wq, sQ, by, bq, nq } = m;
  const vec = new Float32Array(h);
  for (const [i, v] of dacTrung(cau, {})) {
    if (i >= dim) continue;
    const o = i * h, s = sE[i] * v;
    for (let j = 0; j < h; j++) vec[j] += E[o + j] * s;
  }
  const ny = INTENTS.length;
  const zy = new Float32Array(ny);
  for (let c = 0; c < ny; c++) {
    let s = 0; const o = c * h;
    for (let j = 0; j < h; j++) s += Wy[o + j] * vec[j];
    zy[c] = by[c] + s * sY[c];
  }
  let b = 0;
  for (let c = 1; c < ny; c++) if (zy[c] > zy[b]) b = c;
  const zq = new Float32Array(nq);
  for (let c = 0; c < nq; c++) {
    let s = 0; const o = c * h;
    for (let j = 0; j < h; j++) s += Wq[o + j] * vec[j];
    zq[c] = bq[c] + s * sQ[c];
  }
  softmax(zq, 0, nq);
  const top: { i: number; p: number }[] = [];
  for (let c = 0; c < nq; c++) {
    if (top.length < 3 || zq[c] > top[top.length - 1].p) {
      top.push({ i: c, p: zq[c] });
      top.sort((x, y) => y.p - x.p);
      if (top.length > 3) top.pop();
    }
  }
  return { laHoi: b === HOI_MO, top: top.map((t) => ({ id: m.kho.q[t.i], p: t.p })) };
}

export type TraLoiKho =
  | { loai: "dap"; id: string; hoi: string; dap: string }
  | { loai: "goi_y"; cac: { id: string; hoi: string; dap: string }[] };

/**
 * Chính sách ghép với n-gram v4 (lệnh). `v4` = kết quả guessIntent (null = chưa tải được v4 ⇒ chỉ dựa kho).
 * Trả null khi kho không nên trả lời — chỗ gọi xử lý câu như trước.
 */
export function traLoiKho(m: HoiDapModel | null, cau: string, v4: { y: string; conf: number } | null): TraLoiKho | null {
  if (!m || !cau.trim()) return null;
  if (v4 && !NHUONG.has(v4.y) && v4.conf >= NGUONG_V4) return null;
  const d = doanHoiDap(m, cau);
  if (!d.laHoi) return null;
  // chỉ câu ĐÃ DUYỆT có trong `dap`
  const co = d.top.filter((t) => m.kho.dap[t.id]).map((t) => ({ ...t, ...m.kho.dap[t.id] }));
  if (!co.length) return null;
  const dau = co[0];
  if (dau.id === d.top[0].id && dau.p >= NGUONG_DAP) return { loai: "dap", id: dau.id, hoi: dau.hoi, dap: dau.dap };
  // kém chắc (hoặc câu đứng đầu chưa duyệt) ⇒ đưa các câu đã duyệt trong 3 câu gần nhất cho bà con chọn
  if (d.top[0].p < NGUONG_GOI_Y) return null;
  return { loai: "goi_y", cac: co.map(({ id, hoi, dap }) => ({ id, hoi, dap })) };
}

/**
 * Dựng kho từ danh mục (Opus soạn) + quyết định của chủ dự án (trang duyệt): "ok" giữ câu trả lời gốc, "sua" dùng
 * bản sửa, còn lại (bỏ / chưa duyệt) KHÔNG vào `dap`. `q` theo đúng thứ tự lớp của mô hình (meta.json lúc train).
 * `hoi` = câu hỏi chuẩn của mọi mã trong q (để test và để gợi ý sau này) — không có câu trả lời chưa duyệt nào lọt ra.
 */
export function dungKho(
  q: readonly string[],
  danhMuc: readonly { id: string; hoi: string; dap: string }[],
  quyet: Record<string, { t?: string; dap?: string } | undefined>,
): KhoHoiDap & { hoi: Record<string, string> } {
  const theoId = new Map(danhMuc.map((r) => [r.id, r]));
  const dap: KhoHoiDap["dap"] = {};
  const hoi: Record<string, string> = {};
  for (const id of q) {
    const r = theoId.get(id);
    if (!r) continue;
    hoi[id] = r.hoi;
    const d = quyet[id];
    if (d?.t === "ok") dap[id] = { hoi: r.hoi, dap: r.dap };
    else if (d?.t === "sua" && typeof d.dap === "string" && d.dap.trim()) dap[id] = { hoi: r.hoi, dap: d.dap.trim() };
  }
  return { q: [...q], dap, hoi };
}

/** Câu Sen Biển nói khi gợi ý: đọc tối đa 3 câu hỏi để bà con chọn. */
export function cauGoiY(cac: { hoi: string }[]): string {
  if (cac.length === 1) return `Có phải bà con hỏi: ${cac[0].hoi}`;
  return `Bà con hỏi câu nào: ${cac.map((c, i) => `${i ? "hay " : ""}${c.hoi.replace(/\?\s*$/, "")}`).join(", ")}?`;
}
