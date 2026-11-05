// MÁY GIÁM SÁT ĐÃ HUỶ / THU HỒI trên S-Tracking (2026-11-05). THUẦN — dùng chung máy chủ (cua-toi, thông báo) và máy GPU
// (nhắc nhở). Viettel không có cột "đã huỷ": đại lý ĐỔI TÊN máy khi huỷ/bán/thu hồi — thêm tiền tố "DE"/"de"
// (DE-…, DEKG-…, DEA-…) hoặc "Thu"/"Thuh"/"Thuhoi" (ThuCM-…, ThuhoiCM-…), có máy còn bị dồn vào nhóm "…DELETE".
// Báo thật 05/11 (nhóm Zalo SDVico SDFish): "Có số chiếc hiện ko còn tồn tại trên app viettel của khách hoặc đã huỷ,
// bán lâu rồi" — DEKG-93388-TS nằm cạnh KG-93388-TS thật. Đo kho 05/11: 527/14 562 máy, không máy nào còn cảnh báo mở.
// Không có mã tỉnh nào là "DE" hay "Thu" (mã đăng ký tàu cá: KG, BV, QNg, BTh, CM…) ⇒ không nhầm tàu thật.
// Máy đã bỏ: KHÔNG hiện ở thẻ "máy của tôi", KHÔNG báo/nhắc, KHÔNG vào sổ tàu. Kho vẫn giữ (đối soát).

const TIEN_TO_BO = /^\s*(de|thu)/i;
const NHOM_BO = /delete/i;

/** @param {{ ten_tau?: string|null, tenTau?: string|null, nhom?: string|null }} t */
export function laMayDaBo(t) {
  if (!t) return false;
  const ten = t.ten_tau ?? t.tenTau ?? "";
  return TIEN_TO_BO.test(ten) || NHOM_BO.test(t.nhom ?? "");
}
