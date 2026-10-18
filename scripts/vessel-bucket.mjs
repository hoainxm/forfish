// scripts/vessel-bucket.mjs — BĂM mã tàu thành 10 xô (0..9), không PII: chỉ để chia tàu làm 2 nửa
// ổn định (A = xô 0–4, B = xô 5–9) cho phép kiểm "tách theo tàu" của bộ đo trung thực
// (docs/app-map/ops/fish-train-review-2026-10-18, đợt 1 mục 1.3). Cùng hàm cho nhãn
// (dl-build-labels), lưới đội tàu (build-fleet-effort-grid), lưới sản lượng (build-species-catch-grid)
// và bộ chấm (dl-eval-fleet) ⇒ một tàu luôn ở cùng một nửa ở mọi nơi.
//   node scripts/vessel-bucket.mjs --selftest
export const BUCKETS = 10;

/** FNV-1a 32 bit → xô 0..9 */
export function vesselBucket(id) {
  let h = 0x811c9dc5;
  const s = String(id ?? "");
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h % BUCKETS;
}

/** Nửa của một xô: "A" (0–4) | "B" (5–9) */
export const halfOfBucket = (b) => (+b < BUCKETS / 2 ? "A" : "B");
export const vesselHalf = (id) => halfOfBucket(vesselBucket(id));

if (process.argv[1]?.endsWith("vessel-bucket.mjs") && process.argv.includes("--selftest")) {
  const ids = Array.from({ length: 4000 }, (_, i) => `V${(i * 2654435761 >>> 0).toString(16).padStart(8, "0")}`);
  const n = [0, 0];
  for (const id of ids) {
    if (vesselBucket(id) !== vesselBucket(id)) throw new Error("băm không ổn định");
    const b = vesselBucket(id);
    if (!(b >= 0 && b < BUCKETS)) throw new Error(`xô ngoài khoảng: ${b}`);
    n[vesselHalf(id) === "A" ? 0 : 1]++;
  }
  if (Math.abs(n[0] - n[1]) > 0.1 * ids.length) throw new Error(`hai nửa lệch: ${n}`);
  if (halfOfBucket(4) !== "A" || halfOfBucket(5) !== "B" || halfOfBucket("9") !== "B") throw new Error("halfOfBucket");
  console.log(`selftest OK (A ${n[0]} · B ${n[1]})`);
}
