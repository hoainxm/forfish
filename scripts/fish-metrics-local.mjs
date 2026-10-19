// scripts/fish-metrics-local.mjs — HAI SỐ ĐO PHỤ cho lớp cộng thêm của dự báo cá (mảnh 2B, README §7.0).
// Hàm THUẦN (không đọc đĩa/mạng). `node scripts/fish-metrics-local.mjs --selftest`.
//
// Vì sao: AUC toàn lưới trộn thang tỉnh (cả biển) với thang nhỏ (cùng bãi) nên rất kém nhạy với dịch chuyển trong bãi
// (report-eval-protocol §5). Một lớp cộng thêm chỉ được nâng điểm khi qua CẢ BA: AUCeff trong-nghề, AUC cục bộ, Spearman dị thường.
//
//  localAuc       — AUC chỉ so cặp (ô có cá, ô có giờ đánh) trong CÙNG khối blockDeg°×blockDeg° VÀ cùng ngày; trung bình
//                   các khối-ngày theo kg. Triệt tiêu địa lý lớn; còn "ô nào trong bãi này tốt hơn".
//  spearmanAnom   — hạng Spearman giữa (điểm − trung bình tháng của ô) và (CPUE − trung bình CPUE của ô), chỉ ô-ngày ≥ minHours
//                   giờ đánh để CPUE ổn định. "Động" thuần: bỏ hẳn phần cố định theo ô. 0 ⇒ ảnh ngày không nói thêm gì.

/** AUC có trọng số P(pos > neg) + ½ P(=), pos/neg = [[điểm, w]]. O(n log n). NaN nếu một phía rỗng. */
export function weightedAucPairs(pos, neg) {
  let P = 0, N = 0;
  for (const [, w] of pos) P += w;
  for (const [, w] of neg) N += w;
  if (!(P > 0) || !(N > 0)) return NaN;
  const all = [...pos.map(([s, w]) => [s, w, 0]), ...neg.map(([s, w]) => [s, 0, w])].sort((a, b) => a[0] - b[0]);
  let acc = 0, negBelow = 0;
  for (let i = 0; i < all.length; ) {
    let j = i, p = 0, n = 0;
    while (j < all.length && all[j][0] === all[i][0]) { p += all[j][1]; n += all[j][2]; j++; }
    acc += p * (negBelow + n / 2);
    negBelow += n;
    i = j;
  }
  return acc / (P * N);
}

/**
 * AUC cục bộ. `rows` = [{day, lat, lon, score, kg, hours}] mỗi ô-ngày (kg = sản lượng loài, hours = giờ đánh của nhóm nghề mục tiêu;
 * một ô có thể vừa là pos vừa là neg như AUCeff). Khối = floor(lat/blockDeg), floor(lon/blockDeg).
 * Chỉ khối-ngày có CẢ hai phía mới tính; trọng số khối = tổng kg của khối-ngày. Trả {auc, blocks, kgUsed, kgTotal}.
 */
export function localAuc(rows, { blockDeg = 1 } = {}) {
  const groups = new Map();
  let kgTotal = 0;
  for (const r of rows) {
    if (r.kg > 0) kgTotal += r.kg;
    if (!(r.kg > 0) && !(r.hours > 0)) continue;
    const key = `${r.day}|${Math.floor(r.lat / blockDeg)}|${Math.floor(r.lon / blockDeg)}`;
    const g = groups.get(key) ?? groups.set(key, { pos: [], neg: [], kg: 0 }).get(key);
    if (r.kg > 0) { g.pos.push([r.score, r.kg]); g.kg += r.kg; }
    if (r.hours > 0) g.neg.push([r.score, r.hours]);
  }
  let wSum = 0, wAuc = 0, blocks = 0;
  for (const g of groups.values()) {
    const a = weightedAucPairs(g.pos, g.neg);
    if (Number.isFinite(a)) { wSum += g.kg; wAuc += g.kg * a; blocks++; }
  }
  return { auc: wSum > 0 ? wAuc / wSum : NaN, blocks, kgUsed: wSum, kgTotal };
}

/** Hạng (trung bình khi trùng) của mảng — 1..n */
function ranks(v) {
  const idx = v.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]);
  const r = new Float64Array(v.length);
  for (let i = 0; i < idx.length; ) {
    let j = i;
    while (j < idx.length && idx[j][0] === idx[i][0]) j++;
    const avg = (i + j + 1) / 2; // hạng 1-based trung bình của [i, j)
    for (let k = i; k < j; k++) r[idx[k][1]] = avg;
    i = j;
  }
  return r;
}

/** Pearson trên hai mảng cùng độ dài; NaN nếu một phía hằng */
function pearson(a, b) {
  const n = a.length;
  let ma = 0, mb = 0;
  for (let i = 0; i < n; i++) { ma += a[i]; mb += b[i]; }
  ma /= n; mb /= n;
  let sab = 0, saa = 0, sbb = 0;
  for (let i = 0; i < n; i++) { const x = a[i] - ma, y = b[i] - mb; sab += x * y; saa += x * x; sbb += y * y; }
  return saa > 0 && sbb > 0 ? sab / Math.sqrt(saa * sbb) : NaN;
}

export const spearman = (a, b) => (a.length >= 3 ? pearson(ranks(a), ranks(b)) : NaN);

const monthOfDay = (d) => d.slice(0, 7);

/**
 * Cặp dị thường (điểm, CPUE). `rows` = [{day, cell, score, kg, hours}] — PHẢI gồm MỌI ngày có điểm (kể cả ô-ngày không có giờ đánh)
 * vì trung bình tháng của điểm lấy trên mọi ngày của ô trong tháng. CPUE = kg/hours của ô-ngày có hours ≥ minHours.
 * Ô cần ≥ minDays ô-ngày đủ giờ mới tham gia (không thì "trung bình ô" vô nghĩa). Trả mảng {day, s, c}.
 */
export function anomalyPairs(rows, { minHours = 6, minDays = 3 } = {}) {
  const sm = new Map();
  for (const r of rows) {
    const k = `${r.cell}|${monthOfDay(r.day)}`;
    const a = sm.get(k) ?? sm.set(k, [0, 0]).get(k);
    a[0] += r.score; a[1]++;
  }
  const byCell = new Map();
  for (const r of rows) {
    if (!(r.hours >= minHours)) continue;
    (byCell.get(r.cell) ?? byCell.set(r.cell, []).get(r.cell)).push(r);
  }
  const out = [];
  for (const [, rs] of byCell) {
    if (rs.length < minDays) continue;
    const cp = rs.map((r) => r.kg / r.hours);
    const cm = cp.reduce((a, b) => a + b, 0) / cp.length;
    rs.forEach((r, i) => {
      const [sum, n] = sm.get(`${r.cell}|${monthOfDay(r.day)}`);
      out.push({ day: r.day, s: r.score - sum / n, c: cp[i] - cm });
    });
  }
  return out;
}

/**
 * Spearman dị thường ngày × ô. Trả {rho, n, cells, t, p (một phía ρ>0, xấp xỉ t — các ô-ngày KHÔNG độc lập nên p lạc quan; dùng ci90)}.
 * `boot` > 0: CI 90 % bootstrap theo khối `blockDays` ngày (mặc định 7) trên các cặp đã tạo.
 */
export function spearmanAnom(rows, { minHours = 6, minDays = 3, boot = 0, blockDays = 7, seed = 11 } = {}) {
  const pairs = anomalyPairs(rows, { minHours, minDays });
  const cells = new Set(rows.filter((r) => r.hours >= minHours).map((r) => r.cell)).size;
  return spearmanFromPairs(pairs, cells, { boot, blockDays, seed });
}

/** Phần thống kê của `spearmanAnom` trên các cặp {day,s,c} đã dựng (dùng chung với bản dày đặc). */
export function spearmanFromPairs(pairs, cells, { boot = 0, blockDays = 7, seed = 11 } = {}) {
  const n = pairs.length;
  const rho = spearman(pairs.map((x) => x.s), pairs.map((x) => x.c));
  const t = Number.isFinite(rho) && n > 2 ? (rho * Math.sqrt((n - 2) / Math.max(1e-12, 1 - rho * rho))) : NaN;
  // p một phía theo xấp xỉ chuẩn của t (n lớn)
  const p = Number.isFinite(t) ? 0.5 * erfc(t / Math.SQRT2) : NaN;
  let ci = null, pBoot = NaN;
  if (boot > 0 && n >= 30) {
    const dayN = (d) => Math.round(Date.parse(`${d}T00:00:00Z`) / 86400e3);
    let base = Infinity;
    for (const x of pairs) base = Math.min(base, dayN(x.day));
    const blocks = new Map();
    for (const x of pairs) {
      const b = Math.floor((dayN(x.day) - base) / blockDays);
      (blocks.get(b) ?? blocks.set(b, []).get(b)).push(x);
    }
    const keys = [...blocks.keys()];
    let r = seed;
    const rnd = () => ((r = (r * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    const xs = [];
    for (let b = 0; b < boot; b++) {
      const s = [], c = [];
      for (let k = 0; k < keys.length; k++) for (const x of blocks.get(keys[Math.floor(rnd() * keys.length)])) { s.push(x.s); c.push(x.c); }
      const v = spearman(s, c);
      if (Number.isFinite(v)) xs.push(v);
    }
    xs.sort((a, b) => a - b);
    if (xs.length) { ci = [xs[Math.round((xs.length - 1) * 0.05)], xs[Math.round((xs.length - 1) * 0.95)]]; pBoot = (xs.filter((v) => v <= 0).length + 1) / (xs.length + 1); }
  }
  return { rho, n, cells, t, p, ci90: ci, pBoot };
}

/**
 * Bản DÀY ĐẶC của `anomalyPairs` (cho 300 ngày × 3 000 ô × nhiều nhánh mà không dựng object từng ô-ngày).
 * `days` = [{day, month (khoá tháng), score: ArrayLike, kg: ArrayLike, hours: ArrayLike}] — mảng cùng độ dài nCells.
 * Cùng định nghĩa: trung bình tháng của điểm lấy trên MỌI ngày của ô trong tháng; CPUE chỉ ô-ngày hours ≥ minHours,
 * ô cần ≥ minDays ô-ngày đủ giờ. Trả mảng {day, s, c}.
 */
export function anomalyPairsDense(days, nCells, { minHours = 6, minDays = 3 } = {}) {
  const sum = new Map(), cnt = new Map();
  for (const d of days) {
    let S = sum.get(d.month), C = cnt.get(d.month);
    if (!S) { sum.set(d.month, (S = new Float64Array(nCells))); cnt.set(d.month, (C = new Float64Array(nCells))); }
    for (let q = 0; q < nCells; q++) { S[q] += d.score[q]; C[q]++; }
  }
  const per = Array.from({ length: nCells }, () => []);
  days.forEach((d, di) => { for (let q = 0; q < nCells; q++) if (d.hours[q] >= minHours) per[q].push(di); });
  const out = [];
  for (let q = 0; q < nCells; q++) {
    const ds = per[q];
    if (ds.length < minDays) continue;
    const cp = ds.map((di) => days[di].kg[q] / days[di].hours[q]);
    const cm = cp.reduce((a, b) => a + b, 0) / cp.length;
    ds.forEach((di, k) => {
      const d = days[di];
      out.push({ day: d.day, s: d.score[q] - sum.get(d.month)[q] / cnt.get(d.month)[q], c: cp[k] - cm });
    });
  }
  return out;
}

/**
 * AUC cục bộ cho MỘT ngày từ mảng dày đặc: `block[q]` = mã khối 1°×1° của ô q. Trả {num, den, blocks}
 * (num = Σ kg·AUC khối, den = Σ kg khối có cả hai phía) — cộng nhiều ngày rồi chia để có TB theo kg (và bootstrap khối ngày).
 */
export function localAucDay(score, kg, hours, block) {
  const groups = new Map();
  for (let q = 0; q < score.length; q++) {
    if (!(kg[q] > 0) && !(hours[q] > 0)) continue;
    const g = groups.get(block[q]) ?? groups.set(block[q], { pos: [], neg: [], kg: 0 }).get(block[q]);
    if (kg[q] > 0) { g.pos.push([score[q], kg[q]]); g.kg += kg[q]; }
    if (hours[q] > 0) g.neg.push([score[q], hours[q]]);
  }
  let num = 0, den = 0, blocks = 0;
  for (const g of groups.values()) {
    const a = weightedAucPairs(g.pos, g.neg);
    if (Number.isFinite(a)) { num += g.kg * a; den += g.kg; blocks++; }
  }
  return { num, den, blocks };
}

/** erfc (Abramowitz–Stegun 7.1.26, sai số < 1,5e-7) */
function erfc(x) {
  const z = Math.abs(x), t = 1 / (1 + 0.3275911 * z);
  const y = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429)))) * Math.exp(-z * z);
  return x >= 0 ? y : 2 - y;
}

/* ── selftest ─────────────────────────────────────────────────────────────── */
export function selftest() {
  const assert = (c, m) => { if (!c) throw new Error(`selftest fish-metrics-local: ${m}`); };
  const near = (a, b, e = 1e-9) => Math.abs(a - b) <= e;
  let r = 5;
  const rnd = () => ((r = (r * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  // weightedAucPairs = đếm cặp O(n²)
  const pos = Array.from({ length: 60 }, () => [Math.round(rnd() * 20) / 20, 1 + rnd()]);
  const neg = Array.from({ length: 70 }, () => [Math.round(rnd() * 20) / 20, 1 + rnd()]);
  let acc = 0, P = 0, N = 0;
  for (const [sp, wp] of pos) for (const [sn, wn] of neg) { acc += wp * wn * (sp > sn ? 1 : sp === sn ? 0.5 : 0); }
  for (const [, w] of pos) P += w;
  for (const [, w] of neg) N += w;
  assert(near(weightedAucPairs(pos, neg), acc / (P * N)), "AUC đếm cặp");
  assert(Number.isNaN(weightedAucPairs([], neg)), "AUC rỗng");

  // localAuc: hai khối, trong khối pos luôn hơn neg nhưng khối A cao hơn khối B hẳn ⇒ cục bộ = 1, toàn cục < 1
  const rows = [];
  for (const [la, lo, base] of [[10.2, 108.3, 0.8], [15.7, 109.4, 0.1]]) {
    for (let i = 0; i < 6; i++) {
      rows.push({ day: "2026-08-01", lat: la + i * 0.01, lon: lo, score: base + 0.1 + i * 0.001, kg: 10, hours: 0 });
      rows.push({ day: "2026-08-01", lat: la - i * 0.01, lon: lo, score: base + i * 0.001, kg: 0, hours: 5 });
    }
  }
  const loc = localAuc(rows);
  assert(near(loc.auc, 1) && loc.blocks === 2, `localAuc ${JSON.stringify(loc)}`);
  const glob = weightedAucPairs(rows.filter((x) => x.kg > 0).map((x) => [x.score, x.kg]), rows.filter((x) => x.hours > 0).map((x) => [x.score, x.hours]));
  assert(glob < 0.8, `AUC toàn cục phải thấp hơn (${glob})`);
  // khác ngày không ghép: cùng khối nhưng pos ngày 1, neg ngày 2 ⇒ không khối nào có cả hai ⇒ NaN
  const split = [{ day: "2026-08-01", lat: 10, lon: 108, score: 0.9, kg: 5, hours: 0 }, { day: "2026-08-02", lat: 10, lon: 108, score: 0.1, kg: 0, hours: 4 }];
  assert(Number.isNaN(localAuc(split).auc) && localAuc(split).blocks === 0, "khác ngày không ghép cặp");
  // ô vừa pos vừa neg, hoà điểm ⇒ 0,5
  assert(near(localAuc([{ day: "d", lat: 1, lon: 1, score: 0.5, kg: 3, hours: 2 }]).auc, 0.5), "hoà ⇒ 0,5");

  // spearman: đơn điệu ⇒ 1, đảo ⇒ −1, trùng hạng
  assert(near(spearman([1, 2, 3, 4, 5], [10, 20, 30, 40, 50]), 1) && near(spearman([1, 2, 3, 4], [4, 3, 2, 1]), -1), "spearman cơ bản");
  assert(near(spearman([1, 1, 2, 2], [1, 1, 2, 2]), 1) && Number.isNaN(spearman([1, 1, 1, 1], [1, 2, 3, 4])), "spearman hạng trùng / hằng");
  // dị thường: điểm ô = nền ô + tín hiệu ngày; CPUE = 5·tín hiệu + nền ô khác ⇒ nền ô bị loại, còn tương quan động
  const mk = (sig, noise) => {
    const out = [];
    for (let cell = 0; cell < 12; cell++) {
      for (let d = 1; d <= 20; d++) {
        const day = `2026-08-${String(d).padStart(2, "0")}`;
        const s = (cell % 4) * 3 + sig(cell, d); // nền ô rất lệch
        const dyn = sig(cell, d);
        out.push({ day, cell, score: s, kg: 6 * (3 * cell + 5 * dyn + noise()) + 100, hours: 6 });
      }
    }
    return out;
  };
  const sigA = (c, d) => Math.sin(d * 1.3 + c);
  const dynRows = mk(sigA, () => 0);
  const sp1 = spearmanAnom(dynRows);
  assert(sp1.rho > 0.9 && sp1.n === 240 && sp1.cells === 12, `spearman động ${JSON.stringify(sp1)}`);
  // chỉ nền ô khác nhau (tín hiệu ngày độc lập với CPUE) ⇒ ≈ 0
  const rows0 = mk(sigA, () => 0).map((x, i) => ({ ...x, kg: 6 * (3 * x.cell + 5 * Math.sin(i * 7.7) + 0) + 100 }));
  const sp0 = spearmanAnom(rows0);
  assert(Math.abs(sp0.rho) < 0.25, `spearman nền ô ⇒ ~0 (${sp0.rho})`);
  // giờ < minHours bị loại
  assert(spearmanAnom(dynRows.map((x) => ({ ...x, hours: 2 }))).n === 0, "lọc giờ");
  // bootstrap có CI
  const bs = spearmanAnom(dynRows, { boot: 60 });
  assert(bs.ci90 && bs.ci90[0] > 0.5, `ci90 ${JSON.stringify(bs.ci90)}`);
  // bản dày đặc = bản object
  const dense = [];
  const cellsN = 12, blkOf = Int32Array.from({ length: cellsN }, (_, q) => q % 3);
  const denseRows = [];
  for (let d = 1; d <= 12; d++) {
    const day = `2026-08-${String(d).padStart(2, "0")}`;
    const score = Float64Array.from({ length: cellsN }, (_, q) => Math.sin(d * 0.9 + q) * 0.5 + (q % 4) * 0.2);
    const kg = Float64Array.from({ length: cellsN }, (_, q) => (q % 2 ? 0 : 5 + Math.cos(d + q)));
    const hours = Float64Array.from({ length: cellsN }, (_, q) => (q % 5 === 4 ? 2 : 8));
    dense.push({ day, month: "2026-08", score, kg, hours });
    for (let q = 0; q < cellsN; q++) denseRows.push({ day, cell: q, lat: blkOf[q], lon: 0, score: score[q], kg: kg[q], hours: hours[q] });
  }
  const pa = anomalyPairs(denseRows).map((x) => [x.day, x.s.toFixed(9), x.c.toFixed(9)].join()).sort();
  const pb = anomalyPairsDense(dense, cellsN).map((x) => [x.day, x.s.toFixed(9), x.c.toFixed(9)].join()).sort();
  assert(pa.length > 20 && pa.join("|") === pb.join("|"), "anomalyPairsDense = anomalyPairs");
  const l1 = localAuc(denseRows, { blockDeg: 1 });
  let nn = 0, dd = 0;
  for (const d of dense) { const r = localAucDay(d.score, d.kg, d.hours, blkOf); nn += r.num; dd += r.den; }
  assert(near(l1.auc, nn / dd, 1e-9), "localAucDay = localAuc");
  console.log("selftest fish-metrics-local OK");
}

if (process.argv[1]?.endsWith("fish-metrics-local.mjs") && process.argv.includes("--selftest")) selftest();
