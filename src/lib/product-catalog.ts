// DANH MỤC SẢN PHẨM/DỊCH VỤ do ADMIN quản lý (2026-07-28) — thay cho mảng
// cứng data/sdvico-showcase.ts. Admin ẩn/hiện/xóa/thêm trong /quan-tri, áp
// dụng NGAY cho app (đọc bảng Supabase `product_listings`, không cần build
// lại app). Gồm cả sản phẩm/dịch vụ SDVICO lẫn ĐƠN VỊ NGOÀI (vendor_kind
// 'external' + vendor_name + contact riêng) — sàn thông tin sản phẩm đơn giản.
//
// Đọc CÔNG KHAI (RLS visible=true, không cần đăng nhập) qua browser client —
// chưa cấu hình Supabase hoặc lỗi mạng → trả null, caller rơi về
// SDVICO_SHOWCASE tĩnh (demo mode, giữ nguyên hành vi cũ). Mảng rỗng = đã cấu
// hình nhưng admin chưa/đã xóa hết — KHÔNG fallback (đúng invariant demo mode).
//
// Helper thuần (validateProductDraft) tách riêng để test ở
// src/lib/__tests__/product-catalog.test.ts.

import { createClient } from "@/lib/supabase/client";
import { timeoutSignal } from "@/lib/abort";
import { isCatalogGroup, type CatalogGroupId } from "@/lib/catalog-groups";

export type VendorKind = "sdvico" | "external";

export interface ProductListing {
  id: string;
  vendorKind: VendorKind;
  /** Tên đơn vị ngoài SDWork — chỉ có khi vendorKind='external' */
  vendorName?: string;
  title: string;
  category?: string;
  description?: string;
  features: string[];
  priceText?: string;
  imageUrl?: string;
  contactPhone?: string;
  contactNote?: string;
  /** Nối nhóm SKU CRM để nhận diện "đang dùng" — chỉ áp dụng sdvico */
  line?: string;
  /** Nhóm Cửa hàng: điện tử / cơ điện / nhu yếu phẩm (0032). null = chưa gán. */
  group?: CatalogGroupId;
  /** Giá số VND — cần để đặt hàng. undefined = chưa niêm yết (chỉ hỏi mua). */
  priceVnd?: number;
  /** Đơn vị bán (kg, lít, thùng, cái…) — bắt buộc khi orderable. */
  unit?: string;
  /** Có nút "Thêm vào giỏ" hay không (0032). Mặc định false cho dòng cũ. */
  orderable: boolean;
  visible: boolean;
  sortOrder: number;
  createdAt: string;
}

/** Phần admin nhập khi thêm/sửa một sản phẩm trong danh mục. */
export interface ProductDraft {
  vendorKind: VendorKind;
  vendorName?: string;
  title: string;
  category?: string;
  description?: string;
  features: string[];
  priceText?: string;
  imageUrl?: string;
  contactPhone?: string;
  contactNote?: string;
  line?: string;
  group?: CatalogGroupId;
  priceVnd?: number;
  unit?: string;
  orderable: boolean;
  visible: boolean;
}

const TABLE = "product_listings";

// ── Helper THUẦN (test được) ───────────────────────────────────────────────

/** Trả câu lỗi tiếng Việt nếu draft chưa hợp lệ, null nếu OK. */
export function validateProductDraft(d: ProductDraft): string | null {
  if (!d.title.trim()) return "Nhập tên sản phẩm/dịch vụ.";
  if (d.vendorKind === "external") {
    if (!d.vendorName?.trim()) return "Nhập tên đơn vị (sản phẩm ngoài SDWork).";
    if (!d.contactPhone?.trim() && !d.contactNote?.trim())
      return "Nhập SĐT hoặc ghi chú liên hệ để bà con biết hỏi ai.";
  }
  // Cho đặt hàng ⇒ phải có giá số > 0 + đơn vị + nhóm (server tính tổng, gom nhóm).
  if (d.orderable) {
    if (d.priceVnd == null || !Number.isFinite(d.priceVnd) || d.priceVnd <= 0)
      return "Cho đặt hàng thì phải nhập giá (VND) lớn hơn 0.";
    if (!d.unit?.trim()) return "Nhập đơn vị bán (kg, lít, thùng, cái…).";
    if (!isCatalogGroup(d.group))
      return "Chọn nhóm hàng (điện tử / cơ điện / nhu yếu phẩm).";
  }
  return null;
}

type Row = {
  id: string;
  vendor_kind: string;
  vendor_name: string | null;
  title: string;
  category: string | null;
  description: string | null;
  features: unknown;
  price_text: string | null;
  image_url: string | null;
  contact_phone: string | null;
  contact_note: string | null;
  line: string | null;
  group: string | null;
  price_vnd: number | null;
  unit: string | null;
  orderable: boolean | null;
  visible: boolean;
  sort_order: number;
  created_at: string;
};

function toFeatures(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string");
}

/** Dòng DB → ProductListing (khoan dung với giá trị lạ, không ném lỗi). */
export function rowToListing(r: Row): ProductListing {
  return {
    id: r.id,
    vendorKind: r.vendor_kind === "external" ? "external" : "sdvico",
    vendorName: r.vendor_name ?? undefined,
    title: r.title,
    category: r.category ?? undefined,
    description: r.description ?? undefined,
    features: toFeatures(r.features),
    priceText: r.price_text ?? undefined,
    imageUrl: r.image_url ?? undefined,
    contactPhone: r.contact_phone ?? undefined,
    contactNote: r.contact_note ?? undefined,
    line: r.line ?? undefined,
    group: isCatalogGroup(r.group) ? r.group : undefined,
    priceVnd: typeof r.price_vnd === "number" ? r.price_vnd : undefined,
    unit: r.unit ?? undefined,
    orderable: r.orderable === true,
    visible: r.visible,
    sortOrder: r.sort_order,
    createdAt: r.created_at,
  };
}

// ── Đọc công khai (client) ─────────────────────────────────────────────────

/**
 * Danh mục đang HIỆN, sắp theo sort_order. null = Supabase chưa cấu hình
 * hoặc lỗi → caller rơi về SDVICO_SHOWCASE tĩnh. Mảng rỗng = admin chưa/đã
 * xóa hết sản phẩm — hiển thị thật, KHÔNG fallback.
 */
export async function fetchProductListings(): Promise<ProductListing[] | null> {
  const supabase = createClient();
  if (!supabase) return null;
  // đồng hồ 12 giây (D-PH9) — hỏng thì rơi về danh mục tĩnh, nhưng không có
  // trần là để lại kết nối treo suốt phiên ở sóng "sống mà chết".
  // `.abortSignal()` không nhận `undefined` sạch ⇒ gắn có điều kiện.
  const sig = timeoutSignal(12000);
  let q = supabase
    .from(TABLE)
    .select(
      "id,vendor_kind,vendor_name,title,category,description,features,price_text,image_url,contact_phone,contact_note,line,group,price_vnd,unit,orderable,visible,sort_order,created_at",
    )
    .eq("visible", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(200);
  if (sig) q = q.abortSignal(sig);
  const { data, error } = await q;
  if (error || !data) return null;
  const listings = (data as Row[]).map(rowToListing);
  saveCachedCatalog(listings);
  return listings;
}

/* ══════════════════════════════════════════════════════════════════════════
   BẢN LƯU DANH MỤC TRONG MÁY (2026-08-18, chủ dự án chốt)
   ══════════════════════════════════════════════════════════════════════════

   *"Cửa hàng nó ít đổi món và đơn, nên cứ xem bình thường, online lại thì tự
   động tải mới."*

   Đúng: danh mục đổi khi admin thêm/ẩn món — vài lần một tháng, không phải vài
   phút. Trước bản này mất sóng là `fetchProductListings` trả `null` ⇒ màn rơi
   về `SDVICO_SHOWCASE` tĩnh (mọi món `orderable: false`) ⇒ **nút giỏ ẩn, không
   thấy giá, giỏ đã soạn thành vô hình**. Nay giữ bản đã tải và xem bình thường;
   sóng về thì `fetchProductListings` tự ghi bản mới lên (nghe `online` ở
   `sdvico-catalog.tsx`).

   ⚠️ VÌ SAO ĐƯỢC LƯU Ở ĐÂY dù ADR 0004 nói khu ở-bờ không cache: cỡ dữ liệu.
   Danh mục ~200 món ≈ vài chục KB — không đáng kể so với hạn ngạch dùng chung
   theo origin (gói dự báo 16 ngày ~4 MB). Luật vẫn giữ nguyên tinh thần: KHÔNG
   lưu thứ NẶNG và KHÔNG lưu thứ đổi từng giờ.

   Ghi kiểu "hết chỗ thì thôi" (KHÔNG qua `saveUserJson`): dữ liệu này tải lại
   được, không được phép đẩy dự báo ra để lấy chỗ. Không có PII nên không cần
   ngăn theo SĐT — giá và tên món ai xem cũng như nhau. */

export const CATALOG_CACHE_KEY = "forfish.catalog.v1";

type CatalogCache = { savedAt: number; items: ProductListing[] };

/** Bản danh mục đã tải gần nhất + mốc lưu. `null` = chưa có/đọc không được. */
export function loadCachedCatalog(): CatalogCache | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CATALOG_CACHE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as CatalogCache;
    if (!v || typeof v.savedAt !== "number" || !Array.isArray(v.items)) return null;
    // lọc tối thiểu: món phải còn hình dạng dùng được (id + title)
    const items = v.items.filter(
      (p): p is ProductListing =>
        !!p && typeof p.id === "string" && typeof p.title === "string",
    );
    return items.length > 0 ? { savedAt: v.savedAt, items } : null;
  } catch {
    return null;
  }
}

/** Ghi bản danh mục vừa tải. Nuốt lỗi — hết chỗ thì thôi, không báo đỏ. */
export function saveCachedCatalog(items: ProductListing[]): void {
  if (typeof window === "undefined" || items.length === 0) return;
  try {
    const payload: CatalogCache = { savedAt: Date.now(), items };
    window.localStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify(payload));
  } catch {
    /* máy hết chỗ / bị chặn — danh mục tải lại được, không phải dữ liệu sống-còn */
  }
}
