// Trục 1 — ĐƯỜNG ĐI NHIỀU ĐIỂM: ghép các chặng đã tính (mỗi chặng là một
// `planRoute` đầy đủ) thành MỘT tuyến để vẽ, để đối chiếu bão, để dẫn đường.
// THUẦN LOGIC (test được, không mạng, không React).
//
// Luật ghép chỉ có một nguyên tắc: **cảnh báo không được loãng đi khi nối**.
// Một chặng đè bãi cạn thì cả tuyến phải nói cạn (OR); một chặng chưa kiểm
// được độ sâu thì cả tuyến coi như chưa kiểm (AND); thiếu một nền so sánh
// "chạy thẳng" thì cả tuyến bỏ so sánh chứ không ghép nửa vời.

import type { RoutePlan } from "@/lib/route-plan";

export interface MergedRoute {
  plan: RoutePlan;
  /** Chỉ số của từng điểm ghé trong `plan.waypoints` — để vẽ số 1-2-3 */
  stopWpIdx: number[];
}

/**
 * Ghép các chặng theo đúng thứ tự truyền vào. Trả `null` khi không có chặng
 * nào (nơi gọi tự lo, đừng để lọt xuống thành tuyến rỗng).
 */
export function mergeLegPlans(plans: RoutePlan[]): MergedRoute | null {
  if (plans.length === 0) return null;

  const waypoints = [...plans[0].waypoints];
  const stopWpIdx: number[] = [waypoints.length - 1];
  for (let i = 1; i < plans.length; i++) {
    // bỏ điểm ĐẦU của chặng sau — nó chính là điểm cuối chặng trước
    waypoints.push(...plans[i].waypoints.slice(1));
    stopWpIdx.push(waypoints.length - 1);
  }

  const sum = (pick: (p: RoutePlan) => number) =>
    plans.reduce((a, p) => a + pick(p), 0);
  const max = (pick: (p: RoutePlan) => number) =>
    plans.reduce((a, p) => Math.max(a, pick(p)), 0);
  const some = (pick: (p: RoutePlan) => boolean) => plans.some(pick);

  const fuelL = sum((p) => p.fuelL);

  /*  So với CHẠY THẲNG: chỉ ghép được khi MỌI chặng đều có nền `direct`.
      Thiếu một chặng (đường thẳng chặng đó vướng đất/cạn/sóng cấm) mà vẫn cộng
      các chặng còn lại là bịa ra một con số "chạy thẳng" rẻ hơn thực tế — bà
      con sẽ đọc thành "đi vòng tốn thêm X lít" trong khi chạy thẳng KHÔNG đi
      được. Thà không so sánh. */
  const allDirect = plans.every((p) => p.direct != null);
  const direct = allDirect
    ? {
        distKm: sum((p) => p.direct!.distKm),
        hours: sum((p) => p.direct!.hours),
        fuelL: sum((p) => p.direct!.fuelL),
        maxWaveM: max((p) => p.direct!.maxWaveM),
      }
    : null;

  return {
    plan: {
      waypoints,
      distKm: sum((p) => p.distKm),
      hours: sum((p) => p.hours),
      fuelL,
      maxWaveM: max((p) => p.maxWaveM),
      maxWindKmh: max((p) => p.maxWindKmh),
      hasRoughLeg: some((p) => p.hasRoughLeg),
      hasShallowLeg: some((p) => p.hasShallowLeg),
      hasVeryShallowLeg: some((p) => p.hasVeryShallowLeg),
      hasNearLandLeg: some((p) => p.hasNearLandLeg),
      hasFollowingSeaRisk: some((p) => p.hasFollowingSeaRisk),
      // chưa kiểm được MỘT chặng = cả tuyến chưa né được bãi cạn
      depthChecked: plans.every((p) => p.depthChecked),
      cappedToDirect: some((p) => p.cappedToDirect),
      direct,
      fuelDeltaL: direct ? fuelL - direct.fuelL : null,
      /*  Phần đuôi chạy QUÁ cửa sổ dự báo: cộng. Mỗi chặng nhận `departHourIdx`
          đã cộng dồn giờ các chặng trước nên nó tự đo đúng phần đuôi của mình;
          chặng nằm trọn ngoài cửa sổ sẽ khai trọn số giờ của nó. */
      beyondForecastH: sum((p) => p.beyondForecastH),
    },
    stopWpIdx,
  };
}
