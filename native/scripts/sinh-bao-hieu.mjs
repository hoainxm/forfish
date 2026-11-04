// VECTOR VÀNG CHO LỚP BÁO HIỆU (app-map 18 §5) — báo hiệu OSM ba tầng + báo hiệu Cục Hàng hải.
//
//   node native/scripts/sinh-bao-hieu.mjs
//
// Chạy CHÍNH code web (jiti, alias "@" như vitest.config): decodeSeamarks (seamarks.ts), decodeVnAids (vn-aids.ts),
// chartSymbolId (chart-symbols.ts), decodeDenBien + denOsmTrungDenBien (den-bien.ts), SEAMARK_FAR/MID/AN
// (components/ban-do/hai-do.tsx) trên file bản RÕ trong `public/data/`, rồi dựng GeoJSON bằng thân CHÉP Y các useMemo
// `seamarkGeo` + `seamarkTiers` + `vnAidGeo` trong src/components/fishing-map-view.tsx (web viết thẳng trong component).
// Ghi ra native/shared/src/jvmTest/resources/bao-hieu/*.json; BaoHieuVangTest.kt bắt bản Kotlin (BaoHieu.kt) ra y hệt.
// Sửa một trong các useMemo ở web thì sửa cả bản chép dưới đây, chạy lại script, rồi sửa BaoHieu.kt cho xanh.
//
// `bien.json`: hàng TỰ DỰNG chọc vào mép bộ giải (null, số dạng chữ, ngoài khung, câu tác dụng có "phải"/"trái",
// màu thân lạ, có/không đèn, bảng tra không phải mảng…) — cũng do web chấm, không gõ tay kết quả.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "../../node_modules/jiti/lib/jiti.mjs";

const goc = dirname(fileURLToPath(import.meta.url));
const repo = join(goc, "../..");
globalThis.window = { location: { origin: "https://sdfish.sdvico.vn" } };
const jiti = createJiti(import.meta.url, { alias: { "@": join(repo, "src") }, jsx: true });
const lib = (p) => jiti.import(join(repo, "src/lib", p));

const { decodeSeamarks } = await lib("seamarks.ts");
const { decodeVnAids } = await lib("vn-aids.ts");
const { chartSymbolId } = await lib("chart-symbols.ts");
const { decodeDenBien, denOsmTrungDenBien } = await lib("den-bien.ts");
const { SEAMARK_FAR, SEAMARK_MID, SEAMARK_AN } = await jiti.import(join(repo, "src/components/ban-do/hai-do.tsx"));

/* ── CHÉP Y fishing-map-view.tsx — seamarkGeo (~2714–2727), seamarkTiers (~2735–2748), vnAidGeo (~3148–3158).
      State React thay bằng tham số; web chỉ nhận state khi CÓ phần tử (`m.length`, `d.length`, `a.length` ở các
      effect fetch*) — giữ đúng điều kiện đó ở `khiCo` dưới. ── */
function seamarkGeoOf(seamarkList) {
  if (!seamarkList) return null;
  return {
    type: "FeatureCollection",
    features: seamarkList.map((m, i) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [m.lon, m.lat] },
      properties: { i, t: m.type, ic: chartSymbolId(m) },
    })),
  };
}

function seamarkTiersOf(seamarkGeo, seamarkList, denBien) {
  if (!seamarkGeo || !seamarkList) return null;
  const far = [];
  const mid = [];
  const near = [];
  const trung = denOsmTrungDenBien(seamarkList, denBien);
  for (const f of seamarkGeo.features) {
    const t = String(f.properties?.t ?? "");
    if (SEAMARK_AN.includes(t) || trung.has(Number(f.properties?.i))) continue;
    (SEAMARK_FAR.includes(t) ? far : SEAMARK_MID.includes(t) ? mid : near).push(f);
  }
  const fc = (features) => ({ type: "FeatureCollection", features });
  return { far: fc(far), mid: fc(mid), near: fc(near) };
}

function vnAidGeoOf(vnAids) {
  if (!vnAids?.length) return null;
  return {
    type: "FeatureCollection",
    features: vnAids.map((m, i) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [m.lon, m.lat] },
      properties: { i, ic: chartSymbolId(m, m.tacDung ?? undefined) },
    })),
  };
}

/* ── nạp như fetch* + điều kiện nhận state ── */
const khiCo = (a) => (a.length ? a : null);

function moc(seamarks, denBien) {
  const list = seamarks === undefined ? null : khiCo(decodeSeamarks(seamarks));
  const den = denBien === undefined ? null : khiCo(decodeDenBien(denBien));
  const t = seamarkTiersOf(seamarkGeoOf(list), list, den);
  return t ? [t.far, t.mid, t.near] : [null, null, null];
}
const vn = (raw) => vnAidGeoOf(raw === undefined ? null : khiCo(decodeVnAids(raw)));

/* ── 1. file thật ── */
const doc = (ten) => JSON.parse(readFileSync(join(repo, "public/data", ten), "utf8"));
const seamarksThat = doc("seamarks.v1.json");
const denThat = doc("den-bien.v1.json");
const mocThat = moc(seamarksThat, denThat);
const mocKhongDen = moc(seamarksThat, undefined); // thiếu đèn biển (mất sóng lúc nạp) ⇒ không bỏ đèn OSM nào
const vnThat = vn(doc("vn-aids.v1.json"));

/* ── 2. hàng tự dựng chọc mép ── */
const denBienBien = {
  types: ["light_major"],
  chars: ["Fl"],
  groups: ["2"],
  colours: ["white"],
  names: ["Kê Gà", "Mũi Điện"],
  lights: [
    [108.0, 11.0, 0, 0, 0, 0, 5, 20, 0, 0, 0, 0, 0, 0, 0, 0],
    [109.0, 12.0, 0, 0, 0, 0, 5, 20, 0, 1, 0, 0, 0, 0, 0, 0],
  ],
};
const seamarksBien = {
  v: 1,
  types: [
    "buoy_lateral", "beacon_lateral", "buoy_cardinal", "beacon_cardinal", "light_major", "light_minor", // 0–5
    "platform", "pile", "kieu_moi", "", 5, "light_vessel", "anchorage", "buoy_safe_water", "marine_farm", // 6–14
    "Buoy_Lateral", "light", "landmark", "harbour", "gate", "buoy_special_purpose", null, true, // 15–22
  ],
  chars: ["Fl", "", 0, "Q"],
  groups: ["2", ""],
  colours: [
    "red", "green", "red;green;red", "green;red;green", "black;yellow", "yellow;black", "black;yellow;black", // 0–6
    "yellow;black;yellow", " RED ", "red;", "white", "", "Red ; Green ; Red", 7, "pink", "red;red", // 7–15
    "BLACK; yellow", "green;red", false, // 16–18
  ],
  marks: [
    [106.5, 10.2, 0], // phao luồng không màu ⇒ lat-unknown
    [106.5, 10.2, 0, -1, -1, -1, 0, 0, 0], // đỏ ⇒ port
    [106.5, 10.2, 0, -1, -1, -1, 0, 0, 1], // xanh ⇒ stbd
    [106.5, 10.2, 0, -1, -1, -1, 0, 0, 2],
    [106.5, 10.2, 0, -1, -1, -1, 0, 0, 3],
    [106.5, 10.2, 0, -1, -1, -1, 0, 0, 8], // " RED " ⇒ trim + thường
    [106.5, 10.2, 0, -1, -1, -1, 0, 0, 9], // "red;" ⇒ một phần
    [106.5, 10.2, 0, -1, -1, -1, 0, 0, 12], // hoa + khoảng trắng ⇒ pref-stbd
    [106.5, 10.2, 0, -1, -1, -1, 0, 0, 13], // màu là số 7
    [106.5, 10.2, 0, -1, -1, -1, 0, 0, 14], // màu lạ
    [106.5, 10.2, 0, -1, -1, -1, 0, 0, 15], // red;red
    [106.5, 10.2, 0, -1, -1, -1, 0, 0, 17], // green;red (hai phần) ⇒ unknown
    [106.5, 10.2, 0, -1, -1, -1, 0, 0, 18], // false ⇒ falsy ⇒ không màu thân
    [106.5, 10.2, 0, 0, -1, 0, 5, 3, -1], // không màu thân, đèn đỏ ⇒ port-lit
    [106.5, 10.2, 0, 0, -1, 1, 5, 3, -1], // đèn xanh ⇒ stbd-lit
    [106.5, 10.2, 0, 0, -1, 2, 5, 3, -1], // đèn ba màu ⇒ unknown-lit
    [106.5, 10.2, 0, -1, -1, 1, 0, 0, 0], // thân đỏ thắng đèn xanh
    [106.5, 10.2, 1, -1, -1, -1, 0, 0, 2], // tiêu pref-stbd ⇒ port
    [106.5, 10.2, 1, -1, -1, -1, 0, 0, 3], // tiêu pref-port ⇒ stbd
    [106.5, 10.2, 1, -1, -1, -1, 0, 0, 0],
    [106.5, 10.2, 1, 3, -1, -1, 0, 0, -1], // tiêu có đèn không màu
    [106.5, 10.2, 2, -1, -1, -1, 0, 0, 4],
    [106.5, 10.2, 2, -1, -1, -1, 0, 0, 5],
    [106.5, 10.2, 2, -1, -1, -1, 0, 0, 6],
    [106.5, 10.2, 2, -1, -1, -1, 0, 0, 7],
    [106.5, 10.2, 2, -1, -1, -1, 0, 0, 16], // "BLACK; yellow"
    [106.5, 10.2, 2, -1, -1, -1, 0, 0, 0], // đỏ ⇒ card-unknown
    [106.5, 10.2, 3, -1, -1, -1, 0, 0, 4],
    [106.5, 10.2, 3, 0, -1, -1, 0, 0, 6], // tiêu phương vị có đèn
    [106.5, 10.2, 4], // đèn lớn không đặc tính
    [106.5, 10.2, 4, 0, 0, 10, 10, 20, -1], // đèn lớn có đèn ⇒ không -lit
    [106.5, 10.2, 5, 0], // đèn nhỏ
    [106.5, 10.2, 6, 0], // giàn ⇒ ẩn
    [106.5, 10.2, 7], // cọc ⇒ near
    [106.5, 10.2, 7, 0], // cọc có đèn ⇒ pile-lit
    [106.5, 10.2, 7, 1], // char "" ⇒ falsy
    [106.5, 10.2, 7, 2], // char 0 ⇒ falsy
    [106.5, 10.2, 7, -1, 1], // group "" ⇒ falsy
    [106.5, 10.2, 7, -1, 0], // group "2"
    [106.5, 10.2, 7, -1, -1, 11], // màu đèn "" ⇒ falsy
    [106.5, 10.2, 7, -1, -1, -1, 4], // chỉ chu kỳ
    [106.5, 10.2, 7, -1, -1, -1, -1, 2.5], // chỉ tầm
    [106.5, 10.2, 7, -1, -1, -1, "4", "4"], // chu kỳ/tầm dạng chữ ⇒ không đèn
    [106.5, 10.2, 7, -1, -1, -1, 0, 0], // 0 ⇒ không đèn
    [106.5, 10.2, 7, "0"], // chỉ số chữ ⇒ không tra
    [106.5, 10.2, 7, 0.5], // chỉ số lẻ
    [106.5, 10.2, 7, 99], // ngoài bảng
    [106.5, 10.2, 8], // loại lạ ⇒ aid-unknown, near
    [106.5, 10.2, 8, 0], // loại lạ có đèn ⇒ aid-unknown-lit
    [106.5, 10.2, 9], // loại "" ⇒ bỏ
    [106.5, 10.2, 10], // loại là số 5
    [106.5, 10.2, 10, 0],
    [106.5, 10.2, 11, 0], // tàu đèn ⇒ far
    [106.5, 10.2, 12, 0], // neo ⇒ mid, không -lit
    [106.5, 10.2, 13, 0], // nước sâu ⇒ safe-water-lit
    [106.5, 10.2, 14, 0], // lồng bè ⇒ near, không -lit
    [106.5, 10.2, 15], // hoa ⇒ không khớp loại
    [106.5, 10.2, 16, 0], [106.5, 10.2, 17, 0], [106.5, 10.2, 18], [106.5, 10.2, 19, 0], [106.5, 10.2, 20, 0],
    [106.5, 10.2, 21], // loại null ⇒ bỏ
    [106.5, 10.2, 22], // loại true
    [106.5, 10.2, "0"], // chỉ số loại chữ ⇒ bỏ
    [106.5, 10.2, 0.5],
    [106.5, 10.2, -1],
    [106.5, 10.2, 99],
    ["106.5", 10.2, 0], // kinh độ chữ ⇒ bỏ
    [106.5, null, 0],
    [106.5, 10.2], // thiếu cột
    null,
    "x",
    {},
    [-200, 95, 0], // ngoài khung trái đất — web không chặn khung
    // trùng đèn biển (108.0, 11.0): đèn lớn/nhỏ trong 300 m ⇒ bỏ; phao đèn cạnh đó ⇒ giữ
    [108.0, 11.0, 4, 0],
    [108.001, 11.001, 5, 0],
    [108.0026, 11.0, 4], // ~284 m Đông
    [108.0029, 11.0, 4], // ~316 m ⇒ giữ
    [108.0, 11.0028, 5], // ~311 m Bắc ⇒ giữ
    [108.0, 11.0026, 5], // ~289 m ⇒ bỏ
    [108.0, 11.0, 11, 0], // tàu đèn trùng chỗ ⇒ giữ
    [108.0, 11.0, 0, 0, -1, 0], // phao đèn ⇒ giữ
    [109.0, 12.0, 4],
    [109.0, 12.0, 17, 0], // mốc bờ ⇒ giữ
  ],
};
const vnAidsBien = {
  v: 1,
  types: [
    "buoy_lateral", "beacon_lateral", "buoy_cardinal", "beacon_cardinal", "light_minor", "buoy_special_purpose", // 0–5
    "", "platform", 0, "buoy_isolated_danger", // 6–9
  ],
  chars: ["Fl", "", "Q"],
  groups: ["2", ""],
  colours: ["red", "green", "white", "black;yellow", "", "yellow;black;yellow", null, 0],
  names: ["Phao 5"],
  purposes: [
    "Báo hiệu phía phải luồng", // 0
    "Báo hiệu phía trái luồng", // 1
    "Báo hiệu phía phải trái luồng", // 2 — cả hai ⇒ chưa rõ
    "Báo hiệu hướng luồng chính chuyển sang phải", // 3
    "Báo hiệu hướng luồng chính chuyển hướng sang trái", // 4
    "BH an toàn phía Nam", // 5
    "Phao Nam Định an toàn phía Đông", // 6 — hướng CUỐI thắng
    "Việt Nam", // 7
    "", // 8
    "BÁO HIỆU PHÍA PHẢI", // 9 — hoa
    5, // 10
    null, // 11
    "BH an toàn phía TÂY Bắc", // 12
    "Báo hiệu đầu luồng", // 13 — không nói bên
    "chuyển hướng sang phải nhưng nằm bên trái", // 14
    "Khu vực Đông Bắc", // 15
    "namđông", // 16 — sát nhau
    "Hướng luồng chính chuyển sang trái", // 17
  ],
  routes: [{ ten: "Tuyến luồng Hải Phòng" }],
  marks: [
    // [lon, lat, t, ch, grp, lc, per, rng, bc, rt, nm, pp]
    [106.5, 20.8, 0, -1, -1, -1, 0, 0, -1, 0, 0, 0],
    [106.5, 20.8, 0, -1, -1, -1, 0, 0, -1, 0, 0, 1],
    [106.5, 20.8, 0, -1, -1, -1, 0, 0, -1, 0, 0, 2],
    [106.5, 20.8, 0, -1, -1, 0, 0, 0, -1, 0, 0, 2], // chưa rõ theo câu ⇒ rơi về màu đèn
    [106.5, 20.8, 0, -1, -1, -1, 0, 0, -1, 0, 0, 3],
    [106.5, 20.8, 0, -1, -1, -1, 0, 0, -1, 0, 0, 4],
    [106.5, 20.8, 0, -1, -1, 1, 0, 0, -1, 0, 0, 9],
    [106.5, 20.8, 0, -1, -1, 1, 0, 0, -1, 0, 0, 10], // câu là số
    [106.5, 20.8, 0, -1, -1, 1, 0, 0, -1, 0, 0, 11], // câu null ⇒ màu đèn
    [106.5, 20.8, 0, -1, -1, 1, 0, 0, 0, 0, 0, 13], // màu thân đỏ thắng đèn xanh
    [106.5, 20.8, 0, -1, -1, -1, 0, 0, -1, 0, 0, 14],
    [106.5, 20.8, 0, -1, -1, -1, 0, 0, -1, 0, 0, 17],
    [106.5, 20.8, 1, -1, -1, -1, 0, 0, -1, 0, 0, 17],
    [106.5, 20.8, 0, -1, -1, -1, 0, 0, -1, 0, 0], // thiếu cột pp
    [106.5, 20.8, 0, -1, -1, -1, 0, 0, -1, 0, 0, 99], // pp ngoài bảng
    [106.5, 20.8, 0, -1, -1, -1, 0, 0, -1, 0, 0, "1"], // pp chữ ⇒ không tra
    [106.5, 20.8, 0, -1, -1, 4, 0, 0, -1, 0, 0, 13], // màu đèn "" ⇒ không ⇒ không đèn
    [106.5, 20.8, 0, -1, -1, 6, 0, 0, 6, 0, 0, 13], // màu null
    [106.5, 20.8, 0, -1, -1, 7, 0, 0, 7, 0, 0, 13], // màu 0
    [106.5, 20.8, 0, -1, -1, -1, "5", 0, -1, 0, 0, 13], // chu kỳ chữ "5" > 0 ⇒ CÓ đèn (so sánh JS ép số)
    [106.5, 20.8, 0, -1, -1, -1, true, 0, -1, 0, 0, 13], // true > 0
    [106.5, 20.8, 0, -1, -1, -1, [3], 0, -1, 0, 0, 13], // [3] > 0
    [106.5, 20.8, 0, -1, -1, -1, "x", 0, -1, 0, 0, 13],
    [106.5, 20.8, 0, -1, -1, -1, null, null, -1, 0, 0, 13],
    [106.5, 20.8, 0, -1, -1, -1, 0, 2.5, -1, 0, 0, 13],
    [106.5, 20.8, 0, 1, 1, -1, 0, 0, -1, 0, 0, 13], // char/group "" ⇒ không đèn
    [106.5, 20.8, 0, 0, -1, -1, 0, 0, -1, 0, 0, 13], // char Fl ⇒ có đèn
    [106.5, 20.8, 0, -1, 0, -1, 0, 0, -1, 0, 0, 13],
    [106.5, 20.8, 1, -1, -1, -1, 0, 0, -1, 0, 0, 3], // tiêu pref-stbd ⇒ port
    [106.5, 20.8, 1, -1, -1, -1, 0, 0, -1, 0, 0, 4],
    [106.5, 20.8, 1, 0, -1, 1, 3, 3, -1, 0, 0, 0],
    [106.5, 20.8, 2, -1, -1, -1, 0, 0, -1, 0, 0, 5],
    [106.5, 20.8, 2, -1, -1, -1, 0, 0, -1, 0, 0, 6],
    [106.5, 20.8, 2, -1, -1, -1, 0, 0, -1, 0, 0, 7],
    [106.5, 20.8, 2, -1, -1, -1, 0, 0, -1, 0, 0, 12],
    [106.5, 20.8, 2, -1, -1, -1, 0, 0, -1, 0, 0, 15],
    [106.5, 20.8, 2, -1, -1, -1, 0, 0, -1, 0, 0, 16],
    [106.5, 20.8, 2, -1, -1, -1, 0, 0, 3, 0, 0, 8], // câu rỗng ⇒ màu thân Bắc
    [106.5, 20.8, 2, -1, -1, -1, 0, 0, 5, 0, 0, 13], // câu không hướng ⇒ màu thân Tây
    [106.5, 20.8, 3, 0, -1, -1, 0, 0, 3, 0, 0, 5],
    [106.5, 20.8, 4, 0, -1, 2, 5, 9, -1, 0, 0, 13],
    [106.5, 20.8, 5, -1, -1, -1, 0, 0, -1, 0, 0, 13],
    [106.5, 20.8, 5, 0, -1, -1, 0, 0, -1, 0, 0, 13],
    [106.5, 20.8, 9, 0, -1, -1, 0, 0, -1, 0, 0, 13],
    [106.5, 20.8, 7, -1, -1, -1, 0, 0, -1, 0, 0, 13], // giàn: vn-aids KHÔNG ẩn
    [106.5, 20.8, 6], // loại "" ⇒ bỏ
    [106.5, 20.8, 8], // loại 0 ⇒ bỏ
    [106.5, 20.8, 1.5], // chỉ số lẻ ⇒ bỏ
    [106.5, 20.8, "0"], // chỉ số chữ ⇒ bỏ
    [106.5, 20.8, 0], // chỉ ba cột
    ["106.5", 20.8, 0],
    [106.5, 20.8],
    null,
    7,
  ],
};
/* bảng tra KHÔNG phải mảng: decodeVnAids dùng `f.x ?? []` không kiểm mảng ⇒ chuỗi ra ký tự, object tra khoá */
const vnAidsBangLa = {
  types: { 0: "buoy_lateral", 1: "beacon_cardinal", "1.5": "light_minor", x: "pile" },
  chars: "F",
  groups: null,
  colours: { 0: "red", 2: "green;red;green" },
  purposes: "phải",
  marks: [
    [106.5, 20.8, 0, -1, -1, -1, 0, 0, -1, 0, 0, -1],
    [106.5, 20.8, 0, -1, -1, -1, 0, 0, 2, 0, 0, -1],
    [106.5, 20.8, 0, -1, -1, -1, 0, 0, 0, 0, 0, 0], // câu = "p" ⇒ không nói bên ⇒ màu thân
    [106.5, 20.8, 0, 0, -1, -1, 0, 0, -1, 0, 0, 1], // char = "F"[0] ⇒ có đèn; câu "h"
    [106.5, 20.8, 0, 1, -1, 0, 0, 0, -1, 0, 0, -1], // "F"[1] ⇒ undefined; màu đèn đỏ
    [106.5, 20.8, 1.5, -1, -1, -1, 0, 0, -1, 0, 0, -1], // object tra khoá "1.5"
    [106.5, 20.8, 1, -1, -1, -1, 0, 0, -1, 0, 0, -1],
    [106.5, 20.8, 2], // không có khoá "2"
  ],
};
const seamarksBangLa = { types: "buoy_lateral", marks: [[106.5, 10.2, 0]] }; // bảng không phải mảng ⇒ []
const truongHop = {
  moc: [
    { ten: "day-du", seamarks: seamarksBien, denBien: denBienBien },
    { ten: "khong-den-bien", seamarks: seamarksBien },
    { ten: "den-bien-rong", seamarks: seamarksBien, denBien: { lights: [] } },
    { ten: "den-bien-hong", seamarks: seamarksBien, denBien: "x" },
    { ten: "bang-la", seamarks: seamarksBangLa, denBien: denBienBien },
    { ten: "khong-mark", seamarks: { types: ["light_major"], marks: [] } },
    { ten: "marks-khong-mang", seamarks: { types: ["light_major"], marks: { 0: [106.5, 10.2, 0] } } },
    { ten: "rong-null", seamarks: null },
    { ten: "mot-gian", seamarks: { types: ["platform"], marks: [[106.5, 10.2, 0]] } }, // có list ⇒ ba tầng RỖNG, không null
  ],
  vnAids: [
    { ten: "day-du", raw: vnAidsBien },
    { ten: "bang-la", raw: vnAidsBangLa },
    { ten: "khong-mark", raw: { types: ["buoy_lateral"], marks: [] } },
    { ten: "rong-null", raw: null },
    { ten: "mang", raw: [1, 2] },
  ],
};
const raBien = {
  moc: truongHop.moc.map((c) => ({ ...c, ra: moc(c.seamarks, c.denBien) })),
  vnAids: truongHop.vnAids.map((c) => ({ ...c, ra: vn(c.raw) })),
};

/* ── ghi ── */
const thuMuc = join(goc, "../shared/src/jvmTest/resources/bao-hieu");
mkdirSync(thuMuc, { recursive: true });
const ghi = (ten, o) => {
  writeFileSync(join(thuMuc, ten), JSON.stringify(o) + "\n");
  console.log(`[sinh-bao-hieu] ${ten}`);
};
/*  MẪU FILE THẬT DẠNG GỌN (chống phình git — CLAUDE.md "Dữ liệu bản đồ trong git"): mỗi feature một bộ
    [...giá trị properties theo thứ tự khoá, lon, lat]; khung GeoJSON (type/geometry/khoá) test tự kiểm. Ca thiếu đèn biển
    chỉ lưu PHẦN THÊM so với ca có đèn (đèn OSM trùng không bị bỏ) — thứ tự gộp theo `i` y vòng lặp web. */
const gon = (fc) => fc && { khoa: Object.keys(fc.features[0]?.properties ?? {}), f: fc.features.map((x) => [...Object.values(x.properties), ...x.geometry.coordinates]) };
const tang = (t) => ({ far: gon(t[0]), mid: gon(t[1]), near: gon(t[2]) });
const them = (co, khong) => {
  const da = new Set((co?.features ?? []).map((x) => x.properties.i));
  return gon({ features: (khong?.features ?? []).filter((x) => !da.has(x.properties.i)) })?.f ?? [];
};
ghi("moc.json", tang(mocThat));
ghi("moc-khong-den-bien.json", { far: them(mocThat[0], mocKhongDen[0]), mid: them(mocThat[1], mocKhongDen[1]), near: them(mocThat[2], mocKhongDen[2]) });
ghi("vn-aids.json", gon(vnThat));
ghi("bien.json", raBien);
const dem = (g) => g?.features.length ?? 0;
console.log(
  `[sinh-bao-hieu] OSM xa ${dem(mocThat[0])} · vừa ${dem(mocThat[1])} · sát ${dem(mocThat[2])} ` +
    `(không đèn biển: xa ${dem(mocKhongDen[0])} · vừa ${dem(mocKhongDen[1])}) · Cục HH ${dem(vnThat)}`,
);
