import "server-only";
// Đọc bản nháp SẢN PHẨM từ body — dùng chung cho POST /san-pham và PATCH
// /san-pham/[id]. Chỉ NHẶT trường, không phán xét: luật là của
// `validateMarketProductDraft` + `normalizeProductStatus` (lib/market/validate.ts).
import type { Product, ProductDraftM, ProductStatus, Variant } from "@/lib/market/types";
import { normalizeProductStatus } from "@/lib/market/validate";
import { num, str } from "./_helpers";

function variantsFrom(v: unknown): Variant[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
    .map((x) => {
      const price = num(x.priceVnd);
      return { label: str(x.label) ?? "", ...(price != null ? { priceVnd: price } : {}) };
    });
}

function imagesFrom(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "") : [];
}

function statusFrom(v: unknown): ProductStatus {
  return v === "an" ? "an" : v === "het_hang" ? "het_hang" : "dang_ban";
}

/** Món MỚI — mọi trường lấy từ body; trạng thái chuẩn hoá theo tồn kho. */
export function productDraftFromBody(b: Record<string, unknown>): ProductDraftM {
  const stock = num(b.stock) ?? 0;
  const compareAt = num(b.compareAtVnd);
  /*  `priceVnd: null` trong body = LIÊN HỆ BÁO GIÁ (ADR 0011) — phải giữ null.
      `num(null)` trả undefined rồi `?? 0` biến thành 0, và validate chặn giá 0 ⇒
      shop không đăng nổi món báo-giá-theo-tàu. Thiếu hẳn khoá thì vẫn là 0 (lỗi
      thật, phải báo), khác hẳn với khai null có chủ ý. */
  const priceVnd = b.priceVnd === null ? null : num(b.priceVnd) ?? 0;
  return {
    title: str(b.title) ?? "",
    description: str(b.description),
    category: (typeof b.category === "string" ? b.category : "") as ProductDraftM["category"],
    priceVnd,
    ...(compareAt != null ? { compareAtVnd: compareAt } : {}),
    unit: str(b.unit) ?? "",
    stock,
    images: imagesFrom(b.images),
    variants: variantsFrom(b.variants),
    status: normalizeProductStatus(statusFrom(b.status), stock, priceVnd),
  };
}

/** Bản vá — chỉ những trường client GỬI. `compareAtVnd: null` = bỏ giá gạch. */
export function productPatchFromBody(b: Record<string, unknown>): Partial<ProductDraftM> {
  const p: Partial<ProductDraftM> = {};
  if ("title" in b) p.title = str(b.title) ?? "";
  if ("description" in b) p.description = str(b.description) ?? "";
  if ("category" in b) p.category = (typeof b.category === "string" ? b.category : "") as ProductDraftM["category"];
  if ("priceVnd" in b) p.priceVnd = num(b.priceVnd) ?? 0;
  if ("compareAtVnd" in b) p.compareAtVnd = num(b.compareAtVnd);
  if ("unit" in b) p.unit = str(b.unit) ?? "";
  if ("stock" in b) p.stock = num(b.stock) ?? 0;
  if ("images" in b) p.images = imagesFrom(b.images);
  if ("variants" in b) p.variants = variantsFrom(b.variants);
  if ("status" in b) p.status = statusFrom(b.status);
  return p;
}

/** Món SAU khi vá — để validate trên bản đầy đủ (vá không được đẻ ra món sai). */
export function mergedProductDraft(cur: Product, p: Partial<ProductDraftM>): ProductDraftM {
  const stock = "stock" in p ? p.stock ?? 0 : cur.stock;
  const compareAt = "compareAtVnd" in p ? p.compareAtVnd : cur.compareAtVnd;
  // vá `priceVnd: null` = chuyển món sang liên hệ báo giá; không có khoá thì giữ nguyên
  const priceVnd = "priceVnd" in p ? p.priceVnd ?? null : cur.priceVnd;
  return {
    title: "title" in p ? p.title ?? "" : cur.title,
    description: "description" in p ? p.description : cur.description,
    category: "category" in p ? p.category ?? cur.category : cur.category,
    priceVnd,
    ...(compareAt != null ? { compareAtVnd: compareAt } : {}),
    unit: "unit" in p ? p.unit ?? "" : cur.unit,
    stock,
    images: "images" in p ? p.images ?? [] : cur.images,
    variants: "variants" in p ? p.variants ?? [] : cur.variants,
    status: normalizeProductStatus("status" in p ? p.status ?? cur.status : cur.status, stock, priceVnd),
  };
}
