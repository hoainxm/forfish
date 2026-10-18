// KHO FILE cho DEV — `.local/market-dev.json` + `.local/market-uploads/` (12 §5).
// CHỈ tồn tại để chạy máy dev không có service key. Khởi tạo gọi assertDevFileMode:
// sai điều kiện là ném ngay. Không chứa luật nghiệp vụ ngoài những ràng buộc
// nguyên tử mà RPC làm ở prod (trừ kho, trùng client_ref, hoàn kho idempotent).
//
// Ghi an toàn: một hàng đợi promise (withLock) + ghi tmp rồi rename. Đọc JSON
// hỏng ⇒ KHÔNG đè: ném `unavailable` kèm đường dẫn để dev tự sửa/xoá (K4).
import { promises as fs } from "node:fs";
import path from "node:path";
import { todayIsoVN } from "@/lib/days";
import { newDeviceToken } from "@/lib/device-token";
import { normalizeVnPhone } from "@/lib/phone";
import { buildDevSeed, type DevSeed, type SeedOrder, type SeedProduct, type SeedReview } from "./dev-seed";
import { assertDevFileMode } from "./dev-mode";
import { MarketError } from "./errors";
import { makeOrderCode, makeRequestCode } from "./order-code";
import { patchRequest as applyRequestPatch } from "./request-state";
import { recountRating } from "./rating";
import type { MarketStore, OrderListQuery, PreparedShopOrder } from "./store";
import type { MarketRequest } from "./types";
import { foldVn, maskPhone } from "./text";
import { normalizeProductStatus } from "./validate";
import type {
  Address, AdminOverview, Order, OrderStatus, Page, PaymentMethod, PlaceOrderResult,
  Product, ProductCard, ProductDraftM, ProductQuery, Review, Shop, ShopDraft, ShopPatch, ShopStats,
  ShopStatus, StatsRange,
} from "./types";

export const DEV_FILE_NAME = "market-dev.json";
export const DEV_UPLOAD_DIRNAME = "market-uploads";

/** Tệp kho dev: `MARKET_STORE_FILE` (đường dẫn tuyệt đối, hoặc tương đối cwd);
 *  không đặt ⇒ `.local/market-dev.json` của repo (12 §5.1). */
export function devStoreFile(env: Record<string, string | undefined> = process.env as Record<string, string | undefined>): string {
  const raw = env.MARKET_STORE_FILE?.trim();
  return raw ? path.resolve(process.cwd(), raw) : path.join(process.cwd(), ".local", DEV_FILE_NAME);
}
/** Thư mục chứa tệp kho — ảnh tải lên nằm cạnh nó, route uploads đọc cùng chỗ. */
export function devLocalDir(): string {
  return path.dirname(devStoreFile());
}
export function devUploadDir(base: string = devLocalDir()): string {
  return path.join(base, DEV_UPLOAD_DIRNAME);
}

export interface FileMarketStore extends MarketStore {
  /** thay push ở dev — notify.ts gọi; /dev hiện ra */
  devPushNotification(phone: string, msg: { title: string; body: string; url?: string; pushOs?: boolean }): Promise<void>;
  /** đọc thẳng cho test/route dev */
  readState(): Promise<DevSeed>;
}

const EXT: Record<"image/jpeg" | "image/png" | "image/webp", string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
};
const UPLOAD_MAX = 500 * 1024;
const DAY = 24 * 3600 * 1000;

const clampPage = (q?: { page?: number; pageSize?: number }, def = 20) => {
  const page = Math.max(1, Math.floor(q?.page ?? 1) || 1);
  const pageSize = Math.min(50, Math.max(1, Math.floor(q?.pageSize ?? def) || def));
  return { page, pageSize };
};
function paginate<T>(items: T[], q?: { page?: number; pageSize?: number }, def = 20): Page<T> {
  const { page, pageSize } = clampPage(q, def);
  const start = (page - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), total: items.length, page, pageSize };
}
const byCreatedDesc = <T extends { createdAt: string }>(a: T, b: T) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0);
/** So giá cho sắp xếp: món chưa niêm yết giá (null) LUÔN xuống cuối, bất kể chiều. */
const cmpPrice = (a: number | null, b: number | null, asc: boolean): number => {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return asc ? a - b : b - a;
};

export function createFileStore(opts: { dir?: string; now?: () => Date } = {}): FileMarketStore {
  assertDevFileMode();
  const file = opts.dir ? path.join(opts.dir, DEV_FILE_NAME) : devStoreFile();
  const dir = path.dirname(file);
  const uploads = devUploadDir(dir);
  const now = opts.now ?? (() => new Date());
  const nowIso = () => now().toISOString();

  let state: DevSeed | null = null;
  let chain: Promise<unknown> = Promise.resolve();
  /** Hàng đợi ghi tuần tự — LEAD §4 #1. `fn` chạy sau mọi việc đã xếp trước nó. */
  const withLock = <T>(fn: () => Promise<T>): Promise<T> => {
    const run = chain.then(fn, fn);
    chain = run.catch(() => undefined);
    return run;
  };

  async function persist(): Promise<void> {
    if (!state) return;
    await fs.mkdir(dir, { recursive: true });
    const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(state, null, 2), "utf8");
    await fs.rename(tmp, file);
  }

  async function load(): Promise<DevSeed> {
    if (state) return state;
    let raw: string | null = null;
    try {
      raw = await fs.readFile(file, "utf8");
    } catch (e) {
      if ((e as NodeJS.ErrnoException)?.code !== "ENOENT") {
        console.error("[market] không đọc được kho file:", file, (e as Error).message);
        throw new MarketError("unavailable");
      }
    }
    if (raw == null) {
      state = buildDevSeed(now());
      await persist();
      return state;
    }
    try {
      const parsed = JSON.parse(raw) as DevSeed;
      if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.shops)) throw new Error("sai hình dạng");
      parsed.sessions ??= {};
      parsed.notifications ??= [];
      parsed.reviews ??= [];
      parsed.orders ??= [];
      parsed.products ??= [];
      parsed.personas ??= [];
      parsed.requests ??= [];
      state = parsed;
      return state;
    } catch (e) {
      // Đọc hỏng KHÔNG mở cửa ghi — xoá/sửa tay rồi chạy lại.
      console.error("[market] kho file hỏng JSON, KHÔNG đè:", file, (e as Error).message);
      throw new MarketError("unavailable");
    }
  }
  /** Đọc-rồi-ghi trong lock: nạp state, chạy `fn`, ghi đĩa. */
  const mutate = <T>(fn: (s: DevSeed) => T | Promise<T>): Promise<T> =>
    withLock(async () => {
      const s = await load();
      const out = await fn(s);
      await persist();
      return out;
    });

  // ── map ra kiểu domain ────────────────────────────────────────────────
  const toProduct = (p: SeedProduct): Product => {
    const { searchText: _s, ...rest } = p;
    void _s;
    return { ...rest, images: [...rest.images], variants: rest.variants.map((v) => ({ ...v })) };
  };
  const toCard = (s: DevSeed, p: SeedProduct): ProductCard => {
    const shop = s.shops.find((x) => x.id === p.shopId);
    return {
      ...toProduct(p),
      shopName: shop?.name ?? "",
      shopSlug: shop?.slug ?? "",
      shopProvince: shop?.province,
      shopPaused: shop?.paused ?? false,
    };
  };
  const toOrder = (s: DevSeed, o: SeedOrder): Order => {
    const { restockedAt: _r, ...rest } = o;
    void _r;
    const shop = s.shops.find((x) => x.id === o.shopId);
    return {
      ...rest,
      items: rest.items.map((l) => ({ ...l })),
      timeline: rest.timeline.map((t) => ({ ...t })),
      address: { ...rest.address },
      shopName: shop?.name,
      shopPhone: shop?.phone ?? shop?.ownerPhone,
      shopSlug: shop?.slug,
    };
  };
  const toRequest = (s: DevSeed, r: MarketRequest): MarketRequest => ({
    ...r,
    images: [...r.images],
    address: { ...r.address },
    timeline: r.timeline.map((t) => ({ ...t })),
    ...(r.quote ? { quote: { ...r.quote } } : {}),
    quoteShopName: r.quoteShopId ? s.shops.find((x) => x.id === r.quoteShopId)?.name : undefined,
  });
  const toReview = (r: SeedReview): Review => {
    const { buyerPhone, ...rest } = r;
    return { ...rest, buyerPhoneMasked: maskPhone(buyerPhone) };
  };
  const toShop = (s: Shop): Shop => ({ ...s });

  const recount = (s: DevSeed, productId: string, shopId: string) => {
    const r = recountRating(s.reviews, productId, shopId);
    const p = s.products.find((x) => x.id === productId);
    if (p) { p.ratingAvg = r.product.avg; p.ratingCount = r.product.count; }
    const sh = s.shops.find((x) => x.id === shopId);
    if (sh) { sh.ratingAvg = r.shop.avg; sh.ratingCount = r.shop.count; }
  };

  function filterProducts(s: DevSeed, q: ProductQuery): SeedProduct[] {
    const shopsById = new Map(s.shops.map((x) => [x.id, x]));
    const needle = q.q ? foldVn(q.q) : "";
    const prov = q.province ? foldVn(q.province) : "";
    let list = s.products.filter((p) => {
      if (p.deletedAt) return false;
      const shop = shopsById.get(p.shopId);
      if (!shop) return false;
      if (!q.includeHidden) {
        if (p.adminHidden) return false;
        if (p.status !== "dang_ban" && p.status !== "het_hang") return false;
        if (shop.status !== "hoat_dong") return false;
      }
      if (q.status && q.status !== "all") {
        if (q.status === "bi_go") { if (!p.adminHidden) return false; }
        else if (p.adminHidden || p.status !== q.status) return false;
      }
      if (q.shopId && p.shopId !== q.shopId) return false;
      if (q.category && p.category !== q.category) return false;
      if (prov && foldVn(shop.province ?? "") !== prov) return false;
      if (needle && !p.searchText.includes(needle)) return false;
      return true;
    });
    switch (q.sort) {
      case "ban_chay": list = list.sort((a, b) => b.soldCount - a.soldCount || byCreatedDesc(a, b)); break;
      /* Món LIÊN HỆ BÁO GIÁ (priceVnd null) xuống CUỐI ở CẢ HAI chiều — cùng luật
         với adapter Supabase (nullsFirst: false). Không để null rơi vào phép trừ:
         `null - 5` ra -5, món chưa có giá thành món rẻ nhất. */
      case "gia_tang": list = list.sort((a, b) => cmpPrice(a.priceVnd, b.priceVnd, true) || byCreatedDesc(a, b)); break;
      case "gia_giam": list = list.sort((a, b) => cmpPrice(a.priceVnd, b.priceVnd, false) || byCreatedDesc(a, b)); break;
      default: list = list.sort(byCreatedDesc);
    }
    return list;
  }

  function filterOrders(s: DevSeed, pred: (o: SeedOrder) => boolean, q?: OrderListQuery): Page<Order> {
    /*  status + code + buyerPhone áp Ở ĐÂY để ba đường (buyer / shop / admin)
        cùng một luật — trước đây code+SĐT chỉ có ở `listAllOrders`, nên chủ shop
        không tra nổi đơn của chính mình. */
    const code = q?.code?.trim().toUpperCase();
    const buyer = q?.buyerPhone?.trim();
    const list = s.orders
      .filter(
        (o) =>
          pred(o) &&
          (!q?.status || o.status === q.status) &&
          (!code || o.code === code) &&
          (!buyer || o.buyerPhone === buyer),
      )
      .sort(byCreatedDesc);
    const page = paginate(list, q);
    return { ...page, items: page.items.map((o) => toOrder(s, o)) };
  }

  function restock(s: DevSeed, o: SeedOrder): void {
    if (o.status !== "da_huy" || o.restockedAt) return;
    // nợ: hoàn kho KHÔNG kiểm trần (seller tăng tồn tay rồi đơn huỷ ⇒ cộng thêm), seller phàn nàn ⇒ ghi "kho lúc đặt" vào đơn để hoàn có trần (12 §12)
    for (const it of o.items) {
      const p = s.products.find((x) => x.id === it.productId);
      if (!p) continue;
      p.stock += it.qty;
      p.soldCount = Math.max(0, p.soldCount - it.qty);
      p.status = normalizeProductStatus(p.status, p.stock, p.priceVnd);
      p.updatedAt = nowIso();
    }
    o.restockedAt = nowIso();
  }

  const sinceOf = (range: StatsRange): number => {
    const t = now().getTime();
    if (range === "7d") return t - 7 * DAY;
    if (range === "30d") return t - 30 * DAY;
    return Date.parse(`${todayIsoVN(t)}T00:00:00+07:00`);
  };
  const emptyByStatus = (): Record<OrderStatus, number> => ({
    cho_xac_nhan: 0, da_xac_nhan: 0, dang_giao: 0, da_giao: 0, hoan_thanh: 0, da_huy: 0,
  });

  const store: FileMarketStore = {
    async readState() { return withLock(() => load()); },

    // ── Sản phẩm (người mua) ──
    async listProducts(q) {
      const s = await load();
      // `status` là bộ lọc của người bán — chợ không đọc (12 §3.1), chặn ngay ở đây.
      const list = filterProducts(s, { ...q, status: "all" });
      const page = paginate(list, q);
      return { ...page, items: page.items.map((p) => toCard(s, p)) };
    },
    async getProduct(id) {
      const s = await load();
      const p = s.products.find((x) => x.id === id);
      return p && !p.deletedAt ? toCard(s, p) : null;
    },
    async getProductsByIds(ids) {
      const s = await load();
      const set = new Set(ids);
      return s.products.filter((p) => set.has(p.id) && !p.deletedAt).map(toProduct);
    },

    // ── Shop ──
    async getShop(id) {
      const s = await load();
      const x = s.shops.find((y) => y.id === id);
      return x ? toShop(x) : null;
    },
    async getShopBySlug(slug) {
      const s = await load();
      const x = s.shops.find((y) => y.slug === slug);
      return x ? toShop(x) : null;
    },
    async getShopByOwner(ownerPhone) {
      const s = await load();
      const x = s.shops.find((y) => y.ownerPhone === ownerPhone);
      return x ? toShop(x) : null;
    },
    createShop(ownerPhone, draft, slug) {
      return mutate((s) => {
        if (s.shops.some((y) => y.ownerPhone === ownerPhone))
          throw new MarketError("invalid", "Số này đã có shop rồi. Vào Kênh người bán để xem.");
        if (s.shops.some((y) => y.slug === slug))
          throw new MarketError("slug_taken", "Tên shop này đã có người dùng — chọn tên khác.");
        const at = nowIso();
        const shop: Shop = {
          id: crypto.randomUUID(), ownerPhone, name: draft.name.trim(), slug,
          description: draft.description?.trim() || undefined,
          logoUrl: draft.logoUrl || undefined,
          phone: draft.phone?.trim() || ownerPhone,
          province: draft.province, address: draft.address?.trim() || undefined,
          bankName: draft.bankName?.trim() || undefined,
          bankAccount: draft.bankAccount?.trim() || undefined,
          bankHolder: draft.bankHolder?.trim() || undefined,
          shippingFlatVnd: draft.shippingFlatVnd, freeShipFromVnd: draft.freeShipFromVnd ?? undefined,
          status: "cho_duyet", paused: false, ratingAvg: 0, ratingCount: 0, createdAt: at, updatedAt: at,
        };
        s.shops.push(shop);
        return toShop(shop);
      });
    },
    updateShop(id, patch, slug) {
      return mutate((s) => {
        const shop = s.shops.find((y) => y.id === id);
        if (!shop) throw new MarketError("not_found");
        if (slug && slug !== shop.slug && s.shops.some((y) => y.slug === slug))
          throw new MarketError("slug_taken", "Tên shop này đã có người dùng — chọn tên khác.");
        applyShopPatch(shop, patch as ShopPatch & Partial<ShopDraft>);
        if (slug) shop.slug = slug;
        shop.updatedAt = nowIso();
        return toShop(shop);
      });
    },
    async listShops(q) {
      const s = await load();
      const list = s.shops.filter((y) => !q.status || y.status === q.status).sort(byCreatedDesc);
      const page = paginate(list, q);
      return { ...page, items: page.items.map(toShop) };
    },
    setShopStatus(id, status, note) {
      return mutate((s) => {
        const shop = s.shops.find((y) => y.id === id);
        if (!shop) throw new MarketError("not_found");
        shop.status = status;
        shop.statusNote = note?.trim() || undefined;
        if (status === "hoat_dong" && !shop.approvedAt) shop.approvedAt = nowIso();
        shop.updatedAt = nowIso();
        return toShop(shop);
      });
    },
    setShopOwner(id, ownerPhone) {
      return mutate((s) => {
        const shop = s.shops.find((y) => y.id === id);
        if (!shop) throw new MarketError("not_found");
        if (s.shops.some((y) => y.id !== id && y.ownerPhone === ownerPhone))
          throw new MarketError("invalid", "Số này đã có shop rồi. Vào Kênh người bán để xem.");
        shop.ownerPhone = ownerPhone;
        if (!shop.phone) shop.phone = ownerPhone;
        shop.updatedAt = nowIso();
        return toShop(shop);
      });
    },

    // ── Sản phẩm (người bán) ──
    async listShopProducts(shopId, q) {
      const s = await load();
      const list = filterProducts(s, { ...q, shopId, includeHidden: q.includeHidden ?? true });
      const page = paginate(list, q);
      return { ...page, items: page.items.map(toProduct) };
    },
    createProduct(shopId, draft, searchText) {
      return mutate((s) => {
        if (!s.shops.some((y) => y.id === shopId)) throw new MarketError("not_found");
        const at = nowIso();
        const p: SeedProduct = {
          id: crypto.randomUUID(), shopId, title: draft.title.trim(),
          description: draft.description?.trim() || undefined, category: draft.category,
          priceVnd: draft.priceVnd, compareAtVnd: draft.compareAtVnd ?? undefined, unit: draft.unit.trim(),
          stock: draft.stock, images: [...draft.images], variants: draft.variants.map((v) => ({ ...v })),
          status: normalizeProductStatus(draft.status, draft.stock, draft.priceVnd), adminHidden: false,
          soldCount: 0, ratingAvg: 0, ratingCount: 0, createdAt: at, updatedAt: at, searchText,
        };
        s.products.push(p);
        return toProduct(p);
      });
    },
    updateProduct(shopId, id, patch, searchText) {
      return mutate((s) => {
        const p = s.products.find((x) => x.id === id && x.shopId === shopId && !x.deletedAt);
        if (!p) throw new MarketError("not_found");
        applyProductPatch(p, patch);
        p.status = normalizeProductStatus(p.status, p.stock, p.priceVnd);
        if (searchText != null) p.searchText = searchText;
        p.updatedAt = nowIso();
        return toProduct(p);
      });
    },
    deleteProduct(shopId, id) {
      return mutate((s) => {
        const p = s.products.find((x) => x.id === id && x.shopId === shopId && !x.deletedAt);
        if (!p) throw new MarketError("not_found");
        p.deletedAt = nowIso();
        p.updatedAt = p.deletedAt;
      });
    },
    setProductAdminHidden(id, hidden, reason) {
      return mutate((s) => {
        const p = s.products.find((x) => x.id === id && !x.deletedAt);
        if (!p) throw new MarketError("not_found");
        p.adminHidden = hidden;
        p.adminHiddenReason = hidden ? reason?.trim() || undefined : undefined;
        p.updatedAt = nowIso();
        return toProduct(p);
      });
    },

    // ── Đơn ──
    placeOrders(buyerPhone, prepared, common) {
      return mutate((s) => prepared.map((pre) => placeOne(s, buyerPhone, pre, common)));
    },
    async listBuyerOrders(buyerPhone, q) {
      const s = await load();
      return filterOrders(s, (o) => o.buyerPhone === buyerPhone, q);
    },
    async listShopOrders(shopId, q) {
      const s = await load();
      return filterOrders(s, (o) => o.shopId === shopId, q);
    },
    async listAllOrders(q) {
      const s = await load();
      // code + buyerPhone nay do `filterOrders` lo; ở đây chỉ còn phạm vi shop
      return filterOrders(s, (o) => !q?.shopId || o.shopId === q.shopId, q);
    },
    async listOverdueDelivered(beforeIso, shopId) {
      const s = await load();
      return s.orders
        .filter((o) => o.status === "da_giao" && !!o.deliveredAt && o.deliveredAt <= beforeIso && (!shopId || o.shopId === shopId))
        .sort((a, b) => (a.deliveredAt! < b.deliveredAt! ? -1 : 1))
        .slice(0, 200)
        .map((o) => toOrder(s, o));
    },
    async listOverduePending(beforeIso, shopId) {
      const s = await load();
      return s.orders
        .filter((o) => o.status === "cho_xac_nhan" && o.createdAt <= beforeIso && (!shopId || o.shopId === shopId))
        .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
        .slice(0, 200)
        .map((o) => toOrder(s, o));
    },
    async getOrder(id) {
      const s = await load();
      const o = s.orders.find((x) => x.id === id);
      return o ? toOrder(s, o) : null;
    },
    async getOrderByClientRef(buyerPhone, clientRef) {
      const s = await load();
      const o = s.orders.find((x) => x.buyerPhone === buyerPhone && x.clientRef === clientRef);
      return o ? toOrder(s, o) : null;
    },
    transitionOrder(id, expectStatus, patch) {
      return mutate((s) => {
        const o = s.orders.find((x) => x.id === id);
        if (!o) throw new MarketError("not_found");
        if (o.status !== expectStatus) throw new MarketError("bad_transition");
        if (patch.status != null) o.status = patch.status;
        if (patch.paymentStatus != null) o.paymentStatus = patch.paymentStatus;
        if (patch.cancelBy != null) o.cancelBy = patch.cancelBy;
        if (patch.cancelReason != null) o.cancelReason = patch.cancelReason;
        if (patch.needsRefund != null) o.needsRefund = patch.needsRefund;
        if (patch.sellerNote != null) o.sellerNote = patch.sellerNote;
        if (patch.carrier != null) o.carrier = patch.carrier;
        if (patch.trackingCode != null) o.trackingCode = patch.trackingCode;
        if (patch.deliveredAt != null) o.deliveredAt = patch.deliveredAt;
        if (patch.completedAt != null) o.completedAt = patch.completedAt;
        if (patch.etaFrom != null) o.etaFrom = patch.etaFrom;
        if (patch.etaTo != null) o.etaTo = patch.etaTo;
        if (patch.timelineAppend) o.timeline.push({ ...patch.timelineAppend });
        o.updatedAt = nowIso();
        if (patch.status === "da_huy") restock(s, o);
        return toOrder(s, o);
      });
    },

    // ── Yêu cầu đặt hàng (2026-10-18) ──
    createRequest(buyerPhone, d) {
      return mutate((s) => {
        const reqs = (s.requests ??= []);
        let code = makeRequestCode(now(), Math.random);
        for (let i = 0; i < 20 && reqs.some((r) => r.code === code); i++) code = makeRequestCode(now(), Math.random);
        const at = nowIso();
        const r: MarketRequest = {
          id: crypto.randomUUID(), code, buyerPhone, title: d.title.trim(), qty: d.qty, unit: d.unit.trim(),
          description: d.description?.trim() || undefined, images: [...(d.images ?? [])], needBy: d.needBy || undefined,
          address: { ...d.address }, paymentMethod: d.paymentMethod, status: "moi",
          timeline: [{ status: "moi", at, by: "buyer" }], createdAt: at, updatedAt: at,
        };
        reqs.push(r);
        return toRequest(s, r);
      });
    },
    async listBuyerRequests(buyerPhone, q) {
      const s = await load();
      const list = (s.requests ?? []).filter((r) => r.buyerPhone === buyerPhone && (!q?.status || r.status === q.status)).sort(byCreatedDesc);
      const page = paginate(list, q);
      return { ...page, items: page.items.map((r) => toRequest(s, r)) };
    },
    async listAllRequests(q) {
      const s = await load();
      const list = (s.requests ?? []).filter((r) => !q?.status || r.status === q.status).sort(byCreatedDesc);
      const page = paginate(list, q);
      return { ...page, items: page.items.map((r) => toRequest(s, r)) };
    },
    async getRequest(id) {
      const s = await load();
      const r = (s.requests ?? []).find((x) => x.id === id);
      return r ? toRequest(s, r) : null;
    },
    patchRequest(id, expectStatus, patch) {
      return mutate((s) => {
        const reqs = s.requests ?? [];
        const i = reqs.findIndex((x) => x.id === id);
        if (i < 0) throw new MarketError("not_found");
        if (reqs[i].status !== expectStatus) throw new MarketError("bad_transition");
        reqs[i] = applyRequestPatch(reqs[i], patch, nowIso());
        return toRequest(s, reqs[i]);
      });
    },
    acceptRequest(id, patch, pre) {
      return mutate((s) => {
        const reqs = s.requests ?? [];
        const i = reqs.findIndex((x) => x.id === id);
        if (i < 0) throw new MarketError("not_found");
        if (reqs[i].status !== "da_bao_gia") throw new MarketError("bad_transition");
        const shop = s.shops.find((x) => x.id === pre.shopId);
        if (!shop) throw new MarketError("insert_failed");
        let code = makeOrderCode(now(), Math.random);
        for (let k = 0; k < 20 && s.orders.some((o) => o.code === code); k++) code = makeOrderCode(now(), Math.random);
        const at = nowIso();
        const r = reqs[i];
        const order: SeedOrder = {
          id: crypto.randomUUID(), code, buyerPhone: r.buyerPhone, shopId: shop.id,
          items: pre.lines.map((l) => ({ ...l })), subtotalVnd: pre.subtotalVnd, shippingVnd: pre.shippingVnd, totalVnd: pre.totalVnd,
          paymentMethod: r.paymentMethod, paymentStatus: "chua_thanh_toan", bankSnapshot: pre.bankSnapshot,
          needsRefund: false, status: "da_xac_nhan", address: { ...r.address }, buyerNote: pre.buyerNote,
          timeline: pre.timeline.map((t) => ({ ...t })), clientRef: `yc:${r.id}`, createdAt: at, updatedAt: at,
          etaFrom: pre.etaFrom, etaTo: pre.etaTo, requestId: r.id,
        };
        s.orders.push(order);
        reqs[i] = applyRequestPatch(r, { ...patch, orderId: order.id }, at);
        return { request: toRequest(s, reqs[i]), order: toOrder(s, order) };
      });
    },

    // ── Đánh giá ──
    addReview(input) {
      return mutate((s) => {
        const o = s.orders.find((x) => x.id === input.orderId && x.buyerPhone === input.buyerPhone && x.status === "hoan_thanh");
        if (!o || !o.items.some((l) => l.productId === input.productId))
          throw new MarketError("review_not_allowed", "Chỉ đánh giá được khi đã nhận hàng.");
        if (s.reviews.some((r) => r.orderId === input.orderId && r.productId === input.productId))
          throw new MarketError("already_reviewed", "Món này bà con đã đánh giá rồi.");
        const r: SeedReview = {
          id: crypto.randomUUID(), orderId: o.id, productId: input.productId, shopId: o.shopId,
          buyerPhone: input.buyerPhone, rating: input.rating, comment: input.comment?.trim() || undefined,
          hidden: false, createdAt: nowIso(),
        };
        s.reviews.push(r);
        recount(s, r.productId, r.shopId);
        return toReview(r);
      });
    },
    async listReviews(q) {
      const s = await load();
      const list = s.reviews
        .filter(
          (r) =>
            (!q?.productId || r.productId === q.productId) &&
            (q?.maxRating == null || r.rating <= q.maxRating) &&
            (q?.includeHidden || !r.hidden),
        )
        .sort(byCreatedDesc);
      const page = paginate(list, q);
      return { ...page, items: page.items.map(toReview) };
    },
    setReviewHidden(id, hidden) {
      return mutate((s) => {
        const r = s.reviews.find((x) => x.id === id);
        if (!r) throw new MarketError("not_found");
        r.hidden = hidden;
        recount(s, r.productId, r.shopId);
        return toReview(r);
      });
    },
    async reviewedProductIds(orderId) {
      const s = await load();
      return s.reviews.filter((r) => r.orderId === orderId).map((r) => r.productId);
    },

    // ── Thống kê ──
    async stats(shopId, range) {
      const s = await load();
      const since = sinceOf(range);
      const mine = s.orders.filter((o) => o.shopId === shopId);
      const inRange = (t?: string) => !!t && Date.parse(t) >= since;
      const completed = mine.filter((o) => o.status === "hoan_thanh" && inRange(o.completedAt));
      const qtyBy = new Map<string, { title: string; qty: number }>();
      for (const o of completed) for (const l of o.items) {
        const cur = qtyBy.get(l.productId) ?? { title: l.title, qty: 0 };
        cur.qty += l.qty;
        qtyBy.set(l.productId, cur);
      }
      const byStatus = emptyByStatus();
      for (const o of mine) byStatus[o.status] += 1;
      return {
        range,
        orders: mine.filter((o) => inRange(o.createdAt)).length,
        completed: completed.length,
        revenueVnd: completed.reduce((t, o) => t + o.totalVnd, 0),
        pendingOrders: byStatus.cho_xac_nhan,
        shippingOrders: byStatus.dang_giao,
        awaitingPaymentConfirm: mine.filter((o) => o.paymentStatus === "bao_da_chuyen" && o.status !== "da_huy" && o.status !== "hoan_thanh").length,
        topProducts: [...qtyBy.entries()].map(([productId, v]) => ({ productId, ...v })).sort((a, b) => b.qty - a.qty).slice(0, 5),
        lowStock: s.products
          .filter((p) => p.shopId === shopId && !p.deletedAt && p.stock <= 3)
          .sort((a, b) => a.stock - b.stock)
          .slice(0, 10)
          .map((p) => ({ productId: p.id, title: p.title, stock: p.stock })),
        byStatus,
      } satisfies ShopStats;
    },
    async overview() {
      const s = await load();
      const t = now().getTime();
      const shops: Record<ShopStatus, number> = { cho_duyet: 0, hoat_dong: 0, tam_khoa: 0, tu_choi: 0 };
      for (const sh of s.shops) shops[sh.status] += 1;
      const active = new Set(s.shops.filter((x) => x.status === "hoat_dong").map((x) => x.id));
      const productsOnSale = s.products.filter((p) => !p.deletedAt && !p.adminHidden && p.status === "dang_ban" && active.has(p.shopId)).length;
      const periods = { today: sinceOf("today"), d7: t - 7 * DAY, d30: t - 30 * DAY };
      const orders = { today: emptyByStatus(), d7: emptyByStatus(), d30: emptyByStatus() };
      const gmvVnd = { today: 0, d7: 0, d30: 0 };
      for (const o of s.orders) {
        const c = Date.parse(o.createdAt);
        const done = o.status === "hoan_thanh" && o.completedAt ? Date.parse(o.completedAt) : NaN;
        for (const k of ["today", "d7", "d30"] as const) {
          if (c >= periods[k]) orders[k][o.status] += 1;
          if (Number.isFinite(done) && done >= periods[k]) gmvVnd[k] += o.totalVnd;
        }
      }
      const huy = orders.d30.da_huy;
      const xong = orders.d30.hoan_thanh;
      const out: AdminOverview = {
        shops, productsOnSale, orders, gmvVnd,
        cancelRate30d: huy + xong === 0 ? 0 : huy / (huy + xong),
      };
      return out;
    },
    async saveUpload(shopId, bytes, mime) {
      if (bytes.length > UPLOAD_MAX) throw new MarketError("bad_size", "Ảnh quá lớn (tối đa 500 KB).");
      const ext = EXT[mime];
      if (!ext) throw new MarketError("bad_type");
      const safeShop = shopId.replace(/[^A-Za-z0-9_-]/g, "");
      const name = `${safeShop}-${crypto.randomUUID()}.${ext}`;
      try {
        await fs.mkdir(uploads, { recursive: true });
        await fs.writeFile(path.join(uploads, name), bytes);
      } catch (e) {
        console.error("[market] ghi ảnh dev hỏng:", (e as Error).message);
        throw new MarketError("insert_failed");
      }
      return { url: `/api/dev/uploads/${name}` };
    },

    // ── Dev ──
    devLogin(phone) {
      return mutate((s) => {
        const n = normalizeVnPhone(phone);
        const persona = s.personas.find((p) => p.phone === n);
        if (!persona) throw new MarketError("not_found");
        const token = newDeviceToken();
        s.sessions[token] = { phone: persona.phone, issuedAt: nowIso() };
        return { token, persona: { ...persona } };
      });
    },
    async devIdentity(token) {
      const s = await load();
      const ses = s.sessions[token];
      if (!ses) return null;
      const persona = s.personas.find((p) => p.phone === ses.phone);
      return persona ? { ...persona } : null;
    },
    async devPersonas() {
      const s = await load();
      return s.personas.map((p) => ({ ...p }));
    },
    async devNotifications(phone) {
      const s = await load();
      const n = normalizeVnPhone(phone);
      return s.notifications
        .filter((x) => x.phone === n)
        .sort((a, b) => (a.at < b.at ? 1 : -1))
        .map(({ at, title, body, url, pushOs }) => ({ at, title, body, url, pushOs }));
    },
    devPushNotification(phone, msg) {
      return mutate((s) => {
        s.notifications.push({ at: nowIso(), phone: normalizeVnPhone(phone), title: msg.title, body: msg.body, url: msg.url, pushOs: msg.pushOs !== false });
        if (s.notifications.length > 500) s.notifications = s.notifications.slice(-500);
      });
    },
  };

  /** Một shop = một "giao dịch": kiểm trên bản sao, đủ hết mới áp; thiếu một dòng ⇒ không đụng kho. */
  function placeOne(
    s: DevSeed,
    buyerPhone: string,
    pre: PreparedShopOrder,
    common: { address: Address; paymentMethod: PaymentMethod; buyerNote?: string },
  ): PlaceOrderResult {
    const dup = s.orders.find((o) => o.buyerPhone === buyerPhone && o.clientRef === pre.clientRef);
    if (dup) return { shopId: pre.shopId, ok: true, order: toOrder(s, dup), duplicate: true };

    const shop = s.shops.find((x) => x.id === pre.shopId);
    if (!shop || shop.status !== "hoat_dong") return { shopId: pre.shopId, ok: false, code: "shop_not_active", productIds: [] };
    if (shop.paused) return { shopId: pre.shopId, ok: false, code: "shop_paused", productIds: [] };
    if (common.paymentMethod === "chuyen_khoan" && (!shop.bankAccount || !pre.bankSnapshot))
      return { shopId: pre.shopId, ok: false, code: "shop_not_active", productIds: [] };

    const bad: string[] = [];
    const available: Record<string, number> = {};
    const plan: { p: SeedProduct; qty: number }[] = [];
    for (const l of pre.lines) {
      const p = s.products.find((x) => x.id === l.productId);
      const qtyOk = Number.isInteger(l.qty) && l.qty >= 1 && l.qty <= 999;
      const priceOk = p
        ? l.variantLabel == null
          ? p.priceVnd === l.priceVnd
          : p.variants.some((v) => v.label === l.variantLabel && (v.priceVnd ?? p.priceVnd) === l.priceVnd)
        : false;
      const planned = plan.filter((x) => x.p.id === l.productId).reduce((t, x) => t + x.qty, 0);
      if (
        !p || p.shopId !== shop.id || p.status !== "dang_ban" || p.deletedAt || p.adminHidden ||
        !qtyOk || !priceOk || p.stock - planned < l.qty
      ) {
        bad.push(l.productId);
        if (p && !p.deletedAt && !p.adminHidden && p.shopId === shop.id) available[l.productId] = Math.max(0, p.stock - planned);
        continue;
      }
      plan.push({ p, qty: l.qty });
    }
    if (bad.length > 0) return { shopId: pre.shopId, ok: false, code: "line_unavailable", productIds: [...new Set(bad)], available };

    for (const { p, qty } of plan) {
      p.stock -= qty;
      p.soldCount += qty;
      p.status = normalizeProductStatus(p.status, p.stock, p.priceVnd);
      p.updatedAt = nowIso();
    }
    let code = makeOrderCode(now(), Math.random);
    for (let i = 0; i < 20 && s.orders.some((o) => o.code === code); i++) code = makeOrderCode(now(), Math.random);
    const at = nowIso();
    const order: SeedOrder = {
      id: crypto.randomUUID(), code, buyerPhone, shopId: shop.id,
      items: pre.lines.map((l) => ({ ...l })),
      subtotalVnd: pre.subtotalVnd, shippingVnd: pre.shippingVnd, totalVnd: pre.totalVnd,
      paymentMethod: common.paymentMethod, paymentStatus: "chua_thanh_toan",
      bankSnapshot: common.paymentMethod === "chuyen_khoan" ? pre.bankSnapshot : undefined,
      needsRefund: false, status: "cho_xac_nhan", address: { ...common.address },
      buyerNote: (pre.buyerNote ?? common.buyerNote)?.trim() || undefined,
      timeline: [{ status: "cho_xac_nhan", at, by: "buyer" }],
      clientRef: pre.clientRef, createdAt: at, updatedAt: at,
    };
    s.orders.push(order);
    return { shopId: pre.shopId, ok: true, order: toOrder(s, order), duplicate: false };
  }

  return store;
}

function applyShopPatch(shop: Shop, patch: ShopPatch): void {
  const str = (v: string | undefined) => (v == null ? undefined : v.trim() || undefined);
  if (patch.name != null) shop.name = patch.name.trim();
  if ("description" in patch) shop.description = str(patch.description);
  if ("logoUrl" in patch) shop.logoUrl = str(patch.logoUrl);
  if ("phone" in patch) shop.phone = str(patch.phone) ?? shop.ownerPhone;
  if (patch.province != null) shop.province = patch.province;
  if ("address" in patch) shop.address = str(patch.address);
  if ("bankName" in patch) shop.bankName = str(patch.bankName);
  if ("bankAccount" in patch) shop.bankAccount = str(patch.bankAccount);
  if ("bankHolder" in patch) shop.bankHolder = str(patch.bankHolder);
  if (patch.shippingFlatVnd != null) shop.shippingFlatVnd = patch.shippingFlatVnd;
  if ("freeShipFromVnd" in patch) shop.freeShipFromVnd = patch.freeShipFromVnd ?? undefined;
  if (patch.paused != null) shop.paused = patch.paused;
}

function applyProductPatch(p: SeedProduct, patch: Partial<ProductDraftM> & { adminHidden?: unknown }): void {
  if (patch.title != null) p.title = patch.title.trim();
  if ("description" in patch) p.description = patch.description?.trim() || undefined;
  if (patch.category != null) p.category = patch.category;
  /*  `"priceVnd" in patch` chứ KHÔNG phải `!= null` — null là GIÁ TRỊ CÓ NGHĨA
      (chuyển món sang liên hệ báo giá, ADR 0014), không phải "không gửi". Dùng
      `!= null` là bỏ giá xong món vẫn giữ giá cũ, im lặng. Cùng khuôn với
      `description`/`compareAtVnd` ngay trên dưới. */
  if ("priceVnd" in patch) p.priceVnd = patch.priceVnd ?? null;
  if ("compareAtVnd" in patch) p.compareAtVnd = patch.compareAtVnd ?? undefined;
  if (patch.unit != null) p.unit = patch.unit.trim();
  if (patch.stock != null) p.stock = patch.stock;
  if (patch.images != null) p.images = [...patch.images];
  if (patch.variants != null) p.variants = patch.variants.map((v) => ({ ...v }));
  if (patch.status != null) p.status = patch.status;
  // adminHidden KHÔNG đổi qua đây (seller) — bỏ qua nếu client gửi
}
