// tai-san-luong.mjs — tải bảng sản lượng / đội tàu theo tỉnh × năm từ PxWeb của Cục Thống kê (pxweb.nso.gov.vn).
// Kho "Nông, lâm nghiệp và thủy sản" KHÔNG có trong API /api/v1 ⇒ đi qua form ASP.NET của trang chọn biến:
// GET trang (giữ cookie phiên) → gửi lại form với MỌI giá trị của mọi biến + định dạng JSON-stat.
// Không tài khoản, không CAPTCHA. Ra: $SDFISH_DATA_DIR/hindcast-ntb/san-luong/<bảng>.json (ngoài git).
// Dùng: node scripts/dong-dan/tai-san-luong.mjs [V06.66 V06.65 ...]
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { dataDir } from "../lib/data-dir.mjs";

const OUT = join(dataDir(), "hindcast-ntb", "san-luong");
mkdirSync(OUT, { recursive: true });
const BASE = "https://pxweb.nso.gov.vn";
const NN = encodeURIComponent("Nông nghiệp, lâm nghiệp và thủy sản"), CN = encodeURIComponent("Công nghiệp");
const RXID = "8fecedbf-06ee-439b-95e1-357015cead0d"; // mã phiên trang chủ; đổi thì lấy lại từ trang chủ PxWeb
const TABLES = {
  "V06.59": NN, // số tàu ≥ 90 CV theo tỉnh, 2010→
  "V06.60": NN, // tổng công suất tàu ≥ 90 CV theo tỉnh, 2010→
  "V06.61": NN, // tàu theo nhóm chiều dài × tỉnh, 2021→
  "V06.62": NN, // sản lượng thủy sản cả nước, 1990→
  "V06.63": NN, // sản lượng thủy sản theo tỉnh, 1995→
  "V06.64": NN, // khai thác theo ngành (biển / cá biển / nội địa), cả nước 1990→
  "V06.65": NN, // sản lượng thủy sản KHAI THÁC theo tỉnh (tấn), 1995→
  "V06.66": NN, // sản lượng CÁ BIỂN khai thác theo tỉnh (nghìn tấn), 1995→
  "V07.05": CN, // sản phẩm công nghiệp chủ yếu (có nước mắm, triệu lít), cả nước 1995→
};
const unesc = (s) => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n));

async function get(id) {
  const url = `${BASE}/pxweb/vi/${TABLES[id]}/${TABLES[id]}/${id}.px/?rxid=${RXID}`;
  const r1 = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!r1.ok) throw new Error(`${id}: GET ${r1.status}`);
  const cookie = (r1.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
  const html = await r1.text();
  const body = new URLSearchParams();
  for (const m of html.matchAll(/<input type="hidden" name="([^"]+)" id="[^"]*" value="([^"]*)"/g)) body.append(m[1], unesc(m[2]));
  for (const m of html.matchAll(/<select[^>]*name="([^"]*ValuesListBox)"[^>]*>([\s\S]*?)<\/select>/g))
    for (const o of m[2].matchAll(/<option[^>]*value="([^"]*)"/g)) body.append(m[1], unesc(o[1]));
  const fmt = html.match(/name="([^"]*OutputFormatDropDownList)"/), btn = html.match(/name="([^"]*ButtonViewTable)" value="([^"]*)"/);
  if (!fmt || !btn) throw new Error(`${id}: không thấy form chọn biến`);
  body.append(fmt[1], "FileTypeJsonStat");
  body.append(btn[1], unesc(btn[2]));
  const r2 = await fetch(url, { method: "POST", body, headers: { cookie, "content-type": "application/x-www-form-urlencoded" }, signal: AbortSignal.timeout(120_000) });
  const txt = (await r2.text()).replace(/\0+$/, "");
  if (!r2.ok || !txt.trimStart().startsWith("{")) throw new Error(`${id}: POST ${r2.status}, không phải JSON-stat`);
  JSON.parse(txt.replace(/^﻿/, "")); // kiểm hợp lệ
  writeFileSync(join(OUT, `${id}.json`), txt);
  console.log(id, txt.length, "byte");
}

for (const id of process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(TABLES)) {
  if (!TABLES[id]) { console.error("không biết bảng", id); continue; }
  await get(id).catch((e) => { console.error(e.message); process.exitCode = 1; });
}
