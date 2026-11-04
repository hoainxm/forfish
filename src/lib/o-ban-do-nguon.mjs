// Ô BẢN ĐỒ — phần THUẦN dùng chung giữa máy chủ (route /api/tiles, /api/o-ban-do/nhap) và máy nhà
// (scripts/o-ban-do-thu.mjs trên gpu-desktop). File .mjs không import gì ngoài Node để máy nhà chạy thẳng
// bằng `node`, không cần build (khuôn data-codec.mjs).
//
// Gồm: URL nguồn thật (một chỗ duy nhất — tile-proxy.ts dùng lại) · danh sách ô vùng biển VN · nhận diện PNG.
// KHÔNG ghép/trộn điểm ảnh nhiều ngày (anh Long 2026-11-04: "phải lấy đúng cái nguồn chứ ghép ảnh chế dữ liệu
// thì các dự báo sau sao đúng được?") — mỗi ô giữ NGUYÊN ảnh gốc của nguồn, chỉ chọn ngày mới nhất có ảnh.

const GIBS = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best";

/** URL nguồn thật. GIBS dùng thứ tự WMTS {z}/{y}/{x}; `date` = "default" hoặc "YYYY-MM-DD". */
export const URL_NGUON = {
  chart: (z, x, y) => `https://tiles.emodnet-bathymetry.eu/2020/baselayer/web_mercator/${z}/${x}/${y}.png`,
  seamark: (z, x, y) => `https://tiles.openseamap.org/seamark/${z}/${x}/${y}.png`,
  sst: (z, x, y, date = "default") =>
    `${GIBS}/GHRSST_L4_MUR_Sea_Surface_Temperature_Anomalies/default/${date}/GoogleMapsCompatible_Level7/${z}/${y}/${x}.png`,
  chlorophyll: (z, x, y, date = "default") =>
    `${GIBS}/VIIRS_NOAA20_Chlorophyll_a/default/${date}/GoogleMapsCompatible_Level7/${z}/${y}/${x}.png`,
};

/** Hộp vùng biển VN máy nhà tải trước: Vịnh Bắc Bộ → Hoàng Sa → Trường Sa → Vịnh Thái Lan. */
export const HOP_BIEN_VN = { tay: 101.5, dong: 118.5, nam: 4, bac: 23.5 };

function lon2x(lon, z) {
  return Math.floor(((lon + 180) / 360) * 2 ** z);
}
function lat2y(lat, z) {
  const r = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z);
}

/** Mọi ô {z,x,y} (XYZ) phủ hộp, z từ zMin tới zMax. */
export function oTrongHop(hop, zMin, zMax) {
  const out = [];
  for (let z = zMin; z <= zMax; z++) {
    const n = 2 ** z;
    const x0 = Math.max(0, lon2x(hop.tay, z));
    const x1 = Math.min(n - 1, lon2x(hop.dong, z));
    const y0 = Math.max(0, lat2y(hop.bac, z));
    const y1 = Math.min(n - 1, lat2y(hop.nam, z));
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) out.push({ z, x, y });
  }
  return out;
}

// ---------- Nhận diện PNG ----------

const CHU_KY = [137, 80, 78, 71, 13, 10, 26, 10];

export function laPng(buf) {
  if (!buf || buf.length < 8) return false;
  for (let i = 0; i < 8; i++) if (buf[i] !== CHU_KY[i]) return false;
  return true;
}
