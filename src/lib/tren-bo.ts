// ĐIỂM TRÊN BỜ → CẢNG GẦN NHẤT (2026-11-08, anh Long: "thêm phần xử lý cái trên bờ tới cảng gần nhất …
// để tránh mấy lỗi lúc tính bị vướng đi trên đất liền").
//
// Ca thật: Dẫn đường lấy VỊ TRÍ ĐIỆN THOẠI làm nơi đi; người cầm máy đang ở TP.HCM (10°47'B 106°38'Đ) ⇒ chặng
// đầu "vướng đất liền", tuyến không ra. Bộ tính tuyến chỉ nới đất sát cảng (≤12 km) và đoạn ra cửa sông
// (≤20 km — CUA_DAT_MAX_KM của route-plan), nên điểm sâu trong đất KHÔNG BAO GIỜ tính được. Nay: nơi đi nằm sâu
// trên bờ ⇒ đổi sang cảng gần nhất sát vùng biển, nói rõ cho bà con.
//
// THƯỚC = KHOẢNG CÁCH TỚI VÙNG BIỂN VN (đúng hình geofence `VN_SEA_POLYS`), KHÔNG phải tới "ô nước" của lưới
// độ sâu: lưới ghi cả SÔNG (đo thật: Cần Thơ cách sông Hậu 5 km — sông sâu hạng 5 — nhưng cách biển 75 km;
// TP.HCM cách sông 18 km, cách biển 49 km) ⇒ thước mặt nước để lọt đúng ca cần bắt. Các cảng đo được ≤9 km.
//
// Đường bộ từ chỗ đứng tới cảng: KHÔNG tính — app không có dữ liệu đường sá chạy được offline (cần cả mạng lưới
// đường, hàng chục MB). Chỉ báo khoảng cách đường chim bay, nói thẳng đó không phải đường xe.
// THUẦN, dữ liệu nằm trong bundle ⇒ chạy được khi mất sóng.

import { haversineKm, type LatLon } from "@/lib/geo";
import { distToSegmentKm } from "@/lib/route-storm";
import { VN_SEA_POLYS } from "@/lib/vung-bien-vn";
import { trongVungNhanh } from "@/lib/lo-trinh/vung-nhanh";

/** Cách vùng biển quá ngần này (km) mới coi là "trên bờ" — khớp trần đoạn ra cửa sông của bộ tính tuyến. */
export const TREN_BO_KM = 20;
/** Cảng hợp lệ để thay = cách vùng biển không quá ngần này (danh mục cảng có vài toạ độ sai nằm trong đất). */
export const CANG_TOI_BIEN_KM = 15;
/** Xét tối đa ngần này cảng gần nhất — xa hơn nữa thì thà báo lỗi còn hơn đổi sang cảng tận đâu. */
const TOI_DA_CANG_XET = 12;

/** Khoảng cách (km) từ `p` tới vùng biển VN được phép; 0 khi đang ở trong. */
export function kmToiVungBien(p: LatLon): number {
  if (!Number.isFinite(p.lat) || !Number.isFinite(p.lon)) return Infinity;
  if (trongVungNhanh(p.lat, p.lon)) return 0;
  let min = Infinity;
  for (const poly of VN_SEA_POLYS)
    for (const ring of poly)
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const a = { lat: ring[j][1], lon: ring[j][0] };
        const b = { lat: ring[i][1], lon: ring[i][0] };
        // loại nhanh cạnh xa hơn mức tốt nhất đã có (theo vĩ độ — 1° ≈ 111 km)
        if (Math.min(Math.abs(a.lat - p.lat), Math.abs(b.lat - p.lat)) * 111 > min &&
            Math.sign(a.lat - p.lat) === Math.sign(b.lat - p.lat)) continue;
        const d = distToSegmentKm(p, a, b);
        if (d < min) min = d;
      }
  return min;
}

/** Điểm có nằm SÂU trên bờ (bộ tính tuyến không với tới) không. */
export function namTrenBo(p: LatLon): boolean {
  return kmToiVungBien(p) > TREN_BO_KM;
}

export interface CangUngVien extends LatLon {
  ten: string;
}

/**
 * Cảng gần `p` nhất (đường chim bay) mà nằm sát vùng biển (≤ CANG_TOI_BIEN_KM).
 * null = không cảng nào trong TOI_DA_CANG_XET cảng gần nhất qua được.
 */
export function cangGanNhatSatBien<T extends CangUngVien>(p: LatLon, cangs: readonly T[]): { cang: T; km: number } | null {
  const xep = cangs
    .filter((c) => Number.isFinite(c.lat) && Number.isFinite(c.lon))
    .map((c) => ({ cang: c, km: haversineKm(p, c) }))
    .sort((x, y) => x.km - y.km)
    .slice(0, TOI_DA_CANG_XET);
  for (const x of xep) if (kmToiVungBien(x.cang) <= CANG_TOI_BIEN_KM) return x;
  return null;
}
