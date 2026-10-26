// CĂN GIẤY — tìm 4 góc tờ giấy trong ảnh chụp, nắn thẳng (phối cảnh) + làm rõ chữ. THUẦN (mảng số, không DOM),
// chạy NGAY TRÊN MÁY (mất sóng vẫn căn được), có test (2026-10-26 — anh Long: "chụp ảnh còn phải căn chỉnh sao cho
// dễ đọc"). Màn kéo góc ở components/can-giay-sheet.tsx; luồng ở document-vault (Chụp giấy).
//
// Tìm góc (rẻ, không OpenCV): ảnh thu nhỏ ≤ 320px → xám → ngưỡng Otsu (giấy sáng hơn nền) → vùng sáng LIỀN lớn nhất
// → 4 góc = điểm cực của x+y và x−y. Đủ cho giấy trắng/vàng nhạt đặt trên bàn, sàn, đùi. Không chắc (vùng < 15 % hay
// gần cả khung, tứ giác không lồi) ⇒ null ⇒ chỗ gọi lấy cả khung ảnh và để bà con tự kéo góc.

export type Diem = { x: number; y: number };
/** Thứ tự cố định: trên-trái, trên-phải, dưới-phải, dưới-trái. */
export type BonGoc = [Diem, Diem, Diem, Diem];

/** RGBA → xám (Rec. 601). */
export function xam(rgba: Uint8ClampedArray | Uint8Array, w: number, h: number): Uint8Array {
  const out = new Uint8Array(w * h);
  for (let i = 0, j = 0; i < out.length; i++, j += 4) out[i] = (rgba[j] * 299 + rgba[j + 1] * 587 + rgba[j + 2] * 114) / 1000;
  return out;
}

/** Ngưỡng Otsu trên ảnh xám. */
export function nguongOtsu(g: Uint8Array): number {
  const hist = new Array<number>(256).fill(0);
  for (const v of g) hist[v]++;
  const n = g.length;
  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * hist[t];
  let sumB = 0;
  let wB = 0;
  let best = 0;
  let nguong = 127;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (!wB) continue;
    const wF = n - wB;
    if (!wF) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const giua = wB * wF * (mB - mF) * (mB - mF);
    if (giua > best) {
      best = giua;
      nguong = t;
    }
  }
  return nguong;
}

/** Xếp 4 điểm bất kỳ về thứ tự trên-trái, trên-phải, dưới-phải, dưới-trái (theo x+y và x−y). */
export function xepGoc(p: readonly Diem[]): BonGoc {
  const by = (f: (d: Diem) => number, lon: boolean) => p.reduce((a, b) => ((lon ? f(b) > f(a) : f(b) < f(a)) ? b : a));
  return [by((d) => d.x + d.y, false), by((d) => d.x - d.y, true), by((d) => d.x + d.y, true), by((d) => d.x - d.y, false)];
}

/** Diện tích tứ giác (công thức dây giày, theo thứ tự góc). */
export function dienTich(q: BonGoc): number {
  let s = 0;
  for (let i = 0; i < 4; i++) {
    const a = q[i];
    const b = q[(i + 1) % 4];
    s += a.x * b.y - b.x * a.y;
  }
  return Math.abs(s) / 2;
}

/** Tứ giác lồi (mọi tích có hướng cùng dấu) — góc kéo chéo nhau thì không nắn được. */
export function laLoi(q: BonGoc): boolean {
  let dau = 0;
  for (let i = 0; i < 4; i++) {
    const a = q[i];
    const b = q[(i + 1) % 4];
    const c = q[(i + 2) % 4];
    const z = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(z) < 1e-9) return false;
    const s = Math.sign(z);
    if (dau && s !== dau) return false;
    dau = s;
  }
  return true;
}

/**
 * Tìm 4 góc tờ giấy trên ảnh XÁM nhỏ (w×h). Trả toạ độ trên ảnh nhỏ đó, hoặc null khi không chắc.
 * Vùng sáng LIỀN lớn nhất (4-lân cận) — chữ đen trong giấy là lỗ, không làm hỏng điểm cực.
 */
export function timGoc(g: Uint8Array, w: number, h: number): BonGoc | null {
  if (w < 8 || h < 8 || g.length !== w * h) return null;
  const t = nguongOtsu(g);
  const sang = new Uint8Array(w * h);
  for (let i = 0; i < sang.length; i++) sang[i] = g[i] > t ? 1 : 0;
  const nhan = new Int32Array(w * h);
  const hang = new Int32Array(w * h);
  let tot = 0;
  let totCo = 0;
  let id = 0;
  for (let s = 0; s < sang.length; s++) {
    if (!sang[s] || nhan[s]) continue;
    id++;
    let dau = 0;
    let cuoi = 0;
    hang[cuoi++] = s;
    nhan[s] = id;
    while (dau < cuoi) {
      const k = hang[dau++];
      const x = k % w;
      const y = (k - x) / w;
      const ke = [x > 0 ? k - 1 : -1, x < w - 1 ? k + 1 : -1, y > 0 ? k - w : -1, y < h - 1 ? k + w : -1];
      for (const m of ke) {
        if (m >= 0 && sang[m] && !nhan[m]) {
          nhan[m] = id;
          hang[cuoi++] = m;
        }
      }
    }
    if (cuoi > totCo) {
      totCo = cuoi;
      tot = id;
    }
  }
  const tile = totCo / (w * h);
  if (!tot || tile < 0.15 || tile > 0.97) return null;
  let a = { x: 0, y: 0 };
  let b = a;
  let c = a;
  let d = a;
  let minS = Infinity;
  let maxS = -Infinity;
  let minD = Infinity;
  let maxD = -Infinity;
  for (let k = 0; k < nhan.length; k++) {
    if (nhan[k] !== tot) continue;
    const x = k % w;
    const y = (k - x) / w;
    if (x + y < minS) {
      minS = x + y;
      a = { x, y };
    }
    if (x + y > maxS) {
      maxS = x + y;
      c = { x: x + 1, y: y + 1 };
    }
    if (x - y > maxD) {
      maxD = x - y;
      b = { x: x + 1, y };
    }
    if (x - y < minD) {
      minD = x - y;
      d = { x, y: y + 1 };
    }
  }
  const q: BonGoc = [a, b, c, d];
  if (!laLoi(q) || dienTich(q) < 0.15 * w * h) return null;
  return q;
}

/** Cả khung ảnh — dùng khi không tìm được giấy. */
export const caKhung = (w: number, h: number): BonGoc => [
  { x: 0, y: 0 },
  { x: w, y: 0 },
  { x: w, y: h },
  { x: 0, y: h },
];

/** Nhân toạ độ góc (ảnh nhỏ → ảnh lớn). */
export const nhanGoc = (q: BonGoc, k: number): BonGoc => q.map((p) => ({ x: p.x * k, y: p.y * k })) as BonGoc;

/** Cỡ ảnh ra theo độ dài cạnh tứ giác, cạnh dài nhất ≤ `toiDa`. */
export function coRa(q: BonGoc, toiDa = 1600): { w: number; h: number } {
  const d = (p: Diem, r: Diem) => Math.hypot(p.x - r.x, p.y - r.y);
  let w = Math.max(d(q[0], q[1]), d(q[3], q[2]));
  let h = Math.max(d(q[0], q[3]), d(q[1], q[2]));
  const k = Math.min(1, toiDa / Math.max(w, h, 1));
  w = Math.max(1, Math.round(w * k));
  h = Math.max(1, Math.round(h * k));
  return { w, h };
}

/** Giải hệ tuyến tính n×n (khử Gauss, chọn trụ). null khi suy biến. */
function giai(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  const M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-12) return null;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((r, i) => r[n] / r[i]);
}

/** Ma trận đồng nhất 3×3 (9 số, h33 = 1) đưa 4 điểm `tu` → 4 điểm `den`. */
export function matranPhoiCanh(tu: BonGoc, den: BonGoc): number[] | null {
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = tu[i];
    const { x: u, y: v } = den[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }
  const h = giai(A, b);
  return h ? [...h, 1] : null;
}

export const apMatran = (H: number[], p: Diem): Diem => {
  const z = H[6] * p.x + H[7] * p.y + H[8];
  return { x: (H[0] * p.x + H[1] * p.y + H[2]) / z, y: (H[3] * p.x + H[4] * p.y + H[5]) / z };
};

/**
 * Nắn tứ giác `goc` trên ảnh nguồn RGBA (sw×sh) thành ảnh chữ nhật ow×oh — ánh xạ NGƯỢC (mỗi điểm ra lấy mẫu song
 * tuyến từ nguồn), không lỗ. null khi góc suy biến.
 */
export function nanThang(
  src: Uint8ClampedArray,
  sw: number,
  sh: number,
  goc: BonGoc,
  ow: number,
  oh: number,
): Uint8ClampedArray | null {
  const H = matranPhoiCanh(caKhung(ow, oh), goc);
  if (!H) return null;
  const out = new Uint8ClampedArray(ow * oh * 4);
  for (let y = 0; y < oh; y++) {
    for (let x = 0; x < ow; x++) {
      const z = H[6] * (x + 0.5) + H[7] * (y + 0.5) + H[8];
      const sx = Math.min(sw - 1, Math.max(0, (H[0] * (x + 0.5) + H[1] * (y + 0.5) + H[2]) / z - 0.5));
      const sy = Math.min(sh - 1, Math.max(0, (H[3] * (x + 0.5) + H[4] * (y + 0.5) + H[5]) / z - 0.5));
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      const x1 = Math.min(sw - 1, x0 + 1);
      const y1 = Math.min(sh - 1, y0 + 1);
      const fx = sx - x0;
      const fy = sy - y0;
      const o = (y * ow + x) * 4;
      const i00 = (y0 * sw + x0) * 4;
      const i10 = (y0 * sw + x1) * 4;
      const i01 = (y1 * sw + x0) * 4;
      const i11 = (y1 * sw + x1) * 4;
      for (let c = 0; c < 3; c++) {
        const top = src[i00 + c] * (1 - fx) + src[i10 + c] * fx;
        const bot = src[i01 + c] * (1 - fx) + src[i11 + c] * fx;
        out[o + c] = top * (1 - fy) + bot * fy;
      }
      out[o + 3] = 255;
    }
  }
  return out;
}

/**
 * Làm rõ chữ (bản gửi ĐỌC): kéo giãn độ sáng theo phân vị 2 %–98 % trên kênh sáng, giữ màu (dấu đỏ vẫn đỏ). Ảnh
 * chụp tối/mờ dưới mái tôn ⇒ chữ đậm, nền trắng hơn. Sửa TẠI CHỖ, trả lại chính mảng đó.
 */
export function lamRoChu(rgba: Uint8ClampedArray): Uint8ClampedArray {
  const hist = new Array<number>(256).fill(0);
  const n = rgba.length / 4;
  for (let i = 0; i < rgba.length; i += 4) hist[(rgba[i] * 299 + rgba[i + 1] * 587 + rgba[i + 2] * 114) / 1000 | 0]++;
  const phanVi = (p: number) => {
    let dem = 0;
    for (let t = 0; t < 256; t++) {
      dem += hist[t];
      if (dem >= p * n) return t;
    }
    return 255;
  };
  const lo = phanVi(0.02);
  const hi = phanVi(0.98);
  if (hi - lo < 16) return rgba; // ảnh gần như một màu — kéo là ra nhiễu
  const k = 255 / (hi - lo);
  for (let i = 0; i < rgba.length; i += 4) {
    rgba[i] = (rgba[i] - lo) * k;
    rgba[i + 1] = (rgba[i + 1] - lo) * k;
    rgba[i + 2] = (rgba[i + 2] - lo) * k;
  }
  return rgba;
}

/** Xoay ảnh RGBA 90° theo chiều kim đồng hồ. */
export function xoay90(src: Uint8ClampedArray, w: number, h: number): { data: Uint8ClampedArray; w: number; h: number } {
  const out = new Uint8ClampedArray(src.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const nx = h - 1 - y;
      const ny = x;
      const o = (ny * h + nx) * 4;
      out[o] = src[i];
      out[o + 1] = src[i + 1];
      out[o + 2] = src[i + 2];
      out[o + 3] = src[i + 3];
    }
  }
  return { data: out, w: h, h: w };
}
