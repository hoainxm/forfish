// NỀN TỐI GIẢN KHI MẤT SÓNG — bà con giữa biển vẫn thấy bờ, thấy đảo.
//
// Lỗ hổng đã bịt: mọi ô bản đồ nền lấy từ host ngoài (cartocdn) nên service
// worker không giữ được (public/sw.js bỏ qua khác origin). Mất sóng là nền
// trắng: có số gió sóng, có điểm nóng cá, nhưng mũi tên lơ lửng giữa khoảng
// không, không biết bờ đâu, đảo đâu → mất định hướng, nguy hiểm.
//
// Cách bịt: hình bờ + đảo đóng gói sẵn trong máy (public/data/vn-coast.v1.json,
// sinh bởi scripts/generate-coastline.mjs, nguồn Natural Earth public domain,
// SW giữ sẵn từ lúc cài) — khi ô nền không về thì bật lớp này lên.
//
// Nguyên tắc: CÓ MẠNG THÌ KHÔNG VẼ (nền thật đẹp hơn, vẽ chồng chỉ gây rối).

/** Hình bờ + đảo trong máy (đã nằm trong danh sách SW giữ sẵn). */
export const COAST_DATA_URL = "/data/vn-coast.v1.json";

/* Màu NỘI DUNG BẢN ĐỒ (không phải token UI) — chọn theo tông hải đồ giấy:
   đất màu cát nhạt, viền bờ nâu xám, nước là màu nền của style. */
export const OFFLINE_LAND_COLOR = "#e8e0cd";
export const OFFLINE_COAST_COLOR = "#9c8f74";

/**
 * Bao nhiêu ô nền tải trượt thì coi là "nền không về". 3 ô: một ô lỗi lẻ có
 * thể do ô đó thiếu ở nhà cung cấp; ba ô liên tiếp thì đúng là đứt đường.
 */
export const BASEMAP_FAIL_LIMIT = 3;

/**
 * IM LẶNG bao lâu thì coi là "nền không về" (mili giây).
 *
 * VÌ SAO CÓ VẾ NÀY (lỗi C-6, soát 2026-08-02): ca "sóng sống mà chết" ngoài
 * khơi 40–60 hải lý — máy vẫn báo có mạng, bắt tay được với máy chủ, nhưng gói
 * tin KHÔNG BAO GIỜ về. Ô nền Carto là host ngoài, MapLibre KHÔNG có đồng hồ
 * chặn cho ô: ô treo thì nó KHÔNG bắn sự kiện `error` ⇒ số ô trượt đứng ở 0 ⇒
 * hai vế cũ (`!online`, `fails >= 3`) đều không đúng ⇒ hình bờ + đảo ĐÃ NẰM
 * SẴN TRONG MÁY không bao giờ được vẽ. Bà con nhìn một mặt xanh trơn, mũi tên
 * gió và chấm tàu lơ lửng, không thấy bờ, không thấy đảo.
 *
 * 9 giây: dài hơn mọi lần tải ô bình thường (kể cả 3G cảng ~2–4 s) để không
 * bật nhầm lúc mạng chỉ chậm, nhưng vẫn ngắn hơn sức chờ của người đang cần
 * biết mình ở đâu.
 *
 * ĐỒNG HỒ BẤM TỪ LÚC NÀO — đọc kỹ (LỖI 1, soát chéo 2026-08-02): phải bấm từ
 * lúc bản đồ THẬT SỰ XIN ô nền, KHÔNG phải từ lúc mở màn. MapLibre là hàng
 * lazy-load: tải thư viện + dựng style + qua proxy ô còn nằm phía sau, ở 3G
 * cảng ngốn gần hết 9 giây trước khi có request đầu tiên ⇒ bấm từ lúc mở màn
 * là DƯƠNG TÍNH GIẢ: giây thứ 9 bật hình bờ trong máy kèm câu "Mạng yếu",
 * giây 12 ô về thì tắt — bản đồ nhấp nháy, mà câu vừa nói lại SAI SỰ THẬT.
 * Luật ở `basemapIsSilent` bên dưới, chỗ gọi chỉ việc đưa đúng mốc.
 */
export const BASEMAP_SILENT_MS = 9000;

/**
 * Đã đủ căn cứ để nói "ô nền im lặng" chưa — THUẦN, có test.
 *
 * @param askedAt mốc bản đồ BẮT ĐẦU XIN ô nền (ms). `null` = CHƯA xin lần nào
 *   ⇒ chưa được tính giờ (mở màn ≠ xin ô — xem BASEMAP_SILENT_MS).
 * @param tileSeen đã có ít nhất MỘT ô nền về trong lượt này chưa.
 */
export function basemapIsSilent(
  askedAt: number | null,
  tileSeen: boolean,
  nowMs: number,
): boolean {
  if (askedAt == null || tileSeen) return false;
  return nowMs - askedAt >= BASEMAP_SILENT_MS;
}

export type BasemapHealth = {
  /** navigator.onLine — máy có nghĩ là đang có mạng không */
  online: boolean;
  /** số ô nền tải trượt tính từ lần tải được gần nhất */
  fails: number;
  /** không MỘT ô nền nào về trong `BASEMAP_SILENT_MS` (ô treo, không báo lỗi) */
  silent?: boolean;
};

/**
 * Có bật nền tối giản trong máy hay không. BA vế, vế nào đúng cũng bật:
 * 1. Máy báo mất mạng → bật ngay (không cần chờ đủ 3 ô lỗi).
 * 2. Máy báo có mạng nhưng ô nền TRƯỢT (wifi cảng "có mà không ra") → bật khi
 *    trượt đủ ngưỡng.
 * 3. Ô nền IM LẶNG quá lâu — không về, cũng không báo lỗi (sóng "sống mà
 *    chết"). Đây là ca duy nhất hai vế trên không bắt được, và cũng là ca hay
 *    gặp nhất ngoài khơi.
 */
export function shouldUseOfflineBasemap(h: BasemapHealth): boolean {
  return !h.online || h.fails >= BASEMAP_FAIL_LIMIT || h.silent === true;
}

/**
 * Câu nhắc cho bà con — nói việc, không nói từ kỹ thuật ("tile", "offline",
 * "cache"). null = không cần nhắc gì.
 *
 * MỘT DÒNG NGẮN, và chỗ gọi cho nó TỰ TẮT sau vài giây (giống dòng "Đã lưu dự
 * báo tới ngày…"): trước đây đây là thẻ vàng 2 dòng nằm lì trên bản đồ, chủ dự
 * án xem bản thật thấy rối — nói xong thì trả lại bản đồ cho bà con.
 */
export function offlineBasemapNote(h: BasemapHealth): string | null {
  if (!shouldUseOfflineBasemap(h)) return null;
  /*  ⚠️ ĐỪNG PHÁN VỀ MẠNG CỦA BÀ CON (sửa 2026-08-18, chủ dự án bắt trên máy
      thật: *"t vào internet ầm ầm mà mạng yếu gì?"*).

      Câu cũ "Mạng yếu" nói một điều app KHÔNG BIẾT. Thứ app thật sự quan sát
      được chỉ là: ô nền không về. Mà ô nền lấy thẳng từ host NGOÀI
      (`*.basemaps.cartocdn.com`, xem `buildMapStyle`) — CDN chậm, ISP lọc, hay
      DNS trục trặc đều cho ra đúng triệu chứng này TRONG KHI mạng của bà con
      vẫn nhanh. Nói sai nguyên nhân thì bà con đi sửa nhầm chỗ (tắt/bật 4G,
      đổi wifi) và mất lòng tin vào các cảnh báo khác của app — kể cả cảnh báo
      bão.

      Nay: nói ĐÚNG THỨ THẤY ĐƯỢC ("chưa tải được nền bản đồ") và ĐÚNG HỆ QUẢ
      ("đang dùng hình bờ lưu trong máy"). Nhánh mất sóng thì `navigator.onLine`
      là bằng chứng thật, được phép nói thẳng. */
  return h.online
    ? "Chưa tải được nền bản đồ — đang dùng hình bờ lưu trong máy."
    : "Mất sóng — đang dùng bản đồ lưu trong máy.";
}

/**
 * Đếm ô nền trượt: tải được thì về 0 (đường đã thông trở lại), trượt thì +1.
 * Tách ra hàm thuần để test được, và để chỗ gọi không tự bịa quy tắc.
 */
export function nextFailCount(prev: number, ok: boolean): number {
  return ok ? 0 : prev + 1;
}
