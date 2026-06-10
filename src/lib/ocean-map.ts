/**
 * Trục 1 — bản đồ biển: nguồn ảnh vệ tinh + style bản đồ + nhãn chủ quyền.
 *
 * Quy tắc adapter (01-product.md): mọi nguồn dữ liệu ngoài gói trong file này.
 * Đổi nguồn (NASA GIBS → Copernicus → vendor thương mại) chỉ sửa LAYER defs,
 * không đụng component. Không để tên nguồn lọt vào UI copy — chỉ xuất hiện
 * trong dòng attribution bắt buộc theo điều khoản sử dụng.
 *
 * Nguồn hiện tại: NASA GIBS (tile WMTS công khai, không cần API key,
 * cập nhật hằng ngày, trễ ~2 ngày — đã ghi rõ với người dùng trong UI).
 */

export type OceanLayerId = "sst" | "chlorophyll" | "bathymetry" | "truecolor";

export type OceanLayerDef = {
  id: OceanLayerId;
  /** Nhãn nút bấm — từ của bà con, không jargon */
  label: string;
  /** Một câu giải thích lớp này giúp gì */
  help: string;
  /** Chú giải hai đầu thang màu */
  legend: { from: string; to: string; gradient: string } | null;
  /** Ảnh chậm mấy ngày so với hôm nay (đã dò thực tế nguồn) */
  lagDays: number;
  /** false = bản đồ tĩnh (độ sâu đáy biển) — không có khái niệm "ảnh ngày X" */
  dated: boolean;
  /** Độ mờ khi vẽ đè (mặc định 0.85); lớp tự đứng được (độ sâu) dùng 1 */
  opacity?: number;
  /** Trả về URL template tile cho một ngày YYYY-MM-DD (lớp tĩnh bỏ qua) */
  tiles: (isoDate: string) => string;
  /** Mức zoom sâu nhất nguồn có tile thật (zoom sâu hơn thì phóng to tile cũ) */
  maxNativeZoom: number;
};

const GIBS = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best";

/*
  Màu gradient chú giải mô phỏng thang màu của ảnh vệ tinh (nội dung bản đồ,
  không phải màu UI) — không đưa vào design tokens.
*/
export const OCEAN_LAYERS: Record<OceanLayerId, OceanLayerDef> = {
  sst: {
    id: "sst",
    // Dùng CHÊNH nhiệt (anomaly) thay vì nhiệt tuyệt đối: mùa hè cả Biển Đông
    // đều ~29–31°C nên bản đồ tuyệt đối đỏ đặc một màu — anomaly mới lộ
    // vùng nước trồi lạnh và xoáy ấm cho bà con thấy (đã so 2 tile thực tế).
    label: "Nước nóng lạnh",
    help: "Chỗ xanh là nước lạnh trồi lên, thường nhiều mồi — cá hay gom ở ranh giữa vùng xanh và vùng đỏ.",
    legend: {
      from: "Lạnh hơn mọi khi",
      to: "Nóng hơn mọi khi",
      gradient:
        "linear-gradient(90deg,#4575b4,#91cf60,#dcdcdc,#fdae61,#d73027)",
    },
    lagDays: 2,
    dated: true,
    tiles: (d) =>
      `${GIBS}/GHRSST_L4_MUR_Sea_Surface_Temperature_Anomalies/default/${d}/GoogleMapsCompatible_Level7/{z}/{y}/{x}.png`,
    maxNativeZoom: 7,
  },
  chlorophyll: {
    id: "chlorophyll",
    label: "Vùng nhiều mồi",
    help: "Màu càng ngả vàng đỏ thì nước càng nhiều phù du — mồi của cá nhỏ, cá nhỏ kéo cá lớn. Chỗ trống là mây che, không phải hết mồi.",
    legend: {
      from: "Ít mồi",
      to: "Nhiều mồi",
      gradient:
        "linear-gradient(90deg,#30123b,#28bceb,#a2fc3c,#fabd23,#7a0403)",
    },
    lagDays: 2,
    dated: true,
    tiles: (d) =>
      `${GIBS}/VIIRS_NOAA20_Chlorophyll_a/default/${d}/GoogleMapsCompatible_Level7/{z}/{y}/{x}.png`,
    maxNativeZoom: 7,
  },
  bathymetry: {
    id: "bathymetry",
    // Hải đồ độ sâu: EMODnet (nền GEBCO) — tĩnh, tải một lần dùng quanh năm.
    // Đây là LỚP MẶC ĐỊNH khi mở bản đồ — chuẩn app hàng hải (Navionics/
    // C-MAP/OpenCPN đều mở nautical chart trước, vệ tinh là tuỳ chọn).
    label: "Hải đồ độ sâu",
    help: "Bản đồ độ sâu đáy biển như hải đồ: chỗ nhạt là gò nổi, bãi cạn — cá đáy hay quanh gò, mép dốc. Phóng to gần bờ sẽ thấy phao đèn, báo hiệu.",
    legend: {
      from: "Cạn",
      to: "Sâu",
      gradient: "linear-gradient(90deg,#d9eef5,#9fcde4,#5b9bc9,#2a6299,#0b2d59)",
    },
    lagDays: 0,
    dated: false,
    opacity: 1,
    tiles: () =>
      "https://tiles.emodnet-bathymetry.eu/2020/baselayer/web_mercator/{z}/{x}/{y}.png",
    maxNativeZoom: 10,
  },
  truecolor: {
    id: "truecolor",
    label: "Ảnh mây trời",
    help: "Ảnh chụp thật từ vệ tinh — thấy mây, vệt nước đục, ranh nước trong.",
    legend: null,
    lagDays: 2,
    dated: true,
    // JPG đặc — vẽ mờ 0.85 làm nhãn/đường basemap "ma" lộ xuyên ảnh (đục bẩn)
    opacity: 1,
    tiles: (d) =>
      `${GIBS}/VIIRS_NOAA20_CorrectedReflectance_TrueColor/default/${d}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`,
    maxNativeZoom: 9,
  },
};

// Hải đồ đứng ĐẦU + là mặc định; các lớp tìm cá (nhiệt/mồi/mây) xếp sau
export const OCEAN_LAYER_ORDER: OceanLayerId[] = [
  "bathymetry",
  "sst",
  "chlorophyll",
  "truecolor",
];

/** Ngày (UTC) mới nhất chắc chắn có ảnh, lùi `lagDays` so với `now`. */
export function latestAvailableDate(now: Date, lagDays: number): string {
  const d = new Date(now.getTime() - lagDays * 24 * 60 * 60 * 1000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** "2026-06-08" → "8/6" cho copy tiếng Việt */
export function formatDateVN(isoDate: string): string {
  const [, m, d] = isoDate.split("-");
  return `${Number(d)}/${Number(m)}`;
}

/* ---------------------------------------------------------------------------
   Chủ quyền — không dùng nhãn quốc tế cho Biển Đông / Hoàng Sa / Trường Sa.
   Kỹ thuật: phủ mask màu nước lên vùng biển ở zoom thấp để che nhãn
   "South China Sea / Paracel / Spratly" của tile quốc tế, rồi đè nhãn
   tiếng Việt (HTML marker) lên trên. Tham khảo guide ForLife.
--------------------------------------------------------------------------- */

/**
 * Màu nước khớp basemap Carto Voyager — nội dung bản đồ, không phải token UI.
 * Audit 2026-06-10: sample pixel tile biển thật của Voyager = #d5e8eb
 * (giá trị cũ #aadaff lệch tông → mask thành mảng xanh loang lổ lộ qua
 * lỗ mây của lớp phù du).
 */
export const SEA_MASK_COLOR = "#d5e8eb";

/**
 * Màu vẽ tuyến dẫn đường (MapLibre paint cần hex literal, không nhận CSS
 * variable) — nội dung bản đồ: chọn nổi trên cả nền nước lẫn ảnh vệ tinh,
 * kèm viền trắng bên dưới để tách khỏi màu lớp ảnh.
 */
// Audit 2026-06-10: tuyến KHÔNG được trùng tông cam đỏ của ranh giới biển
// (ranh giới = "không được vượt", phạt nặng) — tuyến dùng xanh dương kiểu
// chỉ đường quen mắt, cam đỏ độc quyền cho ranh giới.
export const ROUTE_LINE_COLOR = "#1a73e8";
export const ROUTE_CASING_COLOR = "#ffffff";

export type SovereigntyLabel = {
  name: string;
  sub?: string;
  lat: number;
  lng: number;
  kind: "sea" | "island";
};

export const SOVEREIGNTY_LABELS: SovereigntyLabel[] = [
  { name: "VỊNH BẮC BỘ", lat: 19.5, lng: 107.3, kind: "sea" },
  { name: "BIỂN ĐÔNG", lat: 14.2, lng: 113.0, kind: "sea" },
  { name: "VỊNH THÁI LAN", lat: 9.3, lng: 102.3, kind: "sea" },
  {
    name: "QUẦN ĐẢO HOÀNG SA",
    sub: "TP. Đà Nẵng — Việt Nam",
    lat: 16.45,
    lng: 111.9,
    kind: "island",
  },
  {
    name: "QUẦN ĐẢO TRƯỜNG SA",
    sub: "Tỉnh Khánh Hòa — Việt Nam",
    lat: 9.7,
    lng: 114.3,
    kind: "island",
  },
];

/** Khung nhìn mặc định: thấy trọn bờ biển VN + Hoàng Sa + Trường Sa */
export const DEFAULT_VIEW = { longitude: 110.8, latitude: 12.8, zoom: 4.6 };

/** Điểm xem dự báo mặc định: ngoài khơi Nam Trung Bộ */
export const DEFAULT_POINT = { lat: 13.0, lon: 110.5 };

/**
 * Style MapLibre: basemap quốc tế + mask che nhãn Biển Đông + lớp vệ tinh.
 * `layerId = null` → chỉ bản đồ nền + mask.
 * `opts.seamarks` — bật/tắt lớp phao đèn (mặc định bật); ranh giới + nhãn
 * chủ quyền KHÔNG có công tắc — là hằng số của app.
 */
export function buildMapStyle(
  layerId: OceanLayerId | null,
  now: Date,
  opts: { seamarks?: boolean } = {},
) {
  const { seamarks = true } = opts;
  const sources: Record<string, object> = {
    basemap: {
      type: "raster",
      tiles: ["a", "b", "c", "d"].map(
        (s) =>
          `https://${s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png`,
      ),
      tileSize: 256,
      attribution:
        "Ảnh: NASA · Độ sâu: EMODnet/GEBCO · Phao đèn: OpenSeaMap · Nền: © OpenStreetMap © CARTO · Dự báo: Open-Meteo",
    },
    "sea-mask": {
      type: "geojson",
      data: {
        type: "Feature",
        properties: {},
        geometry: {
          type: "Polygon",
          // Khung biển khơi che nhãn quốc tế. Audit 2026-06-10: khía góc để
          // KHÔNG đè lên đất nước bạn — cạnh đông hạ về 115E dưới vĩ 8 (né
          // Sabah/Borneo), 116.8E phía trên (né Palawan/Balabac ≥117E),
          // cạnh bắc hạ về 18.05 (né bờ nam Hải Nam ~18.2N).
          coordinates: [
            [
              [109.6, 6.0],
              [115.0, 6.0],
              [115.0, 8.0],
              [116.8, 8.0],
              [116.8, 18.05],
              [109.6, 18.05],
              [109.6, 6.0],
            ],
          ],
        },
      },
    },
  };

  const layers: object[] = [
    { id: "basemap", type: "raster", source: "basemap" },
    {
      id: "sea-mask",
      type: "fill",
      source: "sea-mask",
      maxzoom: 9, // zoom sâu thì nhả mask để xem chi tiết
      paint: { "fill-color": SEA_MASK_COLOR, "fill-opacity": 1 },
    },
  ];

  if (layerId) {
    const def = OCEAN_LAYERS[layerId];
    sources["ocean-data"] = {
      type: "raster",
      tiles: [def.tiles(latestAvailableDate(now, def.lagDays))],
      tileSize: 256,
      maxzoom: def.maxNativeZoom,
    };
    layers.push({
      id: "ocean-data",
      type: "raster",
      source: "ocean-data",
      paint: {
        "raster-opacity": def.opacity ?? 0.85,
        "raster-fade-duration": 150,
      },
    });
  }

  // Báo hiệu hàng hải (phao, đèn biển, vùng neo) — overlay trong suốt,
  // chỉ hiện khi zoom gần bờ; luôn nằm trên mọi lớp ảnh
  if (seamarks) {
    sources["seamarks"] = {
      type: "raster",
      tiles: ["https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png"],
      tileSize: 256,
      minzoom: 9,
    };
    layers.push({
      id: "seamarks",
      type: "raster",
      source: "seamarks",
      minzoom: 9,
    });
  }

  return { version: 8 as const, sources, layers };
}
