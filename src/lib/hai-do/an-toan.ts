/*
  CHẾ ĐỘ HẢI ĐỒ — ĐƯỜNG AN TOÀN + VÉC-TƠ HƯỚNG ĐI (2026-11-04, đợt 1). Thuần, có test.

  ĐƯỜNG AN TOÀN (safety contour): máy hải đồ cho người đi biển đặt độ sâu an
  toàn rồi tô đậm ĐƯỜNG ĐẲNG SÂU đầu tiên không nông hơn số đó (dữ liệu chỉ có
  vài mức đẳng sâu nên không vẽ được đúng 3,7 m — lấy mức sâu kế tiếp, nghiêng
  về an toàn). Màn bản đồ cũ cố định 10 m (`SAFETY_CONTOUR_M`).

  ## Assumptions
  - SÀN 10 m: dưới 10 m dữ liệu đẳng sâu kém tin (xem chú thích SAFETY_CONTOUR_M
    trong ocean-map.ts) — vẽ đường 5 m đậm là hứa một độ tin không có. Nên mớn
    nhỏ vẫn ra 10 m; mớn > 9 m (hoặc bà con tự chọn) mới lên 20/50 m.
  - Mặc định = mớn + 1 m (chừa sóng lừng + sai số), rồi làm tròn lên mức đẳng sâu.
*/

import type { LatLon } from "@/lib/route-plan";

/** Mức đẳng sâu có trong `isobaths.v1.json` mà bà con được chọn làm đường an toàn. */
export const MUC_AN_TOAN_M = [10, 20, 50] as const;
export type MucAnToan = (typeof MUC_AN_TOAN_M)[number];

/** Chừa thêm dưới đáy tàu khi suy từ mớn (m). */
export const DU_DUOI_DAY_M = 1;

/**
 * Đường an toàn (m) để tô đậm.
 * `chon` = bà con tự chọn (ưu tiên); không chọn ⇒ suy từ mớn; không có mớn ⇒ 10 m.
 */
export function duongAnToanM(draftM: number | null | undefined, chon?: number | null): MucAnToan {
  if (chon != null && (MUC_AN_TOAN_M as readonly number[]).includes(chon)) return chon as MucAnToan;
  const can = typeof draftM === "number" && Number.isFinite(draftM) && draftM > 0 ? draftM + DU_DUOI_DAY_M : 0;
  return MUC_AN_TOAN_M.find((m) => m >= can) ?? MUC_AN_TOAN_M[MUC_AN_TOAN_M.length - 1];
}

/* ── VÉC-TƠ HƯỚNG ĐI ─────────────────────────────────────────────────────────
   Vạch từ mũi tàu tới chỗ tàu SẼ TỚI sau N phút nếu giữ hướng + tốc độ — đọc
   ngay được "chạy thế này 6 phút nữa có lọt vào bãi cạn kia không". Tàu đứng
   (tốc độ null) ⇒ không vạch: một vạch dài theo nhiễu GPS là nói dối. */

export const VEC_PHUT = [3, 6, 12] as const;
export type VecPhut = (typeof VEC_PHUT)[number];

const R_KM = 6371;

/** Điểm cách `p` một quãng `km` theo phương vị `deg` (cầu, chính xác cho vài chục km). */
export function diemTheoPhuongVi(p: LatLon, deg: number, km: number): LatLon {
  const d = km / R_KM;
  const b = (deg * Math.PI) / 180;
  const la1 = (p.lat * Math.PI) / 180;
  const lo1 = (p.lon * Math.PI) / 180;
  const la2 = Math.asin(Math.sin(la1) * Math.cos(d) + Math.cos(la1) * Math.sin(d) * Math.cos(b));
  const lo2 = lo1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(la1), Math.cos(d) - Math.sin(la1) * Math.sin(la2));
  return { lat: (la2 * 180) / Math.PI, lon: ((((lo2 * 180) / Math.PI + 540) % 360) - 180) };
}

/** Đầu vạch hướng đi sau `phut` phút; null khi thiếu vị trí/hướng/tốc độ. */
export function dauVecTo(
  pos: LatLon | null,
  headingDeg: number | null,
  speedKmh: number | null,
  phut: number,
): LatLon | null {
  if (!pos || headingDeg == null || speedKmh == null || !(speedKmh > 0) || !(phut > 0)) return null;
  return diemTheoPhuongVi(pos, headingDeg, (speedKmh * phut) / 60);
}

/** GeoJSON vạch hướng đi (rỗng khi không vẽ được) — nguồn cho lớp line. */
export function vecToGeo(pos: LatLon | null, dau: LatLon | null): GeoJSON.FeatureCollection {
  if (!pos || !dau) return { type: "FeatureCollection", features: [] };
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: { type: "LineString", coordinates: [[pos.lon, pos.lat], [dau.lon, dau.lat]] },
      },
    ],
  };
}
