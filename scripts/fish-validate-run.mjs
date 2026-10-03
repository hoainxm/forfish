// scripts/fish-validate-run.mjs  (npx tsx scripts/fish-validate-run.mjs --dates 2024-01-15,2024-04-15 --out <dir>)
// ─────────────────────────────────────────────────────────────────────────────
// SINH PAYLOAD `buildFishForecast` CHO NGÀY QUÁ KHỨ — để chạy kiểm định vị trí
// đánh bắt (scripts/fish-validate-positions.mjs) với GFW/VMS cùng ngày.
//
// Với mỗi ngày D: tải SST (CoralTemp °C), phù du (VIIRS DINEOF), SLA (Blended SSH),
// dị thường nhiệt (CRW) từ CoastWatch ERDDAP cho ĐÚNG ngày D; ETOPO tải MỘT lần.
// HYCOM (D20/nhiệt đáy/250 m) và Copernicus (dòng chảy) KHÔNG tải: OPeNDAP lịch sử
// hay treo và cần tài khoản → các term thermo/bottom/deep/conv bị BỎ (bất biến
// "mất nguồn = điểm giảm hoặc giữ" nên payload là bản THẬN TRỌNG hơn production,
// không lạc quan hơn). Ghi rõ trong payload.meta.
//
// Cache lưới đã tải ở <out>/grids/<dataset>-<D>.json → chạy lại không tải lại.
// Ra: <out>/payload-<D>.json  {ok, date, month, cells, species, meta}
//
//   --dates a,b,c     danh sách ngày (bắt buộc)
//   --out <dir>       thư mục ra (mặc định .cache/fish-validate)
//   --shift 2         nếu ERDDAP thiếu ngày D, thử D±1..±shift (ghi ngày thật dùng)
//   --features full   (2026-10-03, lead) nối thêm 3 nguồn của bản gộp C2/C3/C6: lưới
//                     SST stride 2 (0,1°) + phù du stride 1 (0,083°) cho FRONT MỊN,
//                     bảng khí hậu SST vùng–tháng (src/data/sst-climatology.v1.json),
//                     lưới rạn (src/data/reef-grid-025.v1.json). Mặc định "base" =
//                     chỉ anom+depth, chạy được trên nhánh cũ để so lift TRƯỚC/SAU.
// ─────────────────────────────────────────────────────────────────────────────
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import {
  buildFishForecast,
  parseErddapGrid,
  parseBathyGrid,
  bathyGridUrl,
  ERDDAP_UA,
} from "../src/lib/fish-predict.ts";

const CW = "https://coastwatch.noaa.gov/erddap/griddap";
const argv = process.argv.slice(2);
const arg = (k, d) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const OUT = arg("out", ".cache/fish-validate");
const SHIFT = Number(arg("shift", 2));
const DATES = (arg("dates", "") || "").split(",").map((s) => s.trim()).filter(Boolean);
if (!DATES.length) {
  console.error("cần --dates YYYY-MM-DD[,YYYY-MM-DD…]");
  process.exit(2);
}
mkdirSync(`${OUT}/grids`, { recursive: true });

// Bộ nguồn theo NGÀY — cùng URL production (fish-predict.ts) nhưng thay (last) bằng (D).
// SST dùng CoralTemp (°C, không kelvin) vì bộ dữ liệu lịch sử đầy đủ từ 1985; Blended
// là nguồn ưu tiên của production nhưng cùng lưới 0,05° stride 5 nên ô khớp nhau.
const SOURCES = {
  sst: {
    url: (d) => `${CW}/noaacrwsstDaily.json?analysed_sst%5B(${d})%5D%5B(22.0):5:(5.0)%5D%5B(102.0):5:(118.0)%5D`,
    parse: (j) => parseErddapGrid(j, { hasAltitude: false, unit: "degC" }),
  },
  chl: {
    url: (d) => `${CW}/noaacwNPPN20VIIRSDINEOFDaily.json?chlor_a%5B(${d})%5D%5B(0.0)%5D%5B(22.0):3:(5.0)%5D%5B(102.0):3:(118.0)%5D`,
    parse: (j) => parseErddapGrid(j, { hasAltitude: true, unit: "mg/m3" }),
  },
  sla: {
    url: (d) => `${CW}/noaacwBLENDEDsshDaily.json?sla%5B(${d})%5D%5B(5.0):2:(22.0)%5D%5B(102.0):2:(118.0)%5D`,
    parse: (j) => parseErddapGrid(j, { hasAltitude: false, unit: "m" }),
  },
  anom: {
    url: (d) => `${CW}/noaacrwsstanomalyDaily.json?sea_surface_temperature_anomaly%5B(${d})%5D%5B(22.0):5:(5.0)%5D%5B(102.0):5:(118.0)%5D`,
    parse: (j) => parseErddapGrid(j, { hasAltitude: false, unit: "degC" }),
  },
  // lưới MỊN cho front (C2): cùng nguồn, stride nhỏ hơn — chỉ tải khi --features full
  sstFine: {
    url: (d) => `${CW}/noaacrwsstDaily.json?analysed_sst%5B(${d})%5D%5B(22.0):2:(5.0)%5D%5B(102.0):2:(118.0)%5D`,
    parse: (j) => parseErddapGrid(j, { hasAltitude: false, unit: "degC" }),
  },
  chlFine: {
    url: (d) => `${CW}/noaacwNPPN20VIIRSDINEOFDaily.json?chlor_a%5B(${d})%5D%5B(0.0)%5D%5B(22.0):1:(5.0)%5D%5B(102.0):1:(118.0)%5D`,
    parse: (j) => parseErddapGrid(j, { hasAltitude: true, unit: "mg/m3" }),
  },
};
const FEATURES = arg("features", "base");
let climo = null, reef = null;
if (FEATURES === "full") {
  const { readFileSync: rf } = await import("node:fs");
  climo = JSON.parse(rf(new URL("../src/data/sst-climatology.v1.json", import.meta.url), "utf8")).regions;
  reef = JSON.parse(rf(new URL("../src/data/reef-grid-025.v1.json", import.meta.url), "utf8"));
  console.error("features=full: climo + reef + front mịn");
}

async function getJson(url, label) {
  for (let a = 1; a <= 3; a++) {
    try {
      const t0 = Date.now();
      const r = await fetch(url, { headers: { "User-Agent": ERDDAP_UA }, signal: AbortSignal.timeout(180_000) });
      const t = await r.text();
      if (r.status === 404 || /No data matches|Your query produced no matching results/i.test(t)) return { missing: true };
      if (!r.ok) throw new Error(`HTTP ${r.status}: ${t.slice(0, 120)}`);
      const j = JSON.parse(t);
      process.stderr.write(`  ${label}: ${(t.length / 1e6).toFixed(1)} MB ${Date.now() - t0} ms\n`);
      return j;
    } catch (e) {
      process.stderr.write(`  ${label}: lần ${a} lỗi ${e.message ?? e}\n`);
      if (a === 3) return null;
      await new Promise((s) => setTimeout(s, 2000 * a));
    }
  }
  return null;
}

const addDays = (iso, n) => {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Tải lưới `name` cho ngày D (hoặc ngày lân cận ±SHIFT). Trả {grid, usedDate} | null. Cache JSON thô. */
async function loadGrid(name, date) {
  const tries = [0];
  for (let k = 1; k <= SHIFT; k++) tries.push(k, -k);
  for (const off of tries) {
    const d = addDays(date, off);
    const file = `${OUT}/grids/${name}-${d}.json`;
    let raw;
    if (existsSync(file)) {
      raw = JSON.parse(readFileSync(file, "utf8"));
    } else {
      raw = await getJson(SOURCES[name].url(d), `${name} ${d}`);
      if (raw === null) continue; // lỗi mạng → thử ngày khác (không cache)
      writeFileSync(file, JSON.stringify(raw)); // cache cả {missing:true} để khỏi hỏi lại
    }
    if (raw.missing) continue;
    const grid = SOURCES[name].parse(raw);
    if (grid.lats.length && grid.lons.length) return { grid, usedDate: d, shifted: off !== 0 };
  }
  return null;
}

async function loadBathy() {
  const file = `${OUT}/grids/etopo.json`;
  let raw;
  if (existsSync(file)) raw = JSON.parse(readFileSync(file, "utf8"));
  else {
    raw = await getJson(bathyGridUrl(), "etopo");
    if (!raw || raw.missing) return null;
    writeFileSync(file, JSON.stringify(raw));
  }
  const g = parseBathyGrid(raw);
  return g.lats.length ? g : null;
}

const t0 = Date.now();
const depth = await loadBathy();
if (!depth) console.error("! ETOPO không tải được — payload thiếu cổng độ sâu (loài xa bờ không bị chặn ở ô cạn)");

const summary = [];
for (const D of DATES) {
  console.error(`\n== ${D}`);
  const month = Number(D.slice(5, 7));
  const [sst, chl, sla, anom, sstFine, chlFine] = await Promise.all([
    loadGrid("sst", D), loadGrid("chl", D), loadGrid("sla", D), loadGrid("anom", D),
    FEATURES === "full" ? loadGrid("sstFine", D) : null,
    FEATURES === "full" ? loadGrid("chlFine", D) : null,
  ]);
  if (!sst || !chl) {
    console.error(`  x bỏ ${D}: thiếu ${!sst ? "SST" : ""} ${!chl ? "phù du" : ""} (bắt buộc)`);
    summary.push({ date: D, ok: false });
    continue;
  }
  const fc = buildFishForecast(sst.grid, chl.grid, sla?.grid ?? null, month, {
    anom: anom?.grid ?? null,
    depth: depth ?? null,
    ...(FEATURES === "full"
      ? { climo, reef, frontSstFine: sstFine?.grid ?? null, frontChlFine: chlFine?.grid ?? null }
      : {}),
  });
  const meta = {
    builtAt: new Date().toISOString(),
    sources: {
      sst: { id: "noaa-coraltemp-sst", date: sst.usedDate, shifted: sst.shifted },
      chl: { id: "noaa-viirs-dineof-chl", date: chl.usedDate, shifted: chl.shifted },
      sla: sla ? { id: "noaa-blended-ssh", date: sla.usedDate, shifted: sla.shifted } : null,
      anom: anom ? { id: "noaa-crw-sst-anomaly", date: anom.usedDate, shifted: anom.shifted } : null,
      depth: depth ? { id: "etopo-2022-15s" } : null,
      hycom: null,
      currents: null,
      features: FEATURES,
      sstFine: sstFine ? { date: sstFine.usedDate } : null,
      chlFine: chlFine ? { date: chlFine.usedDate } : null,
    },
    note: "HYCOM + Copernicus KHÔNG tải (lịch sử khó) → term thermo/bottom/deep/conv bị bỏ; payload thận trọng hơn production.",
  };
  const payload = { ...fc, date: D, month, meta };
  writeFileSync(`${OUT}/payload-${D}.json`, JSON.stringify(payload));
  // BẢN "LẤP Ô LẠNH" cho kiểm định trung thực: production BỎ ô có s < 25 và không loài
  // nào ≥ 25 (KEEP_MIN), và bỏ sp[loài] < 25. Kiểm định đọc payload gốc sẽ coi giờ tàu ở
  // ô bị bỏ là "ngoài lưới" (không tính) → mô hình không bao giờ bị phạt vì tàu đánh chỗ
  // nó cho là lạnh. Bản này thêm mọi ô biển (SST hữu hạn) chưa có với s=0, và sp=0 cho
  // mọi loài có mặt trong ngày → ô lạnh được tính vào nền. Ghi ở <out>/payload-fill/.
  const have = new Set(fc.cells.map((c) => `${c.lat},${c.lon}`));
  const filled = fc.cells.map((c) => ({ ...c, sp: { ...c.sp } }));
  let added = 0;
  for (let i = 0; i < sst.grid.lats.length; i++) {
    for (let j = 0; j < sst.grid.lons.length; j++) {
      if (!Number.isFinite(sst.grid.values[i][j])) continue;
      const lat = Math.round(sst.grid.lats[i] * 100) / 100;
      const lon = Math.round(sst.grid.lons[j] * 100) / 100;
      if (have.has(`${lat},${lon}`)) continue;
      filled.push({ lat, lon, s: 0, top: [], sp: {}, t: Math.round(sst.grid.values[i][j] * 10) / 10, c: null });
      added++;
    }
  }
  for (const c of filled) for (const s of fc.species) c.sp[s] ??= 0;
  mkdirSync(`${OUT}/payload-fill`, { recursive: true });
  writeFileSync(`${OUT}/payload-fill/payload-${D}.json`, JSON.stringify({ ...payload, cells: filled, meta: { ...meta, coldFilled: added } }));
  const hot = fc.cells.filter((c) => c.s >= 50).length;
  console.error(`  ✓ ${fc.cells.length} ô, ${hot} ô ≥50 (${((100 * hot) / fc.cells.length).toFixed(1)} %), ${fc.species.length} loài; sla ${sla ? "có" : "KHÔNG"}, anom ${anom ? "có" : "KHÔNG"}`);
  summary.push({ date: D, ok: true, cells: fc.cells.length, hot, species: fc.species.length, sources: meta.sources });
}
writeFileSync(`${OUT}/payload-index.json`, JSON.stringify({ builtAt: new Date().toISOString(), days: summary }, null, 1));
console.error(`\n✓ ${summary.filter((s) => s.ok).length}/${DATES.length} ngày → ${OUT}  (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
