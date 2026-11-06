// VECTOR VÀNG CHO TUỲ CHỌN BẢN ĐỒ (app-map 18 §5) — chạy CHÍNH `load()` + `setMapPrefs()` của src/lib/map-prefs.ts
// trên các giá trị lưu tự dựng (localStorage giả) ⇒ shared/src/jvmTest/resources/tuy-chon/vang.json ⇒ TuyChonVangTest.
//   node native/scripts/sinh-tuy-chon.mjs
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "../../node_modules/jiti/lib/jiti.mjs";

const goc = dirname(fileURLToPath(import.meta.url));
const repo = join(goc, "../..");
const kho = new Map();
globalThis.localStorage = { getItem: (k) => (kho.has(k) ? kho.get(k) : null), setItem: (k, v) => kho.set(k, String(v)), removeItem: (k) => kho.delete(k) };
globalThis.window = { location: { origin: "https://sdfish.sdvico.vn" }, localStorage: globalThis.localStorage };

const VAO = [
  null, "", "{", "null", "42", "\"km\"", "[]", "{}",
  JSON.stringify({ distUnit: "km", coordFormat: "dd", mapGrid: true, vungLong: false, vungQuanLy: false, vmsOverrides: { a: true, b: false }, tideStations: false }),
  JSON.stringify({ distUnit: "KM", coordFormat: "DD", mapGrid: "true", vungLong: 0, vungQuanLy: null, vmsOverrides: [1, 2], tideStations: "false" }),
  JSON.stringify({ mapGrid: 1, vungLong: "no", vmsOverrides: "x", them: 1 }),
  JSON.stringify({ vmsOverrides: null, tideStations: true }),
];
const ra = [];
for (const v of VAO) {
  kho.clear();
  if (v !== null) kho.set("forfish.mapPrefs.v1", v);
  // nạp lại module mỗi ca: state/loaded là biến module
  const jiti = createJiti(import.meta.url, { alias: { "@": join(repo, "src") }, moduleCache: false });
  const mp = await jiti.import(join(repo, "src/lib/map-prefs.ts"));
  mp.setMapPrefs({}); // ensure() + ghi đúng dạng web
  ra.push({ vao: v, ghi: kho.get("forfish.mapPrefs.v1") });
}
const tep = join(goc, "../shared/src/jvmTest/resources/tuy-chon/vang.json");
mkdirSync(dirname(tep), { recursive: true });
writeFileSync(tep, JSON.stringify(ra));
console.log(`[sinh-tuy-chon] ${ra.length} ca ⇒ ${tep}`);
