/**
 * ĐIỂM NỀN "BÃI CÁ THEO MÙA" (đợt 2A, 2026-10-18 — docs/app-map/ops/fish-train-review-2026-10-18 §7).
 *
 * Nền của lớp cá = bản đồ nơi MÙA NÀY tàu cùng nghề bắt được loài đó, không phải HSI vệ tinh (bộ đo trung
 * thực cho thấy bản đồ bãi theo mùa thắng mô hình 0,726 → 0,77–0,81 trong-nghề). Bốn đặc trưng cho một
 * (loài, ô, tháng):
 *   xc     x-sản-lượng loài, bão hoà 1−e^(−kg30/K_s), K_s = trung vị kg ô dương CỦA LOÀI (không phải 8000 chung)
 *   xf     x-đội-tàu của nghề bắt loài (giờ30/60)
 *   stat   tổng log-lift CPUE theo độ sâu + cách bờ + vĩ độ (bảng nhỏ theo loài)
 *   season prior mùa vụ của loài (seasonPrior, ∈ [0,1])
 * Gộp bằng ≤5 hệ số cho mỗi NHÓM loài (logistic use-availability), hoặc rank-combine không hệ số.
 *
 * THUẦN. ĐÃ NỐI vào buildFishForecast qua `extra.base` (2026-10-19, README §7.9); biến thể production = `irls`
 * (`base_irls`, chủ dự án chọn — `mode` ghi trong fish-base.v1.json, sinh từ `BASE_MODE` mặc định "irls" của
 * dl-eval-honest → fish-base-build). Lưới x lấy từ HAI lưới đã có
 * (fleet-effort-025 / species-catch-025) qua fleet-effort.ts ⇒ không thêm request, không thêm lưới theo ô.
 * Tệp tham số (`fish-base.v1.json`, vài chục KB) chỉ chứa K_s, bảng log-lift, hệ số, cờ tháng.
 */

import { FISH_SEASONS, seasonPrior } from "@/data/fish-seasons";

export const BASE_DEPTH_EDGES = [0, 20, 50, 100, 200, 500, 1000, 2000, 3000, 4000, 6000, Infinity];
export const BASE_COAST_EDGES = [0, 5, 10, 20, 40, 80, 160, 320, 640, Infinity];
export const BASE_LAT_BINS = 40;
/** Độ co (giờ) khi ước lift CPUE từng bậc — bậc ít giờ không tự quyết */
export const BASE_SHRINK_HOURS = 50;
/** K_s mặc định khi loài không có ô dương nào (= hằng cũ CATCH_FULL_KG) */
export const BASE_DEFAULT_KS = 8000;

export const BASE_COEF_NAMES = ["b0", "xc", "xf", "stat", "season"] as const;
export type BaseFeatures = [xc: number, xf: number, stat: number, season: number];

export interface BaseStaticTable {
  depth: number[];
  coast: number[];
  lat: number[];
}

export interface BaseParams {
  v: 1;
  builtAt: string;
  /** nguồn + ngày fit + phiên bản nhãn (ghi bởi scripts/fish-base-build.mjs) */
  builtFrom?: Record<string, unknown>;
  /** kg30 để xc = 1 − 1/e, theo loài */
  ksKg: Record<string, number>;
  /** nhóm loài (SpeciesCategory) → hệ số [b0, xc, xf, stat, season]; có kg loài */
  coef: Record<string, number[]>;
  /** như coef nhưng không có xc (tháng chưa có kg loài): [b0, xf, stat, season] */
  coefNoCatch: Record<string, number[]>;
  staticLift: Record<string, BaseStaticTable>;
  /** loài chỉ dựng nền từ đội tàu + tĩnh + mùa (kg khai kém tin cậy: cá tạp/cá xô, loài cấm/hạn chế) — dùng coefNoCatch */
  fleetOnly: string[];
  /** tháng "YYYY-MM" có kg loài trong lưới sản lượng */
  catchMonths: string[];
  /** tháng-trong-năm (1..12) → lưới sản lượng có CHÍNH tháng đó không. false (11–12/2026) ⇒ x chỉ từ tháng kề (hoặc không có ⇒ dùng coefNoCatch) — cờ cho payload/UI */
  catchSameMonth: Record<string, boolean>;
  /** tỉ lệ ô được cho điểm ≥50 (đo trên bản chốt); ô xếp hạng cao nhất tương ứng được điểm ≥50 */
  hotShare: number;
  mode: "irls" | "rank";
}

/** Nhóm loài của nền: 3 nhóm cá nổi/mực có hệ số riêng, còn lại (đáy/rạn/giáp xác) gộp "other" */
export function baseGroup(category: string): string {
  return category === "pelagic-large" || category === "pelagic-small" || category === "cephalopod" ? category : "other";
}

const seasonMemo = new Map<string, number>();
/**
 * Đặc trưng "mùa vụ" của nền: prior LỚN NHẤT của loài (tên đầy đủ) qua mọi dòng lịch mùa, KHÔNG phân vùng —
 * đúng cách lúc fit (scripts/fish-base-fit.mjs). Loài không có dòng mùa ⇒ 1.
 */
export function baseSeason(speciesFull: string, month: number): number {
  const k = `${speciesFull}|${month}`;
  let v = seasonMemo.get(k);
  if (v === undefined) {
    const rows = FISH_SEASONS.filter((f) => f.species === speciesFull);
    v = rows.length ? Math.max(...rows.map((f) => seasonPrior(f.months, month))) : 1;
    seasonMemo.set(k, v);
  }
  return v;
}

export function binOf(v: number, edges: number[]): number {
  if (!Number.isFinite(v)) return -1;
  for (let i = 0; i + 1 < edges.length; i++) if (v >= edges[i] && v < edges[i + 1]) return i;
  return -1;
}

/** Ba chỉ số bậc [sâu, bờ, vĩ] của một ô (độ sâu m dương; -1 = thiếu) */
export function staticBins(depthM: number, coastKm: number, lat: number): [number, number, number] {
  return [
    binOf(depthM, BASE_DEPTH_EDGES),
    binOf(coastKm, BASE_COAST_EDGES),
    Math.max(0, Math.min(BASE_LAT_BINS - 1, Math.floor(lat))),
  ];
}

/**
 * Bảng log-lift CPUE theo từng biến: lift = ((kg_b + c0·PH)/(giờ_b + PH))/c0, c0 = kg/giờ toàn cục.
 * `kg[f][b]`, `hours[f][b]` là tổng đã cộng theo bậc; trả bảng rỗng (0) khi không có dữ liệu.
 */
export function fitStaticLift(kg: number[][], hours: number[][], shrink = BASE_SHRINK_HOURS): number[][] {
  let K = 0, H = 0;
  for (const b of kg[0] ?? []) K += b;
  for (const b of hours[0] ?? []) H += b;
  const c0 = H > 0 ? K / H : 0;
  return kg.map((row, f) => row.map((k, b) => (c0 > 0 ? Math.log((k + c0 * shrink) / (hours[f][b] + shrink) / c0) : 0)));
}

/** Tổng log-lift của một ô; bậc thiếu (-1) đóng góp 0 */
export function staticLogLift(t: BaseStaticTable, bins: [number, number, number]): number {
  return (bins[0] >= 0 ? t.depth[bins[0]] : 0) + (bins[1] >= 0 ? t.coast[bins[1]] : 0) + t.lat[bins[2]];
}

/** Trung vị các giá trị DƯƠNG (K_s). Không có ⇒ BASE_DEFAULT_KS */
export function medianPositive(values: number[]): number {
  const v = values.filter((x) => x > 0 && Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return BASE_DEFAULT_KS;
  const m = v.length >> 1;
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

export interface IrlsRow {
  x: number[];
  y: 0 | 1;
  w: number;
}

/**
 * Hồi quy logistic có trọng số + ridge nhẹ (không phạt hệ số chặn x[0] = 1) bằng IRLS/Newton.
 * Use-availability: dương = ô có kg (w = kg), âm = ô có giờ đánh (w = giờ). Trả hệ số, độ dài = chiều x.
 */
export function irlsLogistic(rows: IrlsRow[], ridge = 1e-3, iters = 30): number[] {
  const d = rows[0]?.x.length ?? 0;
  const beta = new Array<number>(d).fill(0);
  if (!d) return beta;
  let wTot = 0;
  for (const r of rows) wTot += r.w;
  const lam = ridge * wTot;
  for (let it = 0; it < iters; it++) {
    const H = Array.from({ length: d }, () => new Array<number>(d).fill(0));
    const g = new Array<number>(d).fill(0);
    for (const r of rows) {
      let eta = 0;
      for (let k = 0; k < d; k++) eta += beta[k] * r.x[k];
      const p = 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, eta))));
      const s = r.w * p * (1 - p);
      const e = r.w * (r.y - p);
      for (let a = 0; a < d; a++) {
        g[a] += e * r.x[a];
        for (let b = a; b < d; b++) H[a][b] += s * r.x[a] * r.x[b];
      }
    }
    for (let a = 0; a < d; a++) {
      for (let b = 0; b < a; b++) H[a][b] = H[b][a];
      if (a > 0) { H[a][a] += lam; g[a] -= lam * beta[a]; } else H[a][a] += 1e-9 * wTot;
    }
    const step = solve(H, g);
    if (!step) break;
    let mx = 0;
    for (let k = 0; k < d; k++) { beta[k] += step[k]; mx = Math.max(mx, Math.abs(step[k])); }
    if (mx < 1e-7) break;
  }
  return beta;
}

/** Giải H·x = g (khử Gauss, xoay từng phần); null nếu suy biến */
function solve(H: number[][], g: number[]): number[] | null {
  const n = g.length;
  const A = H.map((r, i) => [...r, g[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    if (Math.abs(A[p][c]) < 1e-12) return null;
    [A[c], A[p]] = [A[p], A[c]];
    for (let r = c + 1; r < n; r++) {
      const f = A[r][c] / A[c][c];
      for (let k = c; k <= n; k++) A[r][k] -= f * A[c][k];
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = A[r][n];
    for (let k = r + 1; k < n; k++) s -= A[r][k] * x[k];
    x[r] = s / A[r][r];
  }
  return x;
}

/** Điểm tuyến tính (chưa xếp hạng) của một ô. `hasCatch=false` ⇒ bỏ xc, dùng coefNoCatch. */
export function baseRaw(coef: number[], f: BaseFeatures, hasCatch: boolean): number {
  return hasCatch
    ? coef[0] + coef[1] * f[0] + coef[2] * f[1] + coef[3] * f[2] + coef[4] * f[3]
    : coef[0] + coef[1] * f[1] + coef[2] * f[2] + coef[3] * f[3];
}

/** Phân vị 0..1 (ô bằng nhau chung hạng trung bình); n=1 ⇒ 0,5 */
export function rankFraction(values: ArrayLike<number>): Float64Array {
  const n = values.length;
  const idx = Array.from({ length: n }, (_, i) => i).sort((a, b) => values[a] - values[b]);
  const out = new Float64Array(n);
  for (let i = 0; i < n; ) {
    let j = i;
    while (j + 1 < n && values[idx[j + 1]] === values[idx[i]]) j++;
    const r = n > 1 ? (i + j) / 2 / (n - 1) : 0.5;
    for (let k = i; k <= j; k++) out[idx[k]] = r;
    i = j + 1;
  }
  return out;
}

/**
 * Hạng 0..1 → điểm 0..100. Ngưỡng 50 đặt ở phân vị 1−hotShare (chỉ `hotShare` ô cao nhất được ≥50) —
 * biến đổi đơn điệu nên KHÔNG đổi AUC, chỉ để điểm "Cao" không phủ nửa biển.
 */
export function rankToScore(r: number, hotShare: number): number {
  const q = Math.min(0.95, Math.max(0.05, 1 - hotShare));
  return Math.round(r < q ? (49 * r) / q : 50 + (50 * (r - q)) / (1 - q));
}

/**
 * Điểm nền cho MỘT loài trên danh sách ô. `feats[i]` = [xc, xf, stat, season].
 * mode "irls": xếp hạng theo điểm tuyến tính; "rank": cộng hạng phân vị của xc, xf, stat (đều trọng số, không hệ số;
 * season chỉ nhân nhẹ qua hạng của nó) — mất kênh nào thì bỏ kênh đó.
 */
export function scoreBase(
  p: Pick<BaseParams, "coef" | "coefNoCatch" | "hotShare" | "mode">,
  category: string,
  feats: BaseFeatures[],
  hasCatch: boolean,
  /** cộng vào điểm thô TRƯỚC khi xếp hạng (lớp chuỗi thức ăn theo vùng, lib/fish-chain.ts); vắng = như cũ */
  offset?: ArrayLike<number>,
): Uint8Array {
  const n = feats.length;
  const out = new Uint8Array(n);
  if (!n) return out;
  let raw: ArrayLike<number>;
  if (p.mode === "rank") {
    const cols = hasCatch ? [0, 1, 2] : [1, 2];
    const sum = new Float64Array(n);
    for (const c of cols) {
      const r = rankFraction(feats.map((f) => f[c]));
      for (let i = 0; i < n; i++) sum[i] += r[i];
    }
    raw = sum;
  } else {
    const coef = (hasCatch ? p.coef : p.coefNoCatch)[category];
    if (!coef) return out;
    raw = feats.map((f) => baseRaw(coef, f, hasCatch));
  }
  if (offset && offset.length === n) raw = Array.from(raw, (v, i) => v + (Number.isFinite(offset[i]) ? offset[i] : 0));
  const r = rankFraction(raw);
  for (let i = 0; i < n; i++) out[i] = rankToScore(r[i], p.hotShare);
  return out;
}
