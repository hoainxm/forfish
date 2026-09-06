// KIỂU DOMAIN của Chợ vật tư — THUẦN, dùng chung client/route/adapter/test.
// Khớp migration 0054 (bản 1.1). Camel ở app, snake ở DB; đổi kiểu ⇒ đổi cả rowTo* trong adapter.

export type ShopStatus = "cho_duyet" | "hoat_dong" | "tam_khoa" | "tu_choi";
export type ProductStatus = "dang_ban" | "an" | "het_hang";
/** Bộ LỌC trạng thái ở danh sách món của shop (seller/admin). `bi_go` KHÔNG phải một
 *  ProductStatus — nó là cờ `adminHidden` (SDVICO gỡ); `all` = không lọc. */
export type ProductStatusFilter = ProductStatus | "bi_go" | "all";
export type OrderStatus =
  | "cho_xac_nhan" | "da_xac_nhan" | "dang_giao" | "da_giao" | "hoan_thanh" | "da_huy";
export type PaymentMethod = "cod" | "chuyen_khoan";
export type PaymentStatus = "chua_thanh_toan" | "bao_da_chuyen" | "da_thanh_toan";
/** Ai thao tác — dùng cho máy trạng thái. */
export type Actor = "buyer" | "seller" | "admin" | "system";
/** Ai ghi vào timeline: actor thường, hoặc `admin:<sđt>` khi admin xử lý thay shop (LEAD §4 #2). */
export type TimelineBy = Actor | `admin:${string}`;
/** id gạch-ngang — LEAD §4 #14, khớp check constraint 0054. */
export type ProductCategory =
  | "may-dong-co" | "dien-tu-hang-hai" | "ngu-cu" | "dau-nhot-nhien-lieu"
  | "da-bao-quan" | "nhu-yeu-pham" | "an-toan" | "phu-tung" | "khac";

export interface BankInfo { bankName: string; bankAccount: string; bankHolder: string }

export interface Shop {
  id: string;
  ownerPhone: string;
  name: string;
  slug: string;
  description?: string;
  logoUrl?: string;
  phone?: string;
  province?: string;
  address?: string;
  bankName?: string;
  bankAccount?: string;
  bankHolder?: string;
  shippingFlatVnd: number;
  freeShipFromVnd?: number;
  status: ShopStatus;
  statusNote?: string;
  /** seller tự "tạm nghỉ bán" — món vẫn hiện, không đặt được (LEAD §4 #8) */
  paused: boolean;
  ratingAvg: number;
  ratingCount: number;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

/** Phần người mua được thấy về shop. KHÔNG có ownerPhone/STK/lý do khoá; có cờ "nhận chuyển khoản" để màn Đặt hàng ép COD (LEAD §4 #9). */
export type ShopPublic = Omit<Shop, "ownerPhone" | "bankName" | "bankAccount" | "bankHolder" | "statusNote">
  & { acceptsBankTransfer: boolean };

export interface Variant {
  label: string;
  /** null/undefined = giá gốc của sản phẩm. Kho CHUNG theo sản phẩm (LEAD §5 #5). */
  priceVnd?: number;
}

export interface Product {
  id: string;
  shopId: string;
  title: string;
  description?: string;
  category: ProductCategory;
  priceVnd: number;
  compareAtVnd?: number;
  unit: string;
  stock: number;
  images: string[];
  variants: Variant[];
  status: ProductStatus;
  /** admin gỡ — seller không tự bật lại (11 §3.2) */
  adminHidden: boolean;
  adminHiddenReason?: string;
  /** xoá mềm (LEAD §4 #12) — adapter không bao giờ trả món đã xoá cho buyer */
  deletedAt?: string;
  soldCount: number;
  ratingAvg: number;
  ratingCount: number;
  createdAt: string;
  updatedAt: string;
}

/** Sản phẩm kèm tên/tỉnh/slug/paused của shop cho thẻ ở danh sách (một lượt đọc, không N+1). */
export interface ProductCard extends Product {
  shopName: string;
  shopSlug: string;
  shopProvince?: string;
  shopPaused: boolean;
}

/** Địa chỉ nhận — snapshot vào đơn. isPort=true: detail = tên cảng/cầu cảng (2–80 chữ); false: địa chỉ 5–200 chữ. */
export interface Address {
  name: string;
  phone: string;
  province: string;
  detail: string;
  isPort: boolean;
}

/** Một dòng hàng ĐÃ ĐÓNG BĂNG trong đơn. */
export interface OrderLine {
  productId: string;
  variantLabel?: string;
  title: string;
  unit: string;
  priceVnd: number;
  qty: number;
  lineTotalVnd: number;
  image?: string;
}

/** Một mục timeline — chuyển trạng thái ĐƠN hoặc THANH TOÁN (hai tập giá trị không trùng nhau). */
export interface TimelineEntry {
  status: OrderStatus | PaymentStatus;
  at: string;
  by: TimelineBy;
  note?: string;
}

export interface Order {
  id: string;
  code: string;
  buyerPhone: string;
  shopId: string;
  /** đính kèm khi đọc (join shops) — tên/SĐT/slug HIỆN TẠI của shop, để màn đơn có nút Gọi shop */
  shopName?: string;
  shopPhone?: string;
  shopSlug?: string;
  items: OrderLine[];
  subtotalVnd: number;
  shippingVnd: number;
  totalVnd: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  /** STK shop LÚC ĐẶT (chỉ chuyen_khoan) — nội dung CK = code */
  bankSnapshot?: BankInfo;
  needsRefund: boolean;
  status: OrderStatus;
  cancelBy?: Actor;
  cancelReason?: string;
  address: Address;
  buyerNote?: string;
  sellerNote?: string;
  carrier?: string;
  trackingCode?: string;
  timeline: TimelineEntry[];
  clientRef?: string;
  createdAt: string;
  updatedAt: string;
  deliveredAt?: string;
  completedAt?: string;
}

export interface Review {
  id: string;
  orderId: string;
  productId: string;
  shopId: string;
  /** che 4 số giữa khi trả ra ngoài — adapter làm, không phải UI */
  buyerPhoneMasked: string;
  rating: 1 | 2 | 3 | 4 | 5;
  comment?: string;
  /** admin ẩn (LEAD §4 #15) — buyer không thấy; admin thấy kèm cờ */
  hidden: boolean;
  createdAt: string;
}

// ── Draft (phần client gửi) ───────────────────────────────────────────────
export interface ShopDraft {
  name: string;
  description?: string;
  logoUrl?: string;
  phone?: string;
  province: string;
  address?: string;
  bankName?: string;
  bankAccount?: string;
  bankHolder?: string;
  shippingFlatVnd: number;
  freeShipFromVnd?: number;
}
/** Vá shop — chỉ chủ shop; `paused` tách khỏi draft đăng ký. */
export type ShopPatch = Partial<ShopDraft> & { paused?: boolean };

export interface ProductDraftM {
  title: string;
  description?: string;
  category: ProductCategory;
  priceVnd: number;
  compareAtVnd?: number;
  unit: string;
  stock: number;
  images: string[];
  variants: Variant[];
  status: ProductStatus;
}

/** Dòng giỏ — chỉ id + biến thể + số lượng; giá tra lúc hiện/đặt. */
export interface MarketCartLine {
  productId: string;
  variantLabel?: string;
  qty: number;
}

/** Kết quả tra giỏ (`POST /api/cho/gio/tinh`) — cũng là bản lưu trong `forfish.mcart.v1.quote` để mất sóng còn hiện "giá lúc HH:MM". */
export interface CartQuoteGroup {
  shop: ShopPublic;
  lines: OrderLine[];
  subtotalVnd: number;
  shippingVnd: number;
  totalVnd: number;
}
export interface CartQuote {
  at: string;
  groups: CartQuoteGroup[];
  dropped: import("./pricing").DroppedLine[];
  summary: { subtotalVnd: number; shippingVnd: number; totalVnd: number; shopCount: number };
}

/** Phần đặt hàng cho MỘT shop (một lần đặt = N draft, mỗi draft một đơn). */
export interface ShopCheckoutDraft {
  shopId: string;
  items: MarketCartLine[];
  /** vân tay nội dung — lib/market/order-ref.ts marketOrderClientRef */
  clientRef: string;
  /** tổng client vừa thấy — server tính lại, lệch ⇒ price_changed (11 R5) */
  expectedTotalVnd: number;
  /** GHI CHÚ RIÊNG CHO SHOP NÀY (11 §5.6, 2026-09-06) — dặn dò khác nhau theo
   *  shop ("giao trước 6h" vs "gọi trước khi tới"). Có thì đơn của shop này
   *  dùng nó; thiếu thì rơi về `CheckoutDraft.buyerNote`. ≤ NOTE_MAX chữ. */
  buyerNote?: string;
}

export interface CheckoutDraft {
  shops: ShopCheckoutDraft[];
  address: Address;
  /** MỘT cách trả tiền cho cả lần đặt (LEAD §4 #9) */
  paymentMethod: PaymentMethod;
  /** ghi chú CHUNG — chỉ dùng cho shop nào không có `shops[].buyerNote` riêng */
  buyerNote?: string;
}

// ── Kết quả ───────────────────────────────────────────────────────────────
export type PlaceOrderFailCode =
  | "shop_not_active" | "shop_paused" | "line_unavailable" | "price_changed" | "insert_failed";
export type PlaceOrderResult =
  | { shopId: string; ok: true; order: Order; duplicate: boolean }
  | {
      shopId: string; ok: false; code: PlaceOrderFailCode;
      /** line_unavailable: đúng id thiếu, kèm số còn lại nếu biết */
      productIds: string[]; available?: Record<string, number>;
      /** price_changed: tổng mới để client hiện "tổng mới …đ, bấm Đặt hàng lần nữa" */
      quote?: { subtotalVnd: number; shippingVnd: number; totalVnd: number };
    };

export interface ProductQuery {
  q?: string;
  category?: ProductCategory;
  /** LỌC theo tỉnh của shop (chip "Gần tôi" / khối "Gần bà con" ở /cho — LEAD §4 #11) */
  province?: string;
  shopId?: string;
  /** moi (mặc định) · ban_chay · gia_tang · gia_giam */
  sort?: "moi" | "ban_chay" | "gia_tang" | "gia_giam";
  page?: number;      // từ 1
  pageSize?: number;  // mặc định 20, trần 50
  /** false (buyer): status ∈ dang_ban|het_hang, KHÔNG adminHidden, KHÔNG deleted, shop hoat_dong.
   *  true (seller/admin): mọi status + adminHidden, vẫn KHÔNG deleted. */
  includeHidden?: boolean;
  /** CHỈ `listShopProducts` (seller/admin) đọc — `listProducts` (chợ) BỎ QUA.
   *  dang_ban|an|het_hang = đúng status VÀ không bị gỡ · bi_go = bị admin gỡ (mọi status)
   *  · all / bỏ trống = không lọc. Khớp bảng lọc route 12 §7.2. */
  status?: ProductStatusFilter;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export type StatsRange = "today" | "7d" | "30d";
export interface ShopStats {
  range: StatsRange;
  orders: number;             // đơn TẠO trong kỳ
  completed: number;          // đơn hoan_thanh có completedAt trong kỳ
  revenueVnd: number;         // tổng total_vnd (hàng + ship) của đơn hoan_thanh theo completedAt trong kỳ — 11 §6.3
  /** ba ô "cần làm ngay" — hiện tại, không theo kỳ */
  pendingOrders: number;      // cho_xac_nhan
  shippingOrders: number;     // dang_giao
  awaitingPaymentConfirm: number;  // paymentStatus = bao_da_chuyen, đơn chưa kết thúc
  topProducts: { productId: string; title: string; qty: number }[];  // ≤ 5, theo qty trong đơn hoan_thanh của kỳ
  lowStock: { productId: string; title: string; stock: number }[];   // stock ≤ 3, ≤ 10 dòng
  byStatus: Record<OrderStatus, number>;
}

/** KPI sàn cho tab admin (11 §7). */
export interface AdminOverview {
  shops: Record<ShopStatus, number>;
  productsOnSale: number;
  orders: Record<"today" | "d7" | "d30", Record<OrderStatus, number>>;
  gmvVnd: Record<"today" | "d7" | "d30", number>;     // đơn hoan_thanh theo completedAt
  cancelRate30d: number;                               // huỷ / (huỷ + hoàn thành), 0..1
}

/** Persona dev (chỉ file mode). */
export interface DevPersona {
  phone: string;
  name: string;
  role: "buyer" | "seller" | "admin";
  tier: "basic" | "premium";
}
