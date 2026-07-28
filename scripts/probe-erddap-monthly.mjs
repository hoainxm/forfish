// PROBE (chạy tay, không nằm trong build): tìm dataset ERDDAP có ẢNH THÁNG
// nhiều năm cho SST + phù du trên bbox biển VN — nguyên liệu dựng bản đồ MÙA VỤ
// (climatology) cho lộ trình 16 ngày. In ra: dataset nào sống, dải thời gian,
// cỡ payload, thời gian tải. KHÔNG ghi file dữ liệu.
//
//   node scripts/probe-erddap-monthly.mjs
const UA =
  "Mozilla/5.0 (compatible; SDFish/1.0; +https://github.com/Long-Forfun/ForFish)";
const CW = "https://coastwatch.noaa.gov/erddap";

async function getJson(url, timeoutMs = 60000) {
  const t0 = Date.now();
  const res = await fetch(url, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await res.text();
  const ms = Date.now() - t0;
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* HTML lỗi */
  }
  return { ok: res.ok, status: res.status, ms, bytes: text.length, json, text };
}

async function search(term) {
  const url = `${CW}/search/index.json?searchFor=${encodeURIComponent(term)}&page=1&itemsPerPage=40`;
  const r = await getJson(url);
  if (!r.json?.table) return [];
  const cols = r.json.table.columnNames;
  const iTitle = cols.indexOf("Title");
  const iId = cols.indexOf("Dataset ID");
  return r.json.table.rows.map((row) => ({
    id: row[iId],
    title: String(row[iTitle]).slice(0, 90),
  }));
}

/** Dải thời gian của dataset (từ .das/info) */
async function timeRange(id) {
  const r = await getJson(`${CW}/info/${id}/index.json`, 45000);
  if (!r.json?.table) return null;
  const rows = r.json.table.rows;
  const get = (attr) => {
    const hit = rows.find(
      (x) => x[0] === "attribute" && x[1] === "time" && x[2] === attr,
    );
    return hit ? hit[4] : null;
  };
  const iso = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? new Date(n * 1000).toISOString().slice(0, 10) : v;
  };
  const start = get("actual_range");
  if (start && String(start).includes(",")) {
    const [a, b] = String(start).split(",").map((s) => s.trim());
    return { start: iso(a), end: iso(b) };
  }
  return null;
}

const CANDIDATES = [
  // [id, biến, có chiều altitude?, ghi chú]
  ["noaacwBLENDEDsstDaily", "analysed_sst", false, "SST blended ngày (đang dùng)"],
  ["noaacrwsstDaily", "analysed_sst", false, "CoralTemp ngày (đang dùng, dự phòng)"],
  ["nesdisBLENDEDsstDNDaily", "sst", false, "SST blended ngày/đêm"],
  ["noaacwNPPN20VIIRSDINEOFDaily", "chlor_a", true, "chl DINEOF ngày (đang dùng)"],
  ["nesdisVHNSQchlaMonthly", "chlor_a", true, "chl VIIRS SNPP tháng"],
  ["nesdisVHNSQchlaWeekly", "chlor_a", true, "chl VIIRS SNPP tuần"],
  ["erdMH1chlamday", "chlorophyll", false, "MODIS Aqua chl tháng (ERD)"],
  ["erdMBsstdmday", "sst", true, "POES SST tháng (ERD)"],
];

console.log("=== TÌM DATASET THÁNG ===");
for (const term of ["monthly sst climatology", "monthly chlorophyll"]) {
  const hits = await search(term);
  console.log(`\n-- "${term}" → ${hits.length} kết quả (10 đầu)`);
  for (const h of hits.slice(0, 10)) console.log(`   ${h.id}  |  ${h.title}`);
}

console.log("\n=== DẢI THỜI GIAN CÁC ỨNG VIÊN ===");
for (const [id, , , note] of CANDIDATES) {
  try {
    const tr = await timeRange(id);
    console.log(
      `${id.padEnd(34)} ${tr ? `${tr.start} → ${tr.end}` : "KHÔNG ĐỌC ĐƯỢC"}   (${note})`,
    );
  } catch (e) {
    console.log(`${id.padEnd(34)} LỖI: ${String(e).slice(0, 60)}   (${note})`);
  }
}

// Thử tải THẬT một lát cắt tháng của dataset đang dùng (nguồn chính) để đo
// xem cách "kéo nhiều mốc thời gian một lượt" có khả thi không.
console.log("\n=== THỬ TẢI NHIỀU MỐC THỜI GIAN MỘT LƯỢT (SST blended) ===");
const multi = `${CW}/griddap/noaacwBLENDEDsstDaily.json?analysed_sst%5B(2024-06-01):30:(2024-08-31)%5D%5B(5.0):5:(22.0)%5D%5B(102.0):5:(118.0)%5D`;
try {
  const r = await getJson(multi, 90000);
  const rows = r.json?.table?.rows?.length ?? 0;
  const times = new Set((r.json?.table?.rows ?? []).map((x) => x[0]));
  console.log(
    `  status=${r.status} ${Math.round(r.bytes / 1024)} KB ${r.ms} ms · ${rows} hàng · ${times.size} mốc thời gian`,
  );
  if (!r.ok) console.log("  " + r.text.slice(0, 300).replace(/\s+/g, " "));
} catch (e) {
  console.log("  LỖI: " + String(e).slice(0, 200));
}
