// DẪN ĐƯỜNG — BÁO KHÚC RẼ HAI NHỊP (thuần, test: nav-khuc-re.test.ts).
//
// Học từ VietMap Live (dịch ngược 3.4.4, 2026-11-02): mỗi lệnh rẽ có HAI câu
// thu sẵn — "300_turn_left" đọc khi còn xa, "turn_left" đọc ngay tại chỗ rẽ.
// Ngoài biển không có ngã tư, nhưng tuyến đã vẽ (route-plan, né sóng/bãi cạn)
// có những khúc ĐỔI HƯỚNG thật. Trước đây HUD chỉ có mũi tên tới waypoint kế
// (`steerCue`) và giọng không nói gì về khúc rẽ: bà con phải cúi nhìn máy.
//
// Luật:
//  · Chỉ khúc đổi hướng ≥ KHUC_RE_MIN_DEG mới là "khúc rẽ" — tuyến lưới có
//    nhiều chỗ bẻ vài độ, đọc hết là lải nhải.
//  · Mốc theo THỜI GIAN chạy, quy ra km theo tốc độ (OsmAnd/nav-hazards):
//    báo trước 5 phút (sàn 1 km), báo tới 1 phút (sàn 200 m).
//  · Mỗi khúc nói TỐI ĐA 2 lần, chỉ khi vượt sang mốc gần hơn (khuôn
//    `borderStepCrossed`). Khúc ở chỗ ghé thì bỏ — chỗ ghé có câu riêng.
//  · KHÔNG ra lệnh lái: câu nói hướng đi tiếp, quyết là của thuyền trưởng.

import { haversineKm, type LatLon } from "@/lib/geo";
import { angleDiffDeg, bearingDeg } from "@/lib/route-plan";
import { windDirectionVN } from "@/lib/marine-weather";

/** Đổi hướng ít hơn ngần này (độ) thì không coi là khúc rẽ */
export const KHUC_RE_MIN_DEG = 30;
/** Báo trước: còn ngần này phút chạy (sàn km bên dưới) */
export const KHUC_RE_TRUOC_PHUT = 5;
export const KHUC_RE_TRUOC_SAN_KM = 1;
/** Báo tới: còn ngần này phút chạy (sàn km bên dưới) */
export const KHUC_RE_TOI_PHUT = 1;
export const KHUC_RE_TOI_SAN_KM = 0.2;

export type KhucRe = {
  /** chỉ số waypoint của khúc rẽ */
  idx: number;
  /** còn bao xa dọc tuyến tới khúc rẽ (km) */
  km: number;
  /** hướng la bàn của đoạn SAU khúc rẽ (0–360) */
  huongSau: number;
  /** tên hướng tiếng Việt của đoạn sau ("Đông Bắc") */
  huongVN: string;
  /** góc đổi hướng có dấu: >0 sang phải, <0 sang trái */
  gocDeg: number;
};

/**
 * Khúc rẽ kế tiếp PHÍA TRƯỚC điểm chiếu `alongKm`. Bỏ khúc trùng chỗ ghé
 * (`boQua`) và điểm cuối (tới đích có câu riêng). null khi không còn khúc nào.
 */
export function khucReKeTiep(
  waypoints: readonly LatLon[],
  alongKm: number,
  boQua: ReadonlySet<number> = new Set(),
  minDeg: number = KHUC_RE_MIN_DEG,
): KhucRe | null {
  if (waypoints.length < 3 || !Number.isFinite(alongKm)) return null;
  let cum = 0;
  for (let i = 1; i < waypoints.length - 1; i++) {
    cum += haversineKm(waypoints[i - 1], waypoints[i]);
    if (cum <= alongKm + 0.02) continue; // đã qua (hoặc đang đứng trên) khúc này
    if (boQua.has(i)) continue;
    const truoc = bearingDeg(waypoints[i - 1], waypoints[i]);
    const sau = bearingDeg(waypoints[i], waypoints[i + 1]);
    const goc = angleDiffDeg(sau, truoc);
    if (Math.abs(goc) < minDeg) continue;
    return { idx: i, km: cum - alongKm, huongSau: sau, huongVN: windDirectionVN(sau), gocDeg: goc };
  }
  return null;
}

/** Ngưỡng km của một mốc theo tốc độ: max(sàn, tốc độ × phút). Tốc độ chưa biết → sàn. */
export function nguongKm(phut: number, sanKm: number, speedKmh: number | null): number {
  if (speedKmh == null || !Number.isFinite(speedKmh) || speedKmh <= 0) return sanKm;
  return Math.max(sanKm, (speedKmh * phut) / 60);
}

/** 0 = còn xa · 1 = mốc báo trước · 2 = mốc báo tới */
export function mocKhucRe(km: number, speedKmh: number | null): 0 | 1 | 2 {
  if (km <= nguongKm(KHUC_RE_TOI_PHUT, KHUC_RE_TOI_SAN_KM, speedKmh)) return 2;
  if (km <= nguongKm(KHUC_RE_TRUOC_PHUT, KHUC_RE_TRUOC_SAN_KM, speedKmh)) return 1;
  return 0;
}

export type KhucReNho = { idx: number; step: 0 | 1 | 2 } | null;

export type KhucReBao = {
  /** ổn định theo khúc + mốc — bộ phát ngôn đọc một lần mỗi key */
  key: string;
  idx: number;
  step: 1 | 2;
  text: string;
};

/**
 * Một nhịp đánh giá: trả câu khi VƯỢT sang mốc gần hơn của khúc rẽ hiện tại.
 * Câu chỉ ghép từ cụm đã có mảnh giọng Sen Biển (cổng ghep-giong.test.ts).
 * `fmtDist` = `distSpeech` theo đơn vị bà con chọn.
 */
export function baoKhucRe(
  nho: KhucReNho,
  kr: KhucRe | null,
  speedKmh: number | null,
  fmtDist: (km: number) => string,
): { nho: KhucReNho; bao: KhucReBao | null } {
  if (!kr) return { nho: null, bao: null };
  const step = mocKhucRe(kr.km, speedKmh);
  const cu = nho && nho.idx === kr.idx ? nho.step : 0;
  if (step <= cu) return { nho: { idx: kr.idx, step: cu as 0 | 1 | 2 }, bao: null };
  if (step === 0) return { nho: { idx: kr.idx, step: cu as 0 | 1 | 2 }, bao: null };
  const ben = kr.gocDeg > 0 ? "phải" : "trái";
  const text =
    step === 2
      ? `Bây giờ đi về phía ${kr.huongVN}, bên ${ben} tàu.`
      : `Còn chừng ${fmtDist(kr.km)}, rồi đi về phía ${kr.huongVN}, bên ${ben} tàu.`;
  return {
    nho: { idx: kr.idx, step },
    bao: { key: `re:${kr.idx}:${step}`, idx: kr.idx, step, text },
  };
}
