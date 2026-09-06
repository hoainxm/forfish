import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { marketOrderClientRef } from "@/lib/market/order-ref";
import type {
  Address, CartQuote, MarketCartLine, Order, PaymentMethod, PlaceOrderResult,
  Product, ProductCard, Review, Shop, ShopPublic,
} from "@/lib/market/types";

// Khuôn dùng chung cho mọi ca API của Chợ vật tư. Không có luật nghiệp vụ ở đây —
// chỉ đăng nhập persona, gọi route, tìm món seed. Đường dẫn/route theo 12 §7.

export const TOKEN_HEADER = "x-sdfish-token";

/** Persona của kho file (12 §5.3) — SĐT là danh tính, không lấy từ body. */
export const PERSONA = {
  buyerBa: "0901000001",       // Anh Ba — có 6 đơn seed
  buyerTu: "0901000002",       // Chị Tư — có đơn đã huỷ needsRefund
  buyerNam: "0901000003",      // Cô Năm — CHƯA có shop (dùng test đăng ký shop)
  sellerSdvico: "0902000001",  // chủ shop SDVICO (hoat_dong, KHÔNG STK ⇒ ép COD)
  sellerHaiDang: "0902000002", // chủ shop Đại lý Hải Đăng (hoat_dong, có STK)
  sellerPhuongNam: "0902000003", // chủ shop Đại lý Phương Nam (cho_duyet)
  admin: "0909000000",
} as const;

/** Dữ liệu seed cần gọi tên trong test (12 §5.3). */
export const SEED = {
  shopSdvico: "sdvico",
  shopHaiDang: "dai-ly-hai-dang",
  shopPhuongNam: "dai-ly-phuong-nam",
  // món bình thường
  pLocDau: "Lọc dầu diesel máy tàu",          // SDVICO, tồn 2 — ca "chỉ còn M" + ca đua
  pAoPhao: "Áo phao cứu sinh",                 // SDVICO, tồn 150
  pDaCay: "Đá cây 50kg",                       // Hải Đăng, tồn 1000
  pDayThung: "Dây thừng PP tàu cá",            // Hải Đăng, có 3 biến thể
  pDenLed: "Đèn LED pha tàu cá",               // SDVICO, biến thể có giá riêng
  // món KHÔNG được lên chợ
  pHetHang: "Bộ đàm hàng hải Icom IC-M25",     // tồn 0 ⇒ vẫn hiện (mờ)
  pAdminHidden: "Lưới kéo mắt nhỏ 2a=10mm",    // adminHidden
  pAn: "Mì gói thùng 30 gói",                  // status = an
  pDeleted: "Bạt cũ thanh lý",                 // deletedAt
  // đơn seed của Anh Ba
  orderChoXacNhanCk: "SD260906K7PQ",           // chuyen_khoan + bao_da_chuyen
  orderDangGiao: "SD260904M3RT",
  orderDaGiao2Ngay: "SD260901Q2WX",
  orderDaGiao9Ngay: "SD260825H8ZN",            // ⇒ settleOverdue phải tự hoàn thành
  orderHoanThanh: "SD260822B5CD",
} as const;

/** Địa chỉ nhận mẫu (11 §3.4) — SĐT trong đây là NGƯỜI NHẬN, không phải danh tính. */
export const ADDRESS: Address = {
  name: "Nguyễn Văn Ba",
  phone: "0901000001",
  province: "Khánh Hòa",
  detail: "Cảng Hòn Rớ, tàu KH-91234",
  isPort: true,
};

export type ApiBody = Record<string, unknown> & { ok?: boolean; code?: string; message?: string };
export interface ApiRes<T = ApiBody> {
  status: number;
  body: T & { ok?: boolean; code?: string; message?: string };
}

export function auth(token?: string): Record<string, string> {
  return token ? { [TOKEN_HEADER]: token } : {};
}

/** Địa chỉ server. Tự dựng URL tuyệt đối thay vì tin `baseURL` của fixture
 *  `request` (fixture đó tạo context KHÔNG kèm baseURL — đã đọc runner 1.62). */
export const BASE_URL =
  process.env.PLAYWRIGHT_TEST_BASE_URL ?? `http://localhost:${process.env.SAN_PORT ?? 3031}`;
export const url = (p: string) => (/^https?:\/\//.test(p) ? p : `${BASE_URL}${p}`);

/** Gọi route JSON. KHÔNG ném khi lỗi HTTP — test tự khẳng định status + code. */
export async function call<T = ApiBody>(
  request: APIRequestContext,
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  opts: { token?: string; data?: unknown; headers?: Record<string, string> } = {},
): Promise<ApiRes<T>> {
  const res = await request.fetch(url(path), {
    method,
    headers: { ...auth(opts.token), ...(opts.headers ?? {}) },
    ...(opts.data === undefined ? {} : { data: opts.data as object }),
  });
  const text = await res.text();
  let body: unknown = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { ok: false, code: "not_json", message: text.slice(0, 200) };
  }
  return { status: res.status(), body: body as T & { ok?: boolean; code?: string } };
}

export const get = <T = ApiBody>(r: APIRequestContext, p: string, token?: string) =>
  call<T>(r, "GET", p, { token });
export const post = <T = ApiBody>(r: APIRequestContext, p: string, data?: unknown, token?: string) =>
  call<T>(r, "POST", p, { token, data });
export const patch = <T = ApiBody>(r: APIRequestContext, p: string, data?: unknown, token?: string) =>
  call<T>(r, "PATCH", p, { token, data });
export const del = <T = ApiBody>(r: APIRequestContext, p: string, token?: string) =>
  call<T>(r, "DELETE", p, { token });

/** Đăng nhập persona (12 §6.4) → chuỗi `sdf_…`. Hỏng ⇒ dừng ngay với câu rõ ràng. */
export async function devLogin(request: APIRequestContext, phone: string): Promise<string> {
  const res = await post<{ token?: string }>(request, "/api/dev/login", { phone });
  expect(
    res.status,
    `POST /api/dev/login ${phone} — cần MARKET_STORE=file (dev-market.mjs). Trả về: ${JSON.stringify(res.body)}`,
  ).toBe(200);
  const token = res.body.token;
  expect(typeof token, "token dev phải là chuỗi").toBe("string");
  return token as string;
}

/** Bộ chuỗi của mọi persona hay dùng — gọi 1 lần đầu file test. */
export async function loginAll(request: APIRequestContext) {
  const [ba, tu, nam, sdvico, haidang, phuongnam, admin] = await Promise.all([
    devLogin(request, PERSONA.buyerBa),
    devLogin(request, PERSONA.buyerTu),
    devLogin(request, PERSONA.buyerNam),
    devLogin(request, PERSONA.sellerSdvico),
    devLogin(request, PERSONA.sellerHaiDang),
    devLogin(request, PERSONA.sellerPhuongNam),
    devLogin(request, PERSONA.admin),
  ]);
  return { ba, tu, nam, sdvico, haidang, phuongnam, admin };
}

export interface ProductListRes { ok: boolean; items: ProductCard[]; total: number; page: number; pageSize: number }

export async function listProducts(
  request: APIRequestContext,
  query: Record<string, string | number> = {},
  token?: string,
): Promise<ApiRes<ProductListRes>> {
  const qs = new URLSearchParams(Object.entries(query).map(([k, v]) => [k, String(v)]));
  const suffix = qs.toString() ? `?${qs}` : "";
  return get<ProductListRes>(request, `/api/cho/san-pham${suffix}`, token);
}

/** Tìm món seed theo TÊN qua route công khai (id là uuid sinh mới mỗi lần seed). */
export async function findProduct(
  request: APIRequestContext,
  title: string,
  token?: string,
): Promise<ProductCard> {
  const res = await listProducts(request, { q: title, pageSize: 50 }, token);
  expect(res.status, `GET /api/cho/san-pham?q=${title}`).toBe(200);
  const found = (res.body.items ?? []).find((p) => p.title === title);
  expect(found, `không thấy món seed "${title}" trên chợ`).toBeTruthy();
  return found as ProductCard;
}

/** Món của CHÍNH shop (kể cả ẩn / hết hàng) — dùng chuỗi chủ shop. */
export async function findOwnProduct(
  request: APIRequestContext,
  token: string,
  title: string,
): Promise<Product> {
  const res = await get<{ items: Product[] }>(request, `/api/ban-hang/san-pham?pageSize=50&q=${encodeURIComponent(title)}`, token);
  expect(res.status, "GET /api/ban-hang/san-pham").toBe(200);
  const found = (res.body.items ?? []).find((p) => p.title === title);
  expect(found, `chủ shop không thấy món "${title}"`).toBeTruthy();
  return found as Product;
}

export async function shopBySlug(request: APIRequestContext, slug: string): Promise<ShopPublic> {
  const res = await get<{ shop: ShopPublic }>(request, `/api/cho/shop/${slug}`);
  expect(res.status, `GET /api/cho/shop/${slug}`).toBe(200);
  return res.body.shop;
}

export interface QuoteRes { ok: boolean; quote: CartQuote; titles?: Record<string, string> }

export async function quoteCart(
  request: APIRequestContext,
  items: MarketCartLine[],
  token?: string,
): Promise<ApiRes<QuoteRes>> {
  return post<QuoteRes>(request, "/api/cho/gio/tinh", { items }, token);
}

export interface PlaceRes { ok: boolean; results: PlaceOrderResult[] }

export interface ShopBasket { shopId: string; items: MarketCartLine[]; expectedTotalVnd?: number }

/**
 * Đặt hàng đúng khuôn client (11 §5.6): tra giỏ trước để lấy `expectedTotalVnd`
 * của từng shop, `clientRef` = `marketOrderClientRef` (hàm thật của lib).
 * `overrideTotal` để cố tình gửi tổng sai (ca `price_changed`).
 */
export async function placeOrders(
  request: APIRequestContext,
  token: string,
  baskets: ShopBasket[],
  opts: { address?: Address; paymentMethod?: PaymentMethod; buyerNote?: string } = {},
): Promise<ApiRes<PlaceRes>> {
  const address = opts.address ?? ADDRESS;
  const paymentMethod: PaymentMethod = opts.paymentMethod ?? "cod";
  const common = { address, paymentMethod, ...(opts.buyerNote ? { buyerNote: opts.buyerNote } : {}) };
  const shops = baskets.map((b) => ({
    shopId: b.shopId,
    items: b.items,
    clientRef: marketOrderClientRef({ shopId: b.shopId, items: b.items }, common),
    expectedTotalVnd: b.expectedTotalVnd ?? 0,
  }));
  return post<PlaceRes>(request, "/api/cho/don", { shops, ...common }, token);
}

/** Tổng server đang tính cho một shop — để gửi `expectedTotalVnd` đúng. */
export async function expectedTotalFor(
  request: APIRequestContext,
  shopId: string,
  items: MarketCartLine[],
  token?: string,
): Promise<number> {
  const q = await quoteCart(request, items, token);
  expect(q.status, "POST /api/cho/gio/tinh").toBe(200);
  const group = (q.body.quote?.groups ?? []).find((g) => g.shop.id === shopId);
  expect(group, `giỏ tra lại không có nhóm của shop ${shopId} (dropped: ${JSON.stringify(q.body.quote?.dropped)})`).toBeTruthy();
  return (group as { totalVnd: number }).totalVnd;
}

/** Đặt 1 đơn cho 1 shop và khẳng định thành công — dùng làm tiền đề cho ca khác. */
export async function placeOneOrder(
  request: APIRequestContext,
  token: string,
  shopId: string,
  items: MarketCartLine[],
  opts: { paymentMethod?: PaymentMethod; buyerNote?: string; address?: Address } = {},
): Promise<Order> {
  const total = await expectedTotalFor(request, shopId, items, token);
  const res = await placeOrders(request, token, [{ shopId, items, expectedTotalVnd: total }], opts);
  expect(res.status, `POST /api/cho/don → ${JSON.stringify(res.body)}`).toBe(200);
  const r = res.body.results?.[0];
  expect(r?.ok, `đặt hàng hỏng: ${JSON.stringify(r)}`).toBe(true);
  return (r as { order: Order }).order;
}

export async function getBuyerOrder(request: APIRequestContext, token: string, id: string): Promise<ApiRes<{ order: Order }>> {
  return get<{ order: Order }>(request, `/api/cho/don/${id}`, token);
}

export async function listBuyerOrders(
  request: APIRequestContext,
  token: string,
  query: Record<string, string | number> = {},
): Promise<ApiRes<{ items: Order[]; total: number }>> {
  const qs = new URLSearchParams(Object.entries(query).map(([k, v]) => [k, String(v)]));
  const suffix = qs.toString() ? `?${qs}` : "";
  return get<{ items: Order[]; total: number }>(request, `/api/cho/don${suffix}`, token);
}

export async function listSellerOrders(
  request: APIRequestContext,
  token: string,
  query: Record<string, string | number> = {},
): Promise<ApiRes<{ items: Order[]; total: number }>> {
  const qs = new URLSearchParams(Object.entries(query).map(([k, v]) => [k, String(v)]));
  const suffix = qs.toString() ? `?${qs}` : "";
  return get<{ items: Order[]; total: number }>(request, `/api/ban-hang/don${suffix}`, token);
}

export async function sellerShop(request: APIRequestContext, token: string): Promise<Shop | null> {
  const res = await get<{ shop: Shop | null }>(request, "/api/ban-hang/shop", token);
  expect(res.status, "GET /api/ban-hang/shop").toBe(200);
  return res.body.shop ?? null;
}

/** Tồn kho HIỆN TẠI của một món, đọc bằng route công khai. */
export async function stockOf(request: APIRequestContext, productId: string): Promise<number> {
  const res = await get<{ product: Product }>(request, `/api/cho/san-pham/${productId}`);
  expect(res.status, `GET /api/cho/san-pham/${productId}`).toBe(200);
  return res.body.product.stock;
}

export async function soldOf(request: APIRequestContext, productId: string): Promise<number> {
  const res = await get<{ product: Product }>(request, `/api/cho/san-pham/${productId}`);
  expect(res.status).toBe(200);
  return res.body.product.soldCount;
}

export async function reviewsOf(
  request: APIRequestContext,
  productId: string,
): Promise<ApiRes<{ items: Review[]; total: number }>> {
  return get<{ items: Review[]; total: number }>(request, `/api/cho/san-pham/${productId}/danh-gia`);
}

// ── Ảnh cho ca upload (12 §7.2 + AC-47) ───────────────────────────────────────
/** JPEG bé xíu HỢP LỆ: magic FF D8 FF + đuôi FF D9, chèn thêm cho đủ `size` byte. */
export function fakeJpeg(size = 1024): Buffer {
  const head = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00]);
  const tail = Buffer.from([0xff, 0xd9]);
  const fill = Buffer.alloc(Math.max(0, size - head.length - tail.length), 0x20);
  return Buffer.concat([head, fill, tail]);
}
/** PNG bé xíu hợp lệ (magic 89 50 4E 47 0D 0A 1A 0A). */
export function fakePng(size = 512): Buffer {
  const head = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([head, Buffer.alloc(Math.max(0, size - head.length), 0x00)]);
}

export async function uploadImage(
  request: APIRequestContext,
  token: string,
  file: { name: string; mimeType: string; buffer: Buffer },
): Promise<ApiRes<{ url: string }>> {
  const res = await request.fetch(url("/api/ban-hang/upload"), {
    method: "POST",
    headers: auth(token),
    multipart: { file },
  });
  const text = await res.text();
  let body: unknown = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { ok: false, code: "not_json", message: text.slice(0, 200) };
  }
  return { status: res.status(), body: body as { url: string; ok?: boolean; code?: string } };
}

// ── Màn hình (project `mobile`) ───────────────────────────────────────────────
/** Khoá chuỗi cứng trong máy (state-registry): `forfish.token.v1`. */
export const DEVICE_TOKEN_KEY = "forfish.token.v1";

/** Đăng nhập bằng TRANG /dev (12 §6.4) — đúng đường bà con/dev đi, không nhét
 *  thẳng localStorage: nếu `saveToken` hỏng thì test phải thấy. */
export async function loginViaDevPage(page: Page, phone: string): Promise<void> {
  await page.goto(url("/dev"));
  const row = page.locator("li").filter({ hasText: phone }).first();
  await row.getByRole("button", { name: /Đăng nhập/i }).click();
  await expect
    .poll(async () => page.evaluate((k) => window.localStorage.getItem(k), DEVICE_TOKEN_KEY), { timeout: 15_000 })
    .not.toBeNull();
}
