#!/usr/bin/env node
// Lấy MỘT ngày của bộ Global Fishing Watch "fleet-daily-csvs-100-v3" (0,01°/ngày,
// flag + geartype) từ Zenodo (record 14982712, open access, CC BY-NC 4.0) mà KHÔNG
// phải tải cả zip 3,3 GB: đọc mục lục zip ở đuôi file bằng HTTP Range, tìm entry
// "YYYY-MM-DD.csv", tải riêng khối nén của ngày đó (~5–12 MB) rồi giải nén và
// cắt theo hộp toạ độ. Thuần Node ≥ 18 (fetch + zlib), không cài gì thêm.
//
//   node scripts/gfw-fetch-day.mjs --date 2024-10-01 --out gfw-2024-10-01.csv
//       [--bbox 5,22,102,118]   lat_min,lat_max,lon_min,lon_max (mặc định: Biển Đông/EEZ VN)
//       [--year 2024]           mặc định suy từ --date
//
// Đầu ra: CSV gốc của GFW (date,cell_ll_lat,cell_ll_lon,flag,geartype,hours,fishing_hours,mmsi_present)
// đã lọc theo hộp — đọc thẳng được bởi scripts/fish-validate-positions.mjs.
// Giấy phép: CC BY-NC 4.0 — dùng kiểm định nội bộ, KHÔNG phát hành/nhúng vào app.
import { writeFileSync } from "node:fs";
import { inflateRawSync } from "node:zlib";

const args = parseArgs(process.argv.slice(2));
const date = args.date;
if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? "")) die("cần --date YYYY-MM-DD");
const year = args.year ?? date.slice(0, 4);
const out = args.out ?? `gfw-${date}.csv`;
const bbox = (args.bbox ?? "5,22,102,118").split(",").map(Number);
if (bbox.length !== 4 || bbox.some((v) => !Number.isFinite(v))) die("--bbox lat_min,lat_max,lon_min,lon_max");

const URL_ZIP = `https://zenodo.org/api/records/14982712/files/fleet-daily-csvs-100-v3-${year}.zip/content`;

// Zenodo trả 403 cho HEAD không User-Agent → dùng GET Range 0-0 và đọc tổng từ Content-Range
const UA = { "User-Agent": "SDFish-validate/1.0 (+https://github.com/Long-Forfun/ForFish)" };
const probe = await fetch(URL_ZIP, { headers: { ...UA, Range: "bytes=0-0" }, redirect: "follow", signal: AbortSignal.timeout(60_000) });
if (probe.status !== 206) die(`probe ${probe.status} — Zenodo không trả Range hoặc năm ${year} không có`);
const size = Number((probe.headers.get("content-range") ?? "").split("/")[1]);
if (!size) die(`không đọc được tổng từ Content-Range: ${probe.headers.get("content-range")}`);
log(`zip ${year}: ${(size / 1e9).toFixed(2)} GB — chỉ tải mục lục + 1 ngày`);

// 1) Đuôi file: EOCD (+ zip64) + central directory
const TAIL = Math.min(size, 512 * 1024);
const tail = await range(size - TAIL, size - 1);
let eocd = tail.length - 22;
while (eocd >= 0 && tail.readUInt32LE(eocd) !== 0x06054b50) eocd--;
if (eocd < 0) die("không thấy EOCD trong đuôi zip");
let cdOff = tail.readUInt32LE(eocd + 16);
let cdSize = tail.readUInt32LE(eocd + 12);
if (cdOff === 0xffffffff || cdSize === 0xffffffff) {
  // zip64: locator ngay trước EOCD → trỏ tới zip64 EOCD record
  const loc = eocd - 20;
  if (tail.readUInt32LE(loc) !== 0x07064b50) die("zip64 locator hỏng");
  const z64Off = Number(tail.readBigUInt64LE(loc + 8));
  const z = await range(z64Off, z64Off + 55);
  if (z.readUInt32LE(0) !== 0x06064b50) die("zip64 EOCD hỏng");
  cdSize = Number(z.readBigUInt64LE(40));
  cdOff = Number(z.readBigUInt64LE(48));
}
const cd = cdOff >= size - TAIL ? tail.subarray(cdOff - (size - TAIL), cdOff - (size - TAIL) + cdSize) : await range(cdOff, cdOff + cdSize - 1);

// 2) Duyệt central directory tìm entry của ngày
const want = `${date}.csv`;
let p = 0;
let entry = null;
const names = [];
while (p + 46 <= cd.length && cd.readUInt32LE(p) === 0x02014b50) {
  const method = cd.readUInt16LE(p + 10);
  let csize = cd.readUInt32LE(p + 20);
  let usize = cd.readUInt32LE(p + 24);
  const nLen = cd.readUInt16LE(p + 28);
  const xLen = cd.readUInt16LE(p + 30);
  const cLen = cd.readUInt16LE(p + 32);
  let lhOff = cd.readUInt32LE(p + 42);
  const name = cd.subarray(p + 46, p + 46 + nLen).toString("utf8");
  // zip64 extra field (0x0001) ghi đè các trường 0xFFFFFFFF theo thứ tự usize, csize, lhOff
  let x = p + 46 + nLen;
  const xEnd = x + xLen;
  while (x + 4 <= xEnd) {
    const id = cd.readUInt16LE(x);
    const len = cd.readUInt16LE(x + 2);
    if (id === 0x0001) {
      let q = x + 4;
      if (usize === 0xffffffff) { usize = Number(cd.readBigUInt64LE(q)); q += 8; }
      if (csize === 0xffffffff) { csize = Number(cd.readBigUInt64LE(q)); q += 8; }
      if (lhOff === 0xffffffff) { lhOff = Number(cd.readBigUInt64LE(q)); q += 8; }
    }
    x += 4 + len;
  }
  names.push(name);
  if (name.endsWith(want)) entry = { name, method, csize, usize, lhOff };
  p += 46 + nLen + xLen + cLen;
}
if (!entry) die(`không có ${want} trong zip ${year}; ví dụ entry: ${names.slice(0, 3).join(", ")} … (${names.length} entry)`);
log(`entry ${entry.name}: nén ${(entry.csize / 1e6).toFixed(1)} MB → thô ${(entry.usize / 1e6).toFixed(1)} MB (method ${entry.method})`);

// 3) Local header (30 byte + tên + extra) rồi khối nén
const lh = await range(entry.lhOff, entry.lhOff + 29);
if (lh.readUInt32LE(0) !== 0x04034b50) die("local header hỏng");
const dataStart = entry.lhOff + 30 + lh.readUInt16LE(26) + lh.readUInt16LE(28);
const comp = await range(dataStart, dataStart + entry.csize - 1);
const raw = entry.method === 8 ? inflateRawSync(comp) : entry.method === 0 ? comp : die(`method nén ${entry.method} chưa hỗ trợ`);

// 4) Lọc hộp, giữ header; tóm tắt flag/geartype để biết độ phủ
const lines = raw.toString("utf8").split(/\r?\n/);
const header = lines[0];
const cols = header.split(",");
const iLat = cols.indexOf("cell_ll_lat");
const iLon = cols.indexOf("cell_ll_lon");
const iFlag = cols.indexOf("flag");
const iGear = cols.indexOf("geartype");
const iFish = cols.indexOf("fishing_hours");
if (iLat < 0 || iLon < 0) die(`header lạ: ${header}`);
const [latMin, latMax, lonMin, lonMax] = bbox;
const keep = [header];
const byFlag = new Map();
const byGear = new Map();
for (let i = 1; i < lines.length; i++) {
  const l = lines[i];
  if (!l) continue;
  const f = l.split(",");
  const lat = +f[iLat];
  const lon = +f[iLon];
  if (lat < latMin || lat >= latMax || lon < lonMin || lon >= lonMax) continue;
  keep.push(l);
  const fh = +f[iFish] || 0;
  bump(byFlag, f[iFlag], fh);
  bump(byGear, f[iGear], fh);
}
writeFileSync(out, keep.join("\n") + "\n");
log(`giữ ${keep.length - 1}/${lines.length - 1} dòng trong hộp [${bbox.join(",")}] → ${out}`);
log("giờ đánh bắt theo flag (top 12):");
for (const [k, v] of top(byFlag, 12)) log(`  ${k.padEnd(12)} ${v.h.toFixed(1).padStart(9)} h  ${v.n} ô`);
log("giờ đánh bắt theo geartype:");
for (const [k, v] of top(byGear, 20)) log(`  ${k.padEnd(22)} ${v.h.toFixed(1).padStart(9)} h  ${v.n} ô`);

function bump(m, k, h) {
  const e = m.get(k) ?? { h: 0, n: 0 };
  e.h += h;
  e.n += 1;
  m.set(k, e);
}
function top(m, n) {
  return [...m.entries()].sort((a, b) => b[1].h - a[1].h).slice(0, n);
}
async function range(from, to) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const r = await fetch(URL_ZIP, { headers: { ...UA, Range: `bytes=${from}-${to}` }, redirect: "follow", signal: AbortSignal.timeout(180_000) }).catch((e) => ({ ok: false, status: String(e) }));
    if (r.ok && r.status === 206) return Buffer.from(await r.arrayBuffer());
    log(`range ${from}-${to} lỗi ${r.status} (lần ${attempt})`);
  }
  die("Zenodo không trả Range 206 sau 3 lần");
}
function parseArgs(a) {
  const o = {};
  for (let i = 0; i < a.length; i++) if (a[i].startsWith("--")) o[a[i].slice(2)] = a[i + 1]?.startsWith("--") || a[i + 1] === undefined ? true : a[++i];
  return o;
}
function log(s) { process.stderr.write(s + "\n"); }
function die(s) { log("LỖI: " + s); process.exit(1); }
