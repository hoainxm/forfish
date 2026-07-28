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
