/*
  ÂM LỊCH VIỆT NAM — đổi ngày dương sang ngày âm (múi giờ +7).

  Vì sao có (anh Long 2026-10-20: "thông tin xổ ra phải có thêm info về ngày
  trăng (lịch âm)"): bà con đi biển tính con nước, nghề đèn theo NGÀY ÂM
  ("mùng 1", "rằm"), không theo ngày dương. Ngăn gió sóng in thêm một dòng
  "Âm lịch".

  Thuật toán thiên văn chuẩn của Hồ Ngọc Đức (dùng rộng rãi cho lịch Việt):
  ngày Sóc (trăng mới) theo công thức Meeus rút gọn, tháng 11 âm chứa Đông chí,
  tháng nhuận là tháng đầu tiên trong năm không chứa trung khí. Thuần, không
  mạng, không phụ thuộc — có test đối chiếu ngày Tết/Trung thu/tháng nhuận đã
  công bố.
*/

const TZ = 7; // giờ Việt Nam

/** Số ngày Julius của ngày dương (lịch Gregory, sau 1582). */
export function jdFromDate(dd: number, mm: number, yy: number): number {
  const a = Math.floor((14 - mm) / 12);
  const y = yy + 4800 - a;
  const m = mm + 12 * a - 3;
  return (
    dd +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045
  );
}

/** Ngày Julius (theo múi giờ) của lần Sóc thứ k tính từ 1/1/1900. */
function newMoonDay(k: number): number {
  const T = k / 1236.85;
  const T2 = T * T;
  const T3 = T2 * T;
  const dr = Math.PI / 180;
  let Jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3;
  Jd1 += 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr);
  const M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3;
  const Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3;
  const F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3;
  let C1 = (0.1734 - 0.000393 * T) * Math.sin(M * dr) + 0.0021 * Math.sin(2 * dr * M);
  C1 = C1 - 0.4068 * Math.sin(Mpr * dr) + 0.0161 * Math.sin(dr * 2 * Mpr);
  C1 = C1 - 0.0004 * Math.sin(dr * 3 * Mpr);
  C1 = C1 + 0.0104 * Math.sin(dr * 2 * F) - 0.0051 * Math.sin(dr * (M + Mpr));
  C1 = C1 - 0.0074 * Math.sin(dr * (M - Mpr)) + 0.0004 * Math.sin(dr * (2 * F + M));
  C1 = C1 - 0.0004 * Math.sin(dr * (2 * F - M)) - 0.0006 * Math.sin(dr * (2 * F + Mpr));
  C1 = C1 + 0.001 * Math.sin(dr * (2 * F - Mpr)) + 0.0005 * Math.sin(dr * (2 * Mpr + M));
  let deltat: number;
  if (T < -11) {
    deltat = 0.001 + 0.000839 * T + 0.0002261 * T2 - 0.00000845 * T3 - 0.000000081 * T * T3;
  } else {
    deltat = -0.000278 + 0.000265 * T + 0.000262 * T2;
  }
  const JdNew = Jd1 + C1 - deltat;
  return Math.floor(JdNew + 0.5 + TZ / 24);
}

/** Kinh độ Mặt Trời lúc 0h giờ địa phương của ngày jdn, đổi ra 0..11 (cung 30°). */
function sunLongitude(jdn: number): number {
  const T = (jdn - 2451545.5 - TZ / 24) / 36525;
  const T2 = T * T;
  const dr = Math.PI / 180;
  const M = 357.5291 + 35999.0503 * T - 0.0001559 * T2 - 0.00000048 * T * T2;
  const L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2;
  let DL = (1.9146 - 0.004817 * T - 0.000014 * T2) * Math.sin(dr * M);
  DL += (0.019993 - 0.000101 * T) * Math.sin(dr * 2 * M) + 0.00029 * Math.sin(dr * 3 * M);
  let L = (L0 + DL) * dr;
  L = L - Math.PI * 2 * Math.floor(L / (Math.PI * 2));
  return Math.floor((L / Math.PI) * 6);
}

/** Ngày bắt đầu tháng 11 âm của năm dương yy (tháng chứa Đông chí). */
function lunarMonth11(yy: number): number {
  const off = jdFromDate(31, 12, yy) - 2415021;
  const k = Math.floor(off / 29.530588853);
  let nm = newMoonDay(k);
  if (sunLongitude(nm) >= 9) nm = newMoonDay(k - 1);
  return nm;
}

/** Vị trí tháng nhuận sau tháng 11 âm bắt đầu ở a11. */
function leapMonthOffset(a11: number): number {
  const k = Math.floor((a11 - 2415021.076998695) / 29.530588853 + 0.5);
  let last = 0;
  let i = 1;
  let arc = sunLongitude(newMoonDay(k + i));
  do {
    last = arc;
    i++;
    arc = sunLongitude(newMoonDay(k + i));
  } while (arc !== last && i < 14);
  return i - 1;
}

export interface NgayAm {
  day: number;
  month: number;
  year: number;
  /** tháng nhuận */
  leap: boolean;
}

/** Ngày dương (dd/mm/yyyy, giờ VN) → ngày âm lịch Việt Nam. */
export function solarToLunar(dd: number, mm: number, yy: number): NgayAm {
  const dayNumber = jdFromDate(dd, mm, yy);
  const k = Math.floor((dayNumber - 2415021.076998695) / 29.530588853);
  let monthStart = newMoonDay(k + 1);
  if (monthStart > dayNumber) monthStart = newMoonDay(k);
  let a11 = lunarMonth11(yy);
  let b11 = a11;
  let lunarYear: number;
  if (a11 >= monthStart) {
    lunarYear = yy;
    a11 = lunarMonth11(yy - 1);
  } else {
    lunarYear = yy + 1;
    b11 = lunarMonth11(yy + 1);
  }
  const day = dayNumber - monthStart + 1;
  const diff = Math.floor((monthStart - a11) / 29);
  let leap = false;
  let month = diff + 11;
  if (b11 - a11 > 365) {
    const leapDiff = leapMonthOffset(a11);
    if (diff >= leapDiff) {
      month = diff + 10;
      if (diff === leapDiff) leap = true;
    }
  }
  if (month > 12) month -= 12;
  if (month >= 11 && diff < 4) lunarYear -= 1;
  return { day, month, year: lunarYear, leap };
}

/** "YYYY-MM-DD" (ngày dương theo giờ VN) → ngày âm; chuỗi hỏng → null. */
export function amLichFromIso(iso: string): NgayAm | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const yy = Number(m[1]);
  const mm = Number(m[2]);
  const dd = Number(m[3]);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  return solarToLunar(dd, mm, yy);
}

/** "15/8" · "1/6 nhuận" · thêm "Rằm"/"Mùng 1" cho hai mốc bà con hay nói. */
export function amLichText(a: NgayAm): string {
  const base = `${a.day}/${a.month}${a.leap ? " nhuận" : ""}`;
  if (a.day === 15) return `Rằm · ${base}`;
  if (a.day === 1) return `Mùng 1 · ${base}`;
  return base;
}
