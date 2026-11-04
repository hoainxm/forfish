// VECTOR VÀNG CHO LỚP HẢI ĐỒ (app-map 18 §5) — số đo sâu, đường độ sâu, đèn biển, xác tàu.
//
//   node native/scripts/sinh-hai-do.mjs
//
// Chạy CHÍNH bộ giải mã của web (jiti, alias "@" như vitest.config) trên file bản RÕ trong `public/data/`, rồi dựng
// GeoJSON bằng thân CHÉP Y của bốn useMemo trong src/components/fishing-map-view.tsx (soundingGeo, depthLineGeo,
// denBienGeo, xacTauGeo — web viết thẳng trong component, không có hàm xuất). Ghi ra
// native/shared/src/jvmTest/resources/hai-do/*.json; HaiDoVangTest.kt bắt bản Kotlin (HaiDo.kt) ra y hệt.
// Sửa một trong bốn useMemo ở web thì sửa cả bản chép dưới đây, chạy lại script, rồi sửa HaiDo.kt cho xanh.
//
// "Hôm nay" GHIM = HOM_NAY (web dùng new Date()) để vector không đổi theo ngày chạy.
// `bien.json`: hàng TỰ DỰNG chọc vào mép bộ giải mã (chỉ số dạng chữ, số dạng chữ, null, ngoài khung, tên phao…)
// — cũng do web chấm, không gõ tay kết quả.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "../../node_modules/jiti/lib/jiti.mjs";

const goc = dirname(fileURLToPath(import.meta.url));
const repo = join(goc, "../..");
globalThis.window = { location: { origin: "https://sdfish.sdvico.vn" } };
const jiti = createJiti(import.meta.url, { alias: { "@": join(repo, "src") } });
const lib = (p) => jiti.import(join(repo, "src/lib", p));

const { decodeSoundings, decodeSoundingRoutes, soundingAgeDays } = await lib("soundings.ts");
const { decodeVerdicts, verdictKey, SUSPECT, isStale } = await lib("soundings-verified.ts");
const { decodeFairwayDepths } = await lib("fairway-depth.ts");
const { decodeDenBien } = await lib("den-bien.ts");
const { decodeXacTau } = await lib("xac-tau.ts");
const { lighthouseSymbolId, wreckSymbolId } = await lib("chart-symbols.ts");
const { lightAbbrev } = await lib("seamarks.ts");
const { fmtDepthM } = await lib("map-prefs.ts");

export const HOM_NAY = "2026-11-04";

/* ── CHÉP Y fishing-map-view.tsx (origin/main ~2970–3125) — chỉ thay `new Date()` bằng `homNay` truyền vào,
      và state React bằng tham số. State web chỉ nhận khi CÓ phần tử (`s.diem.length || s.tuyen.length`,
      `d.length`, `v.size`) — giữ đúng điều kiện đó ở `nap*` dưới. ── */
function soundingGeoOf(soundings, verdicts, homNay) {
  if (!soundings?.diem.length) return null;
  const feats = [];
  for (const [i, s] of soundings.diem.entries()) {
    if (verdicts?.get(verdictKey(0, "diem", i))?.kq === SUSPECT) continue;
    const tuoi = soundingAgeDays(s, homNay);
    feats.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [s.lon, s.lat] },
      properties: {
        i,
        d: s.depthM,
        nhan: fmtDepthM(s.depthM),
        cu: isStale(tuoi) ? 1 : 0,
        tuoi: tuoi ?? -1,
      },
    });
  }
  return feats.length ? { type: "FeatureCollection", features: feats } : null;
}

function depthLineGeoOf(soundings, fairwayList) {
  const feats = [];
  for (const [i, r] of (soundings?.tuyen ?? []).entries()) {
    if (r.sauM === null) continue;
    feats.push({
      type: "Feature",
      geometry: { type: "LineString", coordinates: r.points.map((p) => [p.lon, p.lat]) },
      properties: { k: "tuyen", i, d: r.sauM, nhan: fmtDepthM(r.sauM) },
    });
  }
  for (const [i, f] of (fairwayList ?? []).entries()) {
    feats.push({
      type: "Feature",
      geometry: { type: "LineString", coordinates: [[f.tu.lon, f.tu.lat], [f.den.lon, f.den.lat]] },
      properties: { k: "luong", i, d: f.sauM, nhan: fmtDepthM(f.sauM) },
    });
  }
  return feats.length ? { type: "FeatureCollection", features: feats } : null;
}

function denBienGeoOf(denBien) {
  if (!denBien?.length) return null;
  return {
    type: "FeatureCollection",
    features: denBien.map((d, i) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [d.lon, d.lat] },
      properties: { i, ic: lighthouseSymbolId(d), ten: d.ten, dt: lightAbbrev(d.light) },
    })),
  };
}

function xacTauGeoOf(xacTau) {
  if (!xacTau?.length) return null;
  return {
    type: "FeatureCollection",
    features: xacTau.map((x, i) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [x.lon, x.lat] },
      properties: {
        i,
        ic: wreckSymbolId(x.loai, x.doSauVuotQua),
        nhan: typeof x.doSauVuotQua === "number" && x.doSauVuotQua > 0 ? fmtDepthM(x.doSauVuotQua) : "",
      },
    })),
  };
}

/* ── nạp như fetch* + điều kiện nhận state của component ── */
const napSoundings = (raw) => {
  const s = { diem: decodeSoundings(raw), tuyen: decodeSoundingRoutes(raw) };
  return s.diem.length || s.tuyen.length ? s : null;
};
const khiCo = (a) => (a.length ? a : null);
const napVerdicts = (raw) => {
  const v = decodeVerdicts(raw);
  return v.size ? v : null;
};

function chay({ soundings, verdicts, fairway, denBien, xacTau }, homNay) {
  const s = soundings === undefined ? null : napSoundings(soundings);
  const v = verdicts === undefined ? null : napVerdicts(verdicts);
  const f = fairway === undefined ? null : khiCo(decodeFairwayDepths(fairway));
  return {
    doSau: soundingGeoOf(s, v, homNay),
    duongDoSau: depthLineGeoOf(s, f),
    denBien: denBienGeoOf(denBien === undefined ? null : khiCo(decodeDenBien(denBien))),
    xacTau: xacTauGeoOf(xacTau === undefined ? null : khiCo(decodeXacTau(xacTau))),
  };
}

/* ── 1. file thật ── */
const doc = (ten) => JSON.parse(readFileSync(join(repo, "public/data", ten), "utf8"));
const that = {
  soundings: doc("soundings.v1.json"),
  verdicts: doc("soundings-verified.v1.json"),
  fairway: doc("fairway-depths.v1.json"),
  denBien: doc("den-bien.v1.json"),
  xacTau: doc("xac-tau.v1.json"),
};
const ra = chay(that, HOM_NAY);
// thiếu file đối chiếu (mất sóng lúc nạp) ⇒ mọi điểm coi như chưa chấm, vẫn vẽ
const raKhongDoiChieu = chay({ ...that, verdicts: undefined }, HOM_NAY).doSau;

/* ── 2. hàng tự dựng chọc mép ── */
const prov = { origin: { source: "tbhh", at: "2026-01-01" } };
const bien = {
  homNay: "2026-03-01",
  soundings: {
    luong: [{ ma: "CVHHKG", ten: "Kiên Giang" }],
    thongBao: [
      { so: "1/TBHH", ngay: "2026-02-20", luong: 0, prov },
      { so: "2/TBHH", ngay: "2018-01-01", luong: 0, prov },
      { so: "3/TBHH", ngay: "2026-02-31", luong: 0, prov }, // ngày tràn tháng — Date.parse vẫn nhận
      { so: "4/TBHH", ngay: "khong-ro", luong: 0, prov }, // ngày hỏng ⇒ tuoi -1
      { so: "5/TBHH", ngay: "2026-01-01", luong: 0, prov: null }, // không lý lịch ⇒ bỏ
      { so: "6/TBHH", ngay: 20260101, luong: 0, prov }, // ngày không phải chuỗi ⇒ bỏ
      { so: "7/TBHH", ngay: "2026", luong: 0, prov }, // chỉ năm — ISO rút gọn
    ],
    diem: [
      [106.5, 10.2, 45, 0],
      [106.5, 10.2, 120, 1], // cũ > 365 ngày
      [106.5, 10.2, 77, 2],
      [106.5, 10.2, 33, 3],
      [106.5, 10.2, 33, 4],
      [106.5, 10.2, 33, 5],
      [106.5, 10.2, 33, 6],
      [106.5, 10.2, "58", 0], // độ sâu dạng chữ — Number() vẫn đọc
      [106.5, 10.2, 58, "0"], // chỉ số dạng chữ — mảng JS vẫn tra được
      [106.5, 10.2, true, 0], // true = 1 ⇒ 0,1 m, vừa chạm sàn
      [106.5, 10.2, null, 0], // null = 0 ⇒ loại
      [106.5, 10.2, 0.5, 0], // 0,05 m ⇒ loại
      [106.5, 10.2, 2001, 0], // > 200 m ⇒ loại
      [106.5, 10.2, 2000, 0], // = 200 m
      [101.9, 10.2, 40, 0], // ngoài khung Tây
      ["106.5", 10.2, 40, 0], // kinh độ dạng chữ ⇒ loại (isFinite không ép kiểu)
      [106.5, 10.2, 40], // thiếu cột
      [106.5, 10.2, 40, 99], // chỉ số ngoài bảng
      [106.5, 10.2, 40, 1.5], // chỉ số lẻ
      [106.5, 10.2, 40, "00"], // chữ không chuẩn ⇒ undefined
      [106.5, 10.2, 12.35, 0], // làm tròn 1,235 ⇒ 1,2
      [106.5, 10.2, 12.25, 0],
      [106.5, 10.2, 99.95, 0],
      null,
      "x",
      [118, 24, 40, 0], // đúng góc khung
    ],
    tuyen: [
      { tb: 0, ten: "T2", diem: [[106.1, 10.1], [106.2, 10.2], [106.3, 10.3]], sau: 82 },
      { tb: 0, ten: "", diem: [[106.1, 10.1], [106.2, 10.2]], sau: null }, // không độ sâu ⇒ không vẽ
      { tb: 0, ten: null, diem: [[106.1, 10.1], [99, 10.2], [106.3, 10.3]], sau: -15 }, // một đỉnh ngoài khung
      { tb: 0, diem: [[106.1, 10.1], [99, 10.2]], sau: 50 }, // còn 1 đỉnh ⇒ bỏ
      { tb: 0, diem: [[106.1, 10.1]], sau: 50 },
      { tb: "1", diem: [[106.1, 10.1], [106.2, 10.2]], sau: "37" },
      { tb: 0, diem: [[106.1, 10.1], [106.2, 10.2]], sau: 36.5 },
      { tb: 0, diem: [[106.1, 10.1], [106.2, 10.2]], sau: "abc" }, // NaN ⇒ null ⇒ không vẽ
      { tb: 0, diem: [[106.1, 10.1], [106.2, 10.2]] }, // thiếu sau ⇒ null
      { tb: 4, diem: [[106.1, 10.1], [106.2, 10.2]], sau: 40 }, // tin không lý lịch
      { tb: 0, diem: [[106.1, 10.1], "x", [106.2]], sau: 40 },
      { tb: 0, diem: [[106.1, 10.1], [106.2, 10.2]], sau: 0 },
      7,
    ],
  },
  verdicts: {
    muc: [
      { tep: 0, loai: "diem", i: 2, kq: "nghi-loi" },
      { tep: 0, loai: "diem", i: 3, kq: "khop" },
      { tep: 1, loai: "diem", i: 0, kq: "nghi-loi" }, // file khác ⇒ không đụng
      { tep: 0, loai: "tuyen", i: 0, kq: "nghi-loi" }, // tuyến: web không lọc
      { tep: "0", loai: "diem", i: 7, kq: "nghi-loi" }, // tep chữ ⇒ bỏ mục
      { tep: 0, loai: "diem", i: 8, kq: 5 }, // kq không phải chữ ⇒ bỏ mục
      { tep: 0, loai: "xx", i: 9, kq: "nghi-loi" },
      { tep: 0, loai: "diem", i: 20, kq: "nghi-loi" },
      { tep: 0, loai: "diem", i: 20, kq: "khop" }, // trùng khoá ⇒ mục sau đè
      null,
    ],
  },
  fairway: {
    tuyen: [{ ten: "Luồng A", noi: "Hải Phòng", prov }, null],
    thongBao: [{ so: "1", ngay: "2026-01-01", prov }, { so: "2", ngay: "2026-01-01" }],
    doan: [
      [0, 0, 23, 0, 106.75225, 20.88557, 106.76651, 20.94452, "Từ phao 5 đến 17"],
      [0, 0, -15, 1, 106.75, 20.88, 106.76, 20.9, "âm"],
      [0, 0, -25, 0, 106.75, 20.88, 106.76, 20.9, "quá âm"],
      [0, 0, 301, 0, 106.75, 20.88, 106.76, 20.9, "quá sâu"],
      [0, 0, 300, 0, 106.75, 20.88, 106.76, 20.9, "đúng 30"],
      [0, 0, 23, 0, 106.75, 20.88, 106.7501, 20.88, "ngắn quá"],
      [0, 0, 23, 0, 106.75, 20.88, 107.5, 20.88, "dài quá"],
      [1, 0, 23, 0, 106.75, 20.88, 106.76, 20.9, "tuyến null"],
      [0, 1, 23, 0, 106.75, 20.88, 106.76, 20.9, "tin thiếu prov"],
      [0, 0, 23, 0, "106.75", 20.88, 106.76, 20.9, "toạ độ chữ"],
      [0, 0, "23", 0, 106.75, 20.88, 106.76, 20.9, 5],
      [0, 0, 23, 0, 106.75, 20.88, 106.76, 20.9],
      [0, 0, -0.4, 0, 106.75, 20.88, 106.76, 20.9, "âm không"],
      [0, 0, 105, 0, 106.75, 20.88, 106.76, 20.9, "10,5"],
    ],
  },
  denBien: {
    layNgay: "2026-01-01",
    types: ["light_major", "light_minor", "beacon", ""],
    chars: ["Fl", "LFl", ""],
    groups: ["2", " 2+1 ", ""],
    colours: ["white", "white;red", "Red ; GREEN", "grey", "white;pink"],
    names: ["Kê Gà", "Phao số 6", "NC1", "Hòn 123", "A", "Mũi Điện", "Đảo Trần", "x".repeat(41), "Hòn đăng tiêu", "Tiêu Hòn", "Hòn tiêu", "Một hai ba bốn năm sáu bảy", "12,5", "Đèn \"Hòn\"", "Hòn Ếphao", "\u00a0Hòn\u00a0Khoai\u3000", "Một\u00a0hai\u2003ba bốn năm sáu bảy"],
    places: ["Phú Yên"],
    years: ["1899"],
    provs: [prov],
    lights: [
      [108.0, 11.0, 0, 0, 0, 0, 5, 20.7, 3, 0, 0, 30, 60, 23, 0, 0],
      [108.0, 11.0, 1, 1, 1, 1, 6, 20.5, 3, 5, 0, -1, -1, -1, -1, 0],
      [108.0, 11.0, 2, 0, 2, 2, 2.5, 12.4, 3, 6, 0, 0, 0, 0, 0, 0],
      [108.0, 11.0, 9, 9, 9, 9, -1, -1, 9, 0, 0, 0, 0, 0, 0, 0], // loại ngoài bảng ⇒ light_major, không đèn
      [108.0, 11.0, 3, 2, 0, 4, 10, 10, 0, 0, 0, 0, 0, 0, 0, 0], // loại chuỗi rỗng ⇒ light_major
      [108.0, 11.0, 0, 0, 0, 0, 5, 20.7, 3, 1, 0, 0, 0, 0, 0, 0], // tên phao ⇒ bỏ
      [108.0, 11.0, 0, 0, 0, 0, 5, 20.7, 3, 2, 0, 0, 0, 0, 0, 0], // NC1 ⇒ bỏ
      [108.0, 11.0, 0, 0, 0, 0, 5, 20.7, 3, 3, 0, 0, 0, 0, 0, 0], // chuỗi số dài ⇒ bỏ
      [108.0, 11.0, 0, 0, 0, 0, 5, 20.7, 3, 4, 0, 0, 0, 0, 0, 0], // 1 chữ ⇒ bỏ
      [108.0, 11.0, 0, 0, 0, 0, 5, 20.7, 3, 7, 0, 0, 0, 0, 0, 0], // dài quá ⇒ bỏ
      [108.0, 11.0, 0, 0, 0, 0, 5, 20.7, 3, 8, 0, 0, 0, 0, 0, 0], // "đăng tiêu" sau khoảng trắng — \b JS không bắt
      [108.0, 11.0, 0, 0, 0, 0, 5, 20.7, 3, 9, 0, 0, 0, 0, 0, 0], // "Tiêu" đầu chuỗi
      [108.0, 11.0, 0, 0, 0, 0, 5, 20.7, 3, 10, 0, 0, 0, 0, 0, 0],
      [108.0, 11.0, 0, 0, 0, 0, 5, 20.7, 3, 11, 0, 0, 0, 0, 0, 0], // quá 6 chữ
      [108.0, 11.0, 0, 0, 0, 0, 5, 20.7, 3, 12, 0, 0, 0, 0, 0, 0],
      [108.0, 11.0, 0, 0, 0, 0, 5, 20.7, 3, 13, 0, 0, 0, 0, 0, 0], // dấu nháy
      [108.0, 11.0, 0, 0, 0, 0, 5, 20.7, 3, 14, 0, 0, 0, 0, 0, 0], // \b JS: "Ế" không phải chữ ⇒ "phao" có biên
      [108.0, 11.0, 0, 0, 0, 0, 5, 20.7, 3, 15, 0, 0, 0, 0, 0, 0], // khoảng trắng Unicode: trim + \s của JS
      [108.0, 11.0, 0, 0, 0, 0, 5, 20.7, 3, 16, 0, 0, 0, 0, 0, 0], // 7 chữ khi tách cả NBSP/em-space
      [108.0, 11.0, 0, 0, 0, 0, 5, 20.7, 3, 99, 0, 0, 0, 0, 0, 0, 1], // cố ý không tên
      [108.0, 11.0, 0, 0, 0, 0, 5, 20.7, 3, 99, 0, 0, 0, 0, 0, 0], // thiếu tên, không cờ ⇒ bỏ
      [130.0, 11.0, 0, 0, 0, 0, 5, 20.7, 3, 0, 0, 0, 0, 0, 0, 0], // ngoài khung
      [108.0, 11.0, 0, 0, 0, 0, 5, 20.7, 3], // thiếu cột
      [108.0, 11.0, 1.5, "0", 0, 0, 5, 21.5, 3, 0, 0, 0, 0, 0, 0, 0], // chỉ số lẻ/chữ ⇒ không tra
      [108.0, 11.0, 0, 0, 0, 0, 5, 20.5, 3, 0, 0, 0, 0, 0, 0, 0, true], // cờ true ≠ 1
    ],
  },
  xacTau: {
    layNgay: "2026-01-01",
    loais: ["xac-tau", "chuong-ngai", "vat-chim", "la"],
    names: ["MINH KHÁNH 01", ""],
    notices: [{ so: "993/TBHH", nam: 2025, thang: 3, duong: "ocr" }],
    items: [
      [106.36, 9.35, 0, 0, 6.8, -1, 0, 0],
      [106.36, 9.35, 0, 1, -1, -1, 0, 0],
      [106.36, 9.35, 1, -1, 12.25, 50, 0, 0],
      [106.36, 9.35, 2, -1, -1, -1, 9, 0],
      [106.36, 9.35, 3, -1, 3, -1, 0, 0], // loại lạ ⇒ chuong-ngai
      [106.36, 9.35, 7, -1, 3, -1, 0, 0],
      [106.36, 9.35, 0, -1, 0, -1, 0, 0], // độ sâu 0 ⇒ không số
      [106.36, 3.9, 0, -1, 3, -1, 0, 0], // ngoài khung Nam
      [106.36, 9.35, 0, -1, 3], // thiếu cột
      [106.36, 9.35, 0, -1, "4", -1, 0, 0], // độ sâu chữ ⇒ không số
    ],
  },
};
const raBien = chay(bien, bien.homNay);

/* ── ghi ── */
const thuMuc = join(goc, "../shared/src/jvmTest/resources/hai-do");
mkdirSync(thuMuc, { recursive: true });
const ghi = (ten, o) => {
  writeFileSync(join(thuMuc, ten), JSON.stringify(o) + "\n");
  console.log(`[sinh-hai-do] ${ten}`);
};
ghi("do-sau.json", ra.doSau);
ghi("do-sau-khong-doi-chieu.json", raKhongDoiChieu);
ghi("duong-do-sau.json", ra.duongDoSau);
ghi("den-bien.json", ra.denBien);
ghi("xac-tau.json", ra.xacTau);
ghi("bien.json", { vao: bien, ra: raBien, homNay: HOM_NAY });
const dem = (g) => g?.features.length ?? 0;
console.log(`[sinh-hai-do] điểm ${dem(ra.doSau)} (chưa lọc ${dem(raKhongDoiChieu)}) · đường ${dem(ra.duongDoSau)} · đèn ${dem(ra.denBien)} · xác ${dem(ra.xacTau)}`);
