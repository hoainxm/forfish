// Đường ranh giới biển Việt Nam (ranh giới ngoài: thềm lục địa / vùng đặc quyền
// kinh tế + đường phân định Vịnh Bắc Bộ). 52 điểm tọa độ chính thức do người
// dùng cung cấp ("Border Coordinate.xlsx"), thứ tự Tây Nam → Trường Sa → Vịnh
// Bắc Bộ. Dùng để cảnh báo tàu khi tới gần ranh giới (chống vi phạm IUU vượt
// vùng biển nước ngoài — lỗi nặng nhất, phạt tới 1 tỷ; xem docs/research/03).
//
// LƯU Ý: đây là tuyến ranh giới để CẢNH BÁO khoảng cách, không phải đường biên
// giới pháp lý chính thức để tra cứu. Luôn nhắc bà con nghe Biên phòng.

/** [kinh độ, vĩ độ] — thứ tự GeoJSON (lng trước, lat sau). */
export type LngLat = [number, number];

export const VN_MARITIME_BORDER: LngLat[] = [
  [103.8, 10.401667],
  [102.92, 9.903333],
  [103.171106, 9.583449],
  [102.203204, 8.781882],
  [103.034167, 7.816667],
  [103.595167, 7.305167],
  [105.82, 6.096667],
  [106.2, 6.25],
  [106.316944, 6.25],
  [106.660464, 6.349967],
  [109.645833, 6.303056],
  [109.286944, 6.8375],
  [109.841444, 5.852694],
  [111.02425, 6.249944],
  [112.561972, 7.661889],
  [115.096944, 7.661889],
  [115.0, 11.183333],
  [115.766667, 11.926667],
  [116.56, 13.74],
  [116.3, 16.0],
  [116.44, 17.29],
  [116.92, 18.54],
  [117.16, 19.55],
  [114.53, 18.48],
  [112.75, 16.0],
  [111.21, 15.58],
  [111.07, 16.0],
  [111.1, 16.47],
  [109.9, 16.7],
  [108.69, 17.3],
  [107.966667, 17.783333],
  [107.6525, 18.070278],
  [107.626111, 18.118889],
  [107.566667, 18.230278],
  [107.159444, 18.714444],
  [107.159444, 19.215278],
  [107.189722, 19.267778],
  [107.211944, 19.423889],
  [107.35, 19.423889],
  [107.527778, 19.659167],
  [107.929722, 19.959167],
  [108.379167, 20.401389],
  [108.208611, 21.209722],
  [108.134722, 21.275556],
  [108.095472, 21.352278],
  [108.094111, 21.456417],
  [108.094417, 21.457833],
  [108.097639, 21.460972],
  [108.099361, 21.463917],
  [108.100444, 21.467139],
  [108.101194, 21.470139],
];

/** GeoJSON LineString để vẽ lên bản đồ. */
export function borderGeoJSON(): GeoJSON.Feature<GeoJSON.LineString> {
  return {
    type: "Feature",
    properties: { name: "Ranh giới biển Việt Nam" },
    geometry: { type: "LineString", coordinates: VN_MARITIME_BORDER },
  };
}
