import "server-only";
// HỢP ĐỒNG KHO của Chợ vật tư. Hai bản: supabase-store.ts (prod) · file-store.ts (dev).
// LUẬT: adapter KHÔNG chứa nghiệp vụ. Nó nhận dữ liệu đã validate/tính xong và
// ghi/đọc; ràng buộc nguyên tử (kho, trùng đơn) nằm ở RPC (supabase) hoặc trong
// hàng đợi ghi (file). Mọi lỗi ném MarketError (errors.ts) — route map sang JSON.
// Người mua KHÔNG BAO GIỜ thấy món deletedAt/adminHidden hay đánh giá hidden —
// adapter lọc, không để route nhớ.
import type {
  Actor, Address, AdminOverview, BankInfo, DevPersona, Order, OrderLine, OrderStatus, Page,
  PaymentMethod, PaymentStatus, PlaceOrderResult, Product, ProductCard, ProductDraftM, ProductQuery,
  Review, Shop, ShopDraft, ShopPatch, ShopStats, ShopStatus, StatsRange, TimelineEntry,
  MarketRequest, RequestDraft, RequestStatus,
} from "./types";
import type { PreparedRequestOrder, RequestPatch } from "./request-state";

/** Vá một đơn — adapter chỉ GHI đúng các trường có mặt; nội dung do applyTransition /
 *  applyPaymentTransition / settleOverdue (order-state.ts) tính. */
export interface OrderPatch {
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  cancelBy?: Actor;
  cancelReason?: string;
  needsRefund?: boolean;
  sellerNote?: string;
  carrier?: string;
  trackingCode?: string;
  deliveredAt?: string;
  completedAt?: string;
  /** hẹn giao — ghi khi shop/chủ sàn xác nhận (YYYY-MM-DD) */
  etaFrom?: string;
  etaTo?: string;
  /** mục MỚI nối vào timeline (adapter append, không thay cả mảng) */
  timelineAppend?: TimelineEntry;
}

/** Đầu vào placeOrders — do route dựng từ pricing.ts. */
export interface PreparedShopOrder {
  shopId: string;
  clientRef: string;
  lines: OrderLine[];
  subtotalVnd: number;
  shippingVnd: number;
  totalVnd: number;
  /** STK shop lúc đặt — route lấy từ Shop khi paymentMethod = chuyen_khoan */
  bankSnapshot?: BankInfo;
  /** ghi chú RIÊNG cho shop này (11 §5.6) — có thì adapter ghi số này vào
   *  `buyer_note` của đơn, thiếu thì dùng `common.buyerNote`. */
  buyerNote?: string;
}

/*  `code` + `buyerPhone` nằm Ở ĐÂY chứ không riêng của admin (trước 2026-09-07
    chỉ `listAllOrders` có): chủ shop cũng phải tra được đơn khi bà con gọi đọc
    mã hoặc số. Hai bộ lọc này áp trong CHÍNH hàm dùng chung của mỗi adapter nên
    listBuyerOrders/listShopOrders/listAllOrders cùng một luật, không ai lệch. */
export interface OrderListQuery {
  status?: OrderStatus;
  page?: number;
  pageSize?: number;
  /** mã đơn đầy đủ, so KHỚP HẲN sau khi hoa hoá (SD + yymmdd + 4) */
  code?: string;
  /** SĐT người mua, đã chuẩn hoá trước khi truyền vào */
  buyerPhone?: string;
  /** trạng thái thanh toán (BH-08: ô "Báo đã CK" ⇒ `bao_da_chuyen`) */
  paymentStatus?: PaymentStatus;
  /** chỉ đơn CHƯA kết thúc (∉ da_huy/hoan_thanh) — áp trong adapter để `total` khớp danh sách, không lọc sau */
  open?: boolean;
}

export interface RequestListQuery {
  status?: RequestStatus;
  page?: number;
  pageSize?: number;
}

export interface MarketStore {
  // ── Sản phẩm (người mua) ─────────────────────────────────────────────
  listProducts(q: ProductQuery): Promise<Page<ProductCard>>;
  /** null khi không có / đã xoá. adminHidden vẫn trả (kèm cờ) — route buyer coi như 404, route seller/admin hiện băng đỏ. */
  getProduct(id: string): Promise<ProductCard | null>;
  /** nhiều id một lượt — cho giỏ + đặt hàng (không N+1). Trả cả 'an'/'het_hang'/adminHidden (KHÔNG trả deleted) để buildMarketLines tự loại + báo lý do. */
  getProductsByIds(ids: string[]): Promise<Product[]>;

  // ── Shop ─────────────────────────────────────────────────────────────
  getShop(id: string): Promise<Shop | null>;
  getShopBySlug(slug: string): Promise<Shop | null>;
  getShopByOwner(ownerPhone: string): Promise<Shop | null>;
  /** slug = toSlug(draft.name); trùng ⇒ MarketError('slug_taken'); owner trùng ⇒ 'invalid' "Số này đã có shop rồi…" */
  createShop(ownerPhone: string, draft: ShopDraft, slug: string): Promise<Shop>;
  /** đổi tên ⇒ caller truyền slug mới; trùng ⇒ 'slug_taken' */
  updateShop(id: string, patch: ShopPatch, slug?: string): Promise<Shop>;
  listShops(q: { status?: ShopStatus; page?: number; pageSize?: number }): Promise<Page<Shop>>;
  /** hoat_dong lần đầu ⇒ adapter đặt approvedAt */
  setShopStatus(id: string, status: ShopStatus, note: string | null): Promise<Shop>;
  /** admin gán chủ shop (seed SDVICO) — ownerPhone đã chuẩn hoá; đã là chủ shop khác ⇒ 'invalid' */
  setShopOwner(id: string, ownerPhone: string): Promise<Shop>;

  // ── Sản phẩm (người bán) ─────────────────────────────────────────────
  listShopProducts(shopId: string, q: Omit<ProductQuery, "shopId">): Promise<Page<Product>>;
  createProduct(shopId: string, draft: ProductDraftM, searchText: string): Promise<Product>;
  /** không đổi được adminHidden qua đây (seller) — adapter bỏ qua nếu có */
  updateProduct(shopId: string, id: string, patch: Partial<ProductDraftM>, searchText?: string): Promise<Product>;
  /** XOÁ MỀM: deletedAt = now (LEAD §4 #12). Ảnh giữ. Không phải của shop ⇒ 'not_found'. */
  deleteProduct(shopId: string, id: string): Promise<void>;
  /** admin gỡ / trả lại món (11 §7) — hidden=true bắt buộc reason */
  setProductAdminHidden(id: string, hidden: boolean, reason: string | null): Promise<Product>;

  // ── Đơn ──────────────────────────────────────────────────────────────
  /**
   * Đặt hàng: MỖI shop một đơn, NGUYÊN TỬ TRONG SHOP, độc lập GIỮA các shop
   * (shop A hết hàng không kéo shop B — LEAD §4 #5). Tham số lines/totals ĐÃ TÍNH
   * ở route bằng pricing.ts; adapter chỉ chạy RPC/ghi file + sinh mã (order-code.ts).
   * Thứ tự kết quả = thứ tự `prepared`.
   */
  placeOrders(buyerPhone: string, prepared: PreparedShopOrder[], common: {
    address: Address; paymentMethod: PaymentMethod;
    /** ghi chú chung — chỉ dùng khi `prepared[].buyerNote` trống */
    buyerNote?: string;
  }): Promise<PlaceOrderResult[]>;
  listBuyerOrders(buyerPhone: string, q?: OrderListQuery): Promise<Page<Order>>;
  listShopOrders(shopId: string, q?: OrderListQuery): Promise<Page<Order>>;
  /** admin: mọi đơn, lọc tuỳ chọn (11 §7: shop / trạng thái / SĐT người mua / mã đơn).
   *  `buyerPhone`/`code` nay ở `OrderListQuery` — đây chỉ thêm `shopId`. */
  listAllOrders(q?: OrderListQuery & { shopId?: string }): Promise<Page<Order>>;
  /** quét cho settleOverdue: đơn da_giao có deliveredAt ≤ mốc (≤ 200 đơn/lượt) */
  listOverdueDelivered(beforeIso: string, shopId?: string): Promise<Order[]>;
  /** quét tự huỷ: đơn cho_xac_nhan tạo trước mốc (≤ 200 đơn/lượt) — 2026-10-18 */
  listOverduePending(beforeIso: string, shopId?: string): Promise<Order[]>;
  getOrder(id: string): Promise<Order | null>;
  getOrderByClientRef(buyerPhone: string, clientRef: string): Promise<Order | null>;
  /**
   * Ghi vá có ĐIỀU KIỆN: chỉ ghi khi đơn vẫn ở `expectStatus` (chống hai người
   * bấm sát nhau) — không khớp ⇒ MarketError('bad_transition'). Nếu patch.status
   * === 'da_huy' thì adapter gọi hoàn kho (RPC market_restock_order / file: cộng
   * lại stock) NGAY SAU khi ghi. Dùng cho cả chuyển thanh toán (patch.paymentStatus)
   * và ghi chú/vận chuyển (không đổi status — expectStatus vẫn phải khớp).
   */
  transitionOrder(id: string, expectStatus: OrderStatus, patch: OrderPatch): Promise<Order>;

  // ── Yêu cầu đặt hàng — "đặt bất kỳ cái gì", chủ sàn báo giá (2026-10-18) ──
  /** adapter sinh mã YC… (makeRequestCode), status moi, timeline [moi] */
  createRequest(buyerPhone: string, draft: RequestDraft): Promise<MarketRequest>;
  listBuyerRequests(buyerPhone: string, q?: RequestListQuery): Promise<Page<MarketRequest>>;
  listAllRequests(q?: RequestListQuery): Promise<Page<MarketRequest>>;
  getRequest(id: string): Promise<MarketRequest | null>;
  /** ghi có điều kiện như transitionOrder — lệch expectStatus ⇒ 'bad_transition' */
  patchRequest(id: string, expectStatus: RequestStatus, patch: RequestPatch): Promise<MarketRequest>;
  /** đồng ý báo giá: giữ yêu cầu (da_bao_gia → da_dat) RỒI sinh đơn; sinh đơn hỏng ⇒ trả yêu cầu về da_bao_gia + ném 'insert_failed' */
  acceptRequest(id: string, patch: RequestPatch, order: PreparedRequestOrder): Promise<{ request: MarketRequest; order: Order }>;

  // ── Đánh giá ─────────────────────────────────────────────────────────
  addReview(input: { orderId: string; productId: string; buyerPhone: string; rating: 1 | 2 | 3 | 4 | 5; comment?: string }): Promise<Review>;
  /*  Đọc đánh giá — MỘT hàm cho cả ba việc: một món (buyer), một món kèm bản ẩn
      (admin mở chi tiết món), và CẢ SÀN (hàng đợi kiểm duyệt, 2026-09-07).
      Trước đây chỉ có bản theo món nên admin muốn soát một đánh giá bậy phải
      đoán đúng món rồi mở ra — với vài trăm món là bất khả thi.
      · productId bỏ trống = cả sàn · maxRating = chỉ lấy sao ≤ n (1–2 sao là
      chỗ lời lẽ nặng nằm) · includeHidden CHỈ route admin truyền. */
  listReviews(q?: {
    productId?: string;
    maxRating?: number;
    page?: number;
    pageSize?: number;
    includeHidden?: boolean;
  }): Promise<Page<Review>>;
  /** admin ẩn/hiện — tính lại ratingAvg/ratingCount sản phẩm + shop từ đánh giá KHÔNG ẩn (RPC market_set_review_hidden) */
  setReviewHidden(id: string, hidden: boolean): Promise<Review>;
  /** id món buyer đã đánh giá trong đơn — cho canReview */
  reviewedProductIds(orderId: string): Promise<string[]>;

  // ── Thống kê + ảnh ───────────────────────────────────────────────────
  stats(shopId: string, range: StatsRange): Promise<ShopStats>;
  overview(): Promise<AdminOverview>;
  /** bytes ĐÃ nén ở client (≤ 400 KB, server vẫn chặn ≤ 500 KB) → URL công khai */
  saveUpload(shopId: string, bytes: Uint8Array, mime: "image/jpeg" | "image/png" | "image/webp"): Promise<{ url: string }>;

  // ── Dev (CHỈ file-store; supabase-store ném MarketError('forbidden')) ──
  devLogin(phone: string): Promise<{ token: string; persona: DevPersona }>;
  devIdentity(token: string): Promise<DevPersona | null>;
  devPersonas(): Promise<DevPersona[]>;
  devNotifications(phone: string): Promise<{ at: string; title: string; body: string; url?: string; pushOs: boolean }[]>;
}

// ── Singleton sống qua HMR ──────────────────────────────────────────────
import { isDevFileMode } from "./dev-mode";

type G = typeof globalThis & { __sdfishMarketStore?: MarketStore };

export async function getMarketStore(): Promise<MarketStore> {
  const g = globalThis as G;
  if (g.__sdfishMarketStore) return g.__sdfishMarketStore;
  // import() động: file-store kéo node:fs — không để nó nằm trong bundle của
  // mọi route khi chạy prod (chỉ supabase-store được nạp).
  const store: MarketStore = isDevFileMode()
    ? (await import("./file-store")).createFileStore()
    : (await import("./supabase-store")).createSupabaseStore();
  g.__sdfishMarketStore = store;
  return store;
}
