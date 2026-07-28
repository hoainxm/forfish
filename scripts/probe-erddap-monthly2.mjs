// PROBE bước 2: xác minh CẤU TRÚC + cỡ tải của 2 nguồn dựng bản đồ mùa vụ
//   · SST tháng: tìm dataset tháng; nếu không có → CoralTemp ngày (1985→nay)
//   · Phù du tháng: noaacwNPPVIIRSSQchlaMonthly (2012→nay, 4km)
// In: biến, trục, stride phù hợp 0,25°, cỡ payload, thời gian.
const UA =
  "Mozilla/5.0 (compatible; SDFish/1.0; +https://github.com/Long-Forfun/ForFish)";
const CW = "https://coastwatch.noaa.gov/erddap";

async function getJson(url, timeoutMs = 90000) {
  const t0 = Date.now();
  const res = await fetch(url, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* HTML */
  }
  return { ok: res.ok, status: res.status, ms: Date.now() - t0, bytes: text.length, json, text };
}

async function search(term) {
  const r = await getJson(
    `${CW}/search/index.json?searchFor=${encodeURIComponent(term)}&page=1&itemsPerPage=40`,
  );
  if (!r.json?.table) return [];
  const cols = r.json.table.columnNames;
  const iT = cols.indexOf("Title");
  const iI = cols.indexOf("Dataset ID");
  return r.json.table.rows.map((x) => ({ id: x[iI], title: String(x[iT]).slice(0, 95) }));
}

console.log("=== TÌM SST THÁNG ===");
for (const t of ["monthly sst", "sea surface temperature monthly"]) {
  const hits = await search(t);
  const monthly = hits.filter((h) => /month/i.test(h.id) || /Monthly/.test(h.title));
  console.log(`\n-- "${t}": ${monthly.length}/${hits.length} có "tháng"`);
  for (const h of monthly.slice(0, 12)) console.log(`   ${h.id}  |  ${h.title}`);
}

console.log("\n=== CẤU TRÚC chl THÁNG (noaacwNPPVIIRSSQchlaMonthly) ===");
const info = await getJson(`${CW}/info/noaacwNPPVIIRSSQchlaMonthly/index.json`);
if (info.json?.table) {
  for (const r of info.json.table.rows) {
    if (r[0] === "dimension" || (r[0] === "variable" && r[1] !== "NC_GLOBAL"))
      console.log(`   ${r[0]} ${r[1]} ${r[2] ?? ""} ${String(r[4] ?? "").slice(0, 80)}`);
    if (r[1] === "time" && r[2] === "actual_range") {
      const [a, b] = String(r[4]).split(",").map((s) => Number(s.trim()));
      console.log(
        `   → thời gian: ${new Date(a * 1000).toISOString().slice(0, 10)} → ${new Date(b * 1000).toISOString().slice(0, 10)}`,
      );
    }
  }
}

console.log("\n=== THỬ TẢI 1 THÁNG chl (stride 6 ≈ 0,25°) ===");
const chlUrl = `${CW}/griddap/noaacwNPPVIIRSSQchlaMonthly.json?chlor_a%5B(2024-06-16)%5D%5B(0.0)%5D%5B(22.0):6:(5.0)%5D%5B(102.0):6:(118.0)%5D`;
const chl = await getJson(chlUrl);
console.log(`   status=${chl.status} ${Math.round(chl.bytes / 1024)} KB ${chl.ms} ms`);
if (chl.json?.table) {
  const rows = chl.json.table.rows;
  const lats = new Set(rows.map((r) => r[2]));
  const lons = new Set(rows.map((r) => r[3]));
  const vals = rows.map((r) => r[4]).filter((v) => typeof v === "number");
  console.log(
    `   cột=${chl.json.table.columnNames.join(",")} | ${lats.size} lat × ${lons.size} lon | ${vals.length}/${rows.length} ô có số`,
  );
  console.log(`   mẫu: ${JSON.stringify(rows.slice(0, 2))}`);
} else console.log("   " + chl.text.slice(0, 300).replace(/\s+/g, " "));

console.log("\n=== THỬ TẢI 1 THÁNG SST (CoralTemp ngày, stride thời gian 10) ===");
const sstUrl = `${CW}/griddap/noaacrwsstDaily.json?analysed_sst%5B(2024-06-01):10:(2024-06-30)%5D%5B(22.0):5:(5.0)%5D%5B(102.0):5:(118.0)%5D`;
const sst = await getJson(sstUrl);
console.log(`   status=${sst.status} ${Math.round(sst.bytes / 1024)} KB ${sst.ms} ms`);
if (sst.json?.table) {
  const rows = sst.json.table.rows;
  const times = new Set(rows.map((r) => r[0]));
  console.log(
    `   cột=${sst.json.table.columnNames.join(",")} | ${times.size} mốc | ${rows.length} hàng`,
  );
  console.log(`   mẫu: ${JSON.stringify(rows.slice(0, 2))}`);
} else console.log("   " + sst.text.slice(0, 300).replace(/\s+/g, " "));
