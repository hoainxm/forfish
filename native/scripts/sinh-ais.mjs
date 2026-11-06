// TÀU AIS + RADAR CPA (đợt 2e, app-map 18 §5) — chạy CHÍNH code web, native KHÔNG viết lại kết quả bằng tay.
//
//   node native/scripts/sinh-ais.mjs
//
// Ra hai thứ:
//  1. FILE KOTLIN SINH (ĐỪNG SỬA TAY):
//     · shared/ais/LopAisSinh.kt — spec các lớp MapLibre AIS (CHÉP Y JSX fishing-map-view.tsx ~8720–8945: Source
//       ais-man / tau-ais / ais-vet / ais-radar / ais-quanh / ais-radar-tau — web viết thẳng trong JSX, không có hằng;
//       sửa ở web thì sửa cả bản chép dưới, script cảnh báo khi id lớp không còn trong JSX) + icon tàu dạng DỮ LIỆU:
//       chạy CHÍNH `dangKyIconTau` (components/ban-do/icon-tau.ts) trên canvas GHI LỆNH giả ⇒ danh sách lệnh vẽ
//       từng ảnh (moveTo/lineTo/arc/stroke…) cho nền tự vẽ lại; + màu/nhãn (MAU_TAU, MAU_MUC, MUC_LABEL, LOAI_TAU).
//     · shared/ais/ChuanTenSinh.kt — bảng `chuanTen` từng ký tự (NFD bỏ dấu, đ→d, hoa, chỉ A-Z0-9) do CHÍNH
//       chuanTen của web chấm trên mọi code point — Kotlin chung không có Normalizer.
//  2. VECTOR VÀNG GỌN: shared/src/jvmTest/resources/ais/{tau,cpa,quanh}.json ⇒ AisVangTest.kt so tuyệt đối.
//     Đầu vào TỰ DỰNG, tất định, giờ GHIM `NOW` (web dùng Date.now()).
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "../../node_modules/jiti/lib/jiti.mjs";

const goc = dirname(fileURLToPath(import.meta.url));
const repo = join(goc, "../..");
globalThis.window = { location: { origin: "https://sdfish.sdvico.vn" } };

/* canvas GHI LỆNH: icon-tau.ts vẽ bằng document.createElement("canvas") — ghi mọi lệnh + mọi thuộc tính đặt */
globalThis.document = {
  createElement() {
    const c = { width: 0, height: 0 };
    c.getContext = () => {
      const lenh = [];
      return new Proxy(
        {},
        {
          get(_, k) {
            if (k === "getImageData") return () => ({ rong: c.width, cao: c.height, lenh });
            return (...a) => lenh.push([k, ...a]);
          },
          set(_, k, v) {
            lenh.push(["dat", k, v]);
            return true;
          },
        },
      );
    };
    return c;
  },
};

const jiti = createJiti(import.meta.url, { alias: { "@": join(repo, "src") } });
const lib = (p) => jiti.import(join(repo, "src", p));
const ta = await lib("lib/tau-ais.ts");
const cpa = await lib("lib/ais-cpa.ts");
const qu = await lib("lib/tau-ais-quanh.ts");
const icon = await lib("components/ban-do/icon-tau.ts");
const om = await lib("lib/ocean-map.ts");
const ch = await lib("lib/tau-ais/chuan-hoa.mjs");

const kt = (o) => JSON.stringify(typeof o === "string" ? o : JSON.stringify(o)).replace(/\$/g, "\\$");
const raNative = join(goc, "../shared/src/commonMain/kotlin/vn/sdvico/forfish/shared/ais");
const raVang = join(goc, "../shared/src/jvmTest/resources/ais");
mkdirSync(raNative, { recursive: true });
mkdirSync(raVang, { recursive: true });

/* ══ 1a. ICON — chạy chính dangKyIconTau ══ */
const anh = [];
icon.dangKyIconTau({ hasImage: () => false, addImage: (ten, img, o) => anh.push({ ten, pixelRatio: o.pixelRatio, ...img }) });

/* ══ 1b. LỚP — CHÉP Y JSX fishing-map-view.tsx (dòng ~8720–8945, origin/main 2026-11-04) ══ */
const ICON_TAU = ["concat", "ais-", ["get", "mk"], "-", ["case", ["==", ["get", "chay"], 1], "chay", "dung"]];
const XOAY = ["case", ["==", ["get", "chay"], 1], ["get", "huong"], 0];
const NHAN_RADAR = { "text-color": "#0b4f63", "text-halo-color": "#ffffff", "text-halo-width": 1.6 };
const NGUON = {
  "ais-man": [{ id: "ais-man", type: "fill", paint: { "fill-color": "#ffffff", "fill-opacity": 0.5 } }],
  // filter theo nhóm (Toàn biển) + icon-opacity khi đang xem vết là ĐỘNG — LopAis.lopTauAis thêm vào
  "tau-ais": [
    {
      id: "tau-ais-dot", type: "symbol",
      layout: { "icon-image": ICON_TAU, "icon-size": icon.CO_ICON_TAU, "icon-rotate": XOAY, "icon-rotation-alignment": "map", "icon-allow-overlap": true, "icon-ignore-placement": true },
      paint: { "icon-opacity": 1 },
    },
  ],
  "ais-vet": [
    { id: "ais-vet-vien", type: "line", filter: ["==", ["get", "k"], "duong"], layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": om.ROUTE_CASING_COLOR, "line-width": 9, "line-opacity": 0.9 } },
    { id: "ais-vet-duong", type: "line", filter: ["==", ["get", "k"], "duong"], layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": om.AIS_VET_COLOR, "line-width": 4.5 } },
    { id: "ais-vet-moc", type: "circle", filter: ["==", ["get", "k"], "moc"], paint: { "circle-radius": 3, "circle-color": om.ROUTE_CASING_COLOR, "circle-stroke-color": om.AIS_VET_COLOR, "circle-stroke-width": 1.5 } },
    {
      id: "ais-vet-hai-dau", type: "circle", filter: ["in", ["get", "k"], ["literal", ["dau", "cuoi"]]],
      paint: { "circle-radius": 8, "circle-color": ["case", ["==", ["get", "k"], "dau"], om.AIS_VET_DAU_COLOR, om.AIS_VET_COLOR], "circle-stroke-color": om.ROUTE_CASING_COLOR, "circle-stroke-width": 2.5 },
    },
    {
      id: "ais-vet-nhan", type: "symbol", filter: ["in", ["get", "k"], ["literal", ["dau", "cuoi"]]],
      layout: { "text-field": ["get", "nhan"], "text-font": ["Noto Sans Bold"], "text-size": 12, "text-offset": [0, 1.4], "text-anchor": "top", "text-allow-overlap": true },
      paint: { "text-color": ["case", ["==", ["get", "k"], "dau"], om.AIS_VET_DAU_COLOR, om.AIS_VET_COLOR], "text-halo-color": om.ROUTE_CASING_COLOR, "text-halo-width": 2 },
    },
  ],
  "ais-radar": [
    {
      id: "ais-radar-vong", type: "line", filter: ["==", ["get", "kind"], "vong"],
      paint: { "line-color": "#0e7490", "line-width": ["case", ["get", "ngoai"], 1.8, 1.1], "line-opacity": ["case", ["get", "ngoai"], 0.85, 0.6], "line-dasharray": [3, 2] },
    },
    { id: "ais-radar-mui", type: "line", filter: ["==", ["get", "kind"], "mui"], paint: { "line-color": "#0b2f44", "line-width": 1.4, "line-opacity": 0.6, "line-dasharray": [1.5, 1.5] } },
    {
      id: "ais-radar-nhan", type: "symbol", filter: ["==", ["get", "kind"], "nhan"],
      layout: { "text-field": ["get", "nhan"], "text-font": ["Noto Sans Bold"], "text-size": 11, "text-anchor": "bottom", "text-offset": [0, -0.2], "text-allow-overlap": true },
      paint: NHAN_RADAR,
    },
  ],
  "ais-quanh": [
    { id: "ais-quanh-vong", type: "line", filter: ["==", ["get", "kind"], "vong"], paint: { "line-color": "#0e7490", "line-width": 1.8, "line-opacity": 0.85 } },
    {
      id: "ais-quanh-nhan", type: "symbol", filter: ["==", ["get", "kind"], "nhan"],
      layout: { "text-field": ["get", "nhan"], "text-font": ["Noto Sans Bold"], "text-size": 11, "text-anchor": "bottom", "text-offset": [0, -0.2], "text-allow-overlap": true },
      paint: NHAN_RADAR,
    },
    {
      id: "ais-quanh-tau", type: "symbol", filter: ["==", ["get", "kind"], "tau"],
      layout: {
        "icon-image": ICON_TAU, "icon-size": ["case", ["==", ["get", "chon"], 1], 1.15, 0.9], "icon-rotate": XOAY, "icon-rotation-alignment": "map",
        "icon-allow-overlap": true, "icon-ignore-placement": true, "symbol-sort-key": ["case", ["==", ["get", "chon"], 1], 2, ["==", ["get", "o"], 1], 1, 0],
      },
      paint: { "icon-opacity": ["case", ["any", ["==", ["get", "o"], 1], ["==", ["get", "chon"], 1]], 1, 0.45] },
    },
    { id: "ais-quanh-chon", type: "symbol", filter: ["all", ["==", ["get", "kind"], "tau"], ["==", ["get", "chon"], 1]], layout: { "icon-image": "ais-chon", "icon-allow-overlap": true, "icon-ignore-placement": true } },
    {
      id: "ais-quanh-tau-nhan", type: "symbol", filter: ["==", ["get", "kind"], "tau"],
      layout: { "text-field": ["get", "nhan"], "text-font": ["Noto Sans Bold"], "text-size": 10, "text-anchor": "left", "text-offset": [0.8, 0], "symbol-sort-key": ["case", ["==", ["get", "chon"], 1], 0, ["==", ["get", "o"], 1], 1, 2] },
      paint: NHAN_RADAR,
    },
  ],
  "ais-radar-tau": [
    { id: "ais-radar-vec", type: "line", filter: ["==", ["get", "kind"], "vec"], paint: { "line-color": ["get", "mau"], "line-width": 1.8, "line-dasharray": [2, 1.5], "line-opacity": ["case", ["==", ["get", "cu"], 1], 0.35, 0.9] } },
    { id: "ais-radar-cpa", type: "line", filter: ["==", ["get", "kind"], "cpa"], paint: { "line-color": ["get", "mau"], "line-width": 1.4, "line-dasharray": [1, 1.2], "line-opacity": 0.9 } },
    {
      id: "ais-radar-cpa-nhan", type: "symbol", filter: ["==", ["get", "kind"], "cpa-nhan"],
      layout: { "text-field": ["get", "nhan"], "text-font": ["Noto Sans Bold"], "text-size": 11, "text-offset": [0, -0.9], "text-allow-overlap": true },
      paint: { "text-color": ["get", "mau"], "text-halo-color": "#ffffff", "text-halo-width": 1.8 },
    },
    {
      id: "ais-radar-quang", type: "circle", filter: ["all", ["==", ["get", "kind"], "tau"], ["in", ["get", "muc"], ["literal", ["nguy", "canh"]]]],
      paint: { "circle-radius": 13, "circle-color": ["get", "mau"], "circle-opacity": 0.18, "circle-stroke-color": ["get", "mau"], "circle-stroke-width": 1.2, "circle-stroke-opacity": 0.7 },
    },
    {
      id: "ais-radar-dot", type: "symbol", filter: ["==", ["get", "kind"], "tau"],
      layout: { "icon-image": ICON_TAU, "icon-size": ["case", ["==", ["get", "chon"], 1], 1.15, 0.9], "icon-rotate": XOAY, "icon-rotation-alignment": "map", "icon-allow-overlap": true, "icon-ignore-placement": true },
      paint: { "icon-opacity": ["case", ["==", ["get", "cu"], 1], 0.45, 1] },
    },
    { id: "ais-radar-chon", type: "symbol", filter: ["all", ["==", ["get", "kind"], "tau"], ["==", ["get", "chon"], 1]], layout: { "icon-image": "ais-chon", "icon-allow-overlap": true, "icon-ignore-placement": true } },
  ],
};
// soát bản chép còn khớp JSX: mọi id lớp/nguồn còn trong fishing-map-view.tsx
const jsx = readFileSync(join(repo, "src/components/fishing-map-view.tsx"), "utf8");
for (const [src, lops] of Object.entries(NGUON)) {
  if (!jsx.includes(`<Source id="${src}"`)) console.warn(`⚠ Source "${src}" không còn trong fishing-map-view.tsx — chép lại`);
  for (const l of lops) if (!jsx.includes(`id="${l.id}"`)) console.warn(`⚠ lớp "${l.id}" không còn trong fishing-map-view.tsx — chép lại`);
}
const AIS_MAN_GEO = { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [[[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]]] } };
if (!jsx.includes("[[[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]]]")) console.warn("⚠ AIS_MAN_GEO đã đổi — chép lại");

writeFileSync(
  join(raNative, "LopAisSinh.kt"),
  `// SINH TỰ ĐỘNG bởi native/scripts/sinh-ais.mjs từ src/components/fishing-map-view.tsx (JSX lớp AIS), icon-tau.ts,
// tau-ais.ts, ais-cpa.ts, tau-ais/chuan-hoa.mjs — ĐỪNG SỬA TAY.
package vn.sdvico.forfish.shared.ais

internal object LopAisSinh {
    /** thứ tự Source trên bản đồ (vẽ SAU CÙNG, trên mọi lớp hải đồ) ⇒ mảng lớp MapLibre (JSON) */
    val NGUON: List<Pair<String, String>> = listOf(
${Object.entries(NGUON).map(([k, v]) => `        ${kt(k)} to ${kt(v)},`).join("\n")}
    )
    const val AIS_MAN_GEO = ${kt(AIS_MAN_GEO)}
    /** ảnh icon: [{ten, pixelRatio, rong, cao, lenh:[[lệnh, …tham số]]}] — lệnh Canvas 2D y icon-tau.ts */
    const val ICON = ${kt(anh)}
    val MAU_TAU: Map<String, String> = mapOf(${Object.entries(ta.MAU_TAU).map(([k, v]) => `${kt(k)} to ${kt(v)}`).join(", ")})
    val MAU_MUC: Map<String, String> = mapOf(${Object.entries(cpa.MAU_MUC).map(([k, v]) => `${kt(k)} to ${kt(v)}`).join(", ")})
    val MUC_LABEL: Map<String, String> = mapOf(${Object.entries(cpa.MUC_LABEL).map(([k, v]) => `${kt(k)} to ${kt(v)}`).join(", ")})
    val LOAI_TAU: Map<Int, String> = mapOf(${Object.entries(ch.LOAI_TAU).map(([k, v]) => `${k} to ${kt(v)}`).join(", ")})
}
`,
);

/* ══ 1c. BẢNG chuanTen ══ */
const ASCII = /^[A-Za-z0-9]$/;
const bang = [];
for (let cp = 0; cp <= 0x10ffff; cp++) {
  if (cp >= 0xd800 && cp <= 0xdfff) continue;
  const s = String.fromCodePoint(cp);
  if (ASCII.test(s)) continue;
  const r = ta.chuanTen(s);
  if (r) bang.push([cp, r]);
}
// bảng từng ký tự chỉ đúng nếu chuanTen ghép được theo ký tự — soát trên chuỗi thật + chuỗi trộn
const theoKyTu = (s) => [...s].map((c) => (ASCII.test(c) ? c.toUpperCase() : (bang.find((b) => b[0] === c.codePointAt(0))?.[1] ?? ""))).join("");
for (const s of ["BV-92468 TS", "Đức Long 09", "ẹ́a", "ǅuro ß ﬀ ı Å", "Hải Đăng Ⅻ ＡＢ", "ǟx"]) {
  if (ta.chuanTen(s) !== theoKyTu(s)) throw new Error(`chuanTen không ghép theo ký tự được: ${s}`);
}
/** chuỗi Kotlin: mọi đơn vị UTF-16 ngoài ASCII in được ⇒ \uXXXX */
const esc = (s) => s.split("").map((c) => { const n = c.charCodeAt(0); return n < 0x20 || n > 0x7e || c === '"' || c === "\\" || c === "$" ? "\\u" + n.toString(16).padStart(4, "0") : c; }).join("");
writeFileSync(
  join(raNative, "ChuanTenSinh.kt"),
  `// SINH TỰ ĐỘNG bởi native/scripts/sinh-ais.mjs — chuanTen (tau-ais.ts) của web chấm trên MỌI code point — ĐỪNG SỬA TAY.
package vn.sdvico.forfish.shared.ais

internal object ChuanTenSinh {
    /** code point (ngoài A-Za-z0-9) ⇒ chuỗi A-Z0-9 sau chuanTen; ký tự không có ở đây ⇒ bỏ. ${bang.length} mục. */
    val BANG: Map<Int, String> by lazy {
        val m = HashMap<Int, String>(${bang.length * 2})
        val k = intArrayOf(${bang.map((b) => b[0]).join(",")})
        val v = "${esc(bang.map((b) => b[1]).join("|"))}".split('|')
        for (i in k.indices) m[k[i]] = v[i]
        m
    }
}
`,
);

/* ══ 2. VECTOR VÀNG ══ */
const NOW = Date.parse("2026-11-04T03:00:00Z");
const C = { lat: 10.2, lon: 107.6 };
const r5 = (x) => Math.round(x * 1e5) / 1e5;
/** điểm cách C (đông, bắc) hải lý — ước phẳng, chỉ để dựng đầu vào */
const quanhC = (xNm, yNm, g = C) => ({ lat: r5(g.lat + yNm / 60), lon: r5(g.lon + xNm / (60 * Math.cos((g.lat * Math.PI) / 180))) });

const TEN = ["BV 92468 TS", "BÌNH THUẬN 1234", "Đức Long 09", null, "  KG-90123-TS ", "HẢI ĐĂNG", "Ocean Star", "ĐNa 90777", "QNg-95555-TS", "bv92468", "Tân Cảng 7", "MSC ANNA"];
const LOAI = [2, 7, 8, 6, 4, 0, 1, 3, 9, 5, 2, 2];
const KN = [null, 0, 0.3, 0.5, 4.1, 8.25, 12, 22.7, 0.49, 6, 15.3, 2.05];
const PHUT = [0, 1, 5, 15, 25, 40, 90, 200, 3000, 2, 29, 31];
const tau = [];
for (let i = 0; i < 36; i++) {
  const goc = (i * 37) % 360;
  const nm = 0.3 + ((i * 0.71) % 14);
  const p = quanhC(nm * Math.sin((goc * Math.PI) / 180), nm * Math.cos((goc * Math.PI) / 180));
  const t = {
    id: i % 9 === 4 ? `vq${i}x7` : i % 13 === 7 ? `${"9".repeat(17)}` : String(574000000 + i * 1013),
    ten: TEN[i % TEN.length],
    loai: LOAI[i % LOAI.length],
    co: i % 3 === 0 ? "VN" : i % 3 === 1 ? null : "PA",
    lat: p.lat,
    lon: p.lon,
    kn: KN[i % KN.length],
    huong: i % 5 === 3 ? null : (i * 53) % 360,
    mui: i % 4 === 1 ? null : i % 4 === 2 ? (i * 53 + 7) % 360 : (i * 41) % 360,
    phut: PHUT[i % PHUT.length],
    dai: i % 6 === 0 ? null : i % 6 === 1 ? 0 : 10 + i * 3,
    dich: i % 7 === 0 ? "VUNG TAU" : null,
  };
  if (i % 4 === 0) t.mmsi = 574090158 + i;
  else if (i % 4 === 1) t.mmsi = null;
  if (i % 5 === 0) t.imo = 9829643 + i;
  if (i % 6 === 2) t.hh = "HZAH" + i;
  tau.push(t);
}
// tàu nhắm vào C (CPA): nguy, canh, đã qua, cùng tốc với mình, tin cũ
const them = (id, x, y, kn, huong, phut, loai = 2, ten = null) => tau.push({ id, ten, loai, co: "VN", ...quanhC(x, y), kn, huong, mui: huong, phut, dai: 20, dich: null, mmsi: null });
them("c-nguy", 0.1, 2, 10, 180, 1, 2, "TÀU NGUY");
them("c-canh", 4, 0.8, 9, 270, 2, 7, "TÀU CẢNH");
them("c-qua", 0.2, -1.5, 8, 180, 0, 8);
them("c-cung", 1, -1, 10, 0, 0, 6);
them("c-cu", 0, 3, 12, 180, 45, 2);
them("c-dung", -0.6, 0.4, 0, null, 3, 3);
them("c-xa", 0, 200, 5, 90, 0, 7); // ngoài mọi tầm
tau.push({ id: "bac", ten: "Tàu xa", loai: 7, co: null, lat: 20.5, lon: 107.1, kn: 11, huong: 45, mui: null, phut: 4, dai: 180, dich: "HAI PHONG", mmsi: 412345678, imo: 9123456, hh: "BQXY" });
const ban = { v: 1, luc: "2026-11-04T02:52:00.000Z", soTau: tau.length, tau };

const ghi = (ten, o) => {
  const s = JSON.stringify(o);
  writeFileSync(join(raVang, ten), s);
  console.log(`${ten}: ${(s.length / 1024).toFixed(1)} KB`);
};

/* tau.json */
const VET = [
  [],
  [{ t: NOW / 1000 - 3600, lat: 10.1, lon: 107.5, kn: 3 }],
  Array.from({ length: 5 }, (_, i) => ({ t: NOW / 1000 - (4 - i) * 3600 - 1800, lat: 10 + i * 0.03, lon: 107.4 + i * 0.02, kn: i === 2 ? null : i * 1.5 })),
  Array.from({ length: 31 }, (_, i) => ({ t: Date.parse("2026-10-29T01:00:00Z") / 1000 + i * 3600 * 4, lat: 9.5 + i * 0.01, lon: 106.9 + i * 0.015, kn: 5 })),
  [{ t: Date.parse("2026-10-31T16:59:00Z") / 1000, lat: 9, lon: 106 }, { t: Date.parse("2026-10-31T17:00:00Z") / 1000, lat: 9.1, lon: 106.1, kn: 1 }],
];
const HOI = ["bv", "BV-92468", "92468", "đức", "duc long", "a", "57409", "  574 09", "574000", "hai", "xyz", "tàu", "TS", "9829643", "41234", "  "];
const GAN = [[C.lat, C.lon, 3], [C.lat, C.lon, 0.5], [C.lat + 0.05, C.lon - 0.03, 3], [20.49, 107.11, 3], [15, 110, 3], [C.lat, C.lon, 20]];
ghi("tau.json", {
  now: NOW,
  ban,
  hang: [...LOAI_LIST()].map((l) => [l, ta.loaiTauLabel(l), ta.nhomTau(l)]),
  tuoiNhan: [0, 1, 2, 30, 59, 60, 89, 90, 149, 150, 2849, 2850, 2880, 4319, 4320, 100000].map((p) => [p, ta.tuoiTinLabel(p)]),
  moiTau: tau.map((t) => ({
    id: t.id,
    moTa: ta.moTaTau(t),
    dinhDanh: ta.dinhDanhTau(t),
    tuoi: [ta.tuoiTinPhut(t, ban, NOW), ta.tuoiTinPhut(t, ban, NOW - 3600e3), ta.tuoiTinPhut(t, { luc: "hong" }, NOW)],
    vet: ta.coTheXemVet(t),
    chay: ta.tauDangChay(t),
  })),
  geo: ta.tauGeoJson(ban),
  dem: ta.demTheoNhom(tau),
  chuanTen: ["BV-92468 TS", "Đức Long 09", "  kg 90123 ts", "ǅuro ß ﬀ", "Ⅻ ＡＢ ı Ø Ł", ""].map((s) => [s, ta.chuanTen(s)]),
  tim: [...HOI.map((q) => [q, 6]), ["bv", 1], ["bv", 0], ["Đ", 3]].map(([q, n]) => [q, n, ta.timTau(tau, q, n).map((t) => t.id)]),
  gan: GAN.map(([la, lo, km]) => {
    const g = ta.tauGanDiem(tau, la, lo, km);
    return [la, lo, km, g ? g.tau.id : null, g ? g.km : null];
  }),
  vet: VET.map((d) => ({ diem: d, cau: [ta.cauVet(d, NOW), ta.cauVet(d, NOW + 86400e3 * 3)], geo: ta.vetGeoJson(d) })),
  gioNgay: [0, 1793757600, 1793779199, 1793779200, 1735664400].map((t) => [t, ta.gioNgayVN(t)]),
});
function* LOAI_LIST() {
  yield* [-1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
}

/* cpa.json */
const MINH = [
  { pos: C, speedKmh: 18.52, headingDeg: 0 },
  { pos: C, speedKmh: null, headingDeg: null },
  { pos: C, speedKmh: 5, headingDeg: 90 },
  { pos: C, speedKmh: 0.5, headingDeg: 200 },
  { pos: { lat: 10.25, lon: 107.65 }, speedKmh: 30, headingDeg: 225 },
];
// mục tiêu GỌN: [id, lat, lon, cachNm, phuongVi, cpaNm, tcpaPhut, muc, tuoiPhut, tinCu, cpaMinh, cpaTau]
const mt = (m) => [m.tau.id, m.pos.lat, m.pos.lon, m.cachNm, m.phuongVi, m.cpaNm, m.tcpaPhut, m.muc, m.tuoiPhut, m.tinCu, m.cpaMinh && [m.cpaMinh.lat, m.cpaMinh.lon], m.cpaTau && [m.cpaTau.lat, m.cpaTau.lon]];
// bản GỌN cho radar (14 tàu đầu + tàu nhắm vào C) — đủ mọi nhánh, vector vừa trần dung lượng
const giuCpa = (t, i) => i < 14 || t.id.startsWith("c-");
const banCpa = { ...ban, tau: tau.filter(giuCpa) };
const CA_QUET = [[0, 2, 0], [0, 6, 0], [0, 6, 40], [1, 6, 0], [1, 6, 40], [2, 6, 0], [3, 2, 0], [4, 12, 0]];
const quet = [];
for (const [mi, tam, tre] of CA_QUET) {
  const minh = MINH[mi];
  {
    {
      const now = NOW + tre * 60e3;
      const ds = cpa.quetQuanh(banCpa, minh, tam, now);
      const chon = ds[1]?.tau.id ?? null;
      quet.push({
        minh: mi, tam, now,
        ds: ds.map(mt),
        dem: cpa.demMuc(ds),
        loc: ["tat", "gan", "ca"].map((l) => cpa.locMucTieu(ds, l).map((m) => m.tau.id)),
        tomTat: [cpa.tomTatNguyCo(ds, true, tam), cpa.tomTatNguyCo(ds, false, tam)],
        dong: ds.map((m) => [cpa.dongPhuTau(m, true), cpa.dongPhuTau(m, false), cpa.mauMucTieu(m)]),
        chon,
        geo: tam === 6 && tre === 0 && mi < 2 ? cpa.mucTieuGeoJson(ds, chon) : null,
      });
    }
  }
}
ghi("cpa.json", {
  hang: { KM_PER_NM: cpa.KM_PER_NM, UOC_TOI_DA_PHUT: cpa.UOC_TOI_DA_PHUT, TIN_CU_PHUT: cpa.TIN_CU_PHUT, DUNG_KN: cpa.DUNG_KN, NGUONG: cpa.NGUONG, TAM_RADAR_NM: cpa.TAM_RADAR_NM, VECTOR_PHUT: cpa.VECTOR_PHUT, LAM_MOI_MS: ta.TAU_AIS_LAM_MOI_MS, QUANH_NM: qu.QUANH_NM, QUANH_GIO: qu.QUANH_GIO },
  minh: MINH,
  banCpa: tau.flatMap((t, i) => (giuCpa(t, i) ? [i] : [])), // chỉ số trong ban.tau (id có thể trùng)
  lech: [[C, { lat: 10.3, lon: 107.7 }], [{ lat: 0, lon: 179.9 }, { lat: 0.1, lon: -179.9 }], [{ lat: 0, lon: -179.9 }, { lat: 0, lon: 179.9 }], [{ lat: 89.99, lon: 0 }, { lat: 89.99, lon: 90 }]].map(([a, b]) => [a, b, cpa.lechNm(a, b)]),
  cong: [[C, 3, -4], [{ lat: 89.999, lon: 10 }, 1, 0.06], [{ lat: 0, lon: 0 }, 0, 0]].map(([g, x, y]) => [g, x, y, cpa.congNm(g, x, y)]),
  vanToc: [[null, 90], [0.49, 90], [0.5, 90], [10, null], [10, 0], [10, 90], [7.3, 237]].map(([k, h]) => [k, h, cpa.vanToc(k, h)]),
  cpaTcpa: [[{ x: 0, y: 2 }, { vx: 0, vy: -10 }], [{ x: 1, y: 1 }, { vx: 0, vy: 0 }], [{ x: 3, y: -2 }, { vx: -5, vy: 1 }], [{ x: -1, y: 0.5 }, { vx: -2, vy: 1 }]].map(([r, v]) => [r, v, cpa.cpaTcpa(r, v)]),
  xepMuc: [[0.4, 10, 5, false], [0.5, 20, 5, false], [0.6, 20, 5, false], [1.5, 30, 0.2, false], [1.6, 30, 5, false], [0.1, 5, 5, true], [0.1, -1, 5, false], [null, null, null, false], [null, 5, 0.49, false], [1, 31, 5, false]].map((a) => [a, cpa.xepMuc(...a)]),
  quet,
  nhan: {
    quang: [0, 0.001, 0.2, 0.5, 0.539, 0.54, 1, 2.7, 13.5].map((n) => [n, cpa.quangNgan(n)]),
    hl: [0, 0.004, 0.35, 0.999, 1, 3.25, 12.04, 1234.5].map((n) => [n, cpa.hlLabel(n)]),
    tcpa: [null, -0.1, 0, 0.4, 0.5, 12.6, 59.4, 59.5, 65, 125.2, 1500].map((n) => [n, cpa.tcpaLabel(n)]),
    huong: [0, 22.4, 22.5, 67, 180, 337.5, 359, 720, -45].map((n) => [n, cpa.huongChu(n)]),
  },
  radar: [[C, 6, 30], [{ lat: 21.1, lon: 108.2 }, 2, null]].map(([t, n, h]) => ({ tam: t, nm: n, huong: h, geo: cpa.radarGeoJson(t, n, h), khung: cpa.khungRadar(t, n) })),
});

/* quanh.json */
const tuGiay = Math.floor(NOW / 1000) - qu.QUANH_GIO * 3600;
const g0 = Math.floor(NOW / 1000);
const P = (id, pts) => ({ tau_id: id, diem: pts });
const pt = (dGio, x, y, kn, h) => { const p = quanhC(x, y); return [g0 - dGio * 3600, p.lat, p.lon, kn, h]; };
const VET_QUANH = [
  P(tau[0].id, [pt(5, 1, 1, 3, 90), pt(4, 0.5, 0.5, 3, 90), pt(3, 9, 9, 3, 90)]),
  P("chi-vet-1", [pt(5.5, 2, 2, 0.2, 10), pt(4.5, 2, 1.9, 0.3, null), pt(3.5, 2.1, 1.8, 4, 45)]),
  P("chi-vet-2", [pt(7, 0, 0, 5, 0), pt(2, 5.9, 0, 6, 270)]),
  P("chi-vet-3", [pt(1, 0, 0.2, "7", "123"), [String(g0 - 600), "10.2", "107.61", null, 12], [g0 - 300, 10.21, null, 5, 5], "khong-phai-mang", [g0 - 200, true, 107.6, 1, 1]]),
  P("chi-vet-4", [pt(0.1, 10, 10, 5, 5)]),
  P("c-nguy", [pt(2, 0, 3, 10, 180), pt(1, 0, 2.5, 10, 180)]),
  { tau_id: 123, diem: [pt(1, 0, 0, 1, 1)] },
  { tau_id: "", diem: [pt(1, 0, 0, 1, 1)] },
  { tau_id: "x", diem: "loi" },
  null,
  P("chi-vet-5", [pt(5, 3, 3, 2, 2), pt(2.4, 3, 3.1, 2, 2), pt(1, 3, 3.2, 2, 2)]),
];
const LOC = [qu.LOC_TRONG, { nhom: "ca", o: null }, { nhom: null, o: true }, { nhom: null, o: false }, { nhom: "dau", o: true }, { nhom: "khach", o: false }];
const caQuanh = [];
for (const [ten, opts] of [
  ["day-du", { vet: VET_QUANH, ban, tam: C, tuGiay }],
  ["chi-ban", { vet: [], ban, tam: C, tuGiay }],
  ["khong-ban", { vet: VET_QUANH, ban: null, tam: C, tuGiay }],
  ["ban-luc-hong", { vet: VET_QUANH, ban: { ...ban, luc: "hong" }, tam: C, tuGiay }],
  ["nm-3", { vet: VET_QUANH, ban, tam: C, tuGiay, nm: 3 }],
]) {
  const ds = qu.gopTauQuanh(opts);
  const chon = ds[2]?.id ?? null;
  caQuanh.push({
    ten,
    nm: opts.nm ?? null,
    banNull: opts.ban === null,
    banLucHong: opts.ban?.luc === "hong",
    ds,
    trangThai: ds.map((t) => qu.trangThaiQuanh(t, g0)),
    loc: LOC.map((l) => qu.locTauQuanh(ds, l).map((t) => t.id)),
    demLoc: LOC.map((l) => qu.demLocQuanh(ds, l)),
    tuQuanh: ds.slice(0, 3).map(qu.tauAisTuQuanh),
    chon,
    geo: ten === "day-du" ? qu.quanhGeoJson(C, ds, chon, opts.nm ?? qu.QUANH_NM, g0) : null,
  });
}
// tàu do MÁY CHỦ trả (thiếu dau / oDay / hienTai — bản máy chủ cũ) qua trangThai + geo
const tauMayChu = [
  { id: "m1", ten: "A", loai: 2, co: "VN", mmsi: null, gan: { t: g0 - 7200, lat: 10.21, lon: 107.6, nm: 0.6 }, cuoi: g0 - 3600, conPhat: false },
  { id: "m2", ten: null, loai: 0, co: null, mmsi: 5, gan: { t: g0 - 100, lat: 10.2, lon: 107.62, nm: 1.2, huong: 90 }, cuoi: g0 - 100, dau: g0 - 9000, conPhat: true, oDay: true, hienTai: { lat: 10.2, lon: 107.63, nm: 1.7, huong: null } },
  { id: "m3", ten: "B", loai: 8, co: null, mmsi: null, gan: { t: g0 - 20000, lat: 10.3, lon: 107.6, nm: 5.9, huong: null }, cuoi: g0 - 19000, dau: g0 - 21000, conPhat: false, oDay: false },
];
ghi("quanh.json", {
  now: NOW,
  tuGiay,
  g0,
  // ban = ban của tau.json (không chép lại)
  vet: VET_QUANH,
  tham: [[C, NOW, undefined, undefined], [{ lat: -0.5, lon: 99 }, NOW + 999, 3, 2]].map(([t, n, nm, gio]) => [t, n, nm ?? null, gio ?? null, qu.thamSoQuanh(t, n, nm, gio)]),
  hopLe: [[10, 107], [-1, 98], [-1.01, 98], [26, 123], [26.01, 100], [10, 97.99], [10, 123.01], [NaN, 100]].map(([a, b]) => [Number.isNaN(a) ? null : a, b, qu.tamHopLe(a, b)]),
  cachDay: [0, 60, 14 * 60, 14 * 60 + 29, 15 * 60, 59 * 60, 3599, 3600, 5400, 30000, -500].map((d) => [d, qu.cachDay(g0 - d, g0)]),
  tenNhom: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((l) => [l, qu.tenNhomTau(l)]),
  ca: caQuanh,
  mayChu: { tau: tauMayChu, trangThai: tauMayChu.map((t) => qu.trangThaiQuanh(t, g0)), geo: qu.quanhGeoJson(C, tauMayChu, "m3", 6, g0) },
});
