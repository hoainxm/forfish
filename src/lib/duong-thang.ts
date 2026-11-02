// KHÔNG TÌM ĐƯỢC ĐƯỜNG ⇒ VẪN CHO MỘT HƯỚNG ĐỂ LÁI (rà Vietmap 2026-11-02).
// Bộ tính tuyến (route-plan) không bao giờ nới đất / rạn / vùng cấm — đúng, vẽ
// đường qua đó là nói dối. Nhưng trước đây hỏng là chỉ còn một câu chữ, bà con
// không biết vướng ở đâu. Nay: vẽ ĐƯỜNG THẲNG NÉT ĐỨT (tham khảo hướng, không phải
// tuyến an toàn) + đánh dấu CHỖ VƯỚNG ĐẦU TIÊN trên đường thẳng đó.
// THUẦN LOGIC — `phanLoai` là hàm tra lớp độ sâu (depth-grid: 0 đất · 1 rạn ·
// 2 nước <2 m · 3+ đi được), truyền vào để test không cần file lưới.

import { haversineKm, type LatLon } from "@/lib/geo";

/** bước lấy mẫu dọc đường thẳng (km) — nhỏ hơn một ô lưới độ sâu (~450 m) */
export const DUONG_THANG_BUOC_KM = 0.4;
/** quanh hai đầu bỏ qua (cảng nằm sát bờ / trong lạch) */
export const DUONG_THANG_BO_DAU_KM = 2;

export type ChoVuong = LatLon & { loai: "dat" | "ran" | "can" };

const NHAN_VUONG: Record<ChoVuong["loai"], string> = {
  dat: "vướng đất liền hoặc đảo",
  ran: "vướng rạn",
  can: "nước rất cạn",
};

export function nhanChoVuong(c: ChoVuong): string {
  return NHAN_VUONG[c.loai];
}

/** Chỗ vướng đầu tiên trên đường thẳng a→b; null khi không vướng gì (hoặc không có lưới). */
export function choVuongDuongThang(
  a: LatLon,
  b: LatLon,
  phanLoai: ((lat: number, lon: number) => number | null) | null,
): ChoVuong | null {
  if (!phanLoai) return null;
  const tong = haversineKm(a, b);
  const n = Math.max(1, Math.ceil(tong / DUONG_THANG_BUOC_KM));
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const km = tong * t;
    if (km < DUONG_THANG_BO_DAU_KM || tong - km < DUONG_THANG_BO_DAU_KM) continue;
    const lat = a.lat + (b.lat - a.lat) * t;
    const lon = a.lon + (b.lon - a.lon) * t;
    const c = phanLoai(lat, lon);
    if (c == null || c > 2) continue;
    return { lat, lon, loai: c === 0 ? "dat" : c === 1 ? "ran" : "can" };
  }
  return null;
}
