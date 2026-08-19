import { describe, expect, it } from "vitest";
import {
  rowToListing,
  validateProductDraft,
  type ProductDraft,
} from "@/lib/product-catalog";

function draft(over: Partial<ProductDraft> = {}): ProductDraft {
  return {
    vendorKind: "sdvico",
    title: "Máy lọc nước biển SEA-40",
    features: [],
    orderable: false,
    visible: true,
    ...over,
  };
}

describe("validateProductDraft", () => {
  it("sdvico chỉ cần tên → hợp lệ", () => {
    expect(validateProductDraft(draft())).toBeNull();
  });
  it("thiếu tên → báo lỗi", () => {
    expect(validateProductDraft(draft({ title: "  " }))).toMatch(/tên/i);
  });
  it("external thiếu tên đơn vị → báo lỗi", () => {
    expect(
      validateProductDraft(draft({ vendorKind: "external", title: "Lưới rê" })),
    ).toMatch(/đơn vị/i);
  });
  it("external có tên đơn vị nhưng không SĐT/ghi chú → báo lỗi", () => {
    expect(
      validateProductDraft(
        draft({ vendorKind: "external", title: "Lưới rê", vendorName: "Cơ sở A" }),
      ),
    ).toMatch(/liên hệ/i);
  });
  it("external đủ tên đơn vị + SĐT hoặc ghi chú → hợp lệ", () => {
    expect(
      validateProductDraft(
        draft({
          vendorKind: "external",
          title: "Lưới rê",
          vendorName: "Cơ sở A",
          contactPhone: "0901234567",
        }),
      ),
    ).toBeNull();
    expect(
      validateProductDraft(
        draft({
          vendorKind: "external",
          title: "Lưới rê",
          vendorName: "Cơ sở A",
          contactNote: "Ghé chợ Vũng Tàu, quầy 12",
        }),
      ),
    ).toBeNull();
  });

  it("cho đặt hàng nhưng thiếu giá → báo lỗi giá", () => {
    expect(
      validateProductDraft(
        draft({ orderable: true, unit: "thùng", group: "nhu_yeu_pham" }),
      ),
    ).toMatch(/giá/i);
    expect(
      validateProductDraft(
        draft({ orderable: true, priceVnd: 0, unit: "thùng", group: "nhu_yeu_pham" }),
      ),
    ).toMatch(/giá/i);
  });
  it("cho đặt hàng nhưng thiếu đơn vị → báo lỗi đơn vị", () => {
    expect(
      validateProductDraft(
        draft({ orderable: true, priceVnd: 50000, group: "nhu_yeu_pham" }),
      ),
    ).toMatch(/đơn vị/i);
  });
  it("cho đặt hàng nhưng thiếu nhóm → báo lỗi nhóm", () => {
    expect(
      validateProductDraft(draft({ orderable: true, priceVnd: 50000, unit: "thùng" })),
    ).toMatch(/nhóm/i);
  });
  it("cho đặt hàng đủ giá + đơn vị + nhóm → hợp lệ", () => {
    expect(
      validateProductDraft(
        draft({
          orderable: true,
          priceVnd: 50000,
          unit: "thùng",
          group: "nhu_yeu_pham",
        }),
      ),
    ).toBeNull();
  });
});

describe("rowToListing", () => {
  const baseRow = {
    id: "row-1",
    vendor_kind: "sdvico",
    vendor_name: null,
    title: "Máy lọc nước biển SEA-40",
    category: "Máy lọc nước biển",
    description: "Mô tả",
    features: ["Công nghệ RO"],
    price_text: null,
    image_url: "/sdvico/sea40.jpg",
    contact_phone: null,
    contact_note: null,
    line: "loc-nuoc",
    group: null,
    price_vnd: null,
    unit: null,
    orderable: false,
    visible: true,
    sort_order: 0,
    created_at: "2026-07-28T00:00:00Z",
  };

  it("map đúng field + features là mảng chuỗi", () => {
    const listing = rowToListing(baseRow);
    expect(listing.vendorKind).toBe("sdvico");
    expect(listing.title).toBe("Máy lọc nước biển SEA-40");
    expect(listing.features).toEqual(["Công nghệ RO"]);
    expect(listing.visible).toBe(true);
    expect(listing.orderable).toBe(false);
  });

  it("map trường đặt hàng: group/price_vnd/unit/orderable", () => {
    const listing = rowToListing({
      ...baseRow,
      group: "nhu_yeu_pham",
      price_vnd: 120000,
      unit: "thùng",
      orderable: true,
    });
    expect(listing.group).toBe("nhu_yeu_pham");
    expect(listing.priceVnd).toBe(120000);
    expect(listing.unit).toBe("thùng");
    expect(listing.orderable).toBe(true);
  });

  it("group lạ → undefined; orderable không phải true → false", () => {
    const listing = rowToListing({ ...baseRow, group: "xyz", orderable: 1 as unknown as boolean });
    expect(listing.group).toBeUndefined();
    expect(listing.orderable).toBe(false);
  });

  it("vendor_kind lạ → về sdvico; features không phải mảng → rỗng", () => {
    const listing = rowToListing({
      ...baseRow,
      vendor_kind: "khac",
      features: "not-an-array",
    });
    expect(listing.vendorKind).toBe("sdvico");
    expect(listing.features).toEqual([]);
  });

  it("vendor_kind='external' giữ nguyên", () => {
    const listing = rowToListing({
      ...baseRow,
      vendor_kind: "external",
      vendor_name: "Cơ sở A",
    });
    expect(listing.vendorKind).toBe("external");
    expect(listing.vendorName).toBe("Cơ sở A");
  });
});
