// Trục 1 — ĐƯỜNG ĐI NHIỀU ĐIỂM: ghép các chặng đã tính (mỗi chặng là một
// `planRoute` đầy đủ) thành MỘT tuyến để vẽ, để đối chiếu bão, để dẫn đường.
// THUẦN LOGIC (test được, không mạng, không React).
//
// Luật ghép chỉ có một nguyên tắc: **cảnh báo không được loãng đi khi nối**.
// Một chặng đè bãi cạn thì cả tuyến phải nói cạn (OR); một chặng chưa kiểm
// được độ sâu thì cả tuyến coi như chưa kiểm (AND); thiếu một nền so sánh
// "chạy thẳng" thì cả tuyến bỏ so sánh chứ không ghép nửa vời.

import type { RoutePlan } from "@/lib/route-plan";
import { summarizeLegs, type LegSummary } from "@/lib/route-legs";

export interface MergedRoute {
  plan: RoutePlan;
  /** Chỉ số của từng điểm ghé trong `plan.waypoints` — để vẽ số 1-2-3 */
  stopWpIdx: number[];
  /*  TỪNG CHẶNG GIỮ LẠI, KHÔNG CHỈ BẢN GỘP (2026-08-29g). Cờ nguy hiểm gộp
      bằng OR để cả tuyến phải nói khi MỘT chặng có vấn đề — đúng cho câu
      cảnh báo, nhưng gộp xong thì mất chỗ: tuyến 4 chặng chỉ chặng 3 đè bãi
      cạn vẫn vẽ một dải đỏ suốt từ bến. Giữ bản tóm tắt từng chặng để bản đồ
      tô đúng khúc nào đáng lo. */
  legs: LegSummary[];
}

/**
 * Ghép các chặng theo đúng thứ tự truyền vào. Trả `null` khi không có chặng
 * nào (nơi gọi tự lo, đừng để lọt xuống thành tuyến rỗng).
 */
export function mergeLegPlans(plans: RoutePlan[]): MergedRoute | null {
  if (plans.length === 0) return null;

  const waypoints = [...plans[0].waypoints];
  const stopWpIdx: number[] = [waypoints.length - 1];
  /*  Giờ cộng dồn tới từng waypoint nối theo cùng luật bỏ-điểm-đầu: chặng sau
      cộng thêm giờ đã chạy tới cuối chặng trước (phần tử cuối của mảng đang
      nối), để ETA tại mỗi điểm là ETA của CẢ chuyến, không phải của riêng chặng. */
  const hoursAt = [...plans[0].hoursAt];
  for (let i = 1; i < plans.length; i++) {
    // bỏ điểm ĐẦU của chặng sau — nó chính là điểm cuối chặng trước
    waypoints.push(...plans[i].waypoints.slice(1));
    stopWpIdx.push(waypoints.length - 1);
    const offset = hoursAt[hoursAt.length - 1] ?? 0;
    for (const h of plans[i].hoursAt.slice(1)) hoursAt.push(offset + h);
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
      hasDraftShallowLeg: some((p) => p.hasDraftShallowLeg),
      /*  "Cạn chỉ ở cảng" cho CẢ tuyến: phải có ít nhất một chặng nói vậy, và
          KHÔNG chặng nào có chỗ thấp giữa đường. Một chặng `nearPortOnly=false`
          có thể là "không có chỗ thấp nào" (vô hại) hoặc "có chỗ thấp xa cảng"
          — phân biệt bằng cờ thấp của chính nó: có cờ mà không nearPortOnly
          nghĩa là thấp ở giữa đường. */
      nearPortOnly:
        some((p) => p.nearPortOnly) &&
        plans.every(
          (p) =>
            p.nearPortOnly ||
            !(p.hasNearLandLeg || p.hasVeryShallowLeg || p.hasDraftShallowLeg),
        ),
      hoursAt,
      hasFollowingSeaRisk: some((p) => p.hasFollowingSeaRisk),
      // chưa kiểm được MỘT chặng = cả tuyến chưa né được bãi cạn
      depthChecked: plans.every((p) => p.depthChecked),
      // hiểm hoạ: chưa kiểm MỘT chặng = cả tuyến chưa kiểm; có ở MỘT chặng = cả tuyến có
      hazardChecked: plans.every((p) => p.hazardChecked),
      hasHazardLeg: some((p) => p.hasHazardLeg),
      hasHazardNearPortLeg: some((p) => p.hasHazardNearPortLeg),
      cappedToDirect: some((p) => p.cappedToDirect),
      direct,
      fuelDeltaL: direct ? fuelL - direct.fuelL : null,
      /*  Phần đuôi chạy QUÁ cửa sổ dự báo: cộng. Mỗi chặng nhận `departHourIdx`
          đã cộng dồn giờ các chặng trước nên nó tự đo đúng phần đuôi của mình;
          chặng nằm trọn ngoài cửa sổ sẽ khai trọn số giờ của nó. */
      beyondForecastH: sum((p) => p.beyondForecastH),
      // best-effort vì biển động: MỘT chặng phải liều là cả tuyến phải cảnh báo
      bestEffortSeas: some((p) => p.bestEffortSeas),
      /*  Mức nguy hiểm từng khúc: NỐI theo đúng thứ tự chặng. Waypoints gộp bỏ
          điểm ĐẦU của chặng sau (nó trùng điểm cuối chặng trước), nên số KHÚC =
          tổng số khúc từng chặng ⇒ segRisks nối thẳng là khớp một-một với các
          cặp waypoint của tuyến gộp. */
      segRisks: plans.flatMap((p) => p.segRisks),
    },
    stopWpIdx,
    legs: summarizeLegs(plans),
  };
}
