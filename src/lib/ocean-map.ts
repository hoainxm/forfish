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

import { proxyTileTemplate } from "@/lib/tile-proxy";
import { layers as protomapsLayers, namedFlavor } from "@protomaps/basemaps";
import { chartSpriteUrl } from "@/lib/chart-symbols";

// "truecolor" (Ảnh mây trời) ĐÃ GỘP về lớp DỰ BÁO "Mây" (panel Thời tiết,
// scalar-field) — user 2026-07-28: một chỗ cho mây, coi ảnh đã-qua là hôm nay
// nhưng nay dùng thẳng dự báo (hôm nay→tương lai) thay ảnh vệ tinh trễ 2 ngày.
export type OceanLayerId = "sst" | "chlorophyll" | "bathymetry";

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
    // Đi qua cầu same-origin /api/tiles/chart/... để service worker giữ lại
    // được ô đã xem (mất sóng vẫn còn hải đồ vùng vừa xem) — xem lib/tile-proxy.
    tiles: () => proxyTileTemplate("chart"),
    maxNativeZoom: 10,
  },
};

// Hải đồ đứng ĐẦU + là mặc định; các lớp tìm cá (nhiệt/mồi) xếp sau.
// Mây KHÔNG còn ở đây — đã gộp về lớp dự báo "Mây" (panel Thời tiết).
export const OCEAN_LAYER_ORDER: OceanLayerId[] = [
  "bathymetry",
  "sst",
  "chlorophyll",
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

/*  MÀU THEO CHẶNG (2026-08-29g, chủ dự án: *"điểm nào cần lưu ý thì màu đỏ,
    cần chú ý vừa thì màu cam, ko có gì thì màu xanh, lúc bắt đầu đi thì cái
    nào đi qua cho hiện màu xám"*).

    VA CHẠM PHẢI NÓI RA: quy ước ngay trên đầu file dành cam-đỏ ĐỘC QUYỀN cho
    ranh giới biển ("không được vượt, phạt nặng"). Tô tuyến đỏ/cam là mượn tông
    đó. Ba thứ giữ cho hai bên KHÔNG lẫn:
      1. Đỏ tuyến là ĐỎ TƯƠI báo hiệu `#d92d20`, khác hẳn đỏ GẠCH `#b42318`
         của ranh giới.
      2. Tuyến luôn có viền trắng `ROUTE_CASING_COLOR` dày bên dưới; ranh giới
         không có. Nhìn hình là biết đâu là tuyến của mình.
      3. Ranh giới là một đường DÀI chạy suốt màn theo bờ; chặng tuyến là khúc
         ngắn nối hai ghim số. Khác cả vị trí lẫn độ dài.
    Xanh giữ NGUYÊN `ROUTE_LINE_COLOR` — đó đã là màu bà con học được là
    "đường của tôi", đổi sang xanh lá chỉ để hợp bộ đèn giao thông là bắt học
    lại một màu mới mà không được gì. */
export const ROUTE_LEG_RED = "#d92d20";
export const ROUTE_LEG_AMBER = "#e8710a";
/** chặng ĐÃ ĐI QUA — xám trầm, vẫn thấy đường nhưng thôi tranh mắt */
export const ROUTE_LEG_PASSED = "#8a94a0";

/* ---------------------------------------------------------------------------
   NHÃN ĐẢO + TUYẾN HÀNG HẢI — chi tiết "đúng chất hải đồ" (2026-08-07).
   Cả hai là asset TĨNH cùng-origin (service worker giữ sẵn → chạy khi mất
   sóng), sinh bởi scripts/generate-islands.mjs + generate-sea-lanes.mjs.
   Render bằng lớp symbol/line của MapLibre (tự giãn theo zoom + tránh chồng
   chữ) chứ KHÔNG phải hàng trăm HTML marker.
--------------------------------------------------------------------------- */

/** ~103 đảo có tên tiếng Việt (ven bờ + Hoàng Sa + Trường Sa). */
export const ISLANDS_DATA_URL = "/data/vn-islands.v1.json";
/** Tuyến hàng hải lớn (vẽ tay, tham khảo) + luồng/phân luồng (OSM, bỏ tên). */
export const SEA_LANES_DATA_URL = "/data/vn-sea-lanes.v1.json";
/** Rạn / đá ngầm / bãi cạn có tên tiếng Việt (lớp bật–tắt "Đá ngầm · Rạn"). */
export const REEFS_DATA_URL = "/data/coral-reefs.v1.json";
/*  RẠN vẽ lại độc lập (Allen Coral Atlas + UNEP-WCMC, CC BY 4.0) — VECTOR TILE.
    Sạch ODbL (không trích một byte OSM nào) và nét hơn hẳn: sai số mép 0,87 px
    ở z14 so với 3,50 px của bộ OSM. Dạng .pmtiles vì bộ này có 4,03 triệu đỉnh —
    đưa MapLibre dạng geojson là 835 MB RAM (xem chú thích ở fishing-map-view).
    ⚠️ Đường dẫn phải nằm trong PMTILES_ARCHIVES của public/sw.js, không thì mất
    sóng là lớp này chết câm. Có test canh (sw-basemap-range). */
export const REEF_SHAPES_PMTILES_URL =
  "pmtiles:///data/reef-shapes-aca.v1.pmtiles";

/** ĐIỂM hiểm hoạ (đá ngầm/xác tàu) — vẫn OSM, vì ACA/WCMC không có lớp điểm. */
export const REEF_SHAPES_DATA_URL = "/data/reef-shapes.v1.json";

/*
  NẤC ZOOM CHO TỪNG MỨC ĐẲNG SÂU (2026-08-29).

  Vì sao có: `isobaths.v1.json` nay sinh ở bước 1/48° và có CHÍN mức, thêm 5 m
  và 10 m (trước chỉ 20 m trở lên). Vẽ hết từ z5 thì ven bờ — nơi chín mức nằm
  sát nhau nhất — thành búi chỉ, đúng chỗ bà con cần đọc rõ nhất và đang nhìn
  dưới nắng chói. Hải đồ giấy cũng phân cấp y vậy: xa chỉ vài đường cái, gần
  mới thêm đường phụ.

  Ngưỡng chọn theo VIỆC bà con làm ở mức zoom đó, không phải theo con số đẹp:
   · 5 · 10 m  → chỉ khi áp bờ, vào luồng, tránh bãi cạn (z10)
   · 20 m      → ngư trường ven bờ, lưới kéo (z9)
   · 50 · 100 m→ thềm lục địa (z7)
   · ≥200 m    → mốc định hướng vùng, thấy từ toàn cảnh (z5)

  `["zoom"]` trong `filter` được MapLibre tính lại ở MỖI MỨC ZOOM NGUYÊN — đủ
  cho việc bật/tắt theo nấc; đừng dùng kiểu này cho thứ cần đổi mượt theo zoom.
*/
const isobathZoomGate = (offset: number) => [
  ">=",
  ["zoom"],
  [
    "case",
    ["<=", ["get", "d"], 10],
    10 + offset,
    ["<=", ["get", "d"], 20],
    9 + offset,
    ["<=", ["get", "d"], 100],
    7 + offset,
    5 + offset,
  ],
];

/** Nấc hiện ĐƯỜNG đẳng sâu */
export const ISOBATH_ZOOM_FILTER = isobathZoomGate(0);
/** Nấc hiện SỐ MÉT — muộn hơn đường một nấc (thấy đường trước, đọc số sau) */
export const ISOBATH_LABEL_ZOOM_FILTER = isobathZoomGate(1);

/*
  DẢI ĐỘ SÂU NHIỀU NẤC (kiểu C-MAP/hải đồ giấy) + ĐƯỜNG AN TOÀN (2026-09-03).

  Nguồn: `isobaths.v1.json` vai `k:"vung"` — MultiPolygon "nước SÂU TỪ d m trở
  ra", CHỈ có 8 mức từ 10 m (10·20·50·100·200·500·1000·2000). KHÔNG có đa giác
  5 m — cố ý (generate-isobaths.mjs, FILL_MIN_M): mô hình ETOPO mù ở dải này
  (13 điểm khảo sát thật <4 m thì mô hình xếp đúng 1), tô "≥5 m" là nói dối
  đúng chỗ tàu mắc cạn. Nên nấc nông nhất là 0–10 m, không tách 0–5 được.

  CHIỀU MÀU: nông = màu biển gốc (đậm nhất), càng SÂU càng SÁNG — giấy vẽ nước
  sâu để trắng, nước nông ăn màu. Chiều này còn là chiều DUY NHẤT SỐNG: tô đậm
  phía nông đã bị đo chết (nét đẳng sâu tụt 1,09:1 — cổng trong ocean-map.test),
  tô sáng phía sâu thì nét nằm trên nền sáng hơn, tương phản TĂNG.

  Đa giác lồng nhau (≥50 ⊂ ≥20 ⊂ ≥10) nên vẽ theo thứ tự NÔNG → SÂU, mỗi lớp
  fill lọc `k=vung`, `d = toM của nấc TRƯỚC`, `fill-opacity: 1` (màu ở đây là
  màu CUỐI, không pha — để cổng đo đúng cái sẽ hiện). Nấc đầu (0–10) không có
  đa giác: nó là nền biển SEA_MASK_COLOR, ghi vào mảng để chú giải đủ nấc.

  Số đo (nét #3d6e96@0,85 · đường an toàn · nhãn #14324f · bước với nấc trước):
    0–10   #d5e8eb  nét 3,32 · an toàn 5,19 · nhãn 10,4 · —
    10–20  #e2f0f3  nét 3,51 · an toàn 5,55 · nhãn 11,3 · bước 1,086
    20–50  #eef6f8  nét 3,72 · an toàn 5,90 · nhãn 12,0 · bước 1,066
    ≥50    #f8fbfc  nét 3,87 · an toàn 6,22 · nhãn 12,6 · bước 1,053
  Bước ≥1,05 là ngưỡng "nhận ra" đã dùng cho dải đủ-nước; không thể rộng hơn
  vì trần là trắng (1,28 tổng cho 3 bước). Nấc sâu nhất KHÔNG lấy trắng tinh:
  đất của nền Protomaps cũng sáng — biển trắng cạnh đất trắng là mất bờ.
*/
export const DEPTH_BANDS: ReadonlyArray<{ toM: number; color: string }> = [
  { toM: 10, color: SEA_MASK_COLOR },
  { toM: 20, color: "#e2f0f3" },
  { toM: 50, color: "#eef6f8" },
  { toM: Infinity, color: "#f8fbfc" },
];

/*  ĐƯỜNG AN TOÀN = đẳng sâu 10 m vẽ ĐẬM (C-MAP "safety contour"): mớn tàu cá
    vỏ gỗ 1,8–2,5 m + sóng lừng ⇒ dưới 10 m là "phải nhìn con nước", và 10 m
    là mức nông nhất dữ liệu còn tin được (xem trên). Nét dày gấp ~2 đẳng sâu
    thường (0,8–1,1 px), màu sẫm hơn một bậc — 5,19:1 trên biển, ≥5,5 trên mọi
    dải. Vẽ đè lên `isobath-lines`, lọc `k=duong`, `d = SAFETY_CONTOUR_M`. */
export const SAFETY_CONTOUR_M = 10;
export const SAFETY_CONTOUR_STYLE = {
  color: "#2c5a80",
  opacity: 0.95,
  width: ["interpolate", ["linear"], ["zoom"], 7, 1.4, 12, 2.6] as const,
} as const;

// Màu NỘI DUNG BẢN ĐỒ (không phải token UI). Nhãn đảo dùng navy như nhãn chủ
// quyền. Tuyến tàu dùng xám-lam trầm — KHÔNG đụng cam-đỏ ranh giới (cấm vượt)
// hay xanh dương ROUTE_LINE_COLOR (tuyến dầu của chính bà con).
export const ISLAND_LABEL_COLOR = "#0f2f4d";
export const ISLAND_DOT_COLOR = "#0f2f4d";
// Rạn/đá ngầm/bãi cạn — teal biển, TÁCH khỏi navy đảo nổi (để bà con phân biệt
// "đá chìm dưới nước" với đảo có thể lên được) và tách khỏi cam-đỏ ranh giới.
export const REEF_LABEL_COLOR = "#0b5e66";
export const REEF_DOT_COLOR = "#0e7c86";
/*  HÌNH DẠNG RẠN — tô teal nhạt trong suốt (thấy phạm vi rạn mà không che hải
    đồ), viền teal đậm. Nội dung bản đồ, không phải token UI.

    ĐO LẠI 2026-09-03 (reviewer hải đồ, nền biển #d5e8eb, tính SAU khi pha mờ):
      viền cũ #0e7c86 @0,5  → 1,89:1  (nét "gần như vô hình")
      viền MỚI #0b6b74 @0,85 → 3,75:1  ✓ sàn 3:1 cho nét (WCAG 1.4.11)
      fill cũ #4bbdc7 @0,18 → 1,11:1
      fill MỚI #4bbdc7 @0,30 → 1,19:1  — DIỆN được phép dưới sàn (chủ ý mờ để
                                      không che số đo sâu), nhưng phải NHẬN RA:
                                      bước ≥1,15 mới thấy khác nền.
    Nét đẳng sâu đè lên fill rạn còn 2,90:1 — chấp nhận: đa giác rạn nhỏ,
    đường đẳng sâu cắt qua rạn là đoạn ngắn; hạ fill xuống 0,25 thì 1,15 —
    lại về ngưỡng không thấy. Có cổng test đo đúng các số này. */
export const REEF_SHAPE_FILL = "#4bbdc7";
export const REEF_SHAPE_FILL_OPACITY = 0.3;
export const REEF_SHAPE_LINE = "#0b6b74";
export const REEF_SHAPE_LINE_OPACITY = 0.85;
// Điểm HIỂM HOẠ hàng hải (đá ngầm/chướng ngại/xác tàu — seamark, thường gần bờ):
// hổ phách đậm = "coi chừng", tách khỏi teal rạn + cam-đỏ ranh giới.
export const REEF_HAZARD_COLOR = "#b45309";
/*  BÁO HIỆU HÀNG HẢI (phao · đèn · tiêu · vùng neo — `seamarks.v1.json`).
    HAI màu, và sự khác nhau MANG THÔNG TIN chứ không phải cho đẹp: cái CÓ ĐÈN
    thì ban đêm nhìn thấy được, cái KHÔNG có đèn thì tối là mất — đúng thứ bà
    con cần phân biệt lúc vào luồng. Magenta theo đúng quy ước hải đồ giấy
    (magenta = báo hiệu có ánh sáng); loại không đèn dùng xanh thép trầm hơn để
    lùi lại phía sau. Nội dung bản đồ, không phải token UI. */
export const SEAMARK_LIT_COLOR = "#b4267a";
export const SEAMARK_UNLIT_COLOR = "#3f6b85";
export const SEA_LANE_COLOR = "#4a5a70"; // tuyến/luồng/phân luồng — xám-lam

/*  CÁP QUANG · ỐNG DẪN · VÙNG CẤM — ba thứ NGUY KHÁC NHAU, phải KHÁC NHAU cả
    sắc lẫn ĐỘ SÁNG (2026-09-03, sửa theo reviewer hải đồ A.3/A.4).

    Vì sao độ sáng chứ không chỉ sắc: cáp tím cũ #7c3aed@0,6 và vùng cấm cam
    cũ #c2620c@0,75 có tương phản độ sáng với nhau đúng **1,00:1** — chỉ khác
    hue. Dưới nắng chói (mất bão hoà) hoặc với ~8% đàn ông mù màu đỏ-lục, hai
    nét là MỘT màu xám. Kéo lưới trúng cáp là bồi thường, trúng ống khí là cháy
    nổ — không được để hai thứ đó trông giống nhau.

    Số đo trên nền biển #d5e8eb, TÍNH SAU KHI PHA MỜ (cùng phép với đẳng sâu):
      cáp      cũ #7c3aed @0,6  → 2,44:1 ✗    MỚI #6d28d9 @0,9  → 4,83:1 ✓
      vùng cấm cũ #c2620c @0,75 → 2,43:1 ✗    MỚI #b85a00 @0,9  → 3,25:1 ✓
      ống dẫn  (chưa có)                      MỚI #1f2933 @0,95 → 10,17:1 ✓
    Độ sáng GIỮA các nét (đã pha mờ): cáp–vùng cấm 1,49 · cáp–ống 2,11 ·
    vùng cấm–ống 3,13 — mỗi cặp phân biệt được không cần màu.

    Ống dẫn dùng MỰC (ink, gần đen) chứ không thêm một hue: mọi kênh màu đã
    có chủ (đỏ = độ sâu nguy, cam = vùng cấm/hiểm hoạ, magenta = có đèn, teal
    = rạn, lục = trú bão, navy = đảo, xám-lam = tuyến). Mực là màu duy nhất
    chưa ai dùng cho NÉT, và nó là màu tối nhất — đúng thứ nguy hiểm nhất. Vẫn
    phải khác NÉT (dash) chứ không chỉ khác màu — xem *_DASH.

    Độ mờ cáp/vùng cấm 0,9 (không 1,0): giữ chút trong suốt để cáp đè lên
    đẳng sâu còn đọc được lớp dưới; hạ xuống 0,8 thì vùng cấm rơi còn 2,9. */
export const SEA_CABLE_COLOR = "#6d28d9"; // cáp quang ngầm — tím đậm
export const SEA_CABLE_OPACITY = 0.9;
/** dash cáp: vạch dài–hở ngắn. Cũ [0,5;2,5] là "nét 17%", coi như không có */
export const SEA_CABLE_DASH = [4, 2] as const;
export const SEA_RESTRICTED_COLOR = "#b85a00"; // vùng cấm + giàn khoan — cam đất
export const SEA_RESTRICTED_OPACITY = 0.9;
export const PIPELINE_COLOR = "#1f2933"; // ống dẫn dầu/khí — mực
export const PIPELINE_OPACITY = 0.95;
/*  dash ống: vạch–chấm (khác cáp vạch–vạch). INT1 vẽ cáp (L30) và ống (L40)
    bằng HAI ký hiệu khác nhau vì hệ quả khác nhau — đây là cách giữ đúng tinh
    thần đó mà không sao chép hình của họ. */
export const PIPELINE_DASH = [7, 2.5, 1.5, 2.5] as const;

/*  VÙNG CẤM có NỀN + NHÃN — viền đứt một mình không đọc ra là "vùng": vòng
    cấm neo 500 m quanh giàn ở z10 chỉ ~3 px. Tô nền nhạt để mắt gom thành
    diện, nhãn đậm để đọc được tên/lý do cấm.
      nền #b85a00 @0,10 trên biển → #d3dbd5 (bước 1,13 vs nền — nhận ra, không
      chói); nhãn #7a3b00 trên nền đó → 6,00:1 ✓ (chữ nhỏ, sàn 4,5); nét đẳng
      sâu đè lên nền này còn 3,03:1 ✓ — lên 0,12 là nét tụt 2,98, đừng nâng. */
export const RESTRICTED_FILL_COLOR = "#b85a00";
export const RESTRICTED_FILL_OPACITY = 0.1;
export const RESTRICTED_LABEL_COLOR = "#7a3b00";

/*  BA TẦNG HIỆN — SCAMIN kiểu Navionics/C-MAP (chủ dự án 2026-09-03c: "icon
    cần logic ở mức zoom nào thấy cái gì, cái nào luôn thấy với lớp hải đồ chi
    tiết, cái nào zoom lên mới thấy — xem các app khác mà làm").

    TRƯỚC: 11 con số zoom rải rác (5 · 7 · 8 · 9 · 11 · 12,5 · 13) tự chọn từng
    lớp, và mâu thuẫn thật: cùng là phao luồng đỏ/xanh — nguồn Cục Hàng hải
    hiện z9, nguồn OSM đợi z13; nhãn rạn ven bờ (z8) hiện TRƯỚC chấm rạn (z9).
    Navionics giải bài "dày quá" bằng vòng "+6" (chạm là phóng tới), không
    giấu phao tới z13.

    NAY: mọi lớp hải đồ trỏ về BỐN mốc có tên — không lớp nào tự đặt số (cổng
    test soi cả JSX của fishing-map-view). Xếp vật theo GIÁ TRỊ Ở KHOẢNG CÁCH
    ĐÓ, không theo nguồn. Bề ngang màn điện thoại ~400 px, vĩ độ 12°:
      LUON z5  ~1.900 km  luôn thấy khi bật Hải đồ: bờ, dải màu độ sâu, tên
                          đảo, tên địa hình ngầm, 5 tuyến lớn
      XA   z7    ~480 km  nhìn cả vùng biển: đèn lớn, xác tàu/chướng ngại, đá
                          ngầm/rạn ngoài khơi, giàn khoan + cấm neo, khu trú
                          bão, đường 10 m đậm
      VUA  z9    ~120 km  áp bờ, nhìn một tỉnh: phao & tiêu luồng (mọi nguồn),
                          đèn nhỏ, cáp/ống/vùng cấm, luồng, rạn ven bờ, tên
                          đèn, số sâu trên xác tàu
      SAT  z11    ~30 km  cửa lạch: phao chuyên dùng/nuôi trồng/neo, số đo
                          sâu, chất đáy
    Chỗ dày phao (tầng VỪA/SÁT) GOM thành vòng "+N" tới hết nấc kế, chạm là
    phóng tới — xem SEAMARK_CLUSTER_*. Tầng XA không gom: đèn lớn thưa, và
    một ngọn đèn bị nuốt vào cụm là mất mốc định hướng. */
export const CHART_TIER = { LUON: 5, XA: 7, VUA: 9, SAT: 11 } as const;

/*  Lớp ĐƯỜNG của sea-lanes: cáp / ống / điểm cập bờ / vùng cấm / luồng đều
    tầng VỪA — là thứ neo và lưới phải tránh, có nghĩa khi đã áp bờ (Navionics
    cũng chỉ vẽ cáp từ cỡ 1:150k). 5 tuyến hàng hải lớn vẽ tay: tầng LUÔN. */
export const SEA_CABLE_MINZOOM = CHART_TIER.VUA;
export const SEA_PIPELINE_MINZOOM = CHART_TIER.VUA;
export const CABLE_LANDING_MINZOOM = CHART_TIER.VUA;
export const SEA_RESTRICTED_MINZOOM = CHART_TIER.VUA;
export const SEA_FAIRWAY_MINZOOM = CHART_TIER.VUA;
/** Giàn khoan: tầng XA — 41 cái, thấy từ xa, và vòng cấm 500 m đi kèm. */
export const RIG_MINZOOM = CHART_TIER.XA;
/** Đá ngầm / xác tàu OSM (87 điểm): tầng XA — vật cản nằm cả ngoài bãi lưới. */
export const REEF_HAZARD_MINZOOM = CHART_TIER.XA;
/** Rạn/bãi/đá NGOÀI KHƠI (149, mốc chủ quyền): icon tầng XA, tên thì luôn. */
export const REEF_OFFSHORE_MINZOOM = CHART_TIER.XA;
/** Rạn/bãi/đá VEN BỜ (1.225): icon VÀ tên cùng tầng VỪA (trước tên z8 hiện trước icon z9). */
export const REEF_VENBO_MINZOOM = CHART_TIER.VUA;
/** Báo hiệu chính thức Cục Hàng hải (774): tầng VỪA, cùng nấc phao OSM. */
export const VN_AID_MINZOOM = CHART_TIER.VUA;
/** Tên địa hình ngầm: tầng LUÔN (nhãn tự né nhau nên toàn cảnh vẫn thưa). */
export const DIA_DANH_NGAM_MINZOOM = CHART_TIER.LUON;
/** Chất đáy: tầng SÁT — Navionics cũng chỉ ghi chất đáy ở zoom cửa lạch; z9–10 là "chấm gì thế". */
export const CHAT_DAY_MINZOOM = CHART_TIER.SAT;
/** Ba tầng của lớp báo hiệu OSM (seamark-far/mid/near) — chia theo loại vật, xem SEAMARK_FAR/MID ở map-view. */
export const SEAMARK_TIER_MINZOOM = { far: CHART_TIER.XA, mid: CHART_TIER.VUA, near: CHART_TIER.SAT } as const;
/*  GOM "+N" (MapLibre cluster) — bán kính 26 px: hai icon 17 px chạm mép nhau
    thì gom, còn cách nửa ngón thì để rời. Cụm tan ở nấc kế: tầng VỪA gom tới
    hết z10 (z11 tầng SÁT hiện, bung ra để thấy từng cái), tầng SÁT gom tới hết
    z12. Cụm chỉ gồm vật ĐÃ tới nấc hiện — vì thế mỗi tầng là một NGUỒN riêng. */
export const SEAMARK_CLUSTER_RADIUS = 26;
export const SEAMARK_CLUSTER_MAXZOOM = { mid: CHART_TIER.SAT - 1, near: CHART_TIER.SAT + 1 } as const;
/*  Vòng "+N": trắng viền navy, số navy — hình TRUNG TÍNH cố ý, không mượn màu
    phao (đỏ/xanh/vàng) để không bị đọc thành một loại phao. Navy #14324f trên
    trắng 13,6:1. Bán kính 13 = 26 px, chạm được nhờ đệm ±28 px. */
export const CLUSTER_BADGE = { fill: "#ffffff", stroke: "#14324f", text: "#14324f", radius: 13 } as const;

/*  CHẤT ĐÁY (nature of seabed — `chat-day.v1.pmtiles`, Allen Coral Atlas
    benthic). Hải đồ nào cũng có: quyết định neo bám hay không (đá/san hô =
    neo trượt) và cá đáy theo chất đáy. Vector tile vì 362K điểm — nhồi geojson
    giết máy yếu, đúng bài học lớp rạn (xem REEF_SHAPES_PMTILES_URL).

    MÀU MANG THÔNG TIN: mỗi loại một màu ĐỦ TÁCH NHAU và đủ SẪM để đọc dưới nắng
    trên nền biển sáng (#d5e8eb) — cùng luật với dải độ sâu. Tách khỏi teal rạn,
    magenta báo hiệu, cam-đỏ ranh giới. Mã khớp `codes` của chat-day.ts. */
// Khu neo đậu tránh trú bão — xanh lục "bến an toàn", tách khỏi mọi màu hiểm
// hoạ/ranh giới. Là nơi CHẠY TỚI khi bão, không phải nơi tránh — nên không
// dùng cam-đỏ. Nội dung bản đồ, không phải token UI.
export const KHU_TRU_BAO_COLOR = "#0e8a5f";
/*  Khu trú bão hiện từ z7 — CÙNG nấc đèn biển, cùng lý do "định hướng vùng".
    Trước là z5 (toàn cảnh cả nước) với icon cho phép chồng: 51 mỏ neo 16,8 px
    phủ dọc bờ ngay lúc chưa ai chọn bến. Ý "bến an toàn phải thấy sớm" là
    đúng, nhưng z5 là cả nước — chọn bến là việc của mức vùng (2026-09-03). */
export const KHU_TRU_BAO_MINZOOM = CHART_TIER.XA;

/*  TRẠM CON NƯỚC (thuỷ triều) — 11 trạm, lớp MIỄN PHÍ, mặc định bật, không
    dính công tắc "Hải đồ chi tiết" (chủ dự án 2026-09-04). Ba nấc:
      LUÔN (z5): ký hiệu CỘT NƯỚC (tide gauge) — hình quen của Navionics /
                 C-MAP / OpenCPN: cột đứng có mực nước, xanh dương = đang
                 lên, đỏ = đang xuống, mực đầy theo biên độ ngày đó, trạm mô
                 hình ruột kẻ sọc (ô `tide-*` trong chart-sprite, chọn bằng
                 `tideSymbolId`) — chủ dự án: "đừng dùng hình tròn";
      XA   (z7): thêm tên trạm;
      VỪA  (z9): tên kèm "đang lên / đang xuống" (thuộc tính `nhan9`, tính
                 trong máy, làm mới theo phút).
    Màu nhãn = BLUE của bảng màu sprite (#2b74c4, 3,77:1 trên nền biển, 3,49:1
    với viền INK — cổng test) — kênh riêng: khác navy nhãn đảo, teal rạn, xanh
    lục khu trú bão, magenta đèn, tím xác tàu. */
export const TIDE_STATION_COLOR = "#2b74c4";
export const TIDE_STATION_MINZOOM = CHART_TIER.LUON;
export const TIDE_STATION_LABEL_MINZOOM = CHART_TIER.XA;
export const TIDE_STATION_TREND_MINZOOM = CHART_TIER.VUA;

export const TIDE_STATION_LAYER = {
  id: "tram-trieu-dot",
  type: "symbol",
  minzoom: TIDE_STATION_MINZOOM,
  layout: {
    "icon-image": ["get", "ic"],
    /*  ×1,5 so với bản đầu (chủ dự án 2026-09-04: "icon thuỷ triều đang nhỏ,
        ở các lớp đang bị lẫn các icon khác"): 1,1 = 26 px @z5 → 1,45 = 35 px
        @z9 → 1,8 = 43 px @z13. Chỉ 11 trạm cả nước, to hơn đèn biển và phao
        một bậc là ĐÚNG THỨ BẬC: trạm con nước là MỐC để hỏi "giờ nước", phao
        là chỉ dẫn cục bộ — cùng lý do đèn biển to hơn phao. */
    "icon-size": ["interpolate", ["linear"], ["zoom"], 5, 1.1, 9, 1.45, 13, 1.8],
    // 11 trạm rải cả nước — không bao giờ chồng nhau, nhưng KHÔNG được để
    // nhãn đảo/rạn giấu mất trạm: cho phép chồng như đèn biển
    "icon-allow-overlap": true,
    "icon-ignore-placement": true,
    "icon-anchor": "center",
  },
} as const;

export const TIDE_STATION_LABEL_LAYER = {
  id: "tram-trieu-ten",
  type: "symbol",
  minzoom: TIDE_STATION_LABEL_MINZOOM,
  layout: {
    // z7–9: tên; từ z9: tên + đang lên/xuống (`nhan9` do map-view tính)
    "text-field": ["step", ["zoom"], ["get", "ten"], TIDE_STATION_TREND_MINZOOM, ["get", "nhan9"]],
    "text-font": ["Noto Sans Bold"],
    "text-size": ["interpolate", ["linear"], ["zoom"], 7, 12, 12, 15],
    // icon to hơn ⇒ đẩy tên xuống theo, không đè lên khối nước
    "text-offset": [0, 1.35],
    "text-anchor": "top",
    "text-allow-overlap": false,
    "text-padding": 4,
  },
  paint: {
    "text-color": TIDE_STATION_COLOR,
    "text-halo-color": "#ffffff",
    "text-halo-width": 1.6,
  },
} as const;
export const CHAT_DAY_PMTILES_URL = "pmtiles:///data/chat-day.v1.pmtiles";
/*  ĐO LẠI 2026-09-03: bộ màu cũ @0,5 chỉ đạt 1,39–2,11:1 — "màu đủ sẫm" trong
    comment trên là chưa đo. Chấm chất đáy là ICON (điểm), sàn 3:1 như mọi ký
    hiệu. Sửa CẢ HAI: màu tối hơn một bậc (giữ đúng hue để chú giải góc vẫn
    khớp) + độ mờ 0,5 → 0,8. Số đo trên #d5e8eb SAU khi pha 0,8:
      Cát 3,55 · Đá 4,78 · San hô 3,46 · Vụn 3,73 · Cỏ 3,50 · Rong 3,46 ·
      chưa rõ 3,28 — tất cả ≥3:1, có cổng test.
    San hô kéo về đất nung #a3452a (không còn cam tươi #e2674a lấn kênh cảnh
    báo của hiểm hoạ/vùng cấm — reviewer A.3); vẫn khác đỏ độ sâu #b3261e
    nhờ HÌNH (chấm nhỏ dày đặc vs chấm có số bên cạnh), độ sáng hai màu gần
    nhau (1,07) là điểm ghi nhận, chưa phải lỗi chặn. */
export const CHAT_DAY_OPACITY = 0.8;
export const CHAT_DAY_COLORS: Record<string, string> = {
  S: "#7d5608", // Cát — vàng cát sẫm (nâu vàng)
  R: "#454049", // Đá — xám đá trầm
  Co: "#a3452a", // San hô — đất nung
  G: "#7a4f1f", // Vụn san hô, đá vụn — nâu đất
  Sg: "#1f6b45", // Cỏ biển — lục rêu sẫm
  Ma: "#5a6318", // Thảm rong tảo — ô-liu sẫm
  khac: "#5a636b", // chưa rõ loại — xám trung tính sẫm
};

/*
  SỐ ĐO SÂU CHÍNH THỨC (2026-08-31) — 379 điểm + 96 tuyến khảo sát của cơ quan
  nhà nước, cộng 13 đoạn luồng có độ sâu khống chế.

  MÀU MANG THÔNG TIN, KHÔNG TRANG TRÍ. Hải đồ giấy in số đo sâu màu đen tất;
  ở đây tô theo NGƯỠNG NGUY HIỂM vì bà con đọc dưới nắng chói trên tàu đang
  chạy, không phải ngồi bàn dò từng con số:
   · dưới 4 m  → đỏ sẫm: mớn nước tàu cá vỏ gỗ 15–20 m thường 1,8–2,5 m, cộng
                 sóng lừng là chạm đáy. Đây là ngưỡng "đừng vào".
   · 4–12 m    → nâu sẫm: qua được nhưng phải nhìn con nước.
   · từ 12 m   → lam sẫm: không phải chuyện phải lo.

  Cả ba đều SẪM trên nền biển sáng (#d5e8eb) — chói nắng thì độ tương phản là
  thứ cứu được, màu tươi không cứu được. Có test canh tỷ lệ tương phản.
*/
export const DEPTH_DANGER_COLOR = "#b3261e"; // < 4 m
export const DEPTH_SHALLOW_COLOR = "#8a5a00"; // 4–12 m
export const DEPTH_SAFE_COLOR = "#1c4b66"; // >= 12 m

/** Ranh giới ba dải, mét. Đổi ở đây là đổi cả chấm lẫn nhãn lẫn đường luồng. */
export const DEPTH_DANGER_M = 4;
export const DEPTH_SHALLOW_M = 12;

/*
  NẤC ZOOM — số đo sâu là dữ liệu CỬA LUỒNG/CẢNG, dày đặc và chụm. Bày từ xa
  thì thành một vũng mực che mất bờ, đúng lúc bà con cần nhìn bờ nhất.
   · đoạn luồng (đường) từ z9  — vào tuyến luồng thì đã cần biết luồng sâu bao nhiêu
   · chấm đo sâu      từ z11 — áp cửa
   · SỐ bên chấm      từ z12,5 — chỉ khi đủ gần để chữ không chồng nhau
*/
export const FAIRWAY_DEPTH_MINZOOM = CHART_TIER.VUA;
export const SOUNDING_DOT_MINZOOM = CHART_TIER.SAT;
// = CHART_TIER.SAT + 1,5 — giữ số để scripts/kiem-ban-do.mjs đọc được; test canh đẳng thức
export const SOUNDING_LABEL_MINZOOM = 12.5;

/*
  ĐÈN BIỂN HIỆN SỚM HƠN MỌI BÁO HIỆU KHÁC (2026-09-02) — z7, trong khi phao/tiêu
  từ z9 và số đo sâu từ z11.

  Vì sao không xếp cùng một nấc: đèn biển có TẦM HIỆU LỰC 15–25 hải lý, tức bà
  con nhìn thấy nó từ ngoài khơi xa, và nó là thứ định hướng khi mọi thứ khác
  tắt. Một cái phao chỉ có nghĩa khi đã vào tới luồng; một ngọn đèn có nghĩa
  đúng lúc còn cách bờ 25 hải lý và đang tìm đường vào. Bắt nó chờ tới z9 là
  giấu đúng lúc nó hữu ích nhất.

  Ở z7 khung nhìn rộng ~2°, và cả nước chỉ có 90 ngọn — không có nguy cơ rối.
*/
export const LIGHTHOUSE_MINZOOM = CHART_TIER.XA;
export const LIGHTHOUSE_LABEL_MINZOOM = CHART_TIER.VUA;

/*
  XÁC TÀU + CHƯỚNG NGẠI VẬT (2026-09-02) — 38 vật chìm từ Thông báo hàng hải.

  Hiện từ z8 — SỚM hơn phao (z9): phao chỉ có nghĩa trong luồng, còn xác tàu
  nằm cả ngoài bãi lưới; tàu giã cào quét trúng là mất lưới, ban đêm chạy qua
  vật cạn là thủng vỏ. 38 điểm cả nước thì z8 không rối được.

  MÀU TÍM SẪM #5b2333 — cố ý KHÔNG trùng kênh nào đang có: đỏ = độ sâu nguy
  hiểm, cam đất = hiểm hoạ rạn OSM, magenta = báo hiệu có đèn. Vật chìm là
  loại nguy riêng, cần nhận ra riêng. Đặc trên nền biển #d5e8eb.

  NỢ ĐÃ TRẢ (2026-09-02b): build-chart-sprite nay có `wreck`/`wreck-depth`/
  `obstruction` tự vẽ, test pixel đủ (bóng khác ≥61% so với mọi hình dễ nhầm)
  — lớp chuyển từ vòng tròn tạm sang KÝ HIỆU thật, quen mắt như hải đồ giấy.
*/
export const WRECK_MINZOOM = CHART_TIER.XA;
/*  SỐ độ sâu nước trên xác tàu hiện muộn hơn HÌNH một tầng (Navionics: "WK
    7.8MT" chỉ ở zoom gần). Ở tầng XA hình đã đủ nói "có vật chìm ở đây";
    con số là chuyện lúc tới gần. */
export const WRECK_DEPTH_MINZOOM = CHART_TIER.VUA;
export const WRECK_COLOR = "#5b2333";

export const WRECK_LAYER = {
  id: "xac-tau",
  type: "symbol",
  minzoom: WRECK_MINZOOM,
  layout: {
    "icon-image": ["get", "ic"],
    /*  NẤC ĐẦU 0,7 × 24 = 16,8 px — KHÔNG được thấp hơn: 0,6 cũ = 14,4 px, DƯỚI
        sàn CHART_ICON_MIN_PX = 16 mà chính repo đặt (chart-symbols.ts). Đúng
        nấc lớp này được cho hiện sớm "vì quan trọng" lại là nấc nó nhỏ hơn
        sàn. Có test quét mọi nấc của mọi spec symbol. */
    "icon-size": ["interpolate", ["linear"], ["zoom"], 8, 0.7, 12, 0.95, 15, 1.2],
    /*  CHO PHÉP CHỒNG — cùng luật với phao và đèn: một xác tàu bị giấu vì
        chồng lên ký hiệu bên cạnh là mất đúng thứ làm rách lưới thủng vỏ. */
    "icon-allow-overlap": true,
    "icon-ignore-placement": true,
    "icon-anchor": "center",
    /*  SỐ ĐỘ SÂU VƯỢT QUA dán cạnh phải ký hiệu — `wreck-depth` chừa sẵn
        vùng trống x≥15/24 cho đúng chỗ này. Mục không có số thì `nhan` rỗng,
        MapLibre không vẽ gì. */
    "text-field": ["step", ["zoom"], "", WRECK_DEPTH_MINZOOM, ["get", "nhan"]],
    "text-font": ["Noto Sans Bold"],
    "text-size": ["interpolate", ["linear"], ["zoom"], 8, 10, 14, 13],
    "text-offset": [0.85, 0.1],
    "text-anchor": "left",
    "text-allow-overlap": true,
  },
  paint: {
    "text-color": WRECK_COLOR,
    "text-halo-color": "#ffffff",
    "text-halo-width": 1.5,
  },
} as const;

/** Biểu thức MapLibre tô theo dải, dùng chung cho chấm · nhãn · đường luồng. */
export function depthColorExpr(prop: string) {
  return [
    "step",
    ["get", prop],
    DEPTH_DANGER_COLOR,
    DEPTH_DANGER_M,
    DEPTH_SHALLOW_COLOR,
    DEPTH_SHALLOW_M,
    DEPTH_SAFE_COLOR,
  ] as const;
}

/*
  SPEC BA LỚP ĐỘ SÂU ĐỂ Ở ĐÂY, KHÔNG VIẾT THẲNG TRONG JSX (2026-08-31).

  Vì sao: cổng "style phải hợp lệ với chính MapLibre" (xem ocean-map.test) chỉ
  soi được thứ `buildMapStyle` dựng ra. Lớp viết thẳng trong JSX đứng NGOÀI cổng
  đó — mà đây đúng là loại lỗi MapLibre không kêu: biểu thức sai thì nó lặng lẽ
  bỏ cả lớp, bản đồ mất sạch số đo sâu giữa biển mà không một dòng lỗi nào.

  Để ở đây thì JSX chỉ còn `<Layer {...SPEC} />`, và bộ kiểm của chính thư viện
  soi được đúng cái sẽ chạy — không phải một bản chép tay đoán lại.
*/
export const DEPTH_LINE_LAYER = {
  id: "depth-line",
  type: "line",
  minzoom: FAIRWAY_DEPTH_MINZOOM,
  paint: {
    "line-color": depthColorExpr("d"),
    "line-width": ["interpolate", ["linear"], ["zoom"], 9, 1.6, 14, 3.4],
    /*  0,8 chứ không 0,55: dưới nắng chói nét mờ là nét không có. Cùng bài học
        với đường đẳng sâu — có cổng tương phản canh, đừng hạ. */
    "line-opacity": 0.8,
  },
} as const;

/*
  SỐ CŨ VẼ RỖNG RUỘT, SỐ MỚI VẼ ĐẶC (2026-09-01).

  Vì sao phải phân biệt: 147/149 điểm quá một năm tuổi rơi trúng dải 4–12 m —
  ĐÚNG dải ra quyết định của tàu mớn 1,5–3 m. Ở cửa lạch bồi lắng, số 7,7 năm
  tuổi và số ba tháng tuổi là hai thứ khác hẳn nhau; vẽ giống hệt nhau là app
  tự nhận một độ chắc chắn mà nguồn không cho.

  Chọn RỖNG RUỘT chứ không thêm màu: màu đã mang nghĩa "nông/sâu", chồng thêm
  nghĩa "cũ/mới" lên cùng một kênh là bắt bà con giải mã hai thứ trong một chấm
  dưới nắng. Rỗng-đặc là kênh riêng, và nó trùng với trực giác sẵn có "nét đứt
  = chưa chắc". Con số bên cạnh vẫn in đầy đủ — cũ không có nghĩa là giấu.
*/
export const SOUNDING_DOT_LAYER = {
  id: "sounding-dot",
  type: "circle",
  minzoom: SOUNDING_DOT_MINZOOM,
  paint: {
    // đặc thì tô ruột; cũ thì ruột trong suốt, chỉ còn vành
    "circle-color": depthColorExpr("d"),
    "circle-opacity": ["case", ["==", ["get", "cu"], 1], 0, 0.95],
    "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, 2.6, 15, 5],
    // vành: điểm mới viền trắng cho nổi trên nền biển; điểm cũ lấy chính màu
    // dải độ sâu làm vành, dày hơn — vẫn đọc được nông/sâu ở khoảng cách xa
    "circle-stroke-color": [
      "case",
      ["==", ["get", "cu"], 1],
      depthColorExpr("d"),
      "#ffffff",
    ],
    "circle-stroke-width": ["case", ["==", ["get", "cu"], 1], 2, 1.2],
  },
} as const;

/*  SỐ đặt BÊN PHẢI chấm, không đè lên — hải đồ giấy in số ngay cạnh mốc đo.
    `text-allow-overlap` để TẮT: chỗ khảo sát dày thì thà mất vài số còn hơn
    thành đám mực không đọc được, đúng chỗ luồng hẹp cần đọc nhất. */
/*  ĐÈN BIỂN — ký hiệu hải đồ, to hơn phao một bậc.

    Kích thước KHÔNG phải trang trí: trên hải đồ giấy, đèn biển vẽ lớn hơn phao
    vì nó là mốc định hướng, còn phao là chỉ dẫn cục bộ. Giữ đúng thứ bậc đó thì
    bà con quen hải đồ giấy đọc được ngay, không phải học lại. */
export const LIGHTHOUSE_LAYER = {
  id: "den-bien",
  type: "symbol",
  minzoom: LIGHTHOUSE_MINZOOM,
  layout: {
    "icon-image": ["get", "ic"],
    // nấc đầu 0,7 = 16,8 px ≥ sàn 16 (cũ 0,55 = 13,2 px — vi phạm sàn của repo)
    "icon-size": ["interpolate", ["linear"], ["zoom"], 7, 0.7, 11, 0.95, 15, 1.25],
    /*  CHO PHÉP CHỒNG — cùng luật với phao: một ngọn đèn bị giấu vì chồng lên
        cái bên cạnh là mất đúng thứ cần thấy lúc tìm đường vào bờ ban đêm. */
    "icon-allow-overlap": true,
    "icon-ignore-placement": true,
    "icon-anchor": "bottom",
  },
} as const;

/*  TÊN ĐÈN — hiện muộn hơn ký hiệu hai nấc. Thấy ngọn đèn trước, đọc tên sau;
    ở z7 mà dán 90 cái tên thì cả dải bờ thành một hàng chữ. */
export const LIGHTHOUSE_LABEL_LAYER = {
  id: "den-bien-ten",
  type: "symbol",
  minzoom: LIGHTHOUSE_LABEL_MINZOOM,
  layout: {
    "text-field": ["get", "ten"],
    "text-font": ["Noto Sans Bold"],
    "text-size": ["interpolate", ["linear"], ["zoom"], 9, 11, 14, 15],
    "text-offset": [0, 0.7],
    "text-anchor": "top",
    "text-allow-overlap": false,
    "text-padding": 4,
  },
  paint: {
    "text-color": SEAMARK_LIT_COLOR,
    "text-halo-color": "#ffffff",
    "text-halo-width": 1.6,
  },
} as const;

export const SOUNDING_LABEL_LAYER = {
  id: "sounding-label",
  type: "symbol",
  minzoom: SOUNDING_LABEL_MINZOOM,
  layout: {
    "text-field": ["get", "nhan"],
    "text-font": ["Noto Sans Bold"],
    "text-size": ["interpolate", ["linear"], ["zoom"], 12.5, 12, 16, 16],
    "text-offset": [0.9, 0],
    "text-anchor": "left",
    "text-allow-overlap": false,
    "text-padding": 3,
  },
  paint: {
    "text-color": depthColorExpr("d"),
    "text-halo-color": "#ffffff",
    "text-halo-width": 1.6,
  },
} as const;
// (KHÔNG đụng cam-đỏ #b42318 của ranh giới, không đụng xanh ROUTE_LINE_COLOR)

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

/**
 * MỐC CHÈN cho lớp bờ offline (`beforeId`) — lớp trống, không vẽ gì.
 *
 * VÌ SAO CÓ (soát 2026-08-02): lớp bờ + đảo lưu trong máy được khai báo bằng
 * JSX nên MapLibre chèn nó LÊN TRÊN CÙNG, dù chú thích ngay cạnh nói nó "nằm
 * dưới mọi lớp khác" — nói một đằng làm một nẻo, ai sửa sau cũng dính bẫy.
 * Nay chỉ đích danh: bờ offline nằm NGAY TRÊN nền + mask, DƯỚI mọi lớp nội
 * dung (ảnh vệ tinh, đẳng sâu, phao đèn, ranh giới, cá, mũi tên gió).
 *
 * ĐỪNG chèn nó xuống dưới `sea-mask`: mask tô kín ô biển 109.6–116.8°E ở mức
 * toàn cảnh, chèn dưới là XOÁ HOÀNG SA + TRƯỜNG SA khỏi bản đồ lúc mất sóng.
 */
export const OFFLINE_COAST_BEFORE_ID = "base-top";

/** Khung nhìn mặc định: thấy trọn bờ biển VN + Hoàng Sa + Trường Sa */
export const DEFAULT_VIEW = { longitude: 110.8, latitude: 12.8, zoom: 4.6 };

/** Điểm xem dự báo mặc định: ngoài khơi Nam Trung Bộ */
export const DEFAULT_POINT = { lat: 13.0, lon: 110.5 };

/*
  LỚP NỀN KHÔNG BAO GIỜ VẼ RA GÌ — cắt để đỡ việc (2026-08-30).

  VÌ SAO CHÚNG CHẾT, đo chứ không đoán: nền là bản trích **z0–9**, mà Protomaps
  chỉ phát thuộc tính `is_bridge` / `is_tunnel` ở mức zoom sâu hơn. Giải nén
  kiểm tận nơi: feature `roads` trong file chỉ mang `kind, kind_detail,
  min_zoom, sort_rank, is_link` — KHÔNG có `is_bridge`, KHÔNG có `is_tunnel`.
  Nên 10 lớp cầu + 10 lớp hầm không có gì để lọc trúng; thêm 8 lớp đòi giá trị
  `minor_road/other/path/rail/pier/taxiway` không tồn tại, `landuse_pier`, và
  `buildings` (source-layer 0 ô).

  Cắt 30 lớp này: 61 → 31 lớp, 1.591 → 1.049 phép lọc mỗi ô z9 (−34%),
  **0 pixel đổi**.

  ⚠️ DANH SÁCH NÀY GẮN VỚI BẢN NỀN HIỆN TẠI. Sinh lại nền sâu hơn z9 là mấy lớp
  cầu/hầm SỐNG LẠI và việc cắt thành SAI. Đừng sửa tay: chạy
  `node scripts/audit-style.mjs --json` rồi lấy lại danh sách, mỗi lần dựng nền.
*/
const BASEMAP_DEAD_LAYERS = new Set([
  "buildings",
  "landuse_pier",
  "roads_taxiway",
  "roads_pier",
  "roads_rail",
  "roads_other",
  "roads_minor",
  "roads_minor_casing",
  "roads_minor_service",
  "roads_minor_service_casing",
  "roads_tunnels_other",
  "roads_tunnels_other_casing",
  "roads_tunnels_minor",
  "roads_tunnels_minor_casing",
  "roads_tunnels_link",
  "roads_tunnels_link_casing",
  "roads_tunnels_major",
  "roads_tunnels_major_casing",
  "roads_tunnels_highway",
  "roads_tunnels_highway_casing",
  "roads_bridges_other",
  "roads_bridges_other_casing",
  "roads_bridges_minor",
  "roads_bridges_minor_casing",
  "roads_bridges_link",
  "roads_bridges_link_casing",
  "roads_bridges_major",
  "roads_bridges_major_casing",
  "roads_bridges_highway",
  "roads_bridges_highway_casing",
]);

/*
  BỎ TOÀN BỘ NHÓM `landuse_*` — BA lý do cùng lúc (2026-08-30, chủ dự án chốt).

  (1) CHỦ QUYỀN, và đây là lý do nặng nhất. Giải nén kiểm tận nơi: `landuse`
      mang `aerodrome` ở Phú Lâm (Hoàng Sa) và Đá Vành Khăn, `airfield` ở Đá Chữ
      Thập, `military` + `airfield` ở Đá Xu Bi. Ba lớp còn sống (`landuse_
      aerodrome`, `landuse_runway`, và bộ lọc của `landuse_park` bao cả
      `military`) ĐANG VẼ chúng ra màn hình — tức app đang vẽ **sân bay và khu
      quân sự Trung Quốc xây trên Hoàng Sa/Trường Sa** như đối tượng bản đồ bình
      thường. Không có chữ (nhãn đã bỏ hết), nhưng hình khối thì có.
  (2) TỐC ĐỘ: `landuse` chiếm **45% dung lượng file nền** (49.532 feature /
      3,78 triệu đỉnh / 8,86 MB). Bỏ 10 lớp ⇒ 1.049 → 184 phép lọc mỗi ô z9.
  (3) DỄ ĐỌC HƠN: đất thành một tông phẳng, ranh đất–nước hằn rõ dưới nắng chói
      — đúng chất hải đồ. Bà con đi biển không dùng màu rừng/dân cư để định vị.

  ⚠️ ĐẢO KHÔNG MẤT. Khối đất do lớp `earth` vẽ, không phải `landuse` — kiểm 7
  nơi: Trường Sa Lớn và Song Tử Tây có `earth` mà **0 landuse** (không đổi một
  pixel); Phú Lâm 1 earth / 1 landuse; đất liền Đà Nẵng 1 earth / 136 landuse.
  Cái mất là màu tô trong đất liền và vài đảo lớn, không phải hình đảo.
*/

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

  // NỀN VECTOR từ PMTiles (Protomaps) thay CARTO raster (nay đòi API key +
  // watermark). CHỈ LẤY HÌNH HỌC (đất/nước/bờ/đường/landcover), BỎ:
  //  · lớp `symbol` — mọi NHÃN OSM (nơi lọt tên Hải Nam/đảo tranh chấp bằng chữ
  //    Trung); không nhãn OSM = KHÔNG THỂ dính chữ Trung.
  //  · `background` — đã có sea-bg riêng (nền nước offline).
  //  · `boundaries*` — RANH GIỚI QUỐC GIA Protomaps có thể lọt đường tranh chấp
  //    Biển Đông; app tự vẽ ranh giới biển VN (border-line) + nhãn chủ quyền.
  // Nhãn tiếng Việt do app tự vẽ (đảo/chủ quyền/rạn). Không key, same-origin →
  // SW giữ được (offline).
  const basemapGeom = (
    protomapsLayers("basemap", namedFlavor("light")) as Array<{
      id: string;
      type: string;
    }>
  ).filter(
    (l) =>
      l.type !== "symbol" &&
      l.id !== "background" &&
      !l.id.startsWith("boundaries") &&
      !BASEMAP_DEAD_LAYERS.has(l.id) &&
      !l.id.startsWith("landuse_"),
  ) as object[];

  const sources: Record<string, object> = {
    basemap: {
      type: "vector",
      url: "pmtiles:///data/vn-basemap.pmtiles",
      /*  CÂU MIỄN TRỪ ĐỘ SÂU (2026-08-29) — BẮT BUỘC, không phải cho đẹp.

          Giấy phép của chính bộ dữ liệu đang dùng (ERDDAP, ETOPO 2022) ghi:
          "The data may be used and redistributed for free but is NOT INTENDED
          FOR LEGAL USE, since it may contain inaccuracies." Mà app lại đang
          bày độ sâu trong bối cảnh DẪN ĐƯỜNG, và lưới ETOPO 15" là ô ~450 m —
          về nguyên tắc không phân giải nổi một cái rạn hay một cái luồng rộng
          100 m. Đo thật 2026-08-29: 5/25 tâm rạn bị phân loại "đủ sâu" trong
          khi nước chỉ 1–2 m.

          CLAUDE.md xếp "hứa độ chính xác dữ liệu mà nguồn không đảm bảo" vào
          danh sách KHÔNG ĐƯỢC. Câu này là cách giữ lời hứa đó. ĐỪNG GỠ. */
      attribution:
        "Ảnh: NASA · Độ sâu: ETOPO/EMODnet/GEBCO · Phao đèn: OpenSeaMap · " +
        "Nền: © OpenStreetMap © Protomaps · Dự báo: Open-Meteo — " +
        "Số độ sâu chỉ để THAM KHẢO, KHÔNG thay hải đồ chính thức và Thông báo hàng hải.",
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
    // NỀN NƯỚC vẽ trước mọi thứ: ô bản đồ nền là host ngoài, mất sóng thì không
    // về — không có lớp này thì màn hình TRẮNG BỐC. Có nó thì tệ nhất bà con
    // cũng thấy "biển" đúng màu, rồi lớp bờ trong máy vẽ hình đất lên (xem
    // lib/offline-basemap.ts).
    { id: "sea-bg", type: "background", paint: { "background-color": SEA_MASK_COLOR } },
    // Hình học nền Protomaps (đất/nước/bờ/đường — KHÔNG nhãn) nằm trên nền nước.
    ...basemapGeom,
    {
      id: "sea-mask",
      type: "fill",
      source: "sea-mask",
      maxzoom: 9,
      paint: {
        "fill-color": SEA_MASK_COLOR,
        // Mask chỉ cần che nhãn quốc tế ở mức TOÀN CẢNH (z≤6, nơi "South China
        // Sea"/Paracel/Spratly hiện). Zoom gần bờ thì mờ dần rồi tắt (z8) để
        // KHÔNG che luồng lạch / cảng / chi tiết ven bờ của basemap.
        "fill-opacity": ["interpolate", ["linear"], ["zoom"], 6, 1, 8, 0],
      },
    },
    // MỐC CHÈN — lớp trống (opacity 0, MapLibre bỏ qua lúc vẽ). Xem
    // OFFLINE_COAST_BEFORE_ID ở trên: nó là ranh giới giữa "nhóm nền" và
    // "nhóm nội dung", để lớp bờ offline có chỗ đứng CHẮC CHẮN.
    {
      id: OFFLINE_COAST_BEFORE_ID,
      type: "background",
      paint: { "background-opacity": 0 },
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
      // Zoom sâu (z>12, nhìn luồng lạch vào cảng) thì nhả lớp ảnh/độ sâu ra,
      // để basemap (bờ biển, cảng, sông lạch) + phao đèn hiện rõ — kiểu hải đồ
      // gần bờ. Mức vùng (z≤12) vẫn xem được nhiệt/mồi/độ sâu.
      maxzoom: 12,
      paint: {
        "raster-opacity": def.opacity ?? 0.85,
        "raster-fade-duration": 150,
      },
    });
  }

  // ĐƯỜNG ĐẲNG SÂU + SỐ MÉT — chất "hải đồ" thật (tự sinh từ ETOPO vì
  // EMODnet WMS chỉ phủ châu Âu — xem scripts/generate-isobaths.mjs).
  // Chỉ vẽ trên nền hải đồ; các nền vệ tinh không cần.
  if (layerId === "bathymetry") {
    /*  FILE NÀY MANG HAI VAI (2026-09-01) — mỗi Feature có `k`:
          · `k:"duong"` — MultiLineString, 9 mức: dùng cho NÉT và NHÃN số mét
          · `k:"vung"`  — MultiPolygon, 8 mức từ 10 m: dành cho dải TÔ
    
        ⚠️ MỌI lớp đọc nguồn này PHẢI lọc theo `k`. Thiếu bộ lọc thì lớp nét
        vẽ luôn cả BIÊN ĐA GIÁC — trong đó có ~201° (~22.000 km) đoạn mép
        khung, thành những nét "2000 m" thẳng băng dọc 102°Đ / 118°Đ / 5°B.
        Có cổng canh trong ocean-map.test. */
    sources["isobaths"] = {
      type: "geojson",
      data: "/data/isobaths.v1.json",
    };
    /*  DẢI "ĐỦ NƯỚC" KIỂU HẢI ĐỒ GIẤY (2026-09-02) — chủ dự án: lớp Hải đồ
        chi tiết phải quen mắt như hải đồ thương mại. Trên giấy: nước sâu để
        TRẮNG, nước nông ăn màu. Ở đây làm đúng chiều đó: vùng ≥10 m (k="vung",
        d=10) phủ MỘT lớp sáng — phần nông giữ nguyên màu biển, tự thành "dải
        nông" mà không tô thêm gì.

        Vì sao chiều này SỐNG trong khi chiều tô-đậm-phía-nông đã bị đo chết
        (xem cổng trong ocean-map.test): tô đậm kéo nét đẳng sâu xuống 1,09:1;
        tô SÁNG phía sâu thì nét nằm trên nền sáng hơn — tương phản TĂNG:
        đo 2026-09-02: nét 3,32 → 3,69:1 · số mét 11,5:1 · bước nông–sâu 1,11
        (đủ nhận ra như giấy). Cổng test đo lại đúng các số này. */
    /*  DẢI ĐỘ SÂU NHIỀU NẤC (kiểu C-MAP, reviewer A.6 2026-09-03) — nông→sâu
        SÁNG dần (chiều duy nhất giữ nét đẳng sâu ≥3:1, xem DEPTH_BANDS). Mỗi
        đa giác `k=vung, d` = "nước sâu từ d m trở lên": tô nấc i bằng đa giác
        d = toM của nấc TRƯỚC, vẽ nông→sâu để nấc sâu đè lên nấc nông. Nấc
        0–10 m chính là nền biển (SEA_MASK_COLOR), không cần đa giác. Nấc đầu
        giữ id `isobath-du-nuoc` cũ (cùng nghĩa: tô vùng ≥10 m). */
    for (let i = 1; i < DEPTH_BANDS.length; i++) {
      layers.push({
        id: i === 1 ? "isobath-du-nuoc" : `isobath-dai-${i}`,
        type: "fill",
        source: "isobaths",
        minzoom: CHART_TIER.LUON,
        filter: ["all", ["==", ["get", "k"], "vung"], ["==", ["get", "d"], DEPTH_BANDS[i - 1].toM]],
        /*  0,7 chứ KHÔNG 1 (reviewer A.11 R2): đa giác ETOPO 1/48° (~2,3 km) phủ
            trùm đảo nhỏ hơn ô (Song Tử Tây 0,13 km², Trường Sa Lớn) vì cả ô
            "sâu"; lớp này nằm TRÊN đất nền + bờ offline, opacity 1 là XOÁ đảo.
            0,7 giữ dải nhìn ra được mà đất vẫn ló qua (như bản 0,65 cũ). */
        paint: { "fill-color": DEPTH_BANDS[i].color, "fill-opacity": 0.7 },
      });
    }
    layers.push({
      id: "isobath-lines",
      type: "line",
      source: "isobaths",
      minzoom: CHART_TIER.LUON,
      // MỖI MỨC SÂU MỘT NẤC ZOOM (2026-08-29). Từ khi thêm mức 5 m và 10 m
      // (generate-isobaths.mjs ở bước 1/48°), vẽ TẤT CẢ mức từ z5 là ven bờ
      // thành búi chỉ rối — chín mức đẳng sâu chồng nhau trong một khoảng
      // hẹp, mà bà con nhìn dưới nắng chói trên tàu lắc. Hải đồ giấy cũng
      // không làm vậy: xa thì chỉ vài đường cái, gần mới thêm đường phụ.
      // Luật: đường CÀNG NÔNG thì đòi zoom CÀNG GẦN mới hiện.
      filter: ["all", ["==", ["get", "k"], "duong"], ISOBATH_ZOOM_FILTER],
      paint: {
        // màu nội dung bản đồ — xanh thép chìm dưới nhãn
        "line-color": "#3d6e96",
        // mức nông vẽ MẢNH hơn: chúng đông hơn hẳn, để cùng độ dày là át
        // mất đường 200/1000 m vốn là mốc định hướng vùng
        "line-width": [
          "interpolate",
          ["linear"],
          ["zoom"],
          5,
          0.5,
          9,
          ["case", ["<=", ["get", "d"], 20], 0.8, 1.1],
        ],
        /*  ĐỘ MỜ 0,55 → 0,85 (2026-08-29) — SỬA LỖI TƯƠNG PHẢN CÓ ĐO.
            Đo thật: `#3d6e96` đặc trên nền nước `#d5e8eb` đạt 4,28:1, thừa
            chuẩn. Nhưng pha 0,55 thì 45% nền nước trộn vào nét ⇒ màu thực tế
            ra `rgb(129,165,188)` = **2,06:1**, DƯỚI ngưỡng 3:1 mà WCAG đòi cho
            nét đồ hoạ. Tức là màu chọn không sai, độ mờ mới là thủ phạm —
            người sau đừng đi đổi màu.
            Chọn 0,85 (3,32:1) chứ không phải 0,80 (3,06:1, sát ngưỡng quá) và
            cũng không phải 1,0: giữ chút trong suốt để chỗ nhiều mức đẳng sâu
            chồng nhau còn đọc được lớp dưới. Bà con đọc màn hình dưới nắng
            chói trên tàu lắc — 3:1 là sàn, không phải đích. */
        "line-opacity": 0.85,
      },
    });
    /*  ĐƯỜNG AN TOÀN 10 m ĐẬM (C-MAP "safety contour", reviewer A.6) — vẽ đè
        lên `isobath-lines`, cùng nguồn `k=duong`, lọc d = SAFETY_CONTOUR_M.
        Nét dày ~2×, màu sẫm một bậc: mắt bắt ngay ranh "nông hơn đây là phải
        nhìn con nước". Xem lý do chọn 10 m ở SAFETY_CONTOUR_M. */
    layers.push({
      id: "isobath-safety",
      type: "line",
      source: "isobaths",
      minzoom: CHART_TIER.XA,
      filter: ["all", ["==", ["get", "k"], "duong"], ["==", ["get", "d"], SAFETY_CONTOUR_M]],
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": SAFETY_CONTOUR_STYLE.color,
        "line-width": SAFETY_CONTOUR_STYLE.width as unknown as number,
        "line-opacity": SAFETY_CONTOUR_STYLE.opacity,
      },
    });
    layers.push({
      id: "isobath-labels",
      type: "symbol",
      source: "isobaths",
      minzoom: 6,
      // nhãn hiện MUỘN HƠN đường một nấc: đường vừa xuất hiện mà đã dán số
      // ngay thì z9–z10 ven bờ đặc chữ. Thấy đường trước, đọc số sau.
      filter: ["all", ["==", ["get", "k"], "duong"], ISOBATH_LABEL_ZOOM_FILTER],
      layout: {
        "symbol-placement": "line",
        "text-field": ["concat", ["to-string", ["get", "d"]], " m"],
        "text-font": ["Noto Sans Regular"],
        "text-size": 11,
        "symbol-spacing": 350,
      },
      paint: {
        "text-color": "#14324f",
        "text-halo-color": "#ffffff",
        "text-halo-width": 1.4,
      },
    });
  }

  // Báo hiệu hàng hải (phao, đèn biển, vùng neo) — overlay trong suốt,
  // chỉ hiện khi zoom gần bờ; luôn nằm trên mọi lớp ảnh
  if (seamarks) {
    sources["seamarks"] = {
      type: "raster",
      // same-origin qua cầu tile → SW giữ được (xem lib/tile-proxy.ts)
      tiles: [proxyTileTemplate("seamark")],
      tileSize: 256,
      minzoom: 8,
    };
    layers.push({
      id: "seamarks",
      type: "raster",
      source: "seamarks",
      // phao, đèn, luồng lạch hiện sớm hơn một nấc (từ z8) để bà con thấy
      // báo hiệu khi mới áp bờ, không phải zoom sát mới ra
      minzoom: 8,
    });
  }

  return {
    version: 8 as const,
    // Font chữ trên bản đồ (số mét đường đẳng sâu…) TỰ HOST trong public/fonts.
    // Trước đây trỏ CDN fonts.openmaptiles.org — CDN đó nay trả trang HTML
    // chuyển hướng thay vì file .pbf (dò 2026-07-25) nên nhãn KHÔNG hiện, và dù
    // còn sống thì mất sóng cũng mất chữ vì SW không giữ được host ngoài.
    // Fontstack có sẵn: "Noto Sans Regular", "Noto Sans Bold" (dải 0-255,
    // 256-511, 7680-7935 — đủ số, chữ Latin và dấu tiếng Việt; 8192-8447 —
    // gạch ngang "–"/"—" trong tên tuyến, thêm 2026-09-03c). Thêm dải/kiểu
    // khác thì tải thêm .pbf vào public/fonts/<fontstack>/<dải>.pbf VÀ khai
    // vào CRITICAL_SHELL của sw.js — thiếu dải là MapLibre bỏ nguyên nhãn.
    // Nguồn: demotiles.maplibre.org/font/ (OFL). Cổng test đối chiếu ký tự
    // thật trong data nhãn với dải đang host (ocean-map.test "dải glyph").
    glyphs: "/fonts/{fontstack}/{range}.pbf",
    /*  BỘ KÝ HIỆU HẢI ĐỒ (2026-09-01) — phao, tiêu, đèn biển vẽ đúng HÌNH như
        hải đồ giấy thay vì chấm tròn tô màu.

        ⚠️ THIẾU DÒNG NÀY thì mọi `icon-image` **im lặng không vẽ** — MapLibre
        không có sprite thì bỏ qua ký hiệu mà không kêu một tiếng, và ba lớp báo
        hiệu biến mất khỏi bản đồ. Đây đúng loại lỗi chỉ lộ ra ngoài biển.

        Tự host cùng origin (4 file, 40 KB) nên service worker giữ được — cùng
        lý do với `glyphs`. Chi tiết bộ ký hiệu: `src/lib/chart-symbols.ts`.

        ⚠️ PHẢI TUYỆT ĐỐI (2026-09-03c): `"/icons/chart-sprite"` tương đối bị
        MapLibre v5 từ chối ("must be absolute") rồi im lặng bỏ MỌI icon —
        hai ngày không một phao/đèn nào vẽ mà test vẫn xanh vì validator style
        không bắt. Có cổng test riêng canh dạng URL này. */
    sprite: chartSpriteUrl(),
    sources,
    layers,
  };
}
