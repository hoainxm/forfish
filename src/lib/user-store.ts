// DỮ LIỆU BÀ CON TỰ GÕ VÀO (giấy tờ · bạn thuyền · mốc bảo dưỡng) — ghi xuống
// máy và NÓI THẬT khi không ghi được.
//
// Vì sao có file này (2026-07-31): ba màn trên đều tự `localStorage.setItem`
// trong một khối try/catch RỖNG. Máy hết chỗ (dự báo tải sẵn chiếm gần hết) thì
// màn hình vẫn hiện đúng thứ vừa nhập — vì nó nằm trong bộ nhớ — nhưng máy
// KHÔNG giữ gì; mở lại app là mất trắng, tệ hơn là tủ giấy tờ rơi về SỔ MẪU.
// Giấy tờ bà con gõ tay mất là mất luôn, còn dự báo có sóng là tải lại được ⇒
// khi chật chỗ thì DỰ BÁO NHƯỜNG, và nhường vẫn không đủ thì phải BÁO ĐỎ.

/**
 * MỘT câu chuẩn khi máy hết chỗ (audit thông báo 2026-08-18, T14 — trước đó 5
 * bản khác nhau: "xoá bớt ảnh/ứng dụng", "xoá bớt dữ liệu", "xoá bớt ảnh/video"…).
 * `what` = thứ vừa không lưu được, lời thường: "giấy tờ vừa nhập", "người vừa
 * thêm", "việc vừa ghi", "sản phẩm vừa ghi", "hồ sơ tàu".
 */
export function storageFullCopy(what: string): string {
  return `Máy hết chỗ — CHƯA lưu được ${what}. Xoá bớt ảnh/video rồi làm lại giúp nhé.`;
}

/**
 * Ghi JSON dữ liệu tự nhập. Trả `false` khi máy KHÔNG giữ được — nơi gọi PHẢI
 * hiện câu báo, không được nuốt im.
 */
export function saveUserJson(key: string, value: unknown): boolean {
  let payload: string;
  try {
    payload = JSON.stringify(value);
  } catch {
    return false; // không stringify được — không phải lỗi bộ nhớ
  }
  /*  ═══ HẾT CHỖ THÌ TỪ CHỐI GHI — KHÔNG ĐI XOÁ DỰ BÁO ═══
      (chủ dự án chốt 2026-08-02h: "hết chỗ → từ chối ghi và nói thật, không đi
      xoá đồ của bà con để lấy chỗ".)

      LỖI ĐÃ SỬA — ĐÂY LÀ ĐƯỜNG XOÁ DỮ LIỆU OFFLINE TỆ NHẤT CÒN LẠI:
      bản cũ lặp tới 4 lượt, mỗi lượt gọi `reclaimForecastSpace` xoá ÍT NHẤT một
      bản dự báo rồi thử ghi lại. Ba chỗ hỏng cộng lại:
        · KHÔNG có cầu dao "dọn không ăn thua". `saveForecast` có (dừng ngay khi
          dọn đủ byte mà vẫn ném ⇒ biết sức ép nằm ở kho khác), đường này thì
          không ⇒ trên iOS/WebKit — nơi localStorage và Cache API DÙNG CHUNG hạn
          ngạch origin — máy đầy vì kho service worker sẽ ăn **4 bản dự báo mà
          không ghi nổi một byte nào**.
        · Trần bậc chỉ dừng trước `storm`, tức `grid` (lưới gió/sóng 16 ngày) và
          `fishmark` (bản đồ cá) VẪN bị xoá được — để nhường chỗ cho một ghi chú
          vài KB. Hai lớp đó giữa biển KHÔNG tải lại được.
        · Nó chạy lúc MỞ MÀN, không phải lúc bà con gõ: `sell-guide.tsx` và
          `boat-products.tsx` đều `useEffect(…, [list, ready])` nên `ready` bật
          là ghi một lượt. Vào ra màn Giao dịch / Tàu cá vài chục lần giữa biển
          = ăn dần kho dự báo, hoàn toàn im lặng, KHÔNG CẦN MẠNG.

      Nay: thử ghi, hỏng thì trả `false`. Chỗ gọi đã có sẵn đường nói thật —
      banner đỏ "CHƯA lưu được, máy hết chỗ". Bà con mất một ghi chú còn hơn mất
      lưới gió sóng của cả chuyến. */
  try {
    window.localStorage.setItem(key, payload);
    return true;
  } catch {
    return false;
  }
}
