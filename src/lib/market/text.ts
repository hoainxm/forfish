// CHỮ của Chợ vật tư — THUẦN (client + route + adapter + test dùng chung).
// Một hàm bỏ dấu cho CẢ search_text lẫn chuỗi tìm lẫn so trùng nhãn biến thể:
// hai bên cùng đi qua foldVn thì "Dây Thừng" tìm ra "day thung" và ngược lại.

/** Chữ thường, bỏ dấu, đ→d, chỉ giữ [a-z0-9 ], còn lại thành khoảng trắng, gộp — dùng cho search_text VÀ chuỗi tìm VÀ so trùng nhãn biến thể. */
export function foldVn(s: string): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** "Đại lý Hải Đăng" → "dai-ly-hai-dang"; rỗng ⇒ "shop". Tên shop DUY NHẤT qua slug (không hậu tố). */
export function toSlug(s: string): string {
  const slug = foldVn(s).replace(/ /g, "-");
  return slug || "shop";
}

/** search_text cho sản phẩm. */
export function productSearchText(d: { title: string; description?: string }): string {
  return foldVn(`${d.title ?? ""} ${d.description ?? ""}`);
}

/** "0901234567" → "0901***567". Số ngắn không ném — che phần giữa còn lại. */
export function maskPhone(phone: string): string {
  const d = (phone ?? "").replace(/\D/g, "");
  if (d.length <= 4) return d ? "*".repeat(d.length) : "";
  if (d.length < 10) return d.slice(0, 2) + "*".repeat(d.length - 4) + d.slice(-2);
  return d.slice(0, 4) + "***" + d.slice(-3);
}
