#!/usr/bin/env node
// NGÀY CÓ BÃO / ÁP THẤP TRÊN BIỂN ĐÔNG → scripts/storm-days-bien-dong.v1.json (2026-10-25).
// ─────────────────────────────────────────────────────────────────────────────
// VÌ SAO: anh Long 25/10 — "khi có bão thì không ai ra khơi": gộp mật độ tàu theo tháng/mùa/trăng mà
// không loại ngày bão thì ô bị kéo lệch (con trăng trùng bão sẽ trông "vắng tàu" oan). Lưới mật độ
// (build-fleet-density.mjs --storms) loại các ngày này khỏi lát gộp; lát Ngày vẫn giữ và ghi chú.
//
// NGUỒN: IBTrACS v04r01 (NOAA NCEI, công khai) — bản "last3years" CSV. Tải tay rồi đưa đường dẫn:
//   curl -o /tmp/ibtracs.csv https://www.ncei.noaa.gov/data/international-best-track-archive-for-climate-stewardship-ibtracs/v04r01/access/csv/ibtracs.last3years.list.v04r01.csv
//   node scripts/build-storm-days.mjs --csv /tmp/ibtracs.csv [--from 2025-11-01] [--buffer 1]
// LUẬT: điểm quỹ đạo nằm trong HỘP Biển Đông (vĩ 5–23 N, kinh 102–121 E — gồm vịnh Bắc Bộ, vịnh Thái Lan)
//   và (gió USA/WMO ≥ 30 kt hoặc NATURE = TS) ⇒ ngày đó (giờ VN) là ngày bão; nới ±buffer ngày
//   (tàu về bờ trước, ra lại sau). Tên quốc tế của IBTrACS; không có số hiệu "bão số N" của VN.
// Sinh lại CÓ CHỦ Ý khi kéo thêm tháng VMS (quy tắc dữ liệu trong git); ngày nguồn ghi trong file.
import fs from "node:fs";

const argv = process.argv.slice(2);
const arg = (k, d) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const CSV = arg("csv", null);
const FROM = arg("from", "2025-11-01");
const BUFFER = Number(arg("buffer", "1"));
const OUT = arg("out", "scripts/storm-days-bien-dong.v1.json");
if (!CSV) { console.error("cần --csv <ibtracs.csv>"); process.exit(2); }

export const BOX = { latMin: 5, latMax: 23, lonMin: 102, lonMax: 121 };
export const MIN_KT = 30;

const rows = fs.readFileSync(CSV, "utf8").split("\n");
const head = rows[0].split(",");
const col = (n) => head.indexOf(n);
const C = { sid: col("SID"), name: col("NAME"), t: col("ISO_TIME"), nat: col("NATURE"), lat: col("LAT"), lon: col("LON"), wmo: col("WMO_WIND"), usa: col("USA_WIND"), basin: col("BASIN") };

const vnDay = (iso) => new Date(new Date(iso.replace(" ", "T") + "Z").getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10);
const addDays = (d, n) => new Date(new Date(d + "T00:00:00Z").getTime() + n * 86400000).toISOString().slice(0, 10);

const storms = new Map(); // sid → {name, days:Set}
for (let i = 2; i < rows.length; i++) {
  const r = rows[i].split(",");
  if (r.length < 25 || r[C.basin] !== "WP") continue;
  const iso = r[C.t];
  if (iso < FROM) continue;
  const lat = Number(r[C.lat]), lon = Number(r[C.lon]);
  if (!(lat >= BOX.latMin && lat <= BOX.latMax && lon >= BOX.lonMin && lon <= BOX.lonMax)) continue;
  const kt = Math.max(Number(r[C.wmo]) || 0, Number(r[C.usa]) || 0);
  if (kt < MIN_KT && r[C.nat] !== "TS") continue;
  const sid = r[C.sid];
  const name = r[C.name] && r[C.name] !== "NOT_NAMED" ? r[C.name] : "ATNĐ";
  const s = storms.get(sid) || storms.set(sid, { name, days: new Set() }).get(sid);
  s.days.add(vnDay(iso));
}

const days = {};
const list = [];
for (const [sid, s] of storms) {
  const ds = [...s.days].sort();
  const from = addDays(ds[0], -BUFFER), to = addDays(ds.at(-1), BUFFER);
  list.push({ sid, name: s.name, from, to, inBoxDays: ds.length });
  for (let d = from; d <= to; d = addDays(d, 1)) (days[d] ??= []).includes(s.name) || days[d].push(s.name);
}
list.sort((a, b) => a.from.localeCompare(b.from));
const out = {
  v: 1,
  source: "IBTrACS v04r01 last3years (NOAA NCEI)",
  csvMtime: fs.statSync(CSV).mtime.toISOString().slice(0, 10),
  rule: { box: BOX, minKt: MIN_KT, bufferDays: BUFFER, from: FROM },
  storms: list,
  days: Object.fromEntries(Object.keys(days).sort().map((d) => [d, days[d]])),
};
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log(`[storm-days] ${list.length} cơn · ${Object.keys(days).length} ngày (đệm ±${BUFFER}) từ ${FROM} → ${OUT}`);
for (const s of list) console.log(`  ${s.from} → ${s.to}  ${s.name}`);
