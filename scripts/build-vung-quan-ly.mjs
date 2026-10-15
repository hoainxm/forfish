// ============================================================================
// DỰNG LỚP "KHU BẢO TỒN BIỂN · VÙNG CẤM KHAI THÁC CÓ THỜI HẠN · KHU BẢO VỆ
// NGUỒN LỢI" cho bản đồ Ra khơi (Trục 1 + Trục 4 — biết chỗ nào không được
// thả lưới để khỏi dính phạt NĐ 38/2024).
//
//   node scripts/build-vung-quan-ly.mjs
//
// Đọc NGUỒN BẢN RÕ trong `scripts/data/vung-quan-ly/` (chép từ repo IUU của
// SDVICO, cùng bộ dữ liệu nhà nước):
//   · VN_KHUBAOTONBIEN_RANHGIOI.kml — 27 khu bảo tồn biển, bộ
//     BAOTONBIEN_RANHGIOI_04122023 = Bảng 6.4 Quy hoạch bảo vệ và khai thác
//     nguồn lợi thủy sản 2021–2030 (QĐ 389/QĐ-TTg 09/5/2024). Chữ bị mã hoá
//     HAI LẦN (FME 2015) — sửa bằng `suaMaChu`. Tỉnh theo địa giới TRƯỚC 2025.
//   · cam-tt19.geojson — khu vực cấm khai thác CÓ THỜI HẠN theo Thông tư
//     19/2018/TT-BNNPTNT (bản đồ hiện trạng MapInfo 12/2023, tên + thời gian cấm
//     + đối tượng chép từ bảng nhúng trong bộ bản đồ, ghép thủ công theo vị trí
//     + tỉnh + diện tích — mức tin ghi ở `tinCay`).
//   · bvnl.geojson — khu bảo vệ nguồn lợi thủy sản (bảng 11/9/2023), khu lớn là
//     đa giác, khu sá sùng/ngán bản đồ chỉ vẽ ĐIỂM.
// Sinh MỘT file `public/data/vung-quan-ly.v1.json` (toạ độ kinh/vĩ WGS84, ranh
// giới rút gọn Douglas–Peucker ~60 m — cùng dung sai repo IUU, không mất góc
// nào đáng kể ở mức phóng bản đồ xã). App đọc qua `lib/vung-quan-ly.ts`.
//
// SINH LẠI LÀ HÀNH ĐỘNG CÓ CHỦ Ý (CLAUDE.md §chống phình): chỉ khi nguồn đổi —
// chép đè file nguồn rồi chạy lại. Ngày chốt nguồn ghi trong `layNgay`.
//
// KHÔNG đưa: khu cấm theo QUY HOẠCH 04/12/2023 (chỉ có số hiệu, chưa tên, chưa
// hiệu lực), tuyến bờ/tuyến lộng (app đã có ranh giới vùng lộng riêng).
// ============================================================================
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "scripts", "data", "vung-quan-ly");
const OUT = path.join(ROOT, "public", "data", "vung-quan-ly.v1.json");
/** Dung sai rút gọn (độ) ≈ 60 m. */
const TOL = 0.00055;
/** Ngày chốt nguồn — đổi khi chép nguồn mới. */
const LAY_NGAY = "2026-10-14";

/* ───────────────────────── chữ mã hoá hai lần ───────────────────────────── */
// Ký tự cp1252 ở dải 0x80–0x9F (khác latin1) — để đảo chữ bị mã hoá hai lần.
const CP1252 = {
  "€": 0x80, "‚": 0x82, "ƒ": 0x83, "„": 0x84, "…": 0x85, "†": 0x86, "‡": 0x87, "ˆ": 0x88,
  "‰": 0x89, "Š": 0x8a, "‹": 0x8b, "Œ": 0x8c, "Ž": 0x8e, "‘": 0x91, "’": 0x92, "“": 0x93,
  "”": 0x94, "•": 0x95, "–": 0x96, "—": 0x97, "˜": 0x98, "™": 0x99, "š": 0x9a, "›": 0x9b,
  "œ": 0x9c, "ž": 0x9e, "Ÿ": 0x9f,
};
/** "báº£o" → "bảo". Chữ đúng sẵn giữ nguyên; đảo mà ra ký tự hỏng thì giữ nguyên. */
export function suaMaChu(s) {
  if (!/[ÃÄÆáº»Â]/.test(s)) return s.normalize("NFC");
  const bytes = [];
  for (const ch of s) {
    const c = ch.codePointAt(0);
    if (c < 0x100) bytes.push(c);
    else if (ch in CP1252) bytes.push(CP1252[ch]);
    else return s.normalize("NFC");
  }
  const out = new TextDecoder("utf-8", { fatal: false }).decode(new Uint8Array(bytes));
  return out.includes("�") ? s.normalize("NFC") : out.normalize("NFC");
}

/* ───────────────────────── tỉnh cũ → tỉnh 2025 ─────────────────────────── */
/** Mã tỉnh 2025 (units.code bên IUU) → tên hiển thị. */
const TEN_TINH = {
  QNINH: "Quảng Ninh", HPHONG: "Hải Phòng", HYEN: "Hưng Yên", NBINH: "Ninh Bình", THOA: "Thanh Hóa",
  NGAN: "Nghệ An", HTINH: "Hà Tĩnh", QTRI: "Quảng Trị", HUE: "Huế", DNANG: "Đà Nẵng", QNGAI: "Quảng Ngãi",
  GLAI: "Gia Lai", DLAK: "Đắk Lắk", KHOA: "Khánh Hòa", LDONG: "Lâm Đồng", HCM: "TP. Hồ Chí Minh",
  DTHAP: "Đồng Tháp", VLONG: "Vĩnh Long", CTHO: "Cần Thơ", CMAU: "Cà Mau", AGIANG: "An Giang", TNINH: "Tây Ninh",
};
/** Tên tỉnh trong KML (địa giới trước sáp nhập 2025) → mã tỉnh mới. */
const TINH_CU_MOI = {
  "Quảng Ninh": "QNINH", "Hải Phòng": "HPHONG", "Nghệ An": "NGAN", "Quảng Bình": "QTRI", "Quảng Trị": "QTRI",
  "Thừa Thiên Huế": "HUE", "Đà Nẵng": "DNANG", "Quảng Nam": "DNANG", "Quảng Ngãi": "QNGAI", "Bình Định": "GLAI",
  "Phú Yên": "DLAK", "Khánh Hòa": "KHOA", "Ninh Thuận": "KHOA", "Bình Thuận": "LDONG", "Bà Rịa - Vũng Tàu": "HCM",
  "Kiên Giang": "AGIANG", "Cà Mau": "CMAU",
};
function tinhMoi(tenCu) {
  const k = tenCu.normalize("NFC").trim().replace(/\s*-\s*/g, " - ");
  const code = TINH_CU_MOI[k];
  if (!code) throw new Error(`tỉnh lạ trong KML: "${tenCu}" — bổ sung TINH_CU_MOI, KHÔNG đoán`);
  return code;
}

/* ───────────────────────── rút gọn Douglas–Peucker ─────────────────────── */
function rutGonMo(pts, tol) {
  if (pts.length <= 2) return [...pts];
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = pts[a];
    const [bx, by] = pts[b];
    const dx = bx - ax, dy = by - ay;
    const len = Math.hypot(dx, dy) || 1e-12;
    let idx = -1, max = tol;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs(dy * (pts[i][0] - ax) - dx * (pts[i][1] - ay)) / len;
      if (d > max) { max = d; idx = i; }
    }
    if (idx >= 0) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
/** Vòng KHÉP KÍN thì cắt đôi tại điểm xa điểm đầu nhất rồi rút từng nửa. */
export function rutGon(pts, tol) {
  if (pts.length <= 4) return [...pts];
  const [fx, fy] = pts[0];
  const [lx, ly] = pts[pts.length - 1];
  if (fx === lx && fy === ly) {
    let far = 1, fd = -1;
    for (let i = 1; i < pts.length - 1; i++) {
      const d = Math.hypot(pts[i][0] - fx, pts[i][1] - fy);
      if (d > fd) { fd = d; far = i; }
    }
    const a = rutGonMo(pts.slice(0, far + 1), tol);
    const b = rutGonMo(pts.slice(far), tol);
    const out = [...a, ...b.slice(1)];
    return out.length >= 4 ? out : [...pts];
  }
  return rutGonMo(pts, tol);
}

const r5 = (v) => Math.round(v * 1e5) / 1e5;
const okLonLat = (a) => a.length >= 2 && Number.isFinite(a[0]) && Number.isFinite(a[1]) && Math.abs(a[0]) <= 180 && Math.abs(a[1]) <= 90;

/** Vòng → rút gọn + làm tròn, đảm bảo khép kín (điểm cuối = điểm đầu). */
function chuanHoaVong(ring) {
  let r = ring.filter(okLonLat).map(([lon, lat]) => [lon, lat]);
  if (r.length >= 2 && (r[0][0] !== r[r.length - 1][0] || r[0][1] !== r[r.length - 1][1])) r.push([r[0][0], r[0][1]]);
  r = rutGon(r, TOL).map(([lon, lat]) => [r5(lon), r5(lat)]);
  if (r.length >= 2 && (r[0][0] !== r[r.length - 1][0] || r[0][1] !== r[r.length - 1][1])) r.push([r[0][0], r[0][1]]);
  return r.length >= 4 ? r : null;
}

/** MultiPolygon (mảng polygon, mỗi polygon = vòng ngoài + lỗ) → chuẩn hoá; polygon mất vòng ngoài thì bỏ. */
function chuanHoaPolys(polys) {
  const out = [];
  for (const poly of polys) {
    const rings = poly.map(chuanHoaVong).filter(Boolean);
    if (!rings.length || !poly[0] || !rings[0] || rings[0] !== chuanHoaVong(poly[0])) {
      // vòng ngoài hỏng ⇒ bỏ cả polygon (lỗ không có vòng ngoài là vô nghĩa)
      const outer = chuanHoaVong(poly[0] ?? []);
      if (!outer) continue;
      out.push([outer, ...poly.slice(1).map(chuanHoaVong).filter(Boolean)]);
      continue;
    }
    out.push(rings);
  }
  return out;
}

/** Tâm = trung bình đỉnh các vòng ngoài (đủ cho nhãn + thẻ chạm). */
function tam(polys) {
  let sx = 0, sy = 0, n = 0;
  for (const poly of polys) for (const [lon, lat] of poly[0]) { sx += lon; sy += lat; n++; }
  return n ? [r5(sx / n), r5(sy / n)] : null;
}

/* ───────────────────────── 1. KML 27 khu bảo tồn ───────────────────────── */
function phanHangOf(s) {
  const k = s.toLowerCase();
  if (/vườn quốc gia/.test(k)) return "Vườn quốc gia";
  if (/loài|sinh cảnh/.test(k)) return "Khu bảo tồn loài - sinh cảnh";
  if (/d[ựữ] trữ/.test(k)) return "Khu dự trữ thiên nhiên";
  throw new Error(`phân hạng lạ: "${s}"`);
}
function trangThaiOf(ghiChu) {
  const k = ghiChu.toLowerCase();
  if (k.includes("chuyển tiếp")) return "chuyen_tiep";
  if (k.includes("đã thành lập")) return "da_thanh_lap";
  return "thanh_lap_moi";
}
const ringOf = (s) =>
  s.trim().split(/\s+/).map((t) => t.split(",").map(Number)).filter(okLonLat).map((a) => [a[0], a[1]]);

function docKml(file) {
  const kml = readFileSync(file, "utf8");
  const placemarks = kml.match(/<Placemark[\s\S]*?<\/Placemark>/g) ?? [];
  if (!placemarks.length) throw new Error(`không thấy Placemark nào trong ${file}`);
  const out = [];
  for (const pm of placemarks) {
    const field = (name) => suaMaChu((pm.match(new RegExp(`<SimpleData name="${name}">([^<]*)</SimpleData>`)) ?? ["", ""])[1]).replace(/\s+/g, " ");
    const ma = field("MaDT").trim();
    const ten = field("TenKhuBaoT").trim();
    const tinhCu = field("TinhThanhp").trim();
    if (!ma || !ten || !tinhCu) throw new Error(`Placemark thiếu mã/tên/tỉnh: ${pm.slice(0, 200)}`);
    const polys = [];
    for (const poly of pm.match(/<Polygon>[\s\S]*?<\/Polygon>/g) ?? []) {
      const outer = poly.match(/<outerBoundaryIs>[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>/);
      if (!outer) continue;
      const rings = [ringOf(outer[1])];
      for (const inner of poly.matchAll(/<innerBoundaryIs>[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>/g)) rings.push(ringOf(inner[1]));
      polys.push(rings);
    }
    const p = chuanHoaPolys(polys);
    if (!p.length) throw new Error(`${ma}: không có vòng toạ độ`);
    const code = tinhMoi(tinhCu);
    out.push({
      ma,
      loai: "bao-ton",
      ten,
      tinh: TEN_TINH[code],
      tinhCu,
      cap: ma.startsWith("BTB_QG") ? "QG" : "T",
      phanHang: phanHangOf(field("PhanHang")),
      trangThai: trangThaiOf(field("Ghichu")),
      ghiChu: field("Ghichu").trim(),
      dienTichHa: Number(field("Dientich_h")) || undefined,
      lon: tam(p)[0],
      lat: tam(p)[1],
      polys: p,
    });
  }
  return out;
}

/* ───────────────────────── 2. GeoJSON (cấm TT19 · BVNL) ────────────────── */
const str = (v) => (typeof v === "string" && v.trim() ? v.trim().replace(/\s+/g, " ").normalize("NFC") : undefined);
const num = (v) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : undefined);

function docGeojson(file, loai) {
  const g = JSON.parse(readFileSync(file, "utf8"));
  const out = [];
  for (const f of g.features) {
    const p = f.properties ?? {};
    const code = str(p.tinh);
    if (!code || !TEN_TINH[code]) throw new Error(`${p.ma}: tỉnh "${p.tinh}" lạ — bổ sung TEN_TINH, KHÔNG đoán`);
    const geom = f.geometry;
    const base = {
      ma: str(p.ma),
      loai,
      ten: str(p.ten) ?? null,
      tinh: TEN_TINH[code],
      tinhCu: str(p.tinhCu),
      dienTichHa: num(p.dienTichHa) ?? num(p.dienTichDoHa),
      doiTuong: str(p.doiTuong),
      thoiGian: str(p.thoiGian),
      thoiGianKhac: str(p.thoiGianQg),
      tinCay: str(p.tinCay),
    };
    if (!base.ma) throw new Error(`feature thiếu mã trong ${file}`);
    if (geom.type === "Point") {
      const [lon, lat] = geom.coordinates;
      if (!okLonLat([lon, lat])) throw new Error(`${base.ma}: điểm hỏng`);
      out.push({ ...base, diem: true, lon: r5(lon), lat: r5(lat) });
      continue;
    }
    const polys = geom.type === "Polygon" ? [geom.coordinates] : geom.type === "MultiPolygon" ? geom.coordinates : null;
    if (!polys) throw new Error(`${base.ma}: hình ${geom.type} không phải vùng/điểm`);
    const pp = chuanHoaPolys(polys);
    if (!pp.length) throw new Error(`${base.ma}: không có vòng toạ độ`);
    const c = tam(pp);
    out.push({ ...base, lon: c[0], lat: c[1], polys: pp });
  }
  return out;
}

/* ───────────────────────── 3. Ghi file ─────────────────────────────────── */
const baoTon = docKml(path.join(SRC, "VN_KHUBAOTONBIEN_RANHGIOI.kml"));
const camTt19 = docGeojson(path.join(SRC, "cam-tt19.geojson"), "cam-thoi-han");
const bvnl = docGeojson(path.join(SRC, "bvnl.geojson"), "bao-ve-nguon-loi");

// Dọn trường undefined cho file gọn.
const gon = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
const vung = [...baoTon, ...camTt19, ...bvnl].map(gon);

const ma = new Set();
for (const v of vung) {
  if (ma.has(v.ma)) throw new Error(`trùng mã ${v.ma}`);
  ma.add(v.ma);
}

const file = {
  v: 1,
  nguon:
    "27 khu bảo tồn biển: ranh giới BAOTONBIEN_RANHGIOI_04122023 (Bảng 6.4 Quy hoạch bảo vệ và khai thác nguồn lợi thủy sản 2021–2030, QĐ 389/QĐ-TTg 09/5/2024). " +
    "Khu cấm khai thác có thời hạn: Thông tư 19/2018/TT-BNNPTNT, ranh giới + tên + thời gian cấm theo bộ bản đồ hiện trạng MapInfo 12/2023 (DATA_GOC_BANDO_122023). " +
    "Khu bảo vệ nguồn lợi thủy sản: bảng 11/9/2023 cùng bộ bản đồ. Chuẩn bị qua repo IUU (SDVICO), chép sang scripts/data/vung-quan-ly/.",
  nhan:
    "Tham khảo — dữ liệu quy hoạch và hiện trạng bản đồ nhà nước, CHƯA đối chiếu văn bản hiện hành; tên khu cấm/khu bảo vệ ghép thủ công theo vị trí. " +
    "Không dùng để kết luận vi phạm. Trước khi thả lưới gần ranh, hỏi thêm chi cục thủy sản/đồn biên phòng địa phương.",
  layNgay: LAY_NGAY,
  giayPhep: {
    trangThai: "ok",
    giayPhepId: "vn-official",
    ghiChu:
      "Thông tin nhà nước Việt Nam công bố (quy hoạch, thông tư, bản đồ quy hoạch) — Điều 15 Luật SHTT loại văn bản hành chính và số liệu khỏi bảo hộ. Không dùng OSM.",
  },
  tinChiDan: {
    cao: "Khớp tỉnh và diện tích (lệch không quá 2 %)",
    vi_tri: "Khớp theo vị trí; diện tích ranh giới lệch diện tích trong bảng",
  },
  vung,
};

const json = JSON.stringify(file);
writeFileSync(OUT, json);
const dem = vung.reduce((a, v) => ((a[v.loai] = (a[v.loai] ?? 0) + 1), a), {});
const dinh = vung.reduce((a, v) => a + (v.polys ? v.polys.flat().reduce((s, r) => s + r.length, 0) : 0), 0);
console.log(`→ ${path.relative(ROOT, OUT)}: ${vung.length} vùng`, dem, `${dinh} đỉnh, ${(Buffer.byteLength(json) / 1024).toFixed(0)} KB`);
console.log("  bảo tồn:", baoTon.map((k) => `${k.ma} ${k.ten} (${k.tinh}, ${k.trangThai})`).join("\n  "));
