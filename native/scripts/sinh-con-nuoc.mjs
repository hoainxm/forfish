// VECTOR VÀNG CHO CON NƯỚC (app-map 18 §5) — chạy CHÍNH src/lib/tides.ts + tideSymbolId (chart-symbols.ts) trên file
// bản RÕ public/data/tide-stations.v1.json, cộng thân CHÉP Y useMemo `tideGeo` của fishing-map-view.tsx.
//   node native/scripts/sinh-con-nuoc.mjs ⇒ native/shared/src/jvmTest/resources/con-nuoc/vang.json ⇒ ConNuocVangTest.kt
// Mốc giờ GHIM (web dùng Date.now()) để vector không đổi theo ngày chạy.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "../../node_modules/jiti/lib/jiti.mjs";

const goc = dirname(fileURLToPath(import.meta.url));
const repo = join(goc, "../..");
globalThis.window = { location: { origin: "https://sdfish.sdvico.vn" } };
const jiti = createJiti(import.meta.url, { alias: { "@": join(repo, "src") } });
const t = await jiti.import(join(repo, "src/lib/tides.ts"));
const { tideSymbolId } = await jiti.import(join(repo, "src/lib/chart-symbols.ts"));
const { isoDateVN } = await jiti.import(join(repo, "src/lib/day-labels.ts"));

const raw = JSON.parse(readFileSync(join(repo, "public/data/tide-stations.v1.json"), "utf8"));
const tram = t.decodeTideStations(raw);

/* ── CHÉP Y fishing-map-view.tsx tideGeo (origin/main ~3164) — `nowMs` truyền vào ── */
function tideGeoOf(tideStations, nowMs) {
  if (!tideStations?.length) return null;
  const chu = (x) => (x === "len" ? "đang lên" : x === "xuong" ? "đang xuống" : "nước đứng");
  const ngay = isoDateVN(nowMs);
  return {
    type: "FeatureCollection",
    features: tideStations.map((s, i) => {
      const trend = t.tideTrendAt(s, nowMs);
      const ser = t.tideDaySeries(s, ngay, 60);
      const lo = Math.min(...ser);
      const hi = Math.max(...ser);
      const frac = hi > lo ? (t.tideHeightAt(s, nowMs) - lo) / (hi - lo) : NaN;
      const model = t.isModelStation(s);
      return {
        type: "Feature",
        geometry: { type: "Point", coordinates: [s.lon, s.lat] },
        properties: { i, ten: s.name, model: model ? 1 : 0, hang: s.hang ?? "vung", ic: tideSymbolId(trend, frac, model), nhan9: `${s.name} · ${chu(trend)}` },
      };
    }),
  };
}

const MOC = [Date.UTC(2026, 10, 4, 3, 0), Date.UTC(2026, 10, 4, 16, 59, 59), Date.UTC(2025, 5, 15, 9, 30), Date.UTC(2030, 0, 1, 0, 0), Date.UTC(2000, 2, 1, 12, 0)];
const NGAY = ["2026-11-04", "2025-06-15", "2030-01-01", "2026-02-31", "khong-ro"];

const vang = {
  soTram: tram.length,
  ids: tram.map((s) => s.id),
  cao: tram.map((s) => MOC.map((m) => t.tideHeightAt(s, m))),
  xuThe: tram.map((s) => MOC.map((m) => t.tideTrendAt(s, m))),
  chuoi: tram.map((s) => t.tideDaySeries(s, "2026-11-04", 60)),
  cucTri: tram.map((s) => NGAY.map((d) => t.tideExtremesForDay(s, d).map((e) => [e.atMs, e.heightM, e.kind]))),
  ngayVn: MOC.concat([Date.UTC(2026, 10, 4, 17, 0), Date.UTC(1969, 11, 31, 16, 59)]).map((m) => [m, t.vnIsoDate(m), isoDateVN(m)]),
  kyHieu: ["len", "xuong", "dung"].flatMap((x) => [NaN, 0, 0.39, 0.4, 0.69, 0.7, 1].flatMap((f) => [false, true].map((m) => [x, Number.isFinite(f) ? f : null, m, tideSymbolId(x, f, m)]))),
  geo: MOC.map((m) => [m, tideGeoOf(tram, m)]),
  // hàng hỏng: web lọc từng trạm (cons lạ, số dạng chữ, thiếu trường)
  hong: {
    vao: { v: 1, stations: [raw.stations[0], { ...raw.stations[0], id: 5 }, { ...raw.stations[0], lat: "10" }, { ...raw.stations[0], cons: [] }, { ...raw.stations[0], cons: [{ name: "XX", amp: 1, phase: 0 }] }, { ...raw.stations[0], cons: [{ name: "M2", amp: "1", phase: 0 }] }, null, { ...raw.stations[0], id: "k", nguon: "model", hang: "cang" }] },
    ra: null,
  },
};
vang.hong.ra = t.decodeTideStations(vang.hong.vao).map((s) => s.id);

const thuMuc = join(goc, "../shared/src/jvmTest/resources/con-nuoc");
mkdirSync(thuMuc, { recursive: true });
writeFileSync(join(thuMuc, "vang.json"), JSON.stringify(vang) + "\n");
console.log(`[sinh-con-nuoc] ${tram.length} trạm · ${MOC.length} mốc · ${NGAY.length} ngày`);
