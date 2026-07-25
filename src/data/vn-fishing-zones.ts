// Ranh giới VÙNG LỘNG khai thác thủy sản VN (giữa tuyến bờ và tuyến lộng theo
// NĐ 26/2019/NĐ-CP — vùng cho tàu 12–dưới 15m). 36 đỉnh do SDVico cung cấp
// (data.json cat "map", name "VungLong", 2026-07-25) — đường gấp khúc chạy dọc
// bờ từ Vịnh Bắc Bộ (~21°N) xuống Vịnh Thái Lan/Cà Mau rồi vòng ra phía biển
// lên lại, khép thành dải VÙNG LỘNG.
//
// LƯU Ý (như ranh giới ngoài): đây là SƠ ĐỒ THAM KHẢO để bà con hình dung vùng
// hoạt động theo cỡ tàu, KHÔNG phải căn cứ pháp lý. Ranh giới chính thức theo
// Phụ lục IV-A NĐ 26/2019 — tra Chi cục Thủy sản / Bộ NN&PTNT trước khi ra khơi.

import type { LngLat } from "@/data/vn-maritime-border";

/** Đỉnh polygon vùng lộng [lng, lat] — thứ tự khép vòng (MapLibre tự nối cuối→đầu) */
export const VUNG_LONG_POLYGON: LngLat[] = [
  [108.2086, 21.2097],
  [107.4561, 20.7189],
  [107.2069, 20.6144],
  [105.9339, 19.3475],
  [105.9964, 18.7928],
  [106.6725, 17.9139],
  [107.3431, 17.1608],
  [109.1397, 15.3778],
  [109.5694, 12.655],
  [109.1572, 11.1497],
  [106.9789, 10.0106],
  [106.6719, 9.3575],
  [105.7481, 8.9742],
  [105.2403, 8.4181],
  [104.5369, 8.4089],
  [104.5367, 10.0],
  [104.005, 10.0],
  [103.8075, 10.3794],
  [103.4244, 9.9933],
  [103.6944, 9.5],
  [104.0306, 9.4992],
  [104.0331, 7.8989],
  [105.4661, 7.9183],
  [106.0464, 8.5533],
  [107.0469, 8.9686],
  [107.3517, 9.6036],
  [109.5761, 10.7767],
  [110.0897, 12.6144],
  [109.6244, 15.6211],
  [107.5786, 17.3939],
  [107.0319, 18.0],
  [106.885, 18.3161],
  [106.6214, 18.6667],
  [106.6214, 19.5519],
  [107.1281, 20.0],
  [108.2944, 20.8033],
];

/** Polygon GeoJSON cho lớp bản đồ (ring khép: lặp lại đỉnh đầu ở cuối) */
export function vungLongGeoJSON(): GeoJSON.Feature<GeoJSON.Polygon> {
  const ring: LngLat[] = [...VUNG_LONG_POLYGON, VUNG_LONG_POLYGON[0]];
  return {
    type: "Feature",
    properties: {},
    geometry: { type: "Polygon", coordinates: [ring] },
  };
}
