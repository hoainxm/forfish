#!/usr/bin/env node
// CỔNG "KHÔNG LỘ NGUỒN / THUẬT TOÁN" TRONG THỨ GỬI XUỐNG MÁY (2026-11-08 — docs/app-map/ops/khong-lo-nguon.md).
//
// Quét CHÍNH THỨ trình duyệt tải về sau `next build`: `.next/static/**` (JS/CSS chunk) + `public/*.js` (sw.js,
// worker phát nguyên văn). Tìm tên nguồn dữ liệu, host bên thứ ba, mã mô hình, tên trường nội tạng mô hình.
//
// Luật BÁNH CÓC: mẫu nào đang có trong `kiem-lo-bundle.no.json` (nợ đã biết, mỗi dòng kèm lý do) thì cho qua;
// mẫu MỚI xuất hiện ⇒ exit 1, build đỏ. Sửa xong một nợ ⇒ script báo "đã sạch, xoá khỏi nợ" (exit 0, nhắc).
// KHÔNG nới danh sách nợ để cho build qua — thêm nợ phải có lý do được duyệt (luật ở doc).
//
// Chạy: node scripts/kiem-lo-bundle.mjs            (sau next build)
//       node scripts/kiem-lo-bundle.mjs --liet-ke  (in mọi chỗ trúng, không chặn)

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, sep } from "node:path";
import { boChuThichJs } from "./bo-chu-thich-public.mjs";

const GOC = process.cwd();
const NO_FILE = join(GOC, "scripts", "kiem-lo-bundle.no.json");

/** Mẫu cấm — [tên, regex]. Tên dùng làm khoá trong file nợ. */
export const MAU = [
  // host + tên nguồn dữ liệu
  ["open-meteo", /open-meteo/i],
  ["erddap", /erddap/i],
  ["noaa", /\bnoaa/i],
  ["coastwatch", /coastwatch|oceanwatch/i],
  ["dataset-noaa", /noaac[wr]\w+/],
  ["copernicus", /copernicus|cmems/i],
  ["hycom", /hycom/i],
  ["gdacs", /gdacs/i],
  ["nchmf", /nchmf/i],
  ["jtwc", /\bjtwc\b/i],
  ["windy", /windy\.com|\bWindy\b/],
  ["overpass", /overpass-api|\bOverpass\b/],
  ["etopo-gebco-emodnet", /etopo|gebco|emodnet/i],
  ["allen-coral", /allencoralatlas|Allen Coral/i],
  ["vasep", /vasep/i],
  ["danh-ba-cao", /trangvangvietnam|masothue|tratencongty/i],
  ["supabase-host", /[a-z0-9]{20}\.supabase\.co/],
  ["sdwork", /SDWork/],
  // mã mô hình thời tiết
  ["model-id", /ncep_gfswave025|gfs_seamless|\bgfs05\b|ecmwf_(ifs|wam)\d+/],
  // nội tạng mô hình cá / dữ liệu dựng
  ["fish-model-fields", /thermFront|chlFront|foodDependence|inshoreFloor|coldCore|thermoBand/],
  ["model-internals", /builtFrom|catch-fleet-static|fleet-effort|species-catch|fish-blend-weights|forecast-skill\.json/],
  ["vms", /\bVMS\b/],
];

function* duyet(dir) {
  if (!existsSync(dir)) return;
  for (const ten of readdirSync(dir)) {
    const p = join(dir, ten);
    const st = statSync(p);
    if (st.isDirectory()) yield* duyet(p);
    else if (/\.(js|mjs|css|html|json)$/.test(ten) && st.size < 20_000_000) yield p;
  }
}

function tep() {
  const ds = [...duyet(join(GOC, ".next", "static"))];
  const pub = join(GOC, "public");
  if (existsSync(pub)) for (const ten of readdirSync(pub)) if (/\.(js|mjs)$/.test(ten)) ds.push(join(pub, ten));
  return ds;
}

const lietKe = process.argv.includes("--liet-ke");
if (!existsSync(join(GOC, ".next", "static"))) {
  console.error("kiem-lo-bundle: chưa có .next/static — chạy sau `next build`.");
  process.exit(1);
}
const no = existsSync(NO_FILE) ? JSON.parse(readFileSync(NO_FILE, "utf8")) : {};
const trung = new Map(); // tên mẫu → [{tep, doan}]
const PUB = join(GOC, "public") + sep;
for (const f of tep()) {
  // public/*.js: build phát hành bỏ chú thích (bo-chu-thich-public.mjs) ⇒ quét ĐÚNG bản sẽ phát, dù đang ở bản git
  const s = f.startsWith(PUB) ? await boChuThichJs(readFileSync(f, "utf8")) : readFileSync(f, "utf8");
  for (const [ten, re] of MAU) {
    const m = re.exec(s);
    if (!m) continue;
    const i = Math.max(0, m.index - 50);
    const ds = trung.get(ten) ?? [];
    ds.push({ tep: f.slice(GOC.length + 1).replace(/\\/g, "/"), doan: s.slice(i, m.index + m[0].length + 50).replace(/\s+/g, " ") });
    trung.set(ten, ds);
  }
}

let loi = 0;
for (const [ten, ds] of trung) {
  const daBiet = Object.prototype.hasOwnProperty.call(no, ten);
  if (lietKe || !daBiet) {
    console.log(`${daBiet ? "NỢ " : "MỚI"} ${ten} — ${ds.length} tệp`);
    for (const d of ds.slice(0, lietKe ? 20 : 3)) console.log(`     ${d.tep}: …${d.doan}…`);
  }
  if (!daBiet) loi++;
}
for (const ten of Object.keys(no)) {
  if (ten.startsWith("_")) continue;
  if (!trung.has(ten)) console.log(`ĐÃ SẠCH ${ten} — xoá dòng này khỏi scripts/kiem-lo-bundle.no.json`);
}
if (loi && !lietKe) {
  console.error(
    `\nkiem-lo-bundle: ${loi} mẫu MỚI lộ nguồn/thuật toán trong thứ gửi xuống máy. Sửa theo docs/app-map/ops/khong-lo-nguon.md ` +
      `(đưa sang server-only / đổi tên trung tính). Chỉ ghi vào nợ khi có lý do được duyệt.`,
  );
  process.exit(1);
}
console.log(`kiem-lo-bundle: ổn — ${trung.size} mẫu đều đã nằm trong nợ, không mẫu mới.`);
