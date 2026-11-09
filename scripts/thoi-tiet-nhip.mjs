// NHỊP TẢI OPEN-METEO CỦA MÁY NHÀ (2026-11-09) — thuần, có test (src/lib/__tests__/thoi-tiet-ke-hoach.test.ts).
//
// Vì sao: log gpu-desktop 07–09/11 — lượt nào cũng dính HAI lần 429 "Minutely API request limit exceeded" ở lưới
// 156 điểm, mỗi lần chờ mù 65 s. Open-Meteo đếm trần THEO PHÚT bằng TRỌNG SỐ (docs: nhiều điểm, >10 biến, >2 tuần
// tính thành nhiều lượt), nên tải lần lượt mà không đếm trọng số vẫn vượt trần. Ở đây ước trọng số từng URL và
// giữ tổng trọng số trong cửa sổ 60 s dưới ngân sách ⇒ chờ ĐÚNG lúc cần, không chờ mù sau khi đã bị chặn.
// Không đổi IP, không lách: chỉ đi chậm cho vừa hạn mức của nguồn.

/** Ngân sách mỗi phút (trần gói miễn phí 600, chừa đệm cho số ước lệch). */
export const NGAN_SACH_PHUT = 500;
const CUA_SO_MS = 60_000;
const DEM_MS = 1_000;

/**
 * Trọng số ước của một URL Open-Meteo: số điểm × max(1, biến/10) × max(1, ngày/14).
 * @param {string} url
 * @returns {number}
 */
export function trongSoOM(url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return 1;
  }
  const p = u.searchParams;
  const diem = Math.max(1, (p.get("latitude") ?? "").split(",").filter(Boolean).length);
  const bien = ["hourly", "daily", "current", "minutely_15"]
    .map((k) => (p.get(k) ?? "").split(",").filter(Boolean).length)
    .reduce((a, b) => a + b, 0);
  const ngay = Number(p.get("forecast_days") ?? 7) || 7;
  return diem * Math.max(1, bien / 10) * Math.max(1, ngay / 14);
}

/**
 * Phải chờ bao lâu (ms) trước khi gửi một URL trọng số `w`, biết các lượt đã gửi trong cửa sổ 60 s.
 * Lượt nặng hơn cả ngân sách ⇒ chờ cửa sổ trống hẳn rồi gửi (không kẹt mãi).
 * @param {{ luc: number, w: number }[]} daGui
 * @param {number} w
 * @param {number} now
 * @param {number} [nganSach]
 * @returns {number}
 */
export function xepLich(daGui, w, now, nganSach = NGAN_SACH_PHUT) {
  const conTrong = daGui.filter((g) => g.luc > now - CUA_SO_MS).sort((a, b) => a.luc - b.luc);
  let tong = conTrong.reduce((s, g) => s + g.w, 0);
  if (tong + w <= nganSach) return 0;
  for (const g of conTrong) {
    tong -= g.w;
    if (tong + w <= nganSach || tong <= 0) return Math.max(0, g.luc + CUA_SO_MS - now) + DEM_MS;
  }
  return 0;
}
