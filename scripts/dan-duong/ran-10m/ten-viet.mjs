#!/usr/bin/env node
// GHÉP TÊN VIỆT cho từng đảo/rạn trong ran-10m.index.json THEO TOẠ ĐỘ (không dịch tên): tâm đảo của bộ dữ liệu
// → thực thể gần nhất có tên Việt trong public/data/coral-reefs.v1.json (1 372 tên, 144 ở Hoàng Sa/Trường Sa) +
// bảng tra tên quốc tế→Việt scripts/dan-duong/ran-10m/ten-ran-bien-dong.json (agent dựng, người duyệt).
//   node scripts/dan-duong/ran-10m/ten-viet.mjs <ran-10m.index.json> <ra: ten-viet.json>
// Mỗi dòng: {bo,id,tenGoc,tenViet,cach:"toa-do"|"bang-tra"|null,khoangKm,trangThai:"khop"|"can-nguoi"}.
// LUẬT: dòng "can-nguoi" KHÔNG được vào sản phẩm; tên gốc TQ không bao giờ hiển thị.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const [inF, outF] = process.argv.slice(2);
const idx = JSON.parse(readFileSync(inF, "utf8")).ran.filter((r) => r.tenGoc != null && r.tamLat != null);
const reefs = JSON.parse(readFileSync(path.join(REPO, "public/data/coral-reefs.v1.json"), "utf8")).features
  .map((f) => ({ ten: f.properties.name, nhom: f.properties.group, lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1] }));
const bangF = path.join(REPO, "scripts/dan-duong/ran-10m/ten-ran-bien-dong.json");
const bang = existsSync(bangF) ? JSON.parse(readFileSync(bangF, "utf8")) : [];
// bỏ loại hình ở đuôi (Anh + pinyin: Dao đảo · Jiao đá · Tan bãi · Ansha bãi ngầm · Shazhou cồn · Qunjiao cụm đá) rồi so phần lõi;
// phần lõi trùng nhau nhiều (Bei/Nan/Zhong…) nên LUÔN kèm điều kiện toạ độ ≤ NGUONG_KM ở dưới
const chuan = (s) => String(s).toLowerCase().replace(/\s+(reef|reefs|island|islands|bank|banks|shoal|shoals|cay|atoll|rock|rocks|dao|jiao|tan|ansha|shazhou|qunjiao|sha|shi)$/i, "").replace(/[^a-z0-9]/g, "");
const km = (a, b) => 111.32 * Math.hypot((a.lon - b.lon) * Math.cos(((a.lat + b.lat) / 2) * Math.PI / 180), a.lat - b.lat);
const NGUONG_KM = 8;
/*  Đường bảng tra: tên đã khớp nên chỉ cần toạ độ "cùng rạn" — rạn vòng lớn (Chữ Thập, Cỏ Mây, Tizard) tâm bộ dữ liệu
    lệch tâm bảng 10–15 km. 20 km vẫn nhỏ hơn khoảng cách giữa hai rạn cùng tên lõi khác nhóm (Đá Bắc HS/TS cách 600 km). */
const NGUONG_BANG_KM = 20;
const out = idx.map((r) => {
  const p = { lat: r.tamLat, lon: r.tamLon };
  let best = null;
  for (const f of reefs) { const d = km(p, f); if (!best || d < best.d) best = { f, d }; }
  const row = { bo: r.bo, id: r.id, tenGoc: r.tenGoc, tamLat: r.tamLat, tamLon: r.tamLon, diem: r.diem, tenViet: null, cach: null, khoangKm: best ? +best.d.toFixed(1) : null, trangThai: "can-nguoi" };
  /*  NGOÀI PHẠM VI: cụm Luconia / thềm Borneo (vĩ độ < 6,5°) và Đông Sa (Pratas, > 19° B phía đông) không thuộc hai quần
      đảo của Việt Nam — bộ dữ liệu có, app không dùng, không cần tên Việt. Giữ dòng để đếm, không vào sản phẩm. */
  if (p.lat < 6.5 || (p.lat > 19 && p.lon > 116)) { row.trangThai = "ngoai-pham-vi"; return row; }
  if (best && best.d <= NGUONG_KM) { row.tenViet = best.f.ten; row.cach = "toa-do"; row.trangThai = "khop"; }
  else {
    /*  Bảng tra: khớp tên quốc tế / pinyin ĐẦY ĐỦ (có hậu tố Dao/Jiao/Tan — pinyin trần như Bei/Nan/Zhong trùng
        nhiều thực thể, cảnh báo của agent dựng bảng) VÀ toạ độ bảng cách tâm ≤ 8 km. Thiếu một trong hai ⇒ cần người. */
    const k = chuan(r.tenGoc);
    const ungVien = bang.filter((x) => [x.en, x.zh_pinyin_full, x.zh_pinyin, ...(x.khac ?? [])].filter(Boolean).some((n) => chuan(n) === k));
    const b = ungVien.find((x) => Number.isFinite(x.lat) && km(p, x) <= NGUONG_BANG_KM) ?? null;
    if (b?.vi) { row.tenViet = b.vi; row.cach = "bang-tra"; row.khoangKm = +km(p, b).toFixed(1); row.trangThai = b.duyet ? "khop" : "can-nguoi"; }
    else if (ungVien.length) { row.tenViet = ungVien.map((x) => x.vi).join(" | "); row.cach = "bang-tra-xa"; row.trangThai = "can-nguoi"; }
  }
  return row;
});
writeFileSync(outF, JSON.stringify({ luc: new Date().toISOString(), n: out.length, khop: out.filter((r) => r.trangThai === "khop").length, ran: out }, null, 1));
const canNguoi = out.filter((r) => r.trangThai === "can-nguoi");
console.log(`ngoài phạm vi (Luconia/Đông Sa): ${out.filter((r) => r.trangThai === "ngoai-pham-vi").length}`);
console.log(`ghép tên: ${out.filter((r) => r.trangThai === "khop").length}/${out.length} khớp · ${canNguoi.length} cần người:`);
for (const r of canNguoi) console.log(`  ${r.bo} ${r.id} "${r.tenGoc}" ${r.tamLat},${r.tamLon} gần nhất ${r.khoangKm} km`);
