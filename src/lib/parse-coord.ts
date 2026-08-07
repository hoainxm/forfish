/*
  Đọc TOẠ ĐỘ bà con GÕ TAY (nút "Đến điểm" trên rail bản đồ) → số độ thập phân.
  Bà con gõ theo máy định vị / hải đồ đang cầm: có thể là độ thập phân (8,5),
  độ-phút (8 30), độ-phút-giây (8 30 15), kèm hoặc không kèm hướng (N/S/E/W hay
  Bắc/Nam/Đông/Tây). Vùng biển VN luôn Bắc + Đông nên BỎ TRỐNG hướng thì mặc
  định Bắc (vĩ) / Đông (kinh) — gõ ít nhất, đúng nhất.

  Tách theo TỪNG TRỤC (một ô vĩ, một ô kinh) nên dấu phẩy = dấu thập phân, KHÔNG
  nhập nhằng với dấu phẩy ngăn cặp toạ độ. Không có mạng vẫn chạy — thuần tính.
*/

export type CoordAxis = "lat" | "lon";

const MAX_ABS: Record<CoordAxis, number> = { lat: 90, lon: 180 };

// hướng theo trục: dương (Bắc/Đông) vs âm (Nam/Tây). Nhận cả chữ quốc tế lẫn
// chữ Việt — TRỪ "N" nhập nhằng (North quốc tế vs Nam tiếng Việt): trong ô vĩ
// độ "N" = North (dương), khớp máy định vị/hải đồ bà con đang dùng.
const NEG_LETTER: Record<CoordAxis, RegExp> = {
  lat: /^S$|^NAM$/, // Nam
  lon: /^W$|^T$|^TAY$/, // Tây
};
const POS_LETTER: Record<CoordAxis, RegExp> = {
  lat: /^N$|^B$|^BAC$/, // North / Bắc
  lon: /^E$|^D$|^Đ$|^DONG$|^ĐONG$/, // East / Đông
};

/**
 * Đọc một giá trị toạ độ bà con gõ. Trả về số độ thập phân (dương = Bắc/Đông,
 * âm = Nam/Tây), hoặc `null` nếu không hiểu / vượt khung (|vĩ|≤90, |kinh|≤180).
 */
export function parseOneCoord(raw: string, axis: CoordAxis): number | null {
  if (typeof raw !== "string") return null;
  // bỏ dấu tiếng Việt ở chữ hướng (Đông→DONG) để so khớp cho gọn
  const s = raw
    .trim()
    .toUpperCase()
    .replace(/Ô|Ơ/g, "O")
    .replace(/Ă|Â/g, "A");
  if (!s) return null;

  // dấu âm rõ ràng (người gõ "-8" thay vì "8 S")
  let sign = 1;
  let body = s;
  if (body.startsWith("-")) {
    sign = -1;
    body = body.slice(1).trim();
  } else if (body.startsWith("+")) {
    body = body.slice(1).trim();
  }

  // tách chữ hướng ở ĐẦU hoặc CUỐI (N 8 30 · 8 30 N)
  const letters = body.match(/[A-ZĐ]+/g) ?? [];
  if (letters.length > 1) return null; // 2 chữ hướng = mập mờ, không đoán
  const dir = letters[0];
  if (dir) {
    if (POS_LETTER[axis].test(dir)) {
      /* dương — giữ nguyên */
    } else if (NEG_LETTER[axis].test(dir)) {
      sign = -1;
    } else {
      return null; // chữ lạ (vd "E" trong ô vĩ độ) — không đoán bừa
    }
  }

  // còn lại chỉ là số: độ [phút [giây]], phẩy = dấu thập phân
  const nums = (body.replace(/,/g, ".").match(/\d+(?:\.\d+)?/g) ?? []).map(
    Number,
  );
  if (nums.length === 0 || nums.length > 3) return null;
  if (nums.some((n) => !Number.isFinite(n))) return null;

  const [deg, min = 0, sec = 0] = nums;
  // phút/giây phải < 60 (trừ khi chỉ có 1 số = độ thập phân thuần)
  if (nums.length >= 2 && (min >= 60 || sec >= 60)) return null;

  const val = sign * (deg + min / 60 + sec / 3600);
  if (!Number.isFinite(val) || Math.abs(val) > MAX_ABS[axis]) return null;
  return val;
}

/**
 * Đọc CẶP vĩ + kinh (mỗi ô một chuỗi). Trả `{ lat, lon }` hoặc `null` nếu một
 * trong hai ô không hợp lệ — để nút "Đến điểm" báo ô nào sai.
 */
export function parseCoordPair(
  latRaw: string,
  lonRaw: string,
): { lat: number; lon: number } | null {
  const lat = parseOneCoord(latRaw, "lat");
  const lon = parseOneCoord(lonRaw, "lon");
  if (lat == null || lon == null) return null;
  return { lat, lon };
}
