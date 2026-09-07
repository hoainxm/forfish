// SEED cho kho file (dev) — THUẦN: `buildDevSeed(now)` → object; file-store ghi
// lần đầu khi `.local/market-dev.json` chưa có (12 §5.3). Không có gì ở đây
// chạy ở prod. Màu placeholder là NỘI DUNG ảnh (SVG data-URI), nằm trong lib —
// không phải class Tailwind nên không dính cổng hex (03 §5/§8).
import { PRODUCT_CATEGORIES } from "./categories";
import { productSearchText } from "./text";
import { recountRating } from "./rating";
import { normalizeProductStatus } from "./validate";
import type {
  Address, DevPersona, Order, OrderLine, Product, ProductCategory, Review, Shop, Variant,
} from "./types";

export interface SeedProduct extends Product { searchText: string }
export interface SeedOrder extends Order { restockedAt?: string }
export interface SeedReview extends Omit<Review, "buyerPhoneMasked"> { buyerPhone: string }
export interface SeedNotification { at: string; phone: string; title: string; body: string; url?: string; pushOs: boolean }

export interface DevSeed {
  version: 1;
  shops: Shop[];
  products: SeedProduct[];
  orders: SeedOrder[];
  reviews: SeedReview[];
  sessions: Record<string, { phone: string; issuedAt: string }>;
  personas: DevPersona[];
  notifications: SeedNotification[];
}

export const DEV_PERSONAS: DevPersona[] = [
  { phone: "0901000001", name: "Anh Ba (mua)", role: "buyer", tier: "basic" },
  { phone: "0901000002", name: "Chị Tư (mua)", role: "buyer", tier: "premium" },
  { phone: "0901000003", name: "Cô Năm (mua)", role: "buyer", tier: "basic" },
  { phone: "0902000001", name: "SDVICO", role: "seller", tier: "basic" },
  { phone: "0902000002", name: "Đại lý Hải Đăng", role: "seller", tier: "basic" },
  { phone: "0902000003", name: "Đại lý Phương Nam (chờ duyệt)", role: "seller", tier: "basic" },
  { phone: "0909000000", name: "Admin", role: "admin", tier: "premium" },
];

/** Màu nền placeholder theo nhóm hàng — nội dung ảnh, không phải token UI. */
const CATEGORY_COLOR: Record<ProductCategory, string> = {
  "may-dong-co": "#3b5f7a",
  "dien-tu-hang-hai": "#1f6f8b",
  "ngu-cu": "#2f7d5a",
  "dau-nhot-nhien-lieu": "#8a5a1e",
  "da-bao-quan": "#4a8fb3",
  "nhu-yeu-pham": "#8b6a2f",
  "an-toan": "#b3452e",
  "phu-tung": "#5a5f6b",
  "khac": "#6b6b6b",
};

/** Ảnh SVG data-URI placeholder theo nhóm — chữ tắt nhóm trên nền màu. */
export function placeholderImage(category: ProductCategory, label: string): string {
  const short = label.slice(0, 12).replace(/[<>&"]/g, "");
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">` +
    `<rect width="400" height="400" rx="32" fill="${CATEGORY_COLOR[category]}"/>` +
    `<text x="200" y="215" font-family="Arial, sans-serif" font-size="34" font-weight="700" fill="#ffffff" text-anchor="middle">${short}</text>` +
    `</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const uuid = () => crypto.randomUUID();
const iso = (ms: number) => new Date(ms).toISOString();
const H = 3600 * 1000;
const D = 24 * H;

interface P {
  shop: "sdvico" | "haidang";
  title: string;
  category: ProductCategory;
  /** null = liên hệ báo giá (ADR 0011) — không vào giỏ, không lên đơn. */
  priceVnd: number | null;
  compareAtVnd?: number;
  unit: string;
  stock: number;
  soldCount: number;
  description?: string;
  variants?: Variant[];
  status?: "dang_ban" | "an";
  adminHiddenReason?: string;
  deleted?: boolean;
}

const PRODUCTS: P[] = [
  // ── SDVICO (16) ──
  { shop: "sdvico", title: "Máy tàu Yanmar 4CHE 120HP", category: "may-dong-co", priceVnd: 185_000_000, unit: "cái", stock: 3, soldCount: 2, description: "Máy chính hãng, bảo hành 12 tháng, lắp đặt tại cảng." },
  { shop: "sdvico", title: "Bơm nước làm mát máy tàu", category: "may-dong-co", priceVnd: 2_450_000, compareAtVnd: 2_900_000, unit: "cái", stock: 12, soldCount: 34 },
  { shop: "sdvico", title: "Máy định vị GPS Garmin 585 Plus", category: "dien-tu-hang-hai", priceVnd: 9_800_000, unit: "cái", stock: 8, soldCount: 27, description: "Màn 6 inch, có dò cá, kèm bản đồ biển Việt Nam." },
  { shop: "sdvico", title: "Máy dò cá Furuno FCV-628", category: "dien-tu-hang-hai", priceVnd: 24_500_000, compareAtVnd: 26_900_000, unit: "cái", stock: 5, soldCount: 11 },
  { shop: "sdvico", title: "Thiết bị giám sát hành trình VX-01", category: "dien-tu-hang-hai", priceVnd: 12_000_000, unit: "bộ", stock: 20, soldCount: 120, description: "Đủ chuẩn Bộ NN&PTNT, lắp và kích hoạt trong ngày." },
  { shop: "sdvico", title: "Bộ đàm hàng hải Icom IC-M25", category: "dien-tu-hang-hai", priceVnd: 4_200_000, unit: "cái", stock: 0, soldCount: 45 },
  { shop: "sdvico", title: "Đèn LED pha tàu cá", category: "phu-tung", priceVnd: 850_000, unit: "cái", stock: 40, soldCount: 60, variants: [{ label: "50W", priceVnd: 850_000 }, { label: "100W", priceVnd: 1_450_000 }], description: "Chống nước IP67, 12–24V." },
  { shop: "sdvico", title: "Áo phao cứu sinh", category: "an-toan", priceVnd: 180_000, unit: "cái", stock: 150, soldCount: 88 },
  { shop: "sdvico", title: "Phao tròn cứu sinh", category: "an-toan", priceVnd: 320_000, unit: "cái", stock: 30, soldCount: 15 },
  { shop: "sdvico", title: "Bình chữa cháy bột 4kg", category: "an-toan", priceVnd: 260_000, unit: "bình", stock: 25, soldCount: 9 },
  { shop: "sdvico", title: "Bugi máy tàu NGK", category: "phu-tung", priceVnd: 95_000, unit: "cái", stock: 200, soldCount: 73 },
  { shop: "sdvico", title: "Lọc dầu diesel máy tàu", category: "phu-tung", priceVnd: 210_000, unit: "cái", stock: 2, soldCount: 19 },
  { shop: "sdvico", title: "Dầu nhớt Castrol 20W-50 thùng 18L", category: "dau-nhot-nhien-lieu", priceVnd: 1_650_000, unit: "thùng", stock: 40, soldCount: 52 },
  { shop: "sdvico", title: "Mỡ bò bôi trơn xô 15kg", category: "dau-nhot-nhien-lieu", priceVnd: 890_000, unit: "xô", stock: 18, soldCount: 6 },
  { shop: "sdvico", title: "Sơn chống hà tàu cá 5L", category: "khac", priceVnd: 1_100_000, unit: "thùng", stock: 22, soldCount: 8 },
  { shop: "sdvico", title: "Bạt che mưa 4×6m", category: "khac", priceVnd: 380_000, unit: "tấm", stock: 35, soldCount: 21 },
  /*  MÓN LIÊN HỆ BÁO GIÁ (ADR 0011) — phải có trong seed, không thì dev và e2e
      không bao giờ nhìn thấy trạng thái này. Đúng khuôn 6 món thật của SDVICO
      chuyển sang chợ bằng 0055: không giá, không tồn kho, bán qua tư vấn. */
  { shop: "sdvico", title: "Máy lọc nước biển SEA-40", category: "khac", priceVnd: null, unit: "bộ", stock: 0, soldCount: 0, description: "Lọc nước biển thành nước ngọt 40L/h. Báo giá theo tàu, gọi shop tư vấn." },
  // ── Đại lý Hải Đăng (9) ──
  { shop: "haidang", title: "Dây thừng PP tàu cá", category: "ngu-cu", priceVnd: 45_000, unit: "kg", stock: 500, soldCount: 96, variants: [{ label: "Ø10" }, { label: "Ø12" }, { label: "Ø14" }], description: "Bán theo kg, cuộn 20–25 kg." },
  { shop: "haidang", title: "Lưới rê 3 lớp", category: "ngu-cu", priceVnd: 2_800_000, unit: "tấm", stock: 15, soldCount: 14 },
  { shop: "haidang", title: "Lưới kéo mắt nhỏ 2a=10mm", category: "ngu-cu", priceVnd: 3_500_000, unit: "tấm", stock: 5, soldCount: 0, adminHiddenReason: "Ngư cụ cấm" },
  { shop: "haidang", title: "Đá cây 50kg", category: "da-bao-quan", priceVnd: 35_000, unit: "cây", stock: 1000, soldCount: 110 },
  { shop: "haidang", title: "Thùng xốp bảo quản 100L", category: "da-bao-quan", priceVnd: 120_000, unit: "cái", stock: 60, soldCount: 40 },
  { shop: "haidang", title: "Gạo ST25 bao 50kg", category: "nhu-yeu-pham", priceVnd: 1_250_000, compareAtVnd: 1_400_000, unit: "bao", stock: 30, soldCount: 17 },
  { shop: "haidang", title: "Nước uống đóng bình 20L", category: "nhu-yeu-pham", priceVnd: 25_000, unit: "bình", stock: 200, soldCount: 100 },
  { shop: "haidang", title: "Mì gói thùng 30 gói", category: "nhu-yeu-pham", priceVnd: 165_000, unit: "thùng", stock: 50, soldCount: 4, status: "an" },
  { shop: "haidang", title: "Bạt cũ thanh lý", category: "khac", priceVnd: 90_000, unit: "tấm", stock: 3, soldCount: 1, deleted: true },
];

function line(p: Product, qty: number, variantLabel?: string): OrderLine {
  const v = variantLabel ? p.variants.find((x) => x.label === variantLabel) : undefined;
  /* Seed chỉ dựng đơn từ món CÓ GIÁ — món liên hệ báo giá không lên đơn được
     (pricing.buildMarketLines chặn). Ném sớm để seed sai lộ ra ngay ở dev. */
  const price = v?.priceVnd ?? p.priceVnd;
  if (price == null) throw new Error(`dev-seed: "${p.title}" chưa có giá, không dựng được dòng đơn`);
  return {
    productId: p.id,
    ...(variantLabel ? { variantLabel } : {}),
    title: p.title,
    unit: p.unit,
    priceVnd: price,
    qty,
    lineTotalVnd: price * qty,
    image: p.images[0],
  };
}

export function buildDevSeed(now: Date): DevSeed {
  const t = now.getTime();
  const created = iso(t - 30 * D);

  const sdvico: Shop = {
    id: uuid(), ownerPhone: "0902000001", name: "SDVICO", slug: "sdvico",
    description: "Thiết bị hàng hải, giám sát hành trình và vật tư tàu cá chính hãng.",
    phone: "0902000001", province: "Khánh Hòa", address: "Cảng Hòn Rớ, Nha Trang",
    shippingFlatVnd: 0, status: "hoat_dong", paused: false, ratingAvg: 0, ratingCount: 0,
    approvedAt: created, createdAt: created, updatedAt: created,
  };
  const haidang: Shop = {
    id: uuid(), ownerPhone: "0902000002", name: "Đại lý Hải Đăng", slug: "dai-ly-hai-dang",
    description: "Ngư cụ, đá cây, nhu yếu phẩm cho tàu đi khơi — giao ra cảng Quy Nhơn.",
    phone: "0902000002", province: "Gia Lai", address: "Cảng cá Quy Nhơn",
    bankName: "Vietcombank", bankAccount: "0071000123456", bankHolder: "NGUYEN VAN HAI",
    shippingFlatVnd: 30_000, freeShipFromVnd: 2_000_000, status: "hoat_dong", paused: false,
    ratingAvg: 0, ratingCount: 0, approvedAt: created, createdAt: created, updatedAt: created,
  };
  const phuongnam: Shop = {
    id: uuid(), ownerPhone: "0902000003", name: "Đại lý Phương Nam", slug: "dai-ly-phuong-nam",
    description: "Vật tư tàu cá vùng Rạch Giá.", phone: "0902000003", province: "An Giang",
    shippingFlatVnd: 50_000, status: "cho_duyet", paused: false, ratingAvg: 0, ratingCount: 0,
    createdAt: iso(t - 1 * D), updatedAt: iso(t - 1 * D),
  };
  const shops = [sdvico, haidang, phuongnam];

  const products: SeedProduct[] = PRODUCTS.map((p, i) => {
    const shop = p.shop === "sdvico" ? sdvico : haidang;
    const at = iso(t - (25 - i) * D);
    const base = normalizeProductStatus(p.status ?? "dang_ban", p.stock, p.priceVnd);
    const prod: SeedProduct = {
      id: uuid(), shopId: shop.id, title: p.title, description: p.description,
      category: p.category, priceVnd: p.priceVnd, compareAtVnd: p.compareAtVnd, unit: p.unit,
      stock: p.stock, images: [placeholderImage(p.category, p.title)], variants: p.variants ?? [],
      status: base, adminHidden: !!p.adminHiddenReason, adminHiddenReason: p.adminHiddenReason,
      deletedAt: p.deleted ? iso(t - 2 * D) : undefined,
      soldCount: p.soldCount, ratingAvg: 0, ratingCount: 0, createdAt: at, updatedAt: at,
      searchText: productSearchText(p),
    };
    return prod;
  });
  const byTitle = (title: string) => {
    const p = products.find((x) => x.title === title);
    if (!p) throw new Error(`seed thiếu món ${title}`);
    return p;
  };

  const addrBa: Address = { name: "Nguyễn Văn Ba", phone: "0901000001", province: "Khánh Hòa", detail: "Cảng Hòn Rớ, tàu KH-91234", isPort: true };
  const addrTu: Address = { name: "Trần Thị Tư", phone: "0901000002", province: "Gia Lai", detail: "Cảng cá Quy Nhơn, cầu cảng số 2", isPort: true };
  const bank = { bankName: haidang.bankName!, bankAccount: haidang.bankAccount!, bankHolder: haidang.bankHolder! };

  const mk = (
    code: string, buyer: string, shop: Shop, lines: OrderLine[], createdMs: number,
    o: Partial<SeedOrder> & { paymentMethod: Order["paymentMethod"]; status: Order["status"] },
    address: Address,
  ): SeedOrder => {
    const subtotalVnd = lines.reduce((s, l) => s + l.lineTotalVnd, 0);
    const shippingVnd = subtotalVnd === 0 ? 0
      : shop.freeShipFromVnd != null && subtotalVnd >= shop.freeShipFromVnd ? 0 : shop.shippingFlatVnd;
    return {
      id: uuid(), code, buyerPhone: buyer, shopId: shop.id, items: lines,
      subtotalVnd, shippingVnd, totalVnd: subtotalVnd + shippingVnd,
      paymentStatus: "chua_thanh_toan", needsRefund: false, address, timeline: [],
      createdAt: iso(createdMs), updatedAt: iso(createdMs), ...o,
    };
  };

  const o1c = t - 3 * H;
  const o1 = mk("SD260906K7PQ", "0901000001", haidang,
    [line(byTitle("Đá cây 50kg"), 10), line(byTitle("Dây thừng PP tàu cá"), 20, "Ø12")], o1c,
    {
      paymentMethod: "chuyen_khoan", status: "cho_xac_nhan", paymentStatus: "bao_da_chuyen", bankSnapshot: bank,
      buyerNote: "Giao trước 6h sáng giúp shop.",
      timeline: [
        { status: "cho_xac_nhan", at: iso(o1c), by: "buyer" },
        { status: "bao_da_chuyen", at: iso(o1c + H), by: "buyer" },
      ],
      clientRef: "m1-seed000000000001",
    }, addrBa);

  const o2c = t - 2 * D;
  const o2 = mk("SD260904M3RT", "0901000001", sdvico,
    [line(byTitle("Áo phao cứu sinh"), 5), line(byTitle("Bugi máy tàu NGK"), 4)], o2c,
    {
      paymentMethod: "cod", status: "dang_giao", carrier: "Gửi xe", trackingCode: "PT-88213",
      timeline: [
        { status: "cho_xac_nhan", at: iso(o2c), by: "buyer" },
        { status: "da_xac_nhan", at: iso(o2c + 2 * H), by: "seller" },
        { status: "dang_giao", at: iso(o2c + D), by: "seller", note: "Gửi xe Phương Trang" },
      ],
      clientRef: "m1-seed000000000002",
    }, addrBa);

  const o3c = t - 5 * D;
  const o3 = mk("SD260901Q2WX", "0901000001", sdvico,
    [line(byTitle("Dầu nhớt Castrol 20W-50 thùng 18L"), 2)], o3c,
    {
      paymentMethod: "cod", status: "da_giao", deliveredAt: iso(t - 2 * D),
      timeline: [
        { status: "cho_xac_nhan", at: iso(o3c), by: "buyer" },
        { status: "da_xac_nhan", at: iso(o3c + H), by: "seller" },
        { status: "dang_giao", at: iso(o3c + D), by: "seller" },
        { status: "da_giao", at: iso(t - 2 * D), by: "seller" },
      ],
      clientRef: "m1-seed000000000003",
    }, addrBa);

  const o4c = t - 12 * D;
  const o4 = mk("SD260825H8ZN", "0901000001", haidang,
    [line(byTitle("Thùng xốp bảo quản 100L"), 3), line(byTitle("Nước uống đóng bình 20L"), 10)], o4c,
    {
      paymentMethod: "cod", status: "da_giao", deliveredAt: iso(t - 9 * D),
      timeline: [
        { status: "cho_xac_nhan", at: iso(o4c), by: "buyer" },
        { status: "da_xac_nhan", at: iso(o4c + H), by: "seller" },
        { status: "dang_giao", at: iso(o4c + D), by: "seller" },
        { status: "da_giao", at: iso(t - 9 * D), by: "seller" },
      ],
      clientRef: "m1-seed000000000004",
    }, addrBa);

  const o5c = t - 15 * D;
  const o5 = mk("SD260822B5CD", "0901000001", sdvico,
    [line(byTitle("Máy định vị GPS Garmin 585 Plus"), 1), line(byTitle("Áo phao cứu sinh"), 2), line(byTitle("Bugi máy tàu NGK"), 6)], o5c,
    {
      paymentMethod: "cod", status: "hoan_thanh", paymentStatus: "da_thanh_toan",
      deliveredAt: iso(t - 11 * D), completedAt: iso(t - 10 * D),
      timeline: [
        { status: "cho_xac_nhan", at: iso(o5c), by: "buyer" },
        { status: "da_xac_nhan", at: iso(o5c + H), by: "seller" },
        { status: "dang_giao", at: iso(o5c + D), by: "seller" },
        { status: "da_giao", at: iso(t - 11 * D), by: "seller" },
        { status: "hoan_thanh", at: iso(t - 10 * D), by: "buyer" },
        { status: "da_thanh_toan", at: iso(t - 10 * D), by: "buyer" },
      ],
      clientRef: "m1-seed000000000005",
    }, addrBa);

  const o6c = t - 4 * D;
  const o6 = mk("SD260902F4GH", "0901000002", haidang,
    [line(byTitle("Lưới rê 3 lớp"), 1)], o6c,
    {
      paymentMethod: "chuyen_khoan", status: "da_huy", paymentStatus: "bao_da_chuyen", bankSnapshot: bank,
      cancelBy: "seller", cancelReason: "Hết hàng, shop xin lỗi bà con", needsRefund: true,
      restockedAt: iso(o6c + 3 * H),
      timeline: [
        { status: "cho_xac_nhan", at: iso(o6c), by: "buyer" },
        { status: "bao_da_chuyen", at: iso(o6c + H), by: "buyer" },
        { status: "da_huy", at: iso(o6c + 3 * H), by: "seller", note: "Hết hàng, shop xin lỗi bà con" },
      ],
      clientRef: "m1-seed000000000006",
    }, addrTu);

  const orders = [o1, o2, o3, o4, o5, o6];

  const gps = byTitle("Máy định vị GPS Garmin 585 Plus");
  const aophao = byTitle("Áo phao cứu sinh");
  const bugi = byTitle("Bugi máy tàu NGK");
  const reviews: SeedReview[] = [
    { id: uuid(), orderId: o5.id, productId: gps.id, shopId: sdvico.id, buyerPhone: "0901000001", rating: 5, comment: "Máy bắt vệ tinh nhanh, màn sáng rõ ngoài nắng.", hidden: false, createdAt: iso(t - 9 * D) },
    { id: uuid(), orderId: o5.id, productId: aophao.id, shopId: sdvico.id, buyerPhone: "0901000001", rating: 4, comment: "Áo dày, dây chắc.", hidden: false, createdAt: iso(t - 9 * D) },
    { id: uuid(), orderId: o5.id, productId: bugi.id, shopId: sdvico.id, buyerPhone: "0901000001", rating: 1, comment: "Bán hàng qua số 09xx rẻ hơn", hidden: true, createdAt: iso(t - 8 * D) },
  ];

  // Điểm cache = tính lại từ đánh giá KHÔNG ẩn — cùng luật RPC market_recount_rating.
  for (const p of products) {
    const r = recountRating(reviews, p.id, p.shopId);
    p.ratingAvg = r.product.avg;
    p.ratingCount = r.product.count;
  }
  for (const s of shops) {
    const r = recountRating(reviews, "", s.id);
    s.ratingAvg = r.shop.avg;
    s.ratingCount = r.shop.count;
  }

  const notifications: SeedNotification[] = [
    { at: iso(o1c), phone: "0902000002", title: `Đơn mới ${o1.code}`, body: `${addrBa.name} đặt 30 món · ${o1.totalVnd.toLocaleString("vi-VN")} đ · Chuyển khoản`, url: `/ban-hang/don/${o1.id}`, pushOs: true },
  ];

  return { version: 1, shops, products, orders, reviews, sessions: {}, personas: DEV_PERSONAS, notifications };
}

/** Kiểm nhanh seed phủ đủ 9 danh mục (test dùng). */
export function seedCategoryCoverage(seed: DevSeed): Record<ProductCategory, number> {
  const out = Object.fromEntries(PRODUCT_CATEGORIES.map((c) => [c, 0])) as Record<ProductCategory, number>;
  for (const p of seed.products) out[p.category] += 1;
  return out;
}
