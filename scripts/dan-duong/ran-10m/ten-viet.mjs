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
/*  THỨ TỰ GHÉP (sửa 2026-10-22 sau khi thấy cụm Hoàng Sa ghép sai: "Đảo Bắc" → "Đá Trương Nghĩa" vì cách 1 km):
    1. BẢNG TRA theo TÊN (quốc tế / pinyin đầy đủ / pinyin lõi) + toạ độ bảng ≤ 20 km. Nhiều ứng viên ⇒ lấy gần nhất
       CHỈ KHI nó ≤ 5 km và ứng viên kế cách gấp đôi; không thì cần người.
    2. TOẠ ĐỘ với coral-reefs.v1.json CHỈ KHI thực thể gần nhất ≤ 3 km VÀ thực thể kế tiếp cách ≥ 2× — trong cụm đảo
       san sát (Lưỡi Liềm, An Vĩnh) điều kiện này tự rớt ⇒ cần người. coral-reefs chỉ có rạn/bãi, không có đảo, nên
       đảo không bao giờ được ghép bằng đường này.
    3. Còn lại: cần người. Sai một tên là sai chủ quyền — thà để trống. */
const NGUONG_TOA_DO_KM = 3;
/*  QUYẾT ĐỊNH NGƯỜI/AGENT THEO LUẬT (LUAT-RA-SOAT-TEN.md) — đọc TRƯỚC mọi phép ghép tự động. "ten-rieng" ⇒ khớp;
    "ten-chung" ⇒ vào sản phẩm với tên chung ("Đá chưa định danh (cụm Nam Yết)"), không bao giờ để tên nguồn. */
const qdF = path.join(REPO, "scripts/dan-duong/ran-10m/quyet-dinh-ten.json");
const quyetDinh = new Map((existsSync(qdF) ? JSON.parse(readFileSync(qdF, "utf8")) : []).map((q) => [`${q.bo}|${q.id}`, q]));
const out = idx.map((r) => {
  const p = { lat: r.tamLat, lon: r.tamLon };
  const row = { bo: r.bo, id: r.id, tenGoc: r.tenGoc, tamLat: r.tamLat, tamLon: r.tamLon, bbox: r.bbox ?? null, diem: r.diem, tenViet: null, cach: null, khoangKm: null, trangThai: "can-nguoi", ghi: null };
  const q = quyetDinh.get(`${r.bo}|${r.id}`);
  if (q?.tenViet) {
    row.tenViet = q.tenViet; row.cach = `quyet-dinh-${q.bac ?? "?"}`; row.ghi = q.lyDo ?? null;
    const bt = bang.find((x) => x.vi === q.tenViet); if (bt) { row.tenLat = bt.lat; row.tenLon = bt.lon; }
    row.trangThai = q.quyetDinh === "ten-rieng" ? "khop" : "ten-chung";
    return row;
  }
  if (p.lat < 6.5 || (p.lat > 19 && p.lon > 116)) { row.trangThai = "ngoai-pham-vi"; return row; }
  // 1. bảng tra theo tên
  const k = chuan(r.tenGoc);
  const ungVien = bang
    .filter((x) => Number.isFinite(x.lat) && [x.en, x.zh_pinyin_full, x.zh_pinyin, ...(x.khac ?? [])].filter(Boolean).some((n) => chuan(n) === k))
    .map((x) => ({ x, d: km(p, x) })).filter((u) => u.d <= NGUONG_BANG_KM).sort((a, b) => a.d - b.d);
  if (ungVien.length === 1 || (ungVien.length > 1 && ungVien[0].d <= 5 && ungVien[1].d >= 2 * ungVien[0].d)) {
    const u = ungVien[0];
    row.tenViet = u.x.vi; row.cach = "bang-tra"; row.khoangKm = +u.d.toFixed(1); row.tenLat = u.x.lat; row.tenLon = u.x.lon; row.trangThai = u.x.duyet ? "khop" : "can-nguoi";
    if (!u.x.duyet) row.ghi = "bảng tra chưa duyệt (ít hơn 2 nguồn)";
    return row;
  }
  if (ungVien.length > 1) { row.tenViet = ungVien.map((u) => u.x.vi).join(" | "); row.cach = "bang-tra-mo-ho"; row.khoangKm = +ungVien[0].d.toFixed(1); row.ghi = "nhiều thực thể cùng tên lõi gần nhau"; return row; }
  // 2. toạ độ — chỉ khi duy nhất
  const gan = reefs.map((f) => ({ f, d: km(p, f) })).sort((a, b) => a.d - b.d);
  row.khoangKm = gan.length ? +gan[0].d.toFixed(1) : null;
  if (gan.length && gan[0].d <= NGUONG_TOA_DO_KM && (gan.length < 2 || gan[1].d >= 2 * gan[0].d)) {
    row.tenViet = gan[0].f.ten; row.cach = "toa-do"; row.trangThai = "khop"; row.tenLat = gan[0].f.lat; row.tenLon = gan[0].f.lon; return row;
  }
  if (gan.length && gan[0].d <= NGUONG_KM) { row.tenViet = gan.slice(0, 3).filter((g) => g.d <= NGUONG_KM).map((g) => `${g.f.ten} (${g.d.toFixed(1)} km)`).join(" | "); row.cach = "toa-do-mo-ho"; row.ghi = "cụm thực thể sát nhau — người chọn"; }
  return row;
});
/*  "CÁI NÀO LỆCH THÌ GHI TÊN CHUNG" (anh Long 2026-10-22). LỆCH = HÌNH HỌC: điểm toạ độ của TÊN (bảng tra /
    coral-reefs) nằm NGOÀI chân hình của bộ dữ liệu (hộp bao thực thể nở 1 km); không có hộp bao thì > 5 km tới tâm.
    Vì sao không xét "loại" theo hậu tố: cách gọi Việt Nam khác nguồn một cách có hệ thống — nguồn gọi "Reef", ta gọi
    Bãi Cỏ Mây / Đảo Phan Vinh / Đảo Sinh Tồn Đông (gọi theo cồn nổi trên rạn); ép loại khớp thì mất đúng những tên đúng.
    Lệch VỊ TRÍ mới là cái làm sai chủ quyền. Áp cho cả quyết định người/agent (tên cụm cũng phải nằm trong chân hình). */
const PAD_DEG = 1 / 111.32; // 1 km
const trongChanHinh = (r) => {
  if (!Number.isFinite(r.tenLat) || !Number.isFinite(r.tenLon)) return null; // không có toạ độ tên để kiểm
  if (Array.isArray(r.bbox) && r.bbox.length === 4) {
    const [w, sN, e, n] = r.bbox; const pad = PAD_DEG;
    return r.tenLon >= w - pad && r.tenLon <= e + pad && r.tenLat >= sN - pad && r.tenLat <= n + pad;
  }
  return km({ lat: r.tamLat, lon: r.tamLon }, { lat: r.tenLat, lon: r.tenLon }) <= 5;
};
const LOAI_NGUON = [[/\b(islands?|islet|dao|yu)$/i, "Đảo"], [/\b(sand|sand cay|cay|shazhou)$/i, "Cồn cát"], [/\b(reef|jiao|rock|rocks)$/i, "Đá"], [/\b(shoals?|banks?|tan|ansha)$/i, "Bãi"], [/\b(atoll|reefs|qunjiao)$/i, "Cụm đá"]];
const loaiNguon = (t) => { const x = String(t).trim(); for (const [re, l] of LOAI_NGUON) if (re.test(x)) return l; return "Đá"; };
const tenChung = (loai, lat) => `${loai} chưa định danh (${lat >= 15 ? "Hoàng Sa" : "Trường Sa"})`;
for (const r of out) {
  if (r.trangThai !== "khop") continue;
  const ok = trongChanHinh(r);
  if (ok !== false) { if (ok === null) r.ghi = (r.ghi ? r.ghi + "; " : "") + "không có toạ độ tên để kiểm lệch"; continue; }
  const dKm = km({ lat: r.tamLat, lon: r.tamLon }, { lat: r.tenLat, lon: r.tenLon });
  r.ghi = `lệch: toạ độ tên nằm ngoài chân hình dữ liệu (cách tâm ${dKm.toFixed(1)} km) — từng gợi ý "${r.tenViet}"`;
  r.tenViet = tenChung(loaiNguon(r.tenGoc), r.tamLat); r.cach = "ten-chung-lech"; r.trangThai = "ten-chung";
}
writeFileSync(outF, JSON.stringify({ luc: new Date().toISOString(), n: out.length, khop: out.filter((r) => r.trangThai === "khop").length, ran: out }, null, 1));
const canNguoi = out.filter((r) => r.trangThai === "can-nguoi");
console.log(`ngoài phạm vi (Luconia/Đông Sa): ${out.filter((r) => r.trangThai === "ngoai-pham-vi").length} · tên chung: ${out.filter((r) => r.trangThai === "ten-chung").length}`);
console.log(`ghép tên: ${out.filter((r) => r.trangThai === "khop").length}/${out.length} khớp · ${canNguoi.length} cần người:`);
console.log(`đổi sang tên chung vì LỆCH: ${out.filter((r) => r.cach === "ten-chung-lech").length}`);
for (const r of out.filter((r) => r.cach === "ten-chung-lech")) console.log(`  ${r.bo} ${r.id} → ${r.tenViet} · ${r.ghi}`);
for (const r of canNguoi) console.log(`  ${r.bo} ${r.id} "${r.tenGoc}" ${r.tamLat.toFixed(3)},${r.tamLon.toFixed(3)} ${r.cach ?? "-"} ${r.tenViet ?? ""} ${r.ghi ?? ""}`);
