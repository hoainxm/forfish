// MÁY GIÁM SÁT ĐÃ HUỶ / THU HỒI / BỎ trên S-Tracking (2026-11-05). THUẦN — dùng chung máy chủ (cua-toi, thông báo) và máy
// GPU (nhắc nhở). Viettel không có cột "đã huỷ", nên nhận theo hai dấu:
//
// 1) ĐỔI TÊN: đại lý đổi tên máy khi huỷ/bán/thu hồi — tiền tố "DE"/"de" (DE-…, DEKG-…, DEA-…) hoặc "Thu"/"Thuh"/"Thuhoi"
//    (ThuCM-…, ThuhoiCM-…), có máy bị dồn vào nhóm "…DELETE". Báo thật 05/11 (nhóm Zalo SDVico SDFish): "Có số chiếc hiện
//    ko còn tồn tại trên app viettel của khách hoặc đã huỷ, bán lâu rồi" — DEKG-93388-TS nằm cạnh KG-93388-TS thật. Không
//    có mã tỉnh nào là "DE" hay "Thu" ⇒ không nhầm tàu thật. Kho 05/11: 527/14 562 máy.
// 2) BỎ ĐỌNG (anh Long 05/11 chốt "ẩn luôn"): KHÔNG cập nhật vị trí quá BO_DONG_NGAY ngày VÀ đã hết hạn (hoặc không có
//    hạn). Máy còn hạn thì giữ dù đứng lâu (có thể tàu nằm bờ, vẫn đóng cước). Kho 05/11: ~1 870 máy đứng >1 năm, 114 còn hạn.
//
// Máy đã bỏ: KHÔNG hiện ở thẻ "máy của tôi", KHÔNG báo/nhắc, KHÔNG vào sổ tàu. Kho vẫn giữ (đối soát).

const TIEN_TO_BO = /^\s*(de|thu)/i;
const NHOM_BO = /delete/i;
export const BO_DONG_NGAY = 365;

/** Ngày hôm nay giờ VN "yyyy-mm-dd". */
function homNayVn(nowMs) {
  return new Date(nowMs + 7 * 3600_000).toISOString().slice(0, 10);
}

/**
 * @param {{ ten_tau?: string|null, tenTau?: string|null, nhom?: string|null,
 *           cap_nhat_nguon?: string|null, capNhatNguon?: string|null, het_han?: string|null, hetHan?: string|null }} t
 * @param {number} [nowMs]
 */
export function laMayDaBo(t, nowMs = Date.now()) {
  if (!t) return false;
  const ten = t.ten_tau ?? t.tenTau ?? "";
  if (TIEN_TO_BO.test(ten) || NHOM_BO.test(t.nhom ?? "")) return true;
  const capNhat = Date.parse(t.cap_nhat_nguon ?? t.capNhatNguon ?? "");
  if (!Number.isFinite(capNhat) || nowMs - capNhat <= BO_DONG_NGAY * 86_400_000) return false;
  const hetHan = t.het_han ?? t.hetHan ?? null;
  return !hetHan || hetHan < homNayVn(nowMs);
}
