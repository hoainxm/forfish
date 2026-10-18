"use client";

// TRẠNG THÁI MÁY của khu Chợ vật tư (giỏ · yêu thích · bản lưu đơn · có sóng
// chưa) — gói lại để 8 màn không mỗi màn một kiểu đọc localStorage.
// MỌI thao tác kho đều đi qua lib/market/* của Core; ở đây chỉ có React.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addMarketLine, loadMarketCart, loadMarketUnselected, MARKET_CART_EVENT, saveMarketCart, saveMarketUnselected,
  selectedMarketLines, setMarketSelection,
} from "@/lib/market/cart";
import { isFavorite, loadFavorites, saveFavorites, toggleFavorite, type FavItem } from "@/lib/market/favorites";
import { loadCachedMarketOrders } from "@/lib/market/orders-cache";
import type { MarketCartLine, Order } from "@/lib/market/types";
import { useAuthUser } from "@/lib/use-auth";

/** Đơn chưa kết thúc = còn phải theo dõi (badge nút Đơn hàng ở /cho). */
export const isOpenOrder = (o: Order) => o.status !== "hoan_thanh" && o.status !== "da_huy";

/**
 * CÓ SÓNG CHƯA — đọc trong effect (không đọc lúc render) để bản dựng máy chủ và
 * bản vẽ đầu ở máy khớp nhau. `navigator.onLine` chỉ biết "có nối mạng", không
 * biết mạng có sống; nhánh lỗi của từng fetch mới là chốt.
 */
export function useOnlineState(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);
  return online;
}

/** Kết quả thêm vào giỏ — màn nói câu khác nhau cho ba ca này. */
export type AddResult = "ok" | "gio_day" | "het_cho";

export interface MarketCartState {
  phone: string | null;
  /** MÁY NÀY CÓ TÀI KHOẢN CHƯA — hỏi `signedIn`, KHÔNG hỏi `phone`:
   *  `phone` có thể null trong khi vẫn đăng nhập (xem cảnh báo ở use-auth.ts),
   *  và lúc đó cổng đăng nhập sẽ chặn oan người đang có tài khoản. */
  signedIn: boolean;
  items: MarketCartLine[];
  /** SỐ DÒNG trong giỏ (F-19: badge đếm dòng như Shopee — 25 kg dây là 1 dòng, không phải 25). */
  count: number;
  /** Khoá dòng đang BỎ CHỌN (F-05) — mặc định chọn hết; dòng mới thêm tự được chọn. */
  unselected: string[];
  /** Dòng đang chọn = thứ màn Đặt hàng mang đi. */
  selectedItems: MarketCartLine[];
  /** Bật/tắt chọn cho một nhóm khoá (một dòng / cả shop / cả giỏ). */
  select: (keys: readonly string[], on: boolean) => void;
  /** Ghi giỏ; false = MÁY HẾT CHỖ (màn phải báo đỏ, KHÔNG tăng badge). */
  commit: (next: MarketCartLine[]) => boolean;
  /** Thêm 1 dòng (cộng dồn theo biến thể) — trần 50 dòng ⇒ "gio_day". */
  add: (productId: string, variantLabel: string | undefined, qty?: number) => AddResult;
  saveFailed: boolean;
}

export function useMarketCart(): MarketCartState {
  const { phone, signedIn } = useAuthUser();
  const [items, setItems] = useState<MarketCartLine[]>([]);
  const [unselected, setUnselected] = useState<string[]>([]);
  const [saveFailed, setSaveFailed] = useState(false);

  /*  KHÁCH LẠ ĐĂNG NHẬP THÌ GIỎ ĐI THEO.
      Giỏ ngăn theo SĐT (R15, cách ly máy dùng chung) và khách lạ nằm ngăn
      "__khach__". Nhưng luồng đã chốt là: xem chợ không cần tài khoản → chọn
      món → bấm Đặt hàng mới hiện LoginGate (11 §5.5). Không dời giỏ thì bà con
      đăng nhập xong quay lại thấy GIỎ TRỐNG — mất công chọn lại, đúng lúc
      chuẩn bị trả tiền. Nên: vừa có SĐT mà ngăn của số đó đang trống thì dời
      giỏ khách lạ sang. Ngăn của người khác KHÔNG bị đụng (chỉ dời khi trống).
      Spec 11/12 chưa nói ca này — ghi ở đây và trong báo cáo. */
  const prevPhone = useRef<string | null>(null);
  useEffect(() => {
    if (phone && prevPhone.current === null) {
      const guest = loadMarketCart(null);
      if (guest.length > 0 && loadMarketCart(phone).length === 0) saveMarketCart(phone, guest);
    }
    prevPhone.current = phone ?? null;
  }, [phone]);

  useEffect(() => {
    const sync = () => {
      setItems(loadMarketCart(phone));
      setUnselected(loadMarketUnselected(phone));
    };
    sync();
    // giỏ đổi ở màn khác / tab khác ⇒ badge và danh sách theo kịp
    window.addEventListener(MARKET_CART_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(MARKET_CART_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [phone]);

  const commit = useCallback(
    (next: MarketCartLine[]) => {
      const ok = saveMarketCart(phone, next);
      setSaveFailed(!ok);
      if (ok) {
        setItems(next);
        setUnselected(loadMarketUnselected(phone)); // khoá của dòng vừa bỏ đã được tỉa
      }
      return ok;
    },
    [phone],
  );

  const select = useCallback(
    (keys: readonly string[], on: boolean) => {
      const next = setMarketSelection(loadMarketUnselected(phone), keys, on);
      // ghi hỏng (máy chật) thì vẫn giữ trong tay — chọn/bỏ chọn tính lại được
      saveMarketUnselected(phone, next);
      setUnselected(next);
    },
    [phone],
  );

  const add = useCallback(
    (productId: string, variantLabel: string | undefined, qty = 1): AddResult => {
      // đọc lại từ máy trước khi cộng — màn khác vừa sửa giỏ thì không đè mất
      const res = addMarketLine(loadMarketCart(phone), productId, variantLabel, qty);
      if (res.reason === "gio_day") return "gio_day";
      return commit(res.items) ? "ok" : "het_cho";
    },
    [phone, commit],
  );

  return {
    phone: phone ?? null, signedIn, items, count: items.length,
    unselected, selectedItems: selectedMarketLines(items, unselected), select,
    commit, add, saveFailed,
  };
}

export interface FavState {
  items: FavItem[];
  has: (productId: string) => boolean;
  toggle: (item: FavItem) => void;
}

export function useFavorites(): FavState {
  const { phone } = useAuthUser();
  const [items, setItems] = useState<FavItem[]>([]);
  useEffect(() => setItems(loadFavorites(phone)), [phone]);
  const toggle = useCallback(
    (item: FavItem) => {
      const next = toggleFavorite(loadFavorites(phone), item);
      // yêu thích là thứ nhỏ và tải lại được — hết chỗ thì thôi, không doạ bà con
      saveFavorites(phone, next);
      setItems(next);
    },
    [phone],
  );
  const has = useCallback((id: string) => isFavorite(items, id), [items]);
  return { items, has, toggle };
}

/** Bản lưu đơn trong máy (11 §9) — dùng cho badge + thẻ "Đơn đang tới" + "Mua lại". */
export function useCachedOrders(): { savedAt: number; orders: Order[] } | null {
  const { phone } = useAuthUser();
  const [cache, setCache] = useState<{ savedAt: number; orders: Order[] } | null>(null);
  useEffect(() => setCache(loadCachedMarketOrders(phone)), [phone]);
  return cache;
}

/** "40/500" — dòng cho bà con biết còn bao nhiêu, thay vì cuộn vô tận. */
export function useSeenLabel(shown: number, total: number): string | null {
  return useMemo(() => (total > shown ? `Đang xem ${shown}/${total}` : null), [shown, total]);
}
