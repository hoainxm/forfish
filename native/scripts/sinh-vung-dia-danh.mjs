// VECTOR VÀNG CHO LỚP ĐỊA DANH NGẦM · KHU TRÚ BÃO · VÙNG QUẢN LÝ (app-map 18 §5, đợt 2b) + SINH VÙNG LỘNG.
//
//   node native/scripts/sinh-vung-dia-danh.mjs
//
// Chạy CHÍNH bộ giải mã của web (jiti, alias "@") — decodeDiaDanhNgam (src/lib/dia-danh-ngam.ts), decodeKhuTruBao
// (src/lib/khu-tru-bao.ts), decodeVungQuanLy + dangVung (src/lib/vung-quan-ly.ts) — trên file bản RÕ trong
// `public/data/`, rồi dựng GeoJSON bằng thân CHÉP Y ba useMemo của src/components/fishing-map-view.tsx
// (diaDanhNgamGeo ~3044, khuTruBaoGeo ~3058, vungQuanLyGeo ~3075 — web viết thẳng trong component, không có hàm xuất).
// Ghi ra native/shared/src/jvmTest/resources/vung-dia-danh/*.json; VungDiaDanhVangTest.kt bắt VungDiaDanh.kt ra y hệt.
// Sửa một trong ba useMemo ở web thì sửa cả bản chép dưới đây, chạy lại script, rồi sửa VungDiaDanh.kt cho xanh.
//
// "Hôm nay" của vùng quản lý: web `new Date()` + getMonth/getDate = GIỜ MÁY bà con = giờ VN. Script ghim
// TZ=Asia/Ho_Chi_Minh và chấm ở VÀI mốc (trong/ngoài mùa, mép đầu/cuối, nửa đêm VN ≠ ngày UTC) — Kotlin nhận epoch ms.
//
// Vùng lộng: `vungLongGeoJSON()` (src/data/vn-fishing-zones.ts) là hằng trong code web ⇒ sinh thẳng thành
// native/shared/src/commonMain/kotlin/vn/sdvico/forfish/shared/bando/VungLongSinh.kt (ĐỪNG SỬA TAY file đó).
process.env.TZ = "Asia/Ho_Chi_Minh";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "../../node_modules/jiti/lib/jiti.mjs";

const goc = dirname(fileURLToPath(import.meta.url));
const repo = join(goc, "../..");
globalThis.window = { location: { origin: "https://sdfish.sdvico.vn" } };
const jiti = createJiti(import.meta.url, { alias: { "@": join(repo, "src") } });
const lib = (p) => jiti.import(join(repo, "src/lib", p));

const { decodeDiaDanhNgam } = await lib("dia-danh-ngam.ts");
const { decodeKhuTruBao } = await lib("khu-tru-bao.ts");
const { decodeVungQuanLy, dangVung } = await lib("vung-quan-ly.ts");
const { vungLongGeoJSON } = await jiti.import(join(repo, "src/data/vn-fishing-zones.ts"));

if (new Date(Date.parse("2026-03-31T17:30:00Z")).getDate() !== 1) throw new Error("TZ Asia/Ho_Chi_Minh không ăn — sửa script");

/* ── MỐC NGÀY (giờ VN) — phủ `dang` của mùa cấm thật: 01/4-30/6, 01/8-30/8, 01/11-30/11, 01/3-30/6, 01/02-29/02… ── */
const MOC = [
  "2026-11-04T09:00:00+07:00", // hôm nay — trong 01/11-30/11
  "2026-04-01T00:30:00+07:00", // mép ĐẦU 01/4; UTC còn 31/3 ⇒ bắt lệch múi giờ
  "2026-03-31T23:59:00+07:00", // ngay trước mép đầu 01/4 (trong 01/3-…)
  "2026-06-30T23:59:00+07:00", // mép CUỐI 30/6
  "2026-07-01T00:00:00+07:00", // ngay sau 30/6
  "2026-08-31T12:00:00+07:00", // 31/8: trong 01/8-31/8, ngoài 01/8-30/8
  "2026-12-01T06:00:00+07:00", // sau 30/11
  "2027-01-15T12:00:00+07:00", // giữa mùa vắt năm (bien)
  "2028-02-29T12:00:00+07:00", // năm nhuận: mép 29/02
  "2026-10-15T12:00:00+07:00", // ngoài mọi mùa
].map((iso) => ({ iso, ms: Date.parse(iso) }));

/* ── CHÉP Y fishing-map-view.tsx — state React thay bằng tham số, `new Date()` thay bằng `homNay` truyền vào.
      State web chỉ có khi fetch* trả mảng (không rỗng thì mới dựng — `?.length` trong useMemo). ── */
// ~3044 diaDanhNgamGeo
function diaDanhNgamGeoOf(diaDanhNgam) {
  if (!diaDanhNgam?.length) return null;
  return {
    type: "FeatureCollection",
    features: diaDanhNgam.map((d) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [d.lon, d.lat] },
      properties: { ten: d.ten, loai: d.loai },
    })),
  };
}

// ~3058 khuTruBaoGeo
function khuTruBaoGeoOf(khuTruBao) {
  if (!khuTruBao?.length) return null;
  return {
    type: "FeatureCollection",
    features: khuTruBao.map((k, i) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [k.lon, k.lat] },
      properties: { i, cap: k.cap },
    })),
  };
}

// ~3075 vungQuanLyGeo
function vungQuanLyGeoOf(vungQuanLy, homNay) {
  if (!vungQuanLy?.length) return null;
  const vung = [];
  const diem = [];
  vungQuanLy.forEach((v, i) => {
    const dang = dangVung(v, homNay);
    if (v.polys) {
      vung.push({
        type: "Feature",
        geometry: { type: "MultiPolygon", coordinates: v.polys },
        properties: { i, dang, loai: v.loai },
      });
    }
    diem.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [v.lon, v.lat] },
      properties: { i, dang, loai: v.loai, ten: v.ten, diem: !v.polys },
    });
  });
  return {
    vung: { type: "FeatureCollection", features: vung },
    diem: { type: "FeatureCollection", features: diem },
  };
}

const diaDanh = (raw) => diaDanhNgamGeoOf(decodeDiaDanhNgam(raw));
const khu = (raw) => khuTruBaoGeoOf(decodeKhuTruBao(raw));
const vungMoc = (raw) => {
  const ds = decodeVungQuanLy(raw);
  return MOC.map(({ iso, ms }, k) => {
    const ra = vungQuanLyGeoOf(ds, new Date(ms));
    // hình học không đổi theo ngày ⇒ chỉ mốc ĐẦU giữ ranh giới (mẫu đỡ phình git ×10); mốc sau so `properties`
    if (k > 0 && ra) for (const f of ra.vung.features) delete f.geometry;
    return { iso, ms, khongHinh: k > 0, ra };
  });
};

/* ── 1. file thật ── */
const doc = (ten) => JSON.parse(readFileSync(join(repo, "public/data", ten), "utf8"));
const raDiaDanh = diaDanh(doc("dia-danh-ngam.v1.json"));
const raKhu = khu(doc("khu-tru-bao.v1.json"));
const raVung = vungMoc(doc("vung-quan-ly.v1.json"));

/* ── 2. hàng tự dựng chọc mép bộ giải ── */
const vong = (x, y) => [[x, y], [x + 0.1, y], [x + 0.1, y + 0.1], [x, y]];
const bien = {
  diaDanh: [
    {
      loai: ["nui", 5, "xx", "doi", null, "constructor", "baivenbo"],
      diaDanh: [
        [110.5, 16.2, 0, "Núi ngầm A"],
        [110.5, 16.2, 3, "  Đồi ngầm B  ", "cột thừa", 9],
        [110.5, 16.2, 6, " Bãi ven bờ ngầm C　"], // khoảng trắng Unicode: trim của JS
        [110.5, 16.2, "0", "chỉ số chữ"], // typeof !== number ⇒ bỏ
        [110.5, 16.2, 1.5, "chỉ số lẻ"],
        [110.5, 16.2, -1, "chỉ số âm"],
        [110.5, 16.2, 99, "ngoài bảng"],
        [110.5, 16.2, 1, "mã là số"],
        [110.5, 16.2, 2, "mã lạ"],
        [110.5, 16.2, 4, "mã null"],
        [110.5, 16.2, 5, "constructor không phải mã"],
        [110.5, 16.2, true, "chỉ số true"],
        [110.5, 16.2, 0, "   "], // tên trắng ⇒ bỏ
        [110.5, 16.2, 0, 12], // tên số ⇒ bỏ
        ["110.5", 16.2, 0, "kinh độ chữ"],
        [101.9, 16.2, 0, "ngoài khung"],
        [118, 24, 0, "đúng góc khung"],
        [102, 4, 0, "góc kia"],
        [110.5, 16.2, 0], // thiếu cột
        null,
        "x",
        { lon: 1 },
        [110.5, null, 0, "vĩ độ null"],
        [-0, 16.2, 0, "kinh âm không"],
      ],
    },
    { loai: "nui", diaDanh: [[110.5, 16.2, 0, "bảng không phải mảng"]] }, // ⇒ bảng rỗng ⇒ không lớp
    { diaDanh: {} },
    { loai: ["nui"], diaDanh: [] },
    null,
    5,
    [],
  ],
  khu: [
    {
      khu: [
        { lon: 107.4, lat: 21.0, ten: "Vân Đồn", cap: "vung" },
        { lon: 107.4, lat: 21.0, ten: " Cô Tô ", cap: "tinh" },
        { lon: 107.4, lat: 21.0, ten: "Cấp hoa", cap: "VUNG" }, // cấp lạ ⇒ tinh
        { lon: 107.4, lat: 21.0, ten: "Thiếu cấp" },
        { lon: 107.4, lat: 21.0, ten: "Cấp số", cap: 1 },
        { lon: "107.4", lat: 21.0, ten: "kinh độ chữ", cap: "vung" },
        { lon: 107.4, lat: 30, ten: "ngoài khung", cap: "vung" },
        { lat: 21.0, ten: "thiếu kinh độ", cap: "vung" },
        { lon: 107.4, lat: 21.0, ten: "  ", cap: "vung" },
        { lon: 107.4, lat: 21.0, ten: 7, cap: "vung" },
        { lon: 107.4, lat: 21.0, cap: "vung" },
        [107.4, 21.0, "mảng"],
        null,
        5,
        "khu",
        { lon: 118, lat: 4, ten: "góc", cap: "vung", sucChua: "x", tin: "?" },
      ],
    },
    { khu: {} },
    { khu: [] },
    null,
    "x",
  ],
  vung: [
    {
      vung: [
        // bao-ton đủ trạng thái
        { ma: "BT1", loai: "bao-ton", ten: "Khu bảo tồn biển Hòn Mun", trangThai: "da_thanh_lap", lon: 109.3, lat: 12.1,
          polys: [[vong(109.3, 12.1), [[1, 2], [3, 4], [5, 6]], vong(109.32, 12.12)]] }, // vòng 3 đỉnh ⇒ lọc
        { ma: " BT2 ", loai: "bao-ton", ten: "  Cù Lao Chàm  ", trangThai: "chuyen_tiep", lon: 108.5, lat: 15.9,
          polys: [[[[108.5, 15.9, 5], [108.6, 15.9, "z"], [108.6, 16.0, null, { a: 1, "2": "b", "1": [true] }], [108.5, 15.9]]]] }, // đỉnh dư cột: giữ nguyên
        { ma: "BT3", loai: "bao-ton", trangThai: "thanh_lap_moi", lon: 108.5, lat: 15.9, polys: [[vong(108.5, 15.9)], [vong(108.7, 15.9)]] },
        { ma: "BT4", loai: "bao-ton", ten: "trạng thái lạ", trangThai: "THANH_LAP_MOI", lon: 108.5, lat: 15.9 },
        { ma: "BT5", loai: "bao-ton", ten: "vòng ngoài hỏng", lon: 108.5, lat: 15.9, polys: [[[[1, 2], [3, 4]], vong(108.5, 15.9)]] }, // mất vòng ngoài ⇒ bỏ mảnh ⇒ null
        { ma: "BT6", loai: "bao-ton", ten: "polys object", lon: 108.5, lat: 15.9, polys: { a: 1 } },
        { ma: "BT7", loai: "bao-ton", ten: "đỉnh chữ", lon: 108.5, lat: 15.9,
          polys: [[[[108.5, "15.9"], [108.6, 15.9], [108.6, 16], [108.5, 15.9]]], [vong(108.5, 15.9), "x", [[1]]], "mảnh chữ", []] },
        { ma: "BT8", loai: "bao-ton", ten: "đỉnh thiếu", lon: 108.5, lat: 15.9, polys: [[[[108.5], [108.6, 15.9], [108.6, 16], [108.5, 15.9]]]] },
        { ma: "BT9", loai: "bao-ton", ten: "polys rỗng", lon: 108.5, lat: 15.9, polys: [] },
        // cam-thoi-han: mùa cấm
        { ma: "C1", loai: "cam-thoi-han", ten: "Long Châu", thoiGian: "01/4-30/6; 01/11-30/11", thoiGianKhac: "01/11-30/11, 01/8-31/8", lon: 107.1, lat: 20.6, polys: [[vong(107.1, 20.6)]] },
        { ma: "C2", loai: "cam-thoi-han", ten: "chữ", thoiGian: "Tháng 5 đến tháng 7", lon: 107.1, lat: 20.6 },
        { ma: "C3", loai: "cam-thoi-han", ten: "vắt năm", thoiGian: "01/11-28/2", lon: 107.1, lat: 20.6 },
        { ma: "C4", loai: "cam-thoi-han", ten: "gạch dài", thoiGian: " 1 / 4 – 3 / 4 ;2/7—1/7", lon: 107.1, lat: 20.6 }, // 2/7—1/7: vắt năm gần trọn năm
        { ma: "C5", loai: "cam-thoi-han", thoiGian: "123/4-5/678", lon: 107.1, lat: 20.6 }, // ⇒ 23/4-5/67 ⇒ tháng 67 ⇒ bỏ; thiếu tên
        { ma: "C6", loai: "cam-thoi-han", ten: "ngày sai", thoiGian: "32/1-5/2; 0/1-5/2; 5/13-1/1; 1/0-1/1; 3/3-31/3", lon: 107.1, lat: 20.6 },
        { ma: "C7", loai: "cam-thoi-han", ten: "chữ số toàn khổ", thoiGian: "１/4-30/6", lon: 107.1, lat: 20.6 },
        { ma: "C8", loai: "cam-thoi-han", ten: "khoảng trắng Unicode", thoiGian: "01 / 4-30/6", lon: 107.1, lat: 20.6 },
        { ma: "C9", loai: "cam-thoi-han", ten: "thời gian số", thoiGian: 104, thoiGianKhac: "  ", lon: 107.1, lat: 20.6 },
        { ma: "C10", loai: "cam-thoi-han", ten: "chỉ bảng khác", thoiGianKhac: "15/10-15/10", lon: 107.1, lat: 20.6 },
        { ma: "C11", loai: "cam-thoi-han", ten: "nhuận", thoiGian: "01/02-29/02", lon: 107.1, lat: 20.6 },
        { ma: "C12", loai: "cam-thoi-han", ten: "dính chữ", thoiGian: "từ01/4-30/6xx", trangThai: "da_thanh_lap", lon: 107.1, lat: 20.6 },
        { ma: "C13", loai: "cam-thoi-han", ten: "trùng sắp xếp", thoiGian: "01/11-30/11; 01/3-31/5", thoiGianKhac: "01/3-31/5; 01/02-31/5", lon: 107.1, lat: 20.6 },
        // bao-ve-nguon-loi: tên thay
        { ma: "N1", loai: "bao-ve-nguon-loi", doiTuong: "Cá lượng (Nemipteridae)", lon: 106.5, lat: 9.0 },
        { ma: "N2", loai: "bao-ve-nguon-loi", doiTuong: "  TÔM HÙM  (x\ny)", lon: 106.5, lat: 9.0 }, // `.` không qua xuống dòng ⇒ không cắt
        { ma: "N3", loai: "bao-ve-nguon-loi", doiTuong: "(Abc)", lon: 106.5, lat: 9.0 },
        { ma: "N4", loai: "bao-ve-nguon-loi", doiTuong: "Cá\n(a)", lon: 106.5, lat: 9.0 },
        { ma: "N5", loai: "bao-ve-nguon-loi", doiTuong: "Cá (a) (b\nc)", lon: 106.5, lat: 9.0 },
        { ma: "N6", loai: "bao-ve-nguon-loi", doiTuong: "Hải sâm (a b) (c)", lon: 106.5, lat: 9.0 },
        { ma: "N7", loai: "bao-ve-nguon-loi", lon: 106.5, lat: 9.0, polys: [[vong(106.5, 9.0)]] },
        { ma: "N8", loai: "bao-ve-nguon-loi", ten: "", doiTuong: 5, lon: 106.5, lat: 9.0 },
        { ma: "N9", loai: "bao-ve-nguon-loi", doiTuong: "Cá mú\r(x)", lon: 106.5, lat: 9.0 },
        // hàng bị bỏ
        { loai: "bao-ton", ten: "thiếu mã", lon: 108.5, lat: 15.9 },
        { ma: "  ", loai: "bao-ton", lon: 108.5, lat: 15.9 },
        { ma: 7, loai: "bao-ton", lon: 108.5, lat: 15.9 },
        { ma: "L1", loai: "Bao-ton", lon: 108.5, lat: 15.9 },
        { ma: "L2", lon: 108.5, lat: 15.9 },
        { ma: "L3", loai: "bao-ton", lon: "108.5", lat: 15.9 },
        { ma: "L4", loai: "bao-ton", lon: 108.5, lat: 3.9 },
        { ma: "L5", loai: "bao-ton", lon: 108.5 },
        ["ma", "bao-ton"],
        null,
        3,
        { ma: "G1", loai: "bao-ton", ten: "góc", lon: 118, lat: 24 },
      ],
    },
    { vung: [{ ma: "X", loai: "bao-ton", ten: "chỉ điểm", lon: 108.5, lat: 15.9 }] }, // vung rỗng, diem có
    { vung: [{ ma: "X", loai: "bao-ton", lon: 99, lat: 15.9 }] }, // tất cả bị bỏ ⇒ null
    { vung: {} },
    null,
    [],
  ],
};
const raBien = {
  diaDanh: bien.diaDanh.map(diaDanh),
  khu: bien.khu.map(khu),
  vung: bien.vung.map(vungMoc),
};

/* ── ghi vector ── */
const thuMuc = join(goc, "../shared/src/jvmTest/resources/vung-dia-danh");
mkdirSync(thuMuc, { recursive: true });
const ghi = (ten, o) => {
  writeFileSync(join(thuMuc, ten), JSON.stringify(o) + "\n");
  console.log(`[sinh-vung-dia-danh] ${ten}`);
};
ghi("dia-danh-ngam.json", raDiaDanh);
ghi("khu-tru-bao.json", raKhu);
ghi("vung-quan-ly.json", raVung);
const vungLong = vungLongGeoJSON();
ghi("vung-long.json", vungLong);
ghi("bien.json", { vao: bien, ra: raBien });

/* ── sinh VungLongSinh.kt ── */
const kt = (o) => JSON.stringify(typeof o === "string" ? o : JSON.stringify(o)).replace(/\$/g, "\\$");
const raKt = join(goc, "../shared/src/commonMain/kotlin/vn/sdvico/forfish/shared/bando/VungLongSinh.kt");
writeFileSync(raKt, `// SINH TỰ ĐỘNG bởi native/scripts/sinh-vung-dia-danh.mjs từ src/data/vn-fishing-zones.ts — ĐỪNG SỬA TAY.
package vn.sdvico.forfish.shared.bando

/** Vùng lộng (NĐ 26/2019, sơ đồ tham khảo SDVico) = \`vungLongGeoJSON()\` của web: Feature Polygon, vòng đã khép. */
internal object VungLongSinh {
    const val GEO = ${kt(vungLong)}
}
`);
console.log(`[sinh-vung-dia-danh] ${raKt}`);

const dem = (g) => g?.features.length ?? 0;
const dang = {};
for (const m of raVung) for (const f of m.ra.diem.features) dang[f.properties.dang] = (dang[f.properties.dang] ?? 0) + 1;
console.log(`[sinh-vung-dia-danh] địa danh ${dem(raDiaDanh)} · khu ${dem(raKhu)} · vùng ${dem(raVung[0].ra.vung)}/${dem(raVung[0].ra.diem)} × ${MOC.length} mốc · dang ${JSON.stringify(dang)}`);
