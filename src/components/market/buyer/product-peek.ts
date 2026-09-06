"use client";

// "BẢN THẺ VỪA XEM" — để mở trang món lúc MẤT SÓNG vẫn thấy tên, giá, ảnh của
// đúng món bà con vừa chạm ở danh sách (11 §5.3), thay vì một màn trắng.
//
// Cố ý dùng `sessionStorage` và KHÔNG dùng tiền tố `forfish.` (12 §8.2): đây là
// bộ nhớ tạm của MỘT lượt mở app, không phải dữ liệu của bà con — không cần vào
// sổ khoá, không cần sao lưu, đóng app là hết. Giữ ít để không ăn chỗ.
import type { ProductCard } from "@/lib/market/types";

const KEY = "sdfish.market-peek.v1";
const MAX = 30;

export interface ProductPeek {
  at: number;
  product: ProductCard;
}

type Store = Record<string, ProductPeek>;

function read(): Store {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return {};
    const s = JSON.parse(raw) as Store;
    return s && typeof s === "object" ? s : {};
  } catch {
    return {};
  }
}

/** Ghi lại thẻ vừa hiện ở danh sách. Nuốt lỗi — đây là thứ có thì tốt. */
export function rememberPeek(product: ProductCard): void {
  if (typeof window === "undefined") return;
  try {
    const s = read();
    s[product.id] = { at: Date.now(), product };
    const keys = Object.keys(s);
    if (keys.length > MAX) {
      keys
        .sort((a, b) => s[a].at - s[b].at)
        .slice(0, keys.length - MAX)
        .forEach((k) => delete s[k]);
    }
    window.sessionStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* hết chỗ / trình duyệt chặn — màn tự lo nhánh không có bản xem */
  }
}

export function readPeek(id: string): ProductPeek | null {
  const p = read()[id];
  return p && p.product ? p : null;
}
