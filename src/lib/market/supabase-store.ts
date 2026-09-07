// KHO SUPABASE cho PROD — service-role + RPC của 0054 (12 §5.4). Không chứa luật
// nghiệp vụ; nguyên tử (trừ kho, trùng client_ref, hoàn kho, điểm đánh giá) nằm
// trong RPC. Mọi truy vấn gắn đồng hồ 10 s qua `timeoutSignal` (KHÔNG
// AbortSignal.timeout trần — cổng no-bare-abort-timeout). rowTo* khoan dung với
// giá trị lạ như rowToOrder cũ (catalog-orders.ts).
import type { SupabaseClient } from "@supabase/supabase-js";
import { timeoutSignal } from "@/lib/abort";
import { todayIsoVN } from "@/lib/days";
import { createAdminClient } from "@/lib/supabase/admin";
import { isProductCategory } from "./categories";
import { MarketError } from "./errors";
import { makeOrderCode } from "./order-code";
import { isOrderStatus, isPaymentMethod, isPaymentStatus } from "./order-state";
import type { MarketStore, OrderListQuery, PreparedShopOrder } from "./store";
import { foldVn, maskPhone } from "./text";
import { normalizeProductStatus } from "./validate";
import type {
  Actor, Address, AdminOverview, BankInfo, Order, OrderLine, OrderStatus, Page, PaymentMethod,
  PlaceOrderResult, Product, ProductCard, Review, Shop, ShopStatus,
  TimelineEntry, Variant,
} from "./types";

type Row = Record<string, unknown>;
const TIMEOUT_MS = 10_000;
const DAY = 24 * 3600 * 1000;

// ── tiện ích đọc cột khoan dung ────────────────────────────────────────────
const str = (v: unknown): string | undefined => (typeof v === "string" && v !== "" ? v : undefined);
const num = (v: unknown, d = 0): number => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v !== "" && Number.isFinite(Number(v)) ? Number(v) : d);
const bool = (v: unknown): boolean => v === true;
const strArr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

function toVariants(v: unknown): Variant[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is Row => !!x && typeof x === "object" && typeof (x as Row).label === "string")
    .map((x) => ({ label: x.label as string, ...(typeof x.priceVnd === "number" ? { priceVnd: x.priceVnd } : {}) }));
}
function toLines(v: unknown): OrderLine[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is Row => !!x && typeof x === "object" && typeof (x as Row).productId === "string" && typeof (x as Row).qty === "number")
    .map((x) => ({
      productId: x.productId as string,
      ...(str(x.variantLabel) ? { variantLabel: str(x.variantLabel) } : {}),
      title: str(x.title) ?? "",
      unit: str(x.unit) ?? "",
      priceVnd: num(x.priceVnd),
      qty: num(x.qty),
      lineTotalVnd: num(x.lineTotalVnd),
      ...(str(x.image) ? { image: str(x.image) } : {}),
    }));
}
function toTimeline(v: unknown): TimelineEntry[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is Row => !!x && typeof x === "object" && (isOrderStatus((x as Row).status) || isPaymentStatus((x as Row).status)))
    .map((x) => ({
      status: x.status as TimelineEntry["status"],
      at: str(x.at) ?? "",
      by: (str(x.by) ?? "system") as TimelineEntry["by"],
      ...(str(x.note) ? { note: str(x.note) } : {}),
    }));
}
function toAddress(v: unknown): Address {
  const x = (v && typeof v === "object" ? v : {}) as Row;
  return { name: str(x.name) ?? "", phone: str(x.phone) ?? "", province: str(x.province) ?? "", detail: str(x.detail) ?? "", isPort: bool(x.isPort) };
}
function toBank(v: unknown): BankInfo | undefined {
  const x = v && typeof v === "object" ? (v as Row) : null;
  if (!x || !str(x.bankAccount)) return undefined;
  return { bankName: str(x.bankName) ?? "", bankAccount: str(x.bankAccount) ?? "", bankHolder: str(x.bankHolder) ?? "" };
}
const SHOP_STATUSES: ShopStatus[] = ["cho_duyet", "hoat_dong", "tam_khoa", "tu_choi"];

export function rowToShop(r: Row): Shop {
  return {
    id: String(r.id), ownerPhone: str(r.owner_phone) ?? "", name: str(r.name) ?? "", slug: str(r.slug) ?? "",
    description: str(r.description), logoUrl: str(r.logo_url), phone: str(r.phone), province: str(r.province),
    address: str(r.address), bankName: str(r.bank_name), bankAccount: str(r.bank_account), bankHolder: str(r.bank_holder),
    shippingFlatVnd: num(r.shipping_flat_vnd), freeShipFromVnd: r.free_ship_from_vnd == null ? undefined : num(r.free_ship_from_vnd),
    status: SHOP_STATUSES.includes(r.status as ShopStatus) ? (r.status as ShopStatus) : "cho_duyet",
    statusNote: str(r.status_note), paused: bool(r.paused), ratingAvg: num(r.rating_avg), ratingCount: num(r.rating_count),
    approvedAt: str(r.approved_at), createdAt: str(r.created_at) ?? "", updatedAt: str(r.updated_at) ?? "",
  };
}
export function rowToProduct(r: Row): Product {
  const status = r.status === "dang_ban" || r.status === "an" || r.status === "het_hang" ? r.status : "an";
  return {
    id: String(r.id), shopId: String(r.shop_id), title: str(r.title) ?? "", description: str(r.description),
    category: isProductCategory(r.category) ? r.category : "khac",
    /* price_vnd NULL = liên hệ báo giá — phải giữ NULL. `num()` sẽ biến thành 0
       và màn hiện "0 đ", tức là báo SAI giá cho bà con. */
    priceVnd: r.price_vnd == null ? null : num(r.price_vnd),
    compareAtVnd: r.compare_at_vnd == null ? undefined : num(r.compare_at_vnd), unit: str(r.unit) ?? "",
    stock: num(r.stock), images: strArr(r.images), variants: toVariants(r.variants), status,
    adminHidden: bool(r.admin_hidden), adminHiddenReason: str(r.admin_hidden_reason), deletedAt: str(r.deleted_at),
    soldCount: num(r.sold_count), ratingAvg: num(r.rating_avg), ratingCount: num(r.rating_count),
    createdAt: str(r.created_at) ?? "", updatedAt: str(r.updated_at) ?? "",
  };
}
export function rowToCard(r: Row): ProductCard {
  const s = (r.shops && typeof r.shops === "object" ? r.shops : {}) as Row;
  return { ...rowToProduct(r), shopName: str(s.name) ?? "", shopSlug: str(s.slug) ?? "", shopProvince: str(s.province), shopPaused: bool(s.paused) };
}
export function rowToOrder(r: Row): Order {
  const s = (r.shops && typeof r.shops === "object" ? r.shops : {}) as Row;
  const cancelBy = r.cancel_by === "buyer" || r.cancel_by === "seller" || r.cancel_by === "admin" || r.cancel_by === "system" ? (r.cancel_by as Actor) : undefined;
  return {
    id: String(r.id), code: str(r.code) ?? "", buyerPhone: str(r.buyer_phone) ?? "", shopId: String(r.shop_id),
    shopName: str(s.name), shopPhone: str(s.phone) ?? str(s.owner_phone), shopSlug: str(s.slug),
    items: toLines(r.items), subtotalVnd: num(r.subtotal_vnd), shippingVnd: num(r.shipping_vnd), totalVnd: num(r.total_vnd),
    paymentMethod: isPaymentMethod(r.payment_method) ? r.payment_method : "cod",
    paymentStatus: isPaymentStatus(r.payment_status) ? r.payment_status : "chua_thanh_toan",
    bankSnapshot: toBank(r.bank_snapshot), needsRefund: bool(r.needs_refund),
    status: isOrderStatus(r.status) ? r.status : "cho_xac_nhan", cancelBy, cancelReason: str(r.cancel_reason),
    address: toAddress(r.address), buyerNote: str(r.buyer_note), sellerNote: str(r.seller_note),
    carrier: str(r.carrier), trackingCode: str(r.tracking_code), timeline: toTimeline(r.timeline),
    clientRef: str(r.client_ref), createdAt: str(r.created_at) ?? "", updatedAt: str(r.updated_at) ?? "",
    deliveredAt: str(r.delivered_at), completedAt: str(r.completed_at),
  };
}
export function rowToReview(r: Row): Review {
  const rating = Math.min(5, Math.max(1, Math.round(num(r.rating, 1)))) as 1 | 2 | 3 | 4 | 5;
  return {
    id: String(r.id), orderId: String(r.order_id), productId: String(r.product_id), shopId: String(r.shop_id),
    buyerPhoneMasked: maskPhone(str(r.buyer_phone) ?? ""), rating, comment: str(r.comment), hidden: bool(r.hidden),
    createdAt: str(r.created_at) ?? "",
  };
}

const SHOP_JOIN = "shops!inner(name, slug, province, status, paused, phone, owner_phone)";
const ORDER_JOIN = "shops(name, slug, phone, owner_phone)";

function shopDraftToRow(d: Record<string, unknown>): Row {
  const out: Row = {};
  const map: Record<string, string> = {
    name: "name", description: "description", logoUrl: "logo_url", phone: "phone", province: "province",
    address: "address", bankName: "bank_name", bankAccount: "bank_account", bankHolder: "bank_holder",
    shippingFlatVnd: "shipping_flat_vnd", freeShipFromVnd: "free_ship_from_vnd", paused: "paused",
  };
  for (const [k, col] of Object.entries(map)) {
    if (k in d) {
      const v = d[k];
      out[col] = typeof v === "string" ? v.trim() || null : v ?? null;
    }
  }
  return out;
}
function productDraftToRow(d: Record<string, unknown>): Row {
  const out: Row = {};
  const map: Record<string, string> = {
    title: "title", description: "description", category: "category", priceVnd: "price_vnd", compareAtVnd: "compare_at_vnd",
    unit: "unit", stock: "stock", images: "images", variants: "variants", status: "status",
  };
  for (const [k, col] of Object.entries(map)) {
    if (k in d) {
      const v = d[k];
      out[col] = typeof v === "string" ? v.trim() || null : v ?? null;
    }
  }
  return out;
}

const pgErr = (e: unknown): { code?: string; message?: string } => (e && typeof e === "object" ? (e as { code?: string; message?: string }) : {});

export function createSupabaseStore(): MarketStore {
  /** Chưa cấu hình ⇒ 503 sạch ở từng lời gọi, KHÔNG ném lúc khởi tạo. */
  const client = (): SupabaseClient => {
    const admin = createAdminClient();
    if (!admin) throw new MarketError("unavailable");
    return admin;
  };
  const sig = () => timeoutSignal(TIMEOUT_MS);
  // abortSignal nằm trên FILTER/TRANSFORM builder, KHÔNG có trên builder sau
  // .single()/.maybeSingle() ⇒ luôn gắn TRƯỚC hai lệnh đó (khuôn product-catalog).
  const withSig = <T>(q: T): T => {
    const s = sig();
    const b = q as unknown as { abortSignal?: (sg: AbortSignal) => T };
    return s && typeof b.abortSignal === "function" ? b.abortSignal(s) : q;
  };
  const fail = (where: string, e: unknown): never => {
    const { code, message } = pgErr(e);
    console.error(`[market] ${where}:`, code, message);
    throw new MarketError("unavailable");
  };
  const clampPage = (q?: { page?: number; pageSize?: number }, def = 20) => {
    const page = Math.max(1, Math.floor(q?.page ?? 1) || 1);
    const pageSize = Math.min(50, Math.max(1, Math.floor(q?.pageSize ?? def) || def));
    return { page, pageSize, from: (page - 1) * pageSize, to: page * pageSize - 1 };
  };

  async function one<T>(table: string, cols: string, col: string, val: string, map: (r: Row) => T): Promise<T | null> {
    const { data, error } = await withSig(client().from(table).select(cols).eq(col, val)).maybeSingle();
    if (error) fail(`${table} đọc`, error);
    return data ? map(data as unknown as Row) : null;
  }

  /** Builder lọc đơn — kiểu nới lỏng (supabase-js generic quá sâu cho tsc). */
  type OrderQb = {
    eq: (col: string, val: string) => OrderQb;
    order: (col: string, o: { ascending: boolean }) => OrderQb;
    range: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: unknown; count: number | null }>;
  };
  async function listOrders(build: (q: OrderQb) => OrderQb, q?: OrderListQuery): Promise<Page<Order>> {
    const { page, pageSize, from, to } = clampPage(q);
    let qb = build(client().from("market_orders").select(`*, ${ORDER_JOIN}`, { count: "exact" }) as unknown as OrderQb);
    /*  status + code + buyerPhone áp Ở ĐÂY để ba đường (buyer / shop / admin)
        cùng một luật — trước đây code+SĐT chỉ có ở `listAllOrders`. */
    if (q?.status) qb = qb.eq("status", q.status);
    if (q?.code?.trim()) qb = qb.eq("code", q.code.trim().toUpperCase());
    if (q?.buyerPhone?.trim()) qb = qb.eq("buyer_phone", q.buyerPhone.trim());
    const { data, error, count } = await withSig(qb.order("created_at", { ascending: false }).range(from, to));
    if (error) fail("market_orders đọc", error);
    return { items: (data ?? []).map((r) => rowToOrder(r as Row)), total: count ?? 0, page, pageSize };
  }

  const store: MarketStore = {
    async listProducts(q) {
      const { page, pageSize, from, to } = clampPage(q);
      let qb = client().from("shop_products").select(`*, ${SHOP_JOIN}`, { count: "exact" }).is("deleted_at", null);
      if (!q.includeHidden) {
        qb = qb.eq("admin_hidden", false).in("status", ["dang_ban", "het_hang"]).eq("shops.status", "hoat_dong");
      }
      /*  LỌC TRẠNG THÁI cho màn quản trị (2026-09-07): file-store vốn đã áp
          trong filterProducts dùng chung, bản Supabase thì quên — nên mục Sản
          phẩm của /quan-tri không lọc được, danh sách trộn lẫn đang bán / ẩn /
          đã bị gỡ. Cùng luật: bi_go = đã gỡ (mọi status) · còn lại = đúng
          status VÀ chưa bị gỡ · all/bỏ trống = không lọc. */
      if (q.status && q.status !== "all") {
        if (q.status === "bi_go") qb = qb.eq("admin_hidden", true);
        else qb = qb.eq("admin_hidden", false).eq("status", q.status);
      }
      if (q.shopId) qb = qb.eq("shop_id", q.shopId);
      if (q.category) qb = qb.eq("category", q.category);
      if (q.province) qb = qb.eq("shops.province", q.province);
      if (q.q?.trim()) qb = qb.ilike("search_text", `%${foldVn(q.q).replace(/[%_]/g, " ")}%`);
      switch (q.sort) {
        case "ban_chay": qb = qb.order("sold_count", { ascending: false }); break;
        /* Món LIÊN HỆ BÁO GIÁ (price_vnd null) xuống CUỐI ở CẢ HAI chiều: bà con
           bấm "Giá cao → thấp" là muốn xem hàng đắt, không phải hàng chưa có giá
           (mặc định của Postgres cho DESC là nulls first ⇒ phải nói rõ). */
        case "gia_tang": qb = qb.order("price_vnd", { ascending: true, nullsFirst: false }); break;
        case "gia_giam": qb = qb.order("price_vnd", { ascending: false, nullsFirst: false }); break;
        default: break;
      }
      const { data, error, count } = await withSig(qb.order("created_at", { ascending: false }).range(from, to));
      if (error) fail("shop_products đọc", error);
      return { items: (data ?? []).map((r) => rowToCard(r as Row)), total: count ?? 0, page, pageSize };
    },
    async getProduct(id) {
      const { data, error } = await withSig(
        client().from("shop_products").select(`*, ${SHOP_JOIN}`).eq("id", id).is("deleted_at", null).maybeSingle(),
      );
      if (error) fail("shop_products đọc", error);
      return data ? rowToCard(data as Row) : null;
    },
    async getProductsByIds(ids) {
      if (ids.length === 0) return [];
      const { data, error } = await withSig(client().from("shop_products").select("*").in("id", ids).is("deleted_at", null));
      if (error) fail("shop_products đọc", error);
      return (data ?? []).map((r) => rowToProduct(r as Row));
    },

    getShop: (id) => one("shops", "*", "id", id, rowToShop),
    getShopBySlug: (slug) => one("shops", "*", "slug", slug, rowToShop),
    getShopByOwner: (owner) => one("shops", "*", "owner_phone", owner, rowToShop),
    async createShop(ownerPhone, draft, slug) {
      const row: Row = { ...shopDraftToRow(draft as unknown as Record<string, unknown>), owner_phone: ownerPhone, slug, status: "cho_duyet" };
      if (!row.phone) row.phone = ownerPhone;
      const { data, error } = await withSig(client().from("shops").insert(row).select("*")).single();
      if (error) {
        const { code, message } = pgErr(error);
        if (code === "23505" && /slug/.test(message ?? "")) throw new MarketError("slug_taken", "Tên shop này đã có người dùng — chọn tên khác.");
        if (code === "23505") throw new MarketError("invalid", "Số này đã có shop rồi. Vào Kênh người bán để xem.");
        fail("shops ghi", error);
      }
      return rowToShop(data as Row);
    },
    async updateShop(id, patch, slug) {
      const row = shopDraftToRow(patch as unknown as Record<string, unknown>);
      if (slug) row.slug = slug;
      const { data, error } = await withSig(client().from("shops").update(row).eq("id", id).select("*")).maybeSingle();
      if (error) {
        if (pgErr(error).code === "23505") throw new MarketError("slug_taken", "Tên shop này đã có người dùng — chọn tên khác.");
        fail("shops sửa", error);
      }
      if (!data) throw new MarketError("not_found");
      return rowToShop(data as Row);
    },
    async listShops(q) {
      const { page, pageSize, from, to } = clampPage(q);
      let qb = client().from("shops").select("*", { count: "exact" });
      if (q.status) qb = qb.eq("status", q.status);
      const { data, error, count } = await withSig(qb.order("created_at", { ascending: false }).range(from, to));
      if (error) fail("shops đọc", error);
      return { items: (data ?? []).map((r) => rowToShop(r as Row)), total: count ?? 0, page, pageSize };
    },
    async setShopStatus(id, status, note) {
      const cur = await store.getShop(id);
      if (!cur) throw new MarketError("not_found");
      const row: Row = { status, status_note: note?.trim() || null };
      if (status === "hoat_dong" && !cur.approvedAt) row.approved_at = new Date().toISOString();
      const { data, error } = await withSig(client().from("shops").update(row).eq("id", id).select("*")).single();
      if (error) fail("shops trạng thái", error);
      return rowToShop(data as Row);
    },
    async setShopOwner(id, ownerPhone) {
      const { data, error } = await withSig(client().from("shops").update({ owner_phone: ownerPhone }).eq("id", id).select("*")).maybeSingle();
      if (error) {
        if (pgErr(error).code === "23505") throw new MarketError("invalid", "Số này đã có shop rồi. Vào Kênh người bán để xem.");
        fail("shops gán chủ", error);
      }
      if (!data) throw new MarketError("not_found");
      return rowToShop(data as Row);
    },

    async listShopProducts(shopId, q) {
      const { page, pageSize, from, to } = clampPage(q);
      let qb = client().from("shop_products").select("*", { count: "exact" }).eq("shop_id", shopId).is("deleted_at", null);
      if (q.includeHidden === false) qb = qb.eq("admin_hidden", false).in("status", ["dang_ban", "het_hang"]);
      if (q.status && q.status !== "all") {
        qb = q.status === "bi_go" ? qb.eq("admin_hidden", true) : qb.eq("admin_hidden", false).eq("status", q.status);
      }
      if (q.category) qb = qb.eq("category", q.category);
      if (q.q?.trim()) qb = qb.ilike("search_text", `%${foldVn(q.q).replace(/[%_]/g, " ")}%`);
      const { data, error, count } = await withSig(qb.order("created_at", { ascending: false }).range(from, to));
      if (error) fail("shop_products đọc", error);
      return { items: (data ?? []).map((r) => rowToProduct(r as Row)), total: count ?? 0, page, pageSize };
    },
    async createProduct(shopId, draft, searchText) {
      const row = { ...productDraftToRow(draft as unknown as Record<string, unknown>), shop_id: shopId, search_text: searchText, status: normalizeProductStatus(draft.status, draft.stock, draft.priceVnd) };
      const { data, error } = await withSig(client().from("shop_products").insert(row).select("*")).single();
      if (error) fail("shop_products ghi", error);
      return rowToProduct(data as Row);
    },
    async updateProduct(shopId, id, patch, searchText) {
      const cur = await one("shop_products", "*", "id", id, rowToProduct);
      if (!cur || cur.shopId !== shopId || cur.deletedAt) throw new MarketError("not_found");
      const { adminHidden: _ah, ...rest } = patch as Partial<Product> & { adminHidden?: unknown };
      void _ah;
      const row = productDraftToRow(rest as Record<string, unknown>);
      const stock = patch.stock ?? cur.stock;
      // `priceVnd` có mặt trong vá thì theo vá (kể cả null = chuyển sang liên hệ báo giá)
      const priceVnd = "priceVnd" in patch ? patch.priceVnd ?? null : cur.priceVnd;
      row.status = normalizeProductStatus(patch.status ?? cur.status, stock, priceVnd);
      if (searchText != null) row.search_text = searchText;
      const { data, error } = await withSig(client().from("shop_products").update(row).eq("id", id).eq("shop_id", shopId).select("*")).single();
      if (error) fail("shop_products sửa", error);
      return rowToProduct(data as Row);
    },
    async deleteProduct(shopId, id) {
      const { data, error } = await withSig(
        client().from("shop_products").update({ deleted_at: new Date().toISOString() })
          .eq("id", id).eq("shop_id", shopId).is("deleted_at", null).select("id").maybeSingle(),
      );
      if (error) fail("shop_products xoá", error);
      if (!data) throw new MarketError("not_found");
    },
    async setProductAdminHidden(id, hidden, reason) {
      const { data, error } = await withSig(
        client().from("shop_products").update({ admin_hidden: hidden, admin_hidden_reason: hidden ? reason?.trim() || null : null })
          .eq("id", id).is("deleted_at", null).select("*").maybeSingle(),
      );
      if (error) fail("shop_products gỡ", error);
      if (!data) throw new MarketError("not_found");
      return rowToProduct(data as Row);
    },

    async placeOrders(buyerPhone, prepared, common) {
      const results: PlaceOrderResult[] = [];
      // Tuần tự theo shop — lỗi shop trước không che shop sau, log dễ đọc.
      for (const pre of prepared) results.push(await placeOne(buyerPhone, pre, common));
      return results;
    },
    listBuyerOrders: (buyerPhone, q) => listOrders((qb) => qb.eq("buyer_phone", buyerPhone), q),
    listShopOrders: (shopId, q) => listOrders((qb) => qb.eq("shop_id", shopId), q),
    // code + buyerPhone nay do `listOrders` lo; ở đây chỉ còn phạm vi shop
    listAllOrders: (q) => listOrders((qb) => (q?.shopId ? qb.eq("shop_id", q.shopId) : qb), q),
    async listOverdueDelivered(beforeIso, shopId) {
      let qb = client().from("market_orders").select(`*, ${ORDER_JOIN}`).eq("status", "da_giao").lte("delivered_at", beforeIso);
      if (shopId) qb = qb.eq("shop_id", shopId);
      const { data, error } = await withSig(qb.order("delivered_at", { ascending: true }).limit(200));
      if (error) fail("market_orders quét", error);
      return (data ?? []).map((r) => rowToOrder(r as Row));
    },
    async getOrder(id) {
      const { data, error } = await withSig(client().from("market_orders").select(`*, ${ORDER_JOIN}`).eq("id", id)).maybeSingle();
      if (error) fail("market_orders đọc", error);
      return data ? rowToOrder(data as Row) : null;
    },
    async getOrderByClientRef(buyerPhone, clientRef) {
      const { data, error } = await withSig(
        client().from("market_orders").select(`*, ${ORDER_JOIN}`).eq("buyer_phone", buyerPhone).eq("client_ref", clientRef).maybeSingle(),
      );
      if (error) fail("market_orders đọc", error);
      return data ? rowToOrder(data as Row) : null;
    },
    async transitionOrder(id, expectStatus, patch) {
      // nợ: timeline đọc-rồi-ghi 2 câu (đủ khi < 100 đơn/ngày), > 100 đơn/ngày ⇒ `timeline = timeline || $1::jsonb` một câu (12 §12)
      const { data: cur, error: e1 } = await withSig(client().from("market_orders").select("timeline,status").eq("id", id)).maybeSingle();
      if (e1) fail("market_orders đọc", e1);
      if (!cur) throw new MarketError("not_found");
      if ((cur as Row).status !== expectStatus) throw new MarketError("bad_transition");
      const row: Row = {};
      if (patch.status != null) row.status = patch.status;
      if (patch.paymentStatus != null) row.payment_status = patch.paymentStatus;
      if (patch.cancelBy != null) row.cancel_by = patch.cancelBy;
      if (patch.cancelReason != null) row.cancel_reason = patch.cancelReason;
      if (patch.needsRefund != null) row.needs_refund = patch.needsRefund;
      if (patch.sellerNote != null) row.seller_note = patch.sellerNote;
      if (patch.carrier != null) row.carrier = patch.carrier;
      if (patch.trackingCode != null) row.tracking_code = patch.trackingCode;
      if (patch.deliveredAt != null) row.delivered_at = patch.deliveredAt;
      if (patch.completedAt != null) row.completed_at = patch.completedAt;
      if (patch.timelineAppend) row.timeline = [...toTimeline((cur as Row).timeline), patch.timelineAppend];
      const { data, error } = await withSig(
        client().from("market_orders").update(row).eq("id", id).eq("status", expectStatus).select(`*, ${ORDER_JOIN}`).maybeSingle(),
      );
      if (error) fail("market_orders vá", error);
      if (!data) throw new MarketError("bad_transition");
      if (patch.status === "da_huy") {
        const { error: e2 } = await withSig(client().rpc("market_restock_order", { p_order_id: id }));
        if (e2) console.error("[market] hoàn kho hỏng:", pgErr(e2).code, pgErr(e2).message);
      }
      return rowToOrder(data as Row);
    },

    async addReview(input) {
      const { data, error } = await withSig(
        client().rpc("market_add_review", {
          p_order_id: input.orderId, p_product_id: input.productId, p_buyer_phone: input.buyerPhone,
          p_rating: input.rating, p_comment: input.comment?.trim() || null,
        }),
      );
      if (error) {
        const { code, message } = pgErr(error);
        if (code === "P0001" && message?.includes("review_not_allowed")) throw new MarketError("review_not_allowed", "Chỉ đánh giá được khi đã nhận hàng.");
        if (code === "23505") throw new MarketError("already_reviewed", "Món này bà con đã đánh giá rồi.");
        fail("market_add_review", error);
      }
      return rowToReview((Array.isArray(data) ? data[0] : data) as Row);
    },
    async listReviews(q) {
      const { page, pageSize, from, to } = clampPage(q);
      let qb = client().from("product_reviews").select("*", { count: "exact" });
      if (q?.productId) qb = qb.eq("product_id", q.productId);
      if (q?.maxRating != null) qb = qb.lte("rating", q.maxRating);
      if (!q?.includeHidden) qb = qb.eq("hidden", false);
      const { data, error, count } = await withSig(qb.order("created_at", { ascending: false }).range(from, to));
      if (error) fail("product_reviews đọc", error);
      return { items: (data ?? []).map((r) => rowToReview(r as Row)), total: count ?? 0, page, pageSize };
    },
    async setReviewHidden(id, hidden) {
      const { data, error } = await withSig(client().rpc("market_set_review_hidden", { p_review_id: id, p_hidden: hidden }));
      if (error) {
        if (pgErr(error).code === "P0001") throw new MarketError("not_found");
        fail("market_set_review_hidden", error);
      }
      return rowToReview((Array.isArray(data) ? data[0] : data) as Row);
    },
    async reviewedProductIds(orderId) {
      const { data, error } = await withSig(client().from("product_reviews").select("product_id").eq("order_id", orderId));
      if (error) fail("product_reviews đọc", error);
      return (data ?? []).map((r) => String((r as Row).product_id));
    },

    async stats(shopId, range) {
      const now = Date.now();
      const since = range === "7d" ? now - 7 * DAY : range === "30d" ? now - 30 * DAY : Date.parse(`${todayIsoVN(now)}T00:00:00+07:00`);
      const sinceIso = new Date(since).toISOString();
      const { data: rows, error } = await withSig(
        client().from("market_orders").select("status,payment_status,total_vnd,items,created_at,completed_at").eq("shop_id", shopId),
      );
      if (error) fail("market_orders thống kê", error);
      const all = (rows ?? []) as Row[];
      const byStatus: Record<OrderStatus, number> = { cho_xac_nhan: 0, da_xac_nhan: 0, dang_giao: 0, da_giao: 0, hoan_thanh: 0, da_huy: 0 };
      for (const o of all) if (isOrderStatus(o.status)) byStatus[o.status] += 1;
      const completed = all.filter((o) => o.status === "hoan_thanh" && typeof o.completed_at === "string" && o.completed_at >= sinceIso);
      const qtyBy = new Map<string, { title: string; qty: number }>();
      for (const o of completed) for (const l of toLines(o.items)) {
        const cur = qtyBy.get(l.productId) ?? { title: l.title, qty: 0 };
        cur.qty += l.qty;
        qtyBy.set(l.productId, cur);
      }
      const { data: low, error: e2 } = await withSig(
        client().from("shop_products").select("id,title,stock").eq("shop_id", shopId).is("deleted_at", null).lte("stock", 3).order("stock", { ascending: true }).limit(10),
      );
      if (e2) fail("shop_products kho thấp", e2);
      return {
        range,
        orders: all.filter((o) => typeof o.created_at === "string" && o.created_at >= sinceIso).length,
        completed: completed.length,
        revenueVnd: completed.reduce((t, o) => t + num(o.total_vnd), 0),
        pendingOrders: byStatus.cho_xac_nhan,
        shippingOrders: byStatus.dang_giao,
        awaitingPaymentConfirm: all.filter((o) => o.payment_status === "bao_da_chuyen" && o.status !== "da_huy" && o.status !== "hoan_thanh").length,
        topProducts: [...qtyBy.entries()].map(([productId, v]) => ({ productId, ...v })).sort((a, b) => b.qty - a.qty).slice(0, 5),
        lowStock: ((low ?? []) as Row[]).map((p) => ({ productId: String(p.id), title: str(p.title) ?? "", stock: num(p.stock) })),
        byStatus,
      };
    },
    async overview() {
      const now = Date.now();
      const periods = { today: Date.parse(`${todayIsoVN(now)}T00:00:00+07:00`), d7: now - 7 * DAY, d30: now - 30 * DAY };
      const d30Iso = new Date(periods.d30).toISOString();
      const [shopsRes, prodRes, ordRes] = await Promise.all([
        withSig(client().from("shops").select("status")),
        withSig(client().from("shop_products").select("id, shops!inner(status)", { count: "exact", head: true })
          .is("deleted_at", null).eq("admin_hidden", false).eq("status", "dang_ban").eq("shops.status", "hoat_dong")),
        withSig(client().from("market_orders").select("status,total_vnd,created_at,completed_at").or(`created_at.gte.${d30Iso},completed_at.gte.${d30Iso}`)),
      ]);
      if (shopsRes.error) fail("shops đếm", shopsRes.error);
      if (prodRes.error) fail("shop_products đếm", prodRes.error);
      if (ordRes.error) fail("market_orders đếm", ordRes.error);
      const shops: Record<ShopStatus, number> = { cho_duyet: 0, hoat_dong: 0, tam_khoa: 0, tu_choi: 0 };
      for (const s of (shopsRes.data ?? []) as Row[]) if (SHOP_STATUSES.includes(s.status as ShopStatus)) shops[s.status as ShopStatus] += 1;
      const empty = (): Record<OrderStatus, number> => ({ cho_xac_nhan: 0, da_xac_nhan: 0, dang_giao: 0, da_giao: 0, hoan_thanh: 0, da_huy: 0 });
      const orders = { today: empty(), d7: empty(), d30: empty() };
      const gmvVnd = { today: 0, d7: 0, d30: 0 };
      for (const o of (ordRes.data ?? []) as Row[]) {
        const c = Date.parse(str(o.created_at) ?? "");
        const done = o.status === "hoan_thanh" ? Date.parse(str(o.completed_at) ?? "") : NaN;
        for (const k of ["today", "d7", "d30"] as const) {
          if (Number.isFinite(c) && c >= periods[k] && isOrderStatus(o.status)) orders[k][o.status] += 1;
          if (Number.isFinite(done) && done >= periods[k]) gmvVnd[k] += num(o.total_vnd);
        }
      }
      const huy = orders.d30.da_huy;
      const xong = orders.d30.hoan_thanh;
      const out: AdminOverview = { shops, productsOnSale: prodRes.count ?? 0, orders, gmvVnd, cancelRate30d: huy + xong === 0 ? 0 : huy / (huy + xong) };
      return out;
    },
    async saveUpload(shopId, bytes, mime) {
      if (bytes.length > 500 * 1024) throw new MarketError("bad_size", "Ảnh quá lớn (tối đa 500 KB).");
      const ext = mime === "image/jpeg" ? "jpg" : mime === "image/png" ? "png" : "webp";
      const admin = client();
      const path = `${shopId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await admin.storage.from("market-media").upload(path, bytes, { contentType: mime, upsert: false });
      if (error) {
        console.error("[market] upload ảnh hỏng:", error.message);
        throw new MarketError("insert_failed");
      }
      return { url: admin.storage.from("market-media").getPublicUrl(path).data.publicUrl };
    },

    async devLogin() { throw new MarketError("forbidden"); },
    async devIdentity() { throw new MarketError("forbidden"); },
    async devPersonas() { throw new MarketError("forbidden"); },
    async devNotifications() { throw new MarketError("forbidden"); },
  };

  async function placeOne(
    buyerPhone: string,
    pre: PreparedShopOrder,
    common: { address: Address; paymentMethod: PaymentMethod; buyerNote?: string },
  ): Promise<PlaceOrderResult> {
    for (let attempt = 0; attempt < 3; attempt++) {
      const code = makeOrderCode(new Date(), Math.random);
      const { data, error } = await withSig(
        client().rpc("market_place_order", {
          p_buyer_phone: buyerPhone, p_shop_id: pre.shopId, p_code: code, p_client_ref: pre.clientRef,
          p_items: pre.lines, p_subtotal_vnd: pre.subtotalVnd, p_shipping_vnd: pre.shippingVnd, p_total_vnd: pre.totalVnd,
          p_payment_method: common.paymentMethod,
          p_bank_snapshot: common.paymentMethod === "chuyen_khoan" ? pre.bankSnapshot ?? null : null,
          p_address: common.address, p_buyer_note: (pre.buyerNote ?? common.buyerNote)?.trim() || null,
        }),
      );
      if (!error) {
        const raw = (Array.isArray(data) ? data[0] : data) as Row;
        const order = raw ? await store.getOrder(String(raw.id)) : null;
        if (!order) return { shopId: pre.shopId, ok: false, code: "insert_failed", productIds: [] };
        return { shopId: pre.shopId, ok: true, order, duplicate: order.code !== code };
      }
      const { code: pg, message } = pgErr(error);
      if (pg === "P0001") {
        if (message?.startsWith("shop_paused")) return { shopId: pre.shopId, ok: false, code: "shop_paused", productIds: [] };
        if (message?.startsWith("shop_not_active")) return { shopId: pre.shopId, ok: false, code: "shop_not_active", productIds: [] };
        const m = /line_unavailable:([0-9a-f-]+)/i.exec(message ?? "");
        if (m) {
          const pid = m[1];
          const available: Record<string, number> = {};
          const { data: p } = await withSig(client().from("shop_products").select("stock,status,deleted_at,admin_hidden").eq("id", pid)).maybeSingle();
          const row = p as Row | null;
          if (row && !row.deleted_at && !row.admin_hidden && row.status === "dang_ban") available[pid] = num(row.stock);
          else if (row) available[pid] = 0;
          return { shopId: pre.shopId, ok: false, code: "line_unavailable", productIds: [pid], available };
        }
      }
      if (pg === "23505" && /client_ref/.test(message ?? "")) {
        const dup = await store.getOrderByClientRef(buyerPhone, pre.clientRef);
        if (dup) return { shopId: pre.shopId, ok: true, order: dup, duplicate: true };
      }
      if (pg === "23505" && /code/.test(message ?? "")) continue; // mã đơn trùng — sinh mã mới
      console.error("[market] market_place_order:", pg, message);
      return { shopId: pre.shopId, ok: false, code: "insert_failed", productIds: [] };
    }
    return { shopId: pre.shopId, ok: false, code: "insert_failed", productIds: [] };
  }

  return store;
}
