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
  return (data as Row[]).map(rowToListing);
}
