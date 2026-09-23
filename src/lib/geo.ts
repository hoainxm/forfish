/*
  HÌNH HỌC LÁ — không import gì trong repo.

  Vì sao tách ra (review đợt 4, G3): `spatial-index.ts` cần `haversineKm`/`LatLon`
  mà lấy từ `route-plan.ts`, trong khi `route-plan.ts` lại import `spatial-index`
  ⇒ chu trình import. Hôm nay vô hại (không module nào dùng binding của module
  kia ở cấp đầu file), nhưng chỉ cần ai thêm một hằng số cấp đầu file gọi qua
  chu trình là ra `undefined` lúc nạp — lỗi chỉ lộ trên máy bà con. Đưa phần
  không phụ thuộc ai xuống đây; `route-plan.ts` re-export để 30+ chỗ gọi cũ
  không phải đổi.

  Bán kính 6.371 km — CÙNG số với `spatial-index.KM_PER_DEG_LAT` (án lệ 936≠937).
*/

export type LatLon = { lat: number; lon: number };

export const EARTH_R_KM = 6371;

const rad = (d: number) => (d * Math.PI) / 180;

/** Khoảng cách vòng lớn, km. */
export function haversineKm(a: LatLon, b: LatLon): number {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_R_KM * Math.asin(Math.sqrt(s));
}
