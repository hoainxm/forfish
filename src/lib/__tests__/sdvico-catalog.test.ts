import { describe, expect, it } from "vitest";
import {
  groupCatalog,
  groupIdOfSku,
  topicLabel,
  type CatalogProduct,
} from "@/lib/sdvico-catalog";

function p(sku: string | null, name: string): CatalogProduct {
  return { id: sku ?? name, sku, name, unit: "pcs", warrantyMonths: 12 };
}

describe("groupIdOfSku", () => {
  it("nhận diện dòng theo tiền tố SKU thật của CRM", () => {
    expect(groupIdOfSku("LN_TP_SEA700")).toBe("loc-nuoc");
    expect(groupIdOfSku("LD_SF50")).toBe("xu-ly-dau");
    expect(groupIdOfSku("NHOT_NANO_RMI15W40/18L")).toBe("nhot");
    expect(groupIdOfSku("NG_PG ADNANO_1L")).toBe("phu-gia");
    expect(groupIdOfSku("WF_WF V4")).toBe("internet-ve-tinh");
    expect(groupIdOfSku("SONPV_SEASHIN SMA")).toBe("son");
    expect(groupIdOfSku("AQ_220")).toBe("dien-lai");
    expect(groupIdOfSku("TL_TL")).toBe("dien-lai");
  });

  it("GS_VSS_ (Thuraya) = điện thoại vệ tinh, GS_ khác = giám sát hành trình", () => {
    expect(groupIdOfSku("GS_VSS_THURAYA")).toBe("dien-thoai-ve-tinh");
    expect(groupIdOfSku("GS_VSS_ANTEN 2025")).toBe("dien-thoai-ve-tinh");
    expect(groupIdOfSku("GS_VTL_2019")).toBe("giam-sat");
    expect(groupIdOfSku("GS_VISHIPEL")).toBe("giam-sat");
  });

  it("dịch vụ (DV_) và SKU lạ/trống → không vào dòng gợi ý", () => {
    expect(groupIdOfSku("DV_LD")).toBeNull();
    expect(groupIdOfSku("XYZ_123")).toBeNull();
    expect(groupIdOfSku(null)).toBeNull();
    expect(groupIdOfSku("")).toBeNull();
  });

  it("không phân biệt hoa thường", () => {
    expect(groupIdOfSku("ln_tp_sea700")).toBe("loc-nuoc");
  });
});

describe("groupCatalog", () => {
  const products = [
    p("LN_TP_SEA700", "Máy lọc nước biển thành nước ngọt Model MLN_SEA700"),
    p("LN_ML_3040", "Màng lọc RO nước biển 3040"),
    p("GS_VTL_2019", "Thiết bị giám sát tàu cá Viettel S-Tracking 2019"),
    p("GS_VSS_THURAYA", "Máy Thuraya MarineStar"),
    p("NG_PG ADNANO_1L", "Phụ gia AdNano"),
    p("DV_LD", "Dịch vụ lắp đặt"), // bỏ
    p(null, "Hàng không SKU"), // bỏ
  ];
  const groups = groupCatalog(products);

  it("chỉ giữ dòng có hàng, đúng thứ tự user liệt kê", () => {
    expect(groups.map((g) => g.id)).toEqual([
      "loc-nuoc",
      "phu-gia",
      "giam-sat",
      "dien-thoai-ve-tinh",
    ]);
    expect(groups[0].products).toHaveLength(2);
  });

  it("dòng nào cũng có nhãn + blurb tiếng đời thường, KHÔNG lộ model", () => {
    for (const g of groups) {
      expect(g.label.length).toBeGreaterThan(3);
      expect(g.blurb.length).toBeGreaterThan(10);
      expect(g.label).not.toMatch(/model|sku/i);
    }
  });
});

describe("showcase Khuyến nghị — sản phẩm chính từ sdvico.vn", () => {
  it("mỗi sản phẩm nối đúng một dòng SKU có thật + đủ ảnh/mô tả", async () => {
    const { SDVICO_SHOWCASE } = await import("@/data/sdvico-showcase");
    const { CATALOG_GROUPS } = await import("@/lib/sdvico-catalog");
    const lineIds = new Set(CATALOG_GROUPS.map((g) => g.id));
    expect(SDVICO_SHOWCASE.length).toBeGreaterThanOrEqual(6);
    for (const s of SDVICO_SHOWCASE) {
      expect(lineIds.has(s.line)).toBe(true);
      expect(s.image).toMatch(/^\/sdvico\/.+\.(jpg|png|webp)$/);
      expect(s.imgW).toBeGreaterThan(0);
      expect(s.imgH).toBeGreaterThan(0);
      expect(s.desc.length).toBeGreaterThan(10);
      expect(s.features.length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("topicLabel", () => {
  it("đổi id chủ đề sang nhãn; id lạ → Việc khác", () => {
    expect(topicLabel("mua")).toBe("Hỏi mua sản phẩm");
    expect(topicLabel("cuoc")).toBe("Hỏi cước / gia hạn");
    expect(topicLabel("xyz")).toBe("Việc khác");
  });
});
