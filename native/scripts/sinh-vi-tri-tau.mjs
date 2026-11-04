// VECTOR VÀNG cho ViTriTau.kt (app-map 18 §5): chạy CHÍNH fixQuaCu của src/lib/use-nav-tracking.ts.
//   node native/scripts/sinh-vi-tri-tau.mjs  ⇒  native/shared/src/commonTest/kotlin/vn/sdvico/forfish/shared/bando/GoldenViTriTau.kt
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "../../node_modules/jiti/lib/jiti.mjs";

const goc = dirname(fileURLToPath(import.meta.url));
const repo = join(goc, "../..");
const jiti = createJiti(import.meta.url, { alias: { "@": join(repo, "src") } });
const { fixQuaCu } = await jiti.import(join(repo, "src/lib/use-nav-tracking.ts"));

const now = 1_800_000_000_000;
const ca = [];
for (const lastFixAt of [null, now, now - 9_999, now - 10_000, now - 10_001, now - 59_999, now - 60_000, now - 60_001, now + 5_000])
  for (const speedKmh of [null, 0, 12.5]) ca.push([lastFixAt, speedKmh, now, fixQuaCu(lastFixAt, speedKmh, now)]);

const kt = (v) => (v === null ? "null" : String(v));
const ra = `// SINH TỰ ĐỘNG bởi native/scripts/sinh-vi-tri-tau.mjs từ src/lib/use-nav-tracking.ts — ĐỪNG SỬA TAY.
package vn.sdvico.forfish.shared.bando

internal object GoldenViTriTau {
    /** lastFixAt, speedKmh, now, kết quả web */
    val CA: List<List<Any?>> = listOf(
${ca.map(([a, s, n, k]) => `        listOf(${a === null ? "null" : `${a}L`}, ${s === null ? "null" : `${Number(s).toFixed(1)}`}, ${n}L, ${k}),`).join("\n")}
    )
}
`;
writeFileSync(join(goc, "../shared/src/commonTest/kotlin/vn/sdvico/forfish/shared/bando/GoldenViTriTau.kt"), ra);
console.log(`[sinh-vi-tri-tau] ${ca.length} ca`);
