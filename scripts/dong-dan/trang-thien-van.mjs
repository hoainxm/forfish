// trang-thien-van.mjs — vị trí Mặt Trời / Mặt Trăng độ chính xác thấp (~0,5–1°) cho bước 15 "Dòng Dẫn".
// Công thức thiên văn rút gọn kiểu Meeus (cùng họ công thức với thư viện suncalc), đủ để biết "trời tối chưa"
// và "trăng có trên trời không, sáng mấy phần". Không thêm phụ thuộc. Thời gian t = giây Unix (UTC).
//   node scripts/dong-dan/trang-thien-van.mjs --selftest
const RAD = Math.PI / 180, E = RAD * 23.4397;
const days = (t) => t / 86400 - 10957.5; // ngày tính từ J2000
const ra = (l, b) => Math.atan2(Math.sin(l) * Math.cos(E) - Math.tan(b) * Math.sin(E), Math.cos(l));
const dec = (l, b) => Math.asin(Math.sin(b) * Math.cos(E) + Math.cos(b) * Math.sin(E) * Math.sin(l));
const sidereal = (d, lw) => RAD * (280.16 + 360.9856235 * d) - lw;
const alt = (H, phi, de) => Math.asin(Math.sin(phi) * Math.sin(de) + Math.cos(phi) * Math.cos(de) * Math.cos(H));
function sunCoords(d) {
  const M = RAD * (357.5291 + 0.98560028 * d);
  const L = M + RAD * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M)) + RAD * 102.9372 + Math.PI;
  return { dec: dec(L, 0), ra: ra(L, 0) };
}
function moonCoords(d) {
  const L = RAD * (218.316 + 13.176396 * d), M = RAD * (134.963 + 13.064993 * d), F = RAD * (93.272 + 13.22935 * d);
  const l = L + RAD * 6.289 * Math.sin(M), b = RAD * 5.128 * Math.sin(F);
  return { ra: ra(l, b), dec: dec(l, b), dist: 385001 - 20905 * Math.cos(M) };
}
/** độ cao Mặt Trời (độ) */
export function sunAltDeg(t, lat, lon) {
  const d = days(t), s = sunCoords(d);
  return alt(sidereal(d, -lon * RAD) - s.ra, lat * RAD, s.dec) / RAD;
}
/** { alt: độ cao trăng (độ), frac: phần mặt trăng được chiếu sáng 0..1 } */
export function moonAt(t, lat, lon) {
  const d = days(t), s = sunCoords(d), m = moonCoords(d);
  const h = alt(sidereal(d, -lon * RAD) - m.ra, lat * RAD, m.dec);
  const SD = 149598000, phi = Math.acos(Math.sin(s.dec) * Math.sin(m.dec) + Math.cos(s.dec) * Math.cos(m.dec) * Math.cos(s.ra - m.ra));
  const inc = Math.atan2(SD * Math.sin(phi), m.dist - SD * Math.cos(phi));
  return { alt: h / RAD, frac: (1 + Math.cos(inc)) / 2 };
}
/** Độ rọi trăng TƯƠNG ĐỐI (trời quang, bỏ khúc xạ/tắt khí quyển): phần sáng × sin(độ cao), 0 khi trăng dưới chân trời. 1 = trăng tròn ở thiên đỉnh. */
export const moonLux = (t, lat, lon) => { const m = moonAt(t, lat, lon); return m.alt > 0 ? m.frac * Math.sin(m.alt * RAD) : 0; };

if (process.argv.includes("--selftest")) {
  const T = (iso) => Date.parse(iso) / 1000, ok = (c, msg) => { console.log(c ? "OK " : "SAI", msg); if (!c) process.exitCode = 1; };
  // trăng tròn 3/3/2026 (nguyệt thực toàn phần ~11:33 UTC), trăng non 17/2/2026 (~12:01 UTC)
  ok(moonAt(T("2026-03-03T11:33Z"), 12, 110).frac > 0.99, `trăng tròn 3/3/2026 frac=${moonAt(T("2026-03-03T11:33Z"), 12, 110).frac.toFixed(3)}`);
  ok(moonAt(T("2026-02-17T12:01Z"), 12, 110).frac < 0.01, `trăng non 17/2/2026 frac=${moonAt(T("2026-02-17T12:01Z"), 12, 110).frac.toFixed(3)}`);
  // giữa trưa giờ VN ở 12°N 110°E: Mặt Trời cao; nửa đêm: thấp
  ok(sunAltDeg(T("2026-06-21T05:00Z"), 12, 110) > 70, `trưa hạ chí alt=${sunAltDeg(T("2026-06-21T05:00Z"), 12, 110).toFixed(1)}`);
  ok(sunAltDeg(T("2026-06-21T17:00Z"), 12, 110) < -50, `nửa đêm alt=${sunAltDeg(T("2026-06-21T17:00Z"), 12, 110).toFixed(1)}`);
  // đêm trăng tròn: nửa đêm trăng cao; đêm trăng non: nửa đêm trăng dưới chân trời
  ok(moonAt(T("2026-03-03T17:00Z"), 12, 110).alt > 50, `nửa đêm rằm alt trăng=${moonAt(T("2026-03-03T17:00Z"), 12, 110).alt.toFixed(1)}`);
  ok(moonAt(T("2026-02-17T17:00Z"), 12, 110).alt < -40, `nửa đêm mùng 1 alt trăng=${moonAt(T("2026-02-17T17:00Z"), 12, 110).alt.toFixed(1)}`);
}
