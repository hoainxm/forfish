/*
  ẢNH NHỎ CHO SẢN PHẨM SDVICO TRÊN CHỢ (2026-10-29, rà soát tốc độ D/P2).

  Sản phẩm SDVICO trên chợ /cho mang ảnh gốc `/sdvico/*.png|jpg` (PNG tới 0,6 MB;
  migration 0061 chép `product_listings.image_url` sang `market_products.images`)
  mà hiển thị ở thẻ 4:3 (~150 px) và ô dòng hàng 3–3,5rem. Bản webp cạnh ngắn
  240 px nằm ở `/sdvico/nho/<tên>.webp` (sinh bằng scripts/anh-nho-sdvico.mjs,
  ~3–17 KB mỗi ảnh). KHÔNG đổi dữ liệu — chỉ đổi lúc hiển thị ô nhỏ. Ảnh ngoài
  (shop tự đăng: URL bucket đầy đủ, data-URI) giữ nguyên. Trang chi tiết sản phẩm
  vẫn dùng ảnh gốc (cần nét, mở khi bà con chạm).
  Hỏng (máy không đọc webp — iOS < 14, hoặc thiếu bản nhỏ) ⇒ `luiAnhGoc` đổi về
  ảnh gốc MỘT lần; gốc cũng hỏng thì chỗ gọi hiện ô trống như trước.
*/

const GOC_SDVICO = /^\/sdvico\/([\w-]+)\.(?:png|jpe?g)$/i;

/** Đường dẫn ảnh nhỏ cho thẻ/ô; không phải ảnh SDVICO nội bộ thì trả nguyên. */
export function anhNho(url: string): string {
  const m = GOC_SDVICO.exec(url);
  return m ? `/sdvico/nho/${m[1]}.webp` : url;
}

/**
 * Gọi trong `onError` của <img src={anhNho(goc)}>: lần hỏng đầu của bản nhỏ ⇒
 * đổi `src` về ảnh gốc, trả true (đừng báo hỏng). Ảnh không có bản nhỏ, hoặc đã
 * lùi rồi ⇒ false (chỗ gọi xử lý như ảnh hỏng).
 */
export function luiAnhGoc(el: { src: string; dataset: DOMStringMap }, goc: string): boolean {
  if (anhNho(goc) === goc || el.dataset.lui) return false;
  el.dataset.lui = "1";
  el.src = goc;
  return true;
}
