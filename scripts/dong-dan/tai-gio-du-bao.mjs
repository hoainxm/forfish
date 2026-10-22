#!/usr/bin/env node
// tai-gio-du-bao.mjs — GIÓ DỰ BÁO THẬT đã phát trong quá khứ (không phải tái phân tích) cho phép thử "dự báo mồi
// 1–3 tuần" (docs/research/du-bao-ca-dong-dan-2026-10/13-du-bao-moi.md). Nguồn: Open-Meteo Single Runs API, mô hình
// ECMWF IFS (9 km), lấy ĐÚNG lần khởi tạo 00 UTC của từng ngày phát (`&run=`), tối đa 16 ngày.
// Đo 2026-10-22: kho chỉ có từ ~4/2024 (mọi mô hình Open-Meteo); IFS lưu 10 ngày tới giữa 2024, 15 ngày từ cuối 2024.
// Ngày phát = ngày bắt đầu mỗi mốc chl 8 ngày (1/1 + 8k) trong tháng 5–10, từ 2024 tới hết gió quan sát CMEMS.
// Điểm: 9 ô BIỂN của lưới CMEMS 0,125° gần nhất với lưới 3×3 trong mỗi hộp SCU/OFU/MKU (hop.mjs) — cùng ô mà chỉ
// số quan sát dùng, tránh điểm trên đất liền. NCU bỏ (chl NCU không theo gió, 12-gio-moi.md).
// Ra $SDFISH_DATA_DIR/hindcast-ntb/gio-du-bao/ecmwf_ifs/<ngày phát>.json. Chạy lại: ngày đã có thì bỏ qua.
//   node scripts/dong-dan/tai-gio-du-bao.mjs [--tu 2024-01-01] [--den 2026-06-20]
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { dataDir } from "../lib/data-dir.mjs";
import { BOXES } from "./hop.mjs";

const argv = process.argv.slice(2);
const arg = (k, d) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const ROOT = join(dataDir(), "hindcast-ntb");
const OUT = join(ROOT, "gio-du-bao", "ecmwf_ifs");
mkdirSync(OUT, { recursive: true });
const TU = arg("tu", "2024-01-01"), DEN = arg("den", "2026-06-20");
const BX = ["SCU", "OFU", "MKU"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 9 ô biển mỗi hộp từ lưới CMEMS 0,125° (manifest do tai-gio-cmems.mjs ghi)
const cells = JSON.parse(readFileSync(join(ROOT, "cmems-gio", "0125", "manifest.json"), "utf8")).cells;
const points = [];
for (const b of BX) {
  const [la0, la1, lo0, lo1] = BOXES[b];
  const mine = cells.filter((c) => c[2].includes(b));
  for (const fy of [1 / 6, 1 / 2, 5 / 6]) for (const fx of [1 / 6, 1 / 2, 5 / 6]) {
    const ty = la0 + fy * (la1 - la0), tx = lo0 + fx * (lo1 - lo0);
    const best = mine.reduce((a, c) => ((c[0] - ty) ** 2 + (c[1] - tx) ** 2 < (a[0] - ty) ** 2 + (a[1] - tx) ** 2 ? c : a));
    if (!points.some((p) => p.lat === best[0] && p.lon === best[1] && p.box === b)) points.push({ box: b, lat: best[0], lon: best[1] });
  }
}
const days = [];
for (let y = +TU.slice(0, 4); y <= +DEN.slice(0, 4); y++) for (let s = 0; s < 46; s++) {
  const d = new Date(Date.UTC(y, 0, 1) + s * 8 * 864e5).toISOString().slice(0, 10), m = +d.slice(5, 7);
  if (m >= 5 && m <= 10 && d >= TU && d <= DEN) days.push(d);
}
console.error(points.length, "điểm,", days.length, "ngày phát", days[0], "→", days.at(-1));
for (const d of days) {
  const f = join(OUT, `${d}.json`);
  if (existsSync(f)) continue;
  const url = `https://single-runs-api.open-meteo.com/v1/forecast?latitude=${points.map((p) => p.lat).join(",")}&longitude=${points.map((p) => p.lon).join(",")}&hourly=wind_speed_10m,wind_direction_10m&models=ecmwf_ifs&run=${d}T00:00&forecast_days=16&wind_speed_unit=ms&timezone=GMT`;
  let ok = false;
  for (let i = 0; i < 6 && !ok; i++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(180000) });
      if (r.status === 429) { console.error("  429 — chờ 60 s"); await sleep(60000); continue; }
      const j = await r.json();
      if (j.error) { console.error(d, "không có lần chạy:", j.reason.slice(0, 80)); ok = true; break; }
      const arr = Array.isArray(j) ? j : [j];
      writeFileSync(f, JSON.stringify({ run: `${d}T00:00Z`, model: "ecmwf_ifs", time: arr[0].hourly.time, points: points.map((p, k) => ({ ...p, s: arr[k].hourly.wind_speed_10m, d: arr[k].hourly.wind_direction_10m })) }));
      const last = arr[0].hourly.wind_speed_10m.findLastIndex((x) => x != null);
      console.error(d, "tới", arr[0].hourly.time[last]);
      ok = true;
    } catch (e) { console.error("  thử lại", i + 1, e.message); await sleep(5000 * (i + 1)); }
  }
  await sleep(1200);
}
console.error("xong gió dự báo →", OUT);
