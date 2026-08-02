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
  const { data, error } = await supabase
    .from(TABLE)
    .select(
      "id,vendor_kind,vendor_name,title,category,description,features,price_text,image_url,contact_phone,contact_note,line,visible,sort_order,created_at",
    )
    .eq("visible", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(200)
    // đồng hồ 12 giây (D-PH9) — hỏng thì rơi về danh mục tĩnh, nhưng không có
    // trần là để lại kết nối treo suốt phiên ở sóng "sống mà chết"
    .abortSignal(AbortSignal.timeout(12000));
  if (error || !data) return null;
  return (data as Row[]).map(rowToListing);
}
