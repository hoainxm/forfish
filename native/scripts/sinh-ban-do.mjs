// SINH STYLE BẢN ĐỒ TỪ CODE WEB (app-map 18 §3d, đợt 2a) — native KHÔNG viết lại style.
//
//   node native/scripts/sinh-ban-do.mjs
//
// · KIEU_NEN / KIEU_NEN_HAI_DO = `buildMapStyle(null | "bathymetry", {seamarks:false})` của src/lib/ocean-map.ts
//   (nền Protomaps light đã lọc + sea-mask + base-top; bản hải đồ thêm raster + đẳng sâu).
// · LOP = các hằng lớp xuất sẵn của ocean-map.ts (độ sâu, đường độ sâu, đèn biển, xác tàu, trạm con nước).
// · LOP_DAO = lớp đảo CHÉP Y JSX của fishing-map-view.tsx (Source "islands") — web viết thẳng trong JSX, không có hằng.
//   Sửa ở web thì sửa cả đây (script in cảnh báo nếu màu đảo đổi).
// · CHU_QUYEN = SOVEREIGNTY_LABELS (Hoàng Sa, Trường Sa…) dạng GeoJSON điểm.
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "../../node_modules/jiti/lib/jiti.mjs";

const goc = dirname(fileURLToPath(import.meta.url));
const repo = join(goc, "../..");
globalThis.window = { location: { origin: "https://sdfish.sdvico.vn" } };
const jiti = createJiti(import.meta.url, { alias: { "@": join(repo, "src") } });
const om = await jiti.import(join(repo, "src/lib/ocean-map.ts"));

const kt = (o) => JSON.stringify(typeof o === "string" ? o : JSON.stringify(o)).replace(/\$/g, "\\$");
const LOP_XUAT = ["SOUNDING_DOT_LAYER", "SOUNDING_LABEL_LAYER", "DEPTH_LINE_LAYER", "LIGHTHOUSE_LAYER", "LIGHTHOUSE_LABEL_LAYER", "WRECK_LAYER", "TIDE_STATION_LAYER", "TIDE_STATION_LABEL_LAYER"];

const lopDao = [
  {
    id: "island-dot", type: "circle",
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 4, 1.4, 9, 3.4],
      "circle-color": om.ISLAND_DOT_COLOR, "circle-stroke-color": "#ffffff", "circle-stroke-width": 1, "circle-opacity": 0.9,
    },
  },
  {
    id: "island-label", type: "symbol",
    layout: {
      "text-field": ["get", "name"], "text-font": ["Noto Sans Bold"],
      "text-size": ["interpolate", ["linear"], ["zoom"], 4.5, 10, 7, 12.5, 10, 15],
      "text-anchor": "top", "text-offset": [0, 0.55], "text-padding": 2,
      "symbol-sort-key": ["get", "rank"], "text-allow-overlap": false, "text-optional": true,
    },
    paint: { "text-color": om.ISLAND_LABEL_COLOR, "text-halo-color": "#ffffff", "text-halo-width": 1.5 },
  },
];

const chuQuyen = {
  type: "FeatureCollection",
  features: om.SOVEREIGNTY_LABELS.map((s) => ({
    type: "Feature",
    geometry: { type: "Point", coordinates: [s.lng, s.lat] },
    properties: { ten: s.name, phu: s.sub ?? "", bien: s.kind === "sea" ? 1 : 0 },
  })),
};

const ra = join(goc, "../shared/src/commonMain/kotlin/vn/sdvico/forfish/shared/bando/BanDoSinh.kt");
mkdirSync(dirname(ra), { recursive: true });
writeFileSync(ra, `// SINH TỰ ĐỘNG bởi native/scripts/sinh-ban-do.mjs từ src/lib/ocean-map.ts — ĐỪNG SỬA TAY.
package vn.sdvico.forfish.shared.bando

/** Style + lớp bản đồ của web dạng JSON (MapLibre style spec). */
internal object BanDoSinh {
    const val KIEU_NEN = ${kt(om.buildMapStyle(null, { seamarks: false }))}
    const val KIEU_NEN_HAI_DO = ${kt(om.buildMapStyle("bathymetry", { seamarks: false }))}
    /** = SEA_MASK_COLOR */
    const val MAU_BIEN = ${kt(om.SEA_MASK_COLOR)}
    /** = OFFLINE_COAST_BEFORE_ID — mốc chèn giữa nhóm nền và nhóm nội dung */
    const val MOC_CHEN = "base-top"
    val LOP: Map<String, String> = mapOf(
${LOP_XUAT.map((k) => `        ${kt(k)} to ${kt(om[k])},`).join("\n")}
    )
    const val LOP_DAO = ${kt(lopDao)}
    const val CHU_QUYEN = ${kt(chuQuyen)}
}
`);
console.log(`[sinh-ban-do] ${ra}`);
