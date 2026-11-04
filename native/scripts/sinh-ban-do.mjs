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
const jiti = createJiti(import.meta.url, { alias: { "@": join(repo, "src") }, jsx: true });
const om = await jiti.import(join(repo, "src/lib/ocean-map.ts"));
const cs = await jiti.import(join(repo, "src/lib/chart-symbols.ts"));
globalThis.React = (await import("react")).default; // ban-do/hai-do.tsx trả <Layer> — chỉ đọc props
const hd = await jiti.import(join(repo, "src/components/ban-do/hai-do.tsx"));
const cd = await jiti.import(join(repo, "src/lib/chat-day.ts"));
const ob = await jiti.import(join(repo, "src/lib/offline-basemap.ts"));
const { TEN_GOI } = await jiti.import(join(repo, "src/lib/labels.ts"));
const { SDVICO_HOTLINE, SDVICO_HOTLINE_DISPLAY } = await jiti.import(join(repo, "src/data/sdvico-showcase.ts"));

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

// LOP_TRAM = bốn <Layer> của Source "tram-trieu" CHÉP Y JSX fishing-map-view.tsx (~8248): trạm vùng từ z5, trạm cảng
// từ TIDE_STATION_CANG_MINZOOM — cùng TIDE_STATION_LAYER / _LABEL_LAYER của ocean-map.
const lopTram = [
  { ...om.TIDE_STATION_LAYER, filter: om.TIDE_FILTER_VUNG },
  { ...om.TIDE_STATION_LAYER, id: "tram-trieu-dot-cang", minzoom: om.TIDE_STATION_CANG_MINZOOM, filter: om.TIDE_FILTER_CANG },
  { ...om.TIDE_STATION_LABEL_LAYER, filter: om.TIDE_FILTER_VUNG },
  { ...om.TIDE_STATION_LABEL_LAYER, id: "tram-trieu-ten-cang", minzoom: om.TIDE_STATION_CANG_MINZOOM, filter: om.TIDE_FILTER_CANG },
];

// TEP_TINH = glyph + sprite mà service worker web giữ sẵn cho offline (public/sw.js) — native tải về file trong máy
// (kho ambient của MapLibre không bảo đảm giữ: đo 2026-11-04, không với tới glyph là MẤT MỌI NHÃN, kể cả chủ quyền).
const sw = (await import("node:fs")).readFileSync(join(repo, "public/sw.js"), "utf8");
const tepTinh = [...new Set([...sw.matchAll(/"(\/(?:fonts\/[^"]+\.pbf|icons\/chart-sprite[^"]*))"/g)].map((m) => m[1]))];
if (!tepTinh.some((d) => d.startsWith("/fonts/")) || !tepTinh.some((d) => d.includes("chart-sprite@2x.json"))) throw new Error("sw.js không còn danh sách glyph/sprite — sửa script");

const chuQuyen = {
  type: "FeatureCollection",
  features: om.SOVEREIGNTY_LABELS.map((s) => ({
    type: "Feature",
    geometry: { type: "Point", coordinates: [s.lng, s.lat] },
    properties: { ten: s.name, phu: s.sub ?? "", bien: s.kind === "sea" ? 1 : 0 },
  })),
};


/* ── ĐỢT 2b: LỚP HẢI ĐỒ CÒN LẠI — CHÉP Y JSX fishing-map-view.tsx (origin/main 2026-11-04), hằng lấy từ ocean-map /
   chart-symbols / ban-do/hai-do (đổi hằng ở web ⇒ chạy lại script là theo). Mỗi nhóm = một <Source>, theo THỨ TỰ JSX.
   `dk` = điều kiện hiện của web (bỏ vế !anyExclusiveOverlay — lớp động chưa có ở native):
     vungLong = prefs.vungLong · vungQuanLy = prefs.vungQuanLy · tramTrieu = prefs.tideStations ·
     nav/sau/ten = chartDetailOn && group{Nav|Depth|Name}On.
   `tep` = khoá file trong KieuBanDo.Tep. `cum` = cluster của <Source>. `moc` = nhóm đã có từ 2a (giữ chỗ thứ tự).
   Sửa JSX ở web thì sửa cả đây. ── */
const ICON = cs.CHART_FEATURE_ICON, SZ = cs.CHART_ICON_SIZE;
const iconDiem = (img, anchor = "center") => ({ "icon-image": img, "icon-size": SZ, "icon-allow-overlap": true, "icon-ignore-placement": true, "icon-anchor": anchor });
const iconRan = ["match", ["get", "type"], "da", ICON.rockAwash, "ran", ICON.coralReef, ICON.bank];
const nhanRan = (extra) => ({ "text-field": ["get", "name"], "text-font": ["Noto Sans Bold"], ...extra, "text-anchor": "top", "text-offset": [0, 0.55], "text-padding": 2, "symbol-sort-key": ["get", "rank"], "text-allow-overlap": false, "text-optional": true });
const paintRan = { "text-color": om.REEF_LABEL_COLOR, "text-halo-color": "#ffffff", "text-halo-width": 1.5 };
const cumProps = (id, z) => hd.cumLayers(id, z, false).map((e) => ({ ...e.props }));
const VQ = om.VUNG_QUAN_LY_FILL_OPACITY, VL = om.VUNG_QUAN_LY_LINE_OPACITY;
const nhom2b = [
  { nguon: "vung-long", dk: "vungLong", tep: "vungLong", lops: [
    { id: "vung-long-fill", type: "fill", paint: { "fill-color": "#ea580c", "fill-opacity": 0.06 } },
    { id: "vung-long-line", type: "line", paint: { "line-color": "#ea580c", "line-width": 2, "line-dasharray": [3, 2], "line-opacity": 0.95 } },
  ] },
  { nguon: "vung-quan-ly", dk: "vungQuanLy", tep: "vungQuanLy", lops: [
    { id: "vung-quan-ly-fill", type: "fill", minzoom: om.VUNG_QUAN_LY_MINZOOM, paint: { "fill-color": om.RESTRICTED_FILL_COLOR, "fill-opacity": ["match", ["get", "dang"], "dang-cam", VQ["dang-cam"], "hieu-luc", VQ["hieu-luc"], "ngoai-mua", VQ["ngoai-mua"], VQ["quy-hoach"]] } },
    { id: "vung-quan-ly-line-lien", type: "line", minzoom: om.VUNG_QUAN_LY_MINZOOM, filter: ["==", ["get", "dang"], "hieu-luc"], layout: { "line-join": "round" }, paint: { "line-color": om.SEA_RESTRICTED_COLOR, "line-width": 2, "line-opacity": VL["hieu-luc"] } },
    { id: "vung-quan-ly-line-dut", type: "line", minzoom: om.VUNG_QUAN_LY_MINZOOM, filter: ["any", ["==", ["get", "dang"], "dang-cam"], ["==", ["get", "dang"], "ngoai-mua"]], layout: { "line-join": "round" }, paint: { "line-color": om.SEA_RESTRICTED_COLOR, "line-width": ["match", ["get", "dang"], "dang-cam", 2.4, 1.4], "line-dasharray": [3, 2], "line-opacity": ["match", ["get", "dang"], "dang-cam", VL["dang-cam"], VL["ngoai-mua"]] } },
    { id: "vung-quan-ly-line-cham", type: "line", minzoom: om.VUNG_QUAN_LY_MINZOOM, filter: ["==", ["get", "dang"], "quy-hoach"], layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": om.SEA_RESTRICTED_COLOR, "line-width": 1.6, "line-dasharray": [0.6, 1.8], "line-opacity": VL["quy-hoach"] } },
  ] },
  { nguon: "vung-quan-ly-diem", dk: "vungQuanLy", tep: "vungQuanLyDiem", lops: [
    { id: "vung-quan-ly-dot", type: "circle", minzoom: om.VUNG_QUAN_LY_DIEM_MINZOOM, filter: ["==", ["get", "diem"], true], paint: { "circle-radius": 6, "circle-color": om.RESTRICTED_FILL_COLOR, "circle-opacity": 0.25, "circle-stroke-color": om.SEA_RESTRICTED_COLOR, "circle-stroke-width": 1.6 } },
    { id: "vung-quan-ly-label", type: "symbol", minzoom: om.VUNG_QUAN_LY_LABEL_MINZOOM, filter: ["!=", ["get", "diem"], true], layout: { "text-field": ["get", "ten"], "text-font": ["Noto Sans Bold"], "text-size": 13, "text-max-width": 9, "text-allow-overlap": false, "text-optional": true }, paint: { "text-color": om.RESTRICTED_LABEL_COLOR, "text-halo-color": "#ffffff", "text-halo-width": 1.4, "text-opacity": ["match", ["get", "dang"], "ngoai-mua", 0.7, 1] } },
    { id: "vung-quan-ly-label-diem", type: "symbol", minzoom: om.VUNG_QUAN_LY_DIEM_MINZOOM, filter: ["==", ["get", "diem"], true], layout: { "text-field": ["get", "ten"], "text-font": ["Noto Sans Bold"], "text-size": 12, "text-max-width": 9, "text-offset": [0, 1.1], "text-anchor": "top", "text-allow-overlap": false, "text-optional": true }, paint: { "text-color": om.RESTRICTED_LABEL_COLOR, "text-halo-color": "#ffffff", "text-halo-width": 1.4 } },
  ] },
  // LƯỚI TOẠ ĐỘ — CHÉP Y mapGridGeo (fishing-map-view ~2173) + MAP_GRID_BOUNDS/STEP (~674, không export): dữ liệu tĩnh ⇒ nhúng thẳng.
  { nguon: "map-grid", dk: "mapGrid", data: (() => {
    const [lonMin, lonMax, latMin, latMax] = [102, 119, 4, 24], buoc = 1, f = [];
    for (let lon = lonMin; lon <= lonMax; lon += buoc) f.push({ type: "Feature", properties: { deg: `${lon}°E` }, geometry: { type: "LineString", coordinates: [[lon, latMin], [lon, latMax]] } });
    for (let lat = latMin; lat <= latMax; lat += buoc) f.push({ type: "Feature", properties: { deg: `${lat}°N` }, geometry: { type: "LineString", coordinates: [[lonMin, lat], [lonMax, lat]] } });
    return { type: "FeatureCollection", features: f };
  })(), lops: [
    { id: "map-grid-line", type: "line", paint: { "line-color": "#334155", "line-width": 0.5, "line-opacity": 0.35 } },
    { id: "map-grid-label", type: "symbol", minzoom: om.CHART_TIER.LUON, layout: { "text-field": ["get", "deg"], "text-font": ["Noto Sans Bold"], "text-size": 11, "symbol-placement": "line", "text-allow-overlap": false }, paint: { "text-color": "#334155", "text-halo-color": "#ffffff", "text-halo-width": 1.2, "text-opacity": 0.7 } },
  ] },
  // ĐỢT 2d — BỜ + ĐẤT nổi TRÊN lớp màu khi bật lớp động (JSX ~7287, `anyExclusiveOverlay`). Lớp màu + mũi tên native
  // chèn NGAY DƯỚI `overlay-coast-fill` (= beforeId của lớp GL web).
  { nguon: "overlay-coast", dk: "dong", tep: "bo", lops: [
    { id: "overlay-coast-fill", type: "fill", paint: { "fill-color": ob.OFFLINE_LAND_COLOR, "fill-opacity": 0.9 } },
    { id: "overlay-coast-line", type: "line", paint: { "line-color": ob.OFFLINE_COAST_COLOR, "line-width": 1.2 } },
  ] },
  { nguon: "sea-lanes", dk: "nav", tep: "luongBien", lops: [
    { id: "sea-lane-vungcam-fill", type: "fill", minzoom: om.SEA_RESTRICTED_MINZOOM, filter: ["all", ["==", ["get", "kind"], "vungcam"], ["!=", ["get", "hoDang"], true]], paint: { "fill-color": om.RESTRICTED_FILL_COLOR, "fill-opacity": om.RESTRICTED_FILL_OPACITY } },
    { id: "sea-lane-cap", type: "line", minzoom: om.SEA_CABLE_MINZOOM, filter: ["==", ["get", "kind"], "cap"], layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": om.SEA_CABLE_COLOR, "line-width": 1.4, "line-dasharray": [...om.SEA_CABLE_DASH], "line-opacity": om.SEA_CABLE_OPACITY } },
    { id: "sea-lane-ong", type: "line", minzoom: om.SEA_PIPELINE_MINZOOM, filter: ["==", ["get", "kind"], "ong"], layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": om.PIPELINE_COLOR, "line-width": 2, "line-dasharray": [...om.PIPELINE_DASH], "line-opacity": om.PIPELINE_OPACITY } },
    { id: "sea-lane-ong-mark", type: "symbol", minzoom: om.SEA_PIPELINE_MINZOOM, filter: ["==", ["get", "kind"], "ong"], layout: { "symbol-placement": "line", "symbol-spacing": 140, "icon-image": ICON.pipelineMark, "icon-size": SZ, "icon-allow-overlap": true, "icon-ignore-placement": true } },
    { id: "sea-lane-cap-bo", type: "symbol", minzoom: om.CABLE_LANDING_MINZOOM, filter: ["==", ["get", "kind"], "cap-bo"], layout: iconDiem(ICON.cableLanding, "bottom") },
    { id: "sea-lane-vungcam", type: "line", minzoom: om.SEA_RESTRICTED_MINZOOM, filter: ["==", ["get", "kind"], "vungcam"], layout: { "line-join": "round" }, paint: { "line-color": om.SEA_RESTRICTED_COLOR, "line-width": 1.6, "line-dasharray": [2, 2], "line-opacity": om.SEA_RESTRICTED_OPACITY } },
    { id: "sea-lane-vungcam-label", type: "symbol", minzoom: om.SEA_RESTRICTED_MINZOOM, filter: ["all", ["==", ["get", "kind"], "vungcam"], ["!=", ["get", "hoDang"], true]], layout: { "text-field": ["get", "ten"], "text-font": ["Noto Sans Bold"], "text-size": 13, "text-max-width": 9, "text-allow-overlap": false, "text-optional": true }, paint: { "text-color": om.RESTRICTED_LABEL_COLOR, "text-halo-color": "#ffffff", "text-halo-width": 1.4 } },
    { id: "sea-lane-camneo", type: "symbol", minzoom: om.SEA_RESTRICTED_MINZOOM, filter: ["all", ["==", ["get", "loai"], "cam-neo"], ["!=", ["get", "hoDang"], true]], layout: iconDiem(ICON.noAnchor) },
    { id: "sea-lane-osm", type: "line", minzoom: om.SEA_FAIRWAY_MINZOOM, filter: ["match", ["get", "kind"], ["luong", "phanluong"], true, false], layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": om.SEA_LANE_COLOR, "line-width": 1.4, "line-dasharray": [1.5, 1.5], "line-opacity": 0.7 } },
    { id: "sea-lane-tss-arrow", type: "symbol", minzoom: om.SEA_FAIRWAY_MINZOOM, filter: ["all", ["==", ["get", "kind"], "phanluong"], ["==", ["get", "pl"], "lane"]], layout: { "symbol-placement": "line", "symbol-spacing": 160, "icon-image": ICON.tssArrow, "icon-size": SZ, "icon-rotation-alignment": "map", "icon-keep-upright": false } },
    { id: "sea-lane-tuyen", type: "line", filter: ["==", ["get", "kind"], "tuyen"], layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": om.SEA_LANE_COLOR, "line-width": ["interpolate", ["linear"], ["zoom"], 4, 1.6, 9, 2.6], "line-dasharray": [3, 2], "line-opacity": 0.8 } },
    { id: "sea-lane-gian", type: "symbol", minzoom: om.RIG_MINZOOM, filter: ["==", ["get", "kind"], "giankhoan"], layout: iconDiem("platform") },
    { id: "sea-lane-label", type: "symbol", minzoom: om.CHART_TIER.LUON, filter: ["==", ["get", "kind"], "tuyen"], layout: { "symbol-placement": "line", "text-field": ["get", "ten"], "text-font": ["Noto Sans Regular"], "text-size": 11, "symbol-spacing": 500, "text-allow-overlap": false }, paint: { "text-color": om.SEA_LANE_COLOR, "text-halo-color": "#ffffff", "text-halo-width": 1.4 } },
  ] },
  { nguon: "dia-danh-ngam", dk: "ten", tep: "diaDanhNgam", lops: [
    { id: "dia-danh-ngam-label", type: "symbol", minzoom: om.DIA_DANH_NGAM_MINZOOM, layout: {
      "icon-image": ["match", ["get", "loai"], ["nui", "day"], ICON.seamount, "doi", ICON.knoll, "song", ICON.ridge, "guyot", ICON.guyot, "ho", ICON.deep, ["thunglung", "hem", "kenh"], ICON.valley, ["vach", "doc", "deo"], ICON.escarpment, "baivenbo", ICON.bank, ICON.knoll],
      "icon-size": SZ, "icon-anchor": "bottom", "icon-allow-overlap": false, "icon-optional": true,
      "text-field": ["get", "ten"], "text-font": ["Noto Sans Regular"], "text-size": ["interpolate", ["linear"], ["zoom"], 5, 11, 8, 12, 11, 13],
      "text-anchor": "top", "text-offset": [0, 0.3], "text-padding": 3, "text-allow-overlap": false, "text-optional": true, "text-max-width": 8 },
      paint: { "text-color": om.REEF_LABEL_COLOR, "text-halo-color": "#ffffff", "text-halo-width": 1.4 } },
  ] },
  { nguon: "dao", moc: true, dk: "dao" }, // đảo ẩn khi bật lớp động (`!anyExclusiveOverlay`)
  // ĐỢT 2c — hình rạn (Allen Coral Atlas) + chất đáy: pmtiles vector, CẦN GÓI (`!premiumLocked`), nhóm Độ sâu.
  { nguon: "reef-shapes", dk: "sauGoi", tep: "ranGoi", vector: true, lops: [
    { id: "reef-fill", type: "fill", "source-layer": "reef", paint: { "fill-color": om.REEF_SHAPE_FILL, "fill-opacity": om.REEF_SHAPE_FILL_OPACITY } },
    { id: "reef-outline", type: "line", "source-layer": "reef", paint: { "line-color": om.REEF_SHAPE_LINE, "line-width": ["interpolate", ["linear"], ["zoom"], 6, 0.5, 11, 1.4], "line-opacity": om.REEF_SHAPE_LINE_OPACITY } },
  ] },
  { nguon: "chat-day", dk: "sauGoi", tep: "chatDay", vector: true, lops: [
    { id: "chat-day-dot", type: "circle", "source-layer": "chat-day", minzoom: om.CHAT_DAY_MINZOOM, paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, 1.1, 12, 3],
      "circle-color": ["match", ["get", "ma"], "S", om.CHAT_DAY_COLORS.S, "R", om.CHAT_DAY_COLORS.R, "Co", om.CHAT_DAY_COLORS.Co, "G", om.CHAT_DAY_COLORS.G, "Sg", om.CHAT_DAY_COLORS.Sg, "Ma", om.CHAT_DAY_COLORS.Ma, om.CHAT_DAY_COLORS.khac],
      "circle-opacity": om.CHAT_DAY_OPACITY } },
    { id: "chat-day-chu", type: "symbol", "source-layer": "chat-day", minzoom: om.CHAT_DAY_TEXT_MINZOOM, filter: ["!=", ["get", "ma"], "khac"], layout: {
      "text-field": ["match", ["get", "ma"], "S", cd.CHAT_DAY_LABEL.S, "R", cd.CHAT_DAY_LABEL.R, "Co", cd.CHAT_DAY_LABEL.Co, "G", "Đá vụn", "Sg", cd.CHAT_DAY_LABEL.Sg, "Ma", "Rong tảo", ""],
      "text-font": ["Noto Sans Regular"], "text-size": 11, "text-offset": [0, 0.9], "text-padding": 48, "text-allow-overlap": false, "text-optional": true },
      paint: { "text-color": om.CHAT_DAY_TEXT_COLOR, "text-halo-color": "#ffffff", "text-halo-width": 1.2 } },
  ] },
  { nguon: "duong-do-sau", moc: true, dk: "sau" },
  { nguon: "do-sau", moc: true, dk: "sau" },
  { nguon: "reef-hazards", dk: "nav", tep: "hiemHoa", lops: [
    { id: "reef-hazard", type: "symbol", minzoom: om.REEF_HAZARD_MINZOOM, filter: ["match", ["get", "kind"], ["rock", "wreck"], true, false], layout: iconDiem(["match", ["get", "kind"], "wreck", "wreck", ICON.rockAwash]) },
  ] },
  { nguon: "seamarks-far", dk: "nav", tep: "baoHieuXa", lops: [{ id: "seamark-far", type: "symbol", minzoom: om.SEAMARK_TIER_MINZOOM.far, layout: hd.SEAMARK_ICON_LAYOUT }] },
  { nguon: "seamarks-mid", dk: "nav", tep: "baoHieuVua", cum: { radius: om.SEAMARK_CLUSTER_RADIUS, maxzoom: om.SEAMARK_CLUSTER_MAXZOOM.mid }, lops: [
    { id: "seamark-mid", type: "symbol", minzoom: om.SEAMARK_TIER_MINZOOM.mid, filter: hd.KHONG_PHAI_CUM, layout: hd.SEAMARK_ICON_LAYOUT }, ...cumProps("seamark-mid", om.SEAMARK_TIER_MINZOOM.mid)] },
  { nguon: "seamarks-near", dk: "nav", tep: "baoHieuGan", cum: { radius: om.SEAMARK_CLUSTER_RADIUS, maxzoom: om.SEAMARK_CLUSTER_MAXZOOM.near }, lops: [
    { id: "seamark-near", type: "symbol", minzoom: om.SEAMARK_TIER_MINZOOM.near, filter: hd.KHONG_PHAI_CUM, layout: hd.SEAMARK_ICON_LAYOUT }, ...cumProps("seamark-near", om.SEAMARK_TIER_MINZOOM.near)] },
  { nguon: "reefs", dk: "sau", tep: "ran", lops: [
    { id: "reef-dot", type: "symbol", minzoom: om.REEF_OFFSHORE_MINZOOM, filter: ["!=", ["get", "group"], "ven-bo"], layout: iconDiem(iconRan) },
    { id: "reef-dot-venbo", type: "symbol", minzoom: om.REEF_VENBO_MINZOOM, filter: ["==", ["get", "group"], "ven-bo"], layout: iconDiem(iconRan) },
    { id: "reef-label", type: "symbol", filter: ["!=", ["get", "group"], "ven-bo"], layout: nhanRan({ "text-size": ["interpolate", ["linear"], ["zoom"], 4.5, 10, 7, 12.5, 10, 15] }), paint: paintRan },
    { id: "reef-label-venbo", type: "symbol", minzoom: om.REEF_VENBO_MINZOOM, filter: ["==", ["get", "group"], "ven-bo"], layout: nhanRan({ "text-size": ["interpolate", ["linear"], ["zoom"], 8, 11, 11, 13] }), paint: paintRan },
  ] },
  { nguon: "vn-aids", dk: "nav", tep: "baoHieuVn", cum: { radius: om.SEAMARK_CLUSTER_RADIUS, maxzoom: om.SEAMARK_CLUSTER_MAXZOOM.mid }, lops: [
    { id: "vn-aid", type: "symbol", minzoom: om.VN_AID_MINZOOM, filter: hd.KHONG_PHAI_CUM, layout: hd.SEAMARK_ICON_LAYOUT }, ...cumProps("vn-aid", om.VN_AID_MINZOOM)] },
  { nguon: "xac-tau-src", moc: true, dk: "nav" },
  { nguon: "den-bien", moc: true, dk: "nav" },
  { nguon: "khu-tru-bao", dk: "nav", tep: "khuTruBao", lops: [
    { id: "khu-tru-bao-dot", type: "symbol", minzoom: om.KHU_TRU_BAO_MINZOOM, layout: iconDiem("anchorage") },
  ] },
  { nguon: "tram-trieu", moc: true, dk: "tramTrieu" },
];
const tenData = (u) => u.replace(/^\/data\//, "").replace(/^pmtiles:\/\/\/data\//, "");

/* ── ĐỢT 2c: NỀN THEO LỚP = buildMapStyle(id) của web cho từng lớp nền ảnh (OCEAN_LAYER_ORDER). Đường ô ảnh
   `/api/tiles/...` (cầu same-origin, gói chặn ở middleware) và `sdfdata:///data/isobaths…` giữ nguyên — KieuBanDo đổi
   sang địa chỉ máy chủ / file trong máy. ── */
const nenLop = Object.fromEntries(om.OCEAN_LAYER_ORDER.map((id) => [id, om.buildMapStyle(id, { seamarks: false })]));
const lopNen = om.OCEAN_LAYER_ORDER.map((id) => ({ id, ten: om.OCEAN_LAYERS[id].label, theoNgay: !!om.OCEAN_LAYERS[id].dated, mau: om.OCEAN_LAYERS[id].legend?.gradient ?? "" }));
// BỜ OFFLINE (JSX ~6925) — chỉ khi nền không tải được; chèn TRƯỚC base-top như web (beforeId)
const lopBo = [
  { id: "offline-coast-fill", type: "fill", paint: { "fill-color": ob.OFFLINE_LAND_COLOR } },
  { id: "offline-coast-line", type: "line", paint: { "line-color": ob.OFFLINE_COAST_COLOR, "line-width": 1 } },
];

const ra = join(goc, "../shared/src/commonMain/kotlin/vn/sdvico/forfish/shared/bando/BanDoSinh.kt");
mkdirSync(dirname(ra), { recursive: true });
writeFileSync(ra, `// SINH TỰ ĐỘNG bởi native/scripts/sinh-ban-do.mjs từ src/lib/ocean-map.ts — ĐỪNG SỬA TAY.
package vn.sdvico.forfish.shared.bando

/** Style + lớp bản đồ của web dạng JSON (MapLibre style spec). Công khai: nền (Android/iOS) đọc LOP_NEN, TEN_GOI, HOTLINE. */
object BanDoSinh {
    const val KIEU_NEN = ${kt(om.buildMapStyle(null, { seamarks: false }))}
    const val KIEU_NEN_HAI_DO = ${kt(om.buildMapStyle("bathymetry", { seamarks: false }))}
    /** = DEFAULT_VIEW — khung mở màn: trọn bờ biển VN + Hoàng Sa + Trường Sa */
    const val TAM_LAT = ${om.DEFAULT_VIEW.latitude}
    const val TAM_LON = ${om.DEFAULT_VIEW.longitude}
    const val ZOOM_MO = ${om.DEFAULT_VIEW.zoom}
    /** = SEA_MASK_COLOR */
    const val MAU_BIEN = ${kt(om.SEA_MASK_COLOR)}
    /** = OFFLINE_COAST_BEFORE_ID — mốc chèn giữa nhóm nền và nhóm nội dung */
    const val MOC_CHEN = "base-top"
    val LOP: Map<String, String> = mapOf(
${LOP_XUAT.map((k) => `        ${kt(k)} to ${kt(om[k])},`).join("\n")}
    )
    const val LOP_DAO = ${kt(lopDao)}
    /** = glyph + sprite trong SHELL của public/sw.js (đường web, đã mã hoá %20) */
    val TEP_TINH: List<String> = listOf(${tepTinh.map((d) => kt(d)).join(", ")})
    const val LOP_TRAM = ${kt(lopTram)}
    const val CHU_QUYEN = ${kt(chuQuyen)}
    /** Đợt 2b: nhóm nguồn theo THỨ TỰ JSX web — {nguon, dk?, tep?, cum?, lops?, moc?} (moc = nhóm đã có từ 2a, giữ chỗ). */
    const val NHOM_2B = ${kt(nhom2b)}
    /** = REEF_SHAPES_DATA_URL / REEFS_DATA_URL / SEA_LANES_DATA_URL — GeoJSON thẳng, không cần giải. */
    const val TEP_HIEM_HOA = ${kt(tenData(om.REEF_SHAPES_DATA_URL))}
    const val TEP_RAN = ${kt(tenData(om.REEFS_DATA_URL))}
    const val TEP_LUONG_BIEN = ${kt(tenData(om.SEA_LANES_DATA_URL))}
    /** Đợt 2c — file gói + đẳng sâu + bờ offline (tên trong /data). */
    const val TEP_RAN_GOI = ${kt(tenData(om.REEF_SHAPES_PMTILES_URL))}
    const val TEP_CHAT_DAY = ${kt(tenData(om.CHAT_DAY_PMTILES_URL))}
    const val TEP_DANG_SAU = "isobaths.v1.json"
    const val TEP_BO = ${kt(tenData(ob.COAST_DATA_URL))}
    /** = buildMapStyle(id) theo từng lớp nền ảnh (gói). */
    val KIEU_NEN_LOP: Map<String, String> = mapOf(
${Object.entries(nenLop).map(([k, v]) => `        ${kt(k)} to ${kt(v)},`).join("\n")}
    )
    /** = OCEAN_LAYER_ORDER + label/dated/legend.gradient — danh sách "Lớp nền bản đồ · Chọn 1". */
    const val LOP_NEN = ${kt(lopNen)}
    const val LOP_BO = ${kt(lopBo)}
    /** = TEN_GOI (labels.ts) + SDVICO_HOTLINE(_DISPLAY) — thẻ khoá gói (PremiumLock). */
    const val TEN_GOI = ${kt(TEN_GOI)}
    const val HOTLINE = ${kt(SDVICO_HOTLINE)}
    const val HOTLINE_HIEN = ${kt(SDVICO_HOTLINE_DISPLAY)}
}
`);
console.log(`[sinh-ban-do] ${ra}`);
