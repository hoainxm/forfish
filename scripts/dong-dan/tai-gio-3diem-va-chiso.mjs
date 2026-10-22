#!/usr/bin/env node
// tai-gio-3diem-va-chiso.mjs — tải cho bước C (docs/research/du-bao-ca-dong-dan-2026-10/09-buoc-C-ket-qua.md):
//   1. gió ERA5 10 m theo giờ (Open-Meteo archive) tại 3 điểm ngoài khơi Nam Trung Bộ, khúc 3 năm, 1982 → nay
//   2. chỉ số khí hậu: ONI, Niño (CPC) và PDO (NCEI ERSSTv5) — file text nhỏ, tải lại mỗi lần chạy
// Ra: $SDFISH_DATA_DIR/hindcast-ntb/{era5-3diem,chiso}. Chạy lại được: file gió có sẵn thì bỏ qua.
// OISST tải bằng tai-oisst.mjs (NCEI ERDDAP chỉ có OISST từ 2020 — đừng dùng cho chuỗi dài).
//   node scripts/dong-dan/tai-gio-3diem-va-chiso.mjs [gio|chiso]   (mặc định cả hai)
import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { dataDir } from "../lib/data-dir.mjs";

const ROOT = join(dataDir(), "hindcast-ntb");
const GIO = join(ROOT, "era5-3diem"), CHISO = join(ROOT, "chiso");
mkdirSync(GIO, { recursive: true });
mkdirSync(CHISO, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(url, tries = 4, timeoutMs = 240000) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
      if (r.status === 429) { console.error("  429 — chờ 60 s (hạn mức Open-Meteo)"); await sleep(60000); continue; }
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.text();
    } catch (e) { console.error("  thử lại", i + 1, e.message); await sleep(5000 * (i + 1)); }
  }
  throw new Error("bỏ cuộc " + url);
}
const which = process.argv[2] ?? "all";
const today = new Date().toISOString().slice(0, 10);
const Y0 = 1982, Y1 = Number(today.slice(0, 4));

if (which === "all" || which === "chiso") {
  const SRC = {
    "oni.txt": "https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt",
    "nino.txt": "https://www.cpc.ncep.noaa.gov/data/indices/sstoi.indices",
    "pdo.txt": "https://www.ncei.noaa.gov/pub/data/cmb/ersst/v5/index/ersst.v5.pdo.dat",
  };
  for (const [f, url] of Object.entries(SRC)) { writeFileSync(join(CHISO, f), await get(url, 4, 60000)); console.error("chỉ số", f); }
}
if (which === "all" || which === "gio") {
  const PTS = [[12.0, 110.0], [11.0, 110.5], [13.0, 109.75]];
  for (const [la, lo] of PTS) for (let y = Y0; y <= Y1; y += 3) {
    const y2 = Math.min(y + 2, Y1);
    const f = join(GIO, `era5-${la}-${lo}-${y}.json`);
    // khúc chứa năm hiện tại luôn tải lại (còn đang dài thêm)
    if (existsSync(f) && y2 < Y1) continue;
    const end = y2 === Y1 ? today : `${y2}-12-31`;
    const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${la}&longitude=${lo}&start_date=${y}-01-01&end_date=${end}&hourly=wind_speed_10m,wind_direction_10m&wind_speed_unit=ms&timezone=GMT`;
    console.error("ERA5", la, lo, y);
    writeFileSync(f, await get(url));
    await sleep(1500);
  }
}
console.error("xong", which, "→", ROOT);
