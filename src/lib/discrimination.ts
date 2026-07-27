// Trục 1 — CỔNG KIỂM ĐỘ PHÂN BIỆT của các yếu tố chấm cá.
//
// VÌ SAO CÓ FILE NÀY: trong MỘT ngày (2026-07-25/26) dự án dính BA lần cùng một
// lỗi, mỗi lần mất một mạch điều tra mới tìm ra:
//   1. `upwTerm`   — dị thường nhiệt so NHIỀU NĂM ⇒ mùa hè dương cả bồn ⇒ kẹp 0
//                    KHẮP NƠI (std không gian 0.068).
//   2. `thermoFit` — D20 Biển Đông p10–p90 = 84–120 m nằm TRỌN dải [70,170] ⇒
//                    luôn ≈1 (std 0.028). Bỏ nó ra: %điểm nóng 49.6 → 19.9.
//   3. `foodLimiter` — log10(chl) trải thật 0.43 đơn vị log, mà dải `chlLog` khai
//                    rộng 0.9–1.7 + mép ±0.45 ⇒ 83–98% ô đạt trần (mực xà std
//                    0.019 — thấp hơn cả thermoFit).
//
// KHUÔN CHUNG: **dải khai rộng hơn phân bố mà nó phải phân biệt** ⇒ yếu tố LUÔN
// BẬT ⇒ chiếm chỗ trong công thức mà không đóng góp thông tin xếp hạng nào.
// Ba lần vấp cùng một hố là đủ để dựng rào: file này biến "độ phân biệt" thành
// một đại lượng ĐO ĐƯỢC và CHẶN ĐƯỢC, thay vì chờ ai đó tình cờ phát hiện.
//
// Chạy trên dữ liệu THẬT: `node scripts/model-discrimination-audit.mjs`
// (in bảng + thoát khác 0 nếu có yếu tố báo đỏ).

/** Dưới mức này coi như KHÔNG phân biệt được ô nào hơn ô nào */
export const DISCRIMINATION_MIN_STD = 0.1;
/** Trên mức này coi như BÃO HOÀ (phần lớn ô kịch trần) */
export const DISCRIMINATION_MAX_SAT = 0.9;
/** Ô có giá trị ≥ mức này tính là "kịch trần" */
export const SATURATION_LEVEL = 0.95;

export interface TermStats {
  /** tên yếu tố, vd "thermFront" | "foodLimiter" */
  key: string;
  /** độ lệch chuẩn KHÔNG GIAN giữa các ô (chỉ ô hữu hạn) */
  std: number;
  /** tỉ lệ ô kịch trần (≥ SATURATION_LEVEL) */
  satFrac: number;
  /** tỉ lệ ô sàn (= 0) — đầu kia của cùng một lỗi */
  floorFrac: number;
  /** số ô hữu hạn dùng để tính */
  n: number;
}

export interface TermVerdict extends TermStats {
  /** std quá thấp — gần như hằng số */
  flat: boolean;
  /** phần lớn ô kịch trần */
  saturated: boolean;
  /** phần lớn ô bị kẹp sàn (dải quá HẸP / lệch chỗ) */
  floored: boolean;
  /** true = lành */
  ok: boolean;
  /** câu giải thích cho người đọc bảng */
  note: string;
}

/**
 * Thống kê độ phân biệt của MỘT yếu tố trên lưới đã chuẩn hoá 0..1.
 * Bỏ ô NaN. Lưới rỗng/toàn NaN → n = 0 (không kết luận, xem `ok` bên dưới).
 */
export function termStats(key: string, values: number[][]): TermStats {
  let n = 0;
  let sum = 0;
  let sum2 = 0;
  let sat = 0;
  let floor = 0;
  for (const row of values ?? []) {
    for (const v of row ?? []) {
      if (!Number.isFinite(v)) continue;
      n++;
      sum += v;
      sum2 += v * v;
      if (v >= SATURATION_LEVEL) sat++;
      if (v <= 0) floor++;
    }
  }
  if (n === 0) return { key, std: 0, satFrac: 0, floorFrac: 0, n: 0 };
  const mean = sum / n;
  const varr = Math.max(0, sum2 / n - mean * mean);
  return {
    key,
    std: Math.sqrt(varr),
    satFrac: sat / n,
    floorFrac: floor / n,
    n,
  };
}

/**
 * Phán yếu tố lành hay báo đỏ. `n === 0` (thiếu dữ liệu hôm nay) KHÔNG tính là
 * lỗi — nguồn tuỳ chọn vắng là chuyện bình thường, đã có `dataQuality` lo.
 */
export function judgeTerm(s: TermStats): TermVerdict {
  if (s.n === 0) {
    return {
      ...s,
      flat: false,
      saturated: false,
      floored: false,
      ok: true,
      note: "không có dữ liệu hôm nay (nguồn tuỳ chọn vắng) — bỏ qua",
    };
  }
  const flat = s.std < DISCRIMINATION_MIN_STD;
  const saturated = s.satFrac > DISCRIMINATION_MAX_SAT;
  const floored = s.floorFrac > DISCRIMINATION_MAX_SAT;
  const ok = !flat && !saturated && !floored;
  const why: string[] = [];
  if (flat) why.push(`std ${s.std.toFixed(3)} < ${DISCRIMINATION_MIN_STD}`);
  if (saturated) why.push(`${(s.satFrac * 100).toFixed(0)}% ô kịch trần`);
  if (floored) why.push(`${(s.floorFrac * 100).toFixed(0)}% ô kẹp sàn`);
  return {
    ...s,
    flat,
    saturated,
    floored,
    ok,
    note: ok
      ? "lành"
      : `${why.join(" · ")} — dải khai có RỘNG/LỆCH so với phân bố thật không?`,
  };
}

/** Phán cả bộ. `redFlags` rỗng = qua cổng. */
export function judgeAll(stats: TermStats[]): {
  verdicts: TermVerdict[];
  redFlags: TermVerdict[];
} {
  const verdicts = stats.map(judgeTerm);
  return { verdicts, redFlags: verdicts.filter((v) => !v.ok) };
}
