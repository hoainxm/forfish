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
  it("nhận diện nhóm theo tiền tố SKU thật của CRM", () => {
    expect(groupIdOfSku("LN_TP_SEA700")).toBe("loc-nuoc");
    expect(groupIdOfSku("GS_VTL_2019")).toBe("giam-sat");
    expect(groupIdOfSku("GS_VSS_THURAYA")).toBe("giam-sat");
    expect(groupIdOfSku("WF_WF V4")).toBe("wifi");
    expect(groupIdOfSku("LD_SF50")).toBe("loc-dau");
    expect(groupIdOfSku("NHOT_NANO_RMI15W40/18L")).toBe("nhot");
    expect(groupIdOfSku("SONPV_SEASHIN SMA")).toBe("son");
    expect(groupIdOfSku("AQ_220")).toBe("dien-lai");
  });

  it("dịch vụ (DV_) và SKU lạ/trống → không vào nhóm gợi ý", () => {
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
    p("LN_TP_SEA250", "Máy lọc nước biển thành nước ngọt Model SEA250"),
    p("LN_ML_3040", "Màng lọc RO nước biển 3040"),
    p("LN_CD_35", "Cổ dê 35"),
    p("GS_VTL_2019", "Thiết bị giám sát tàu cá Viettel S-Tracking 2019"),
    p("DV_LD", "Dịch vụ lắp đặt"), // bỏ
    p(null, "Hàng không SKU"), // bỏ
  ];
  const groups = groupCatalog(products);

  it("chỉ giữ nhóm có hàng, đúng thứ tự định nghĩa", () => {
    expect(groups.map((g) => g.id)).toEqual(["loc-nuoc", "giam-sat"]);
    expect(groups[0].products).toHaveLength(4);
  });

  it("món tiêu biểu = máy/thiết bị chính, khử model gần trùng, tối đa 2", () => {
    const h = groups[0].highlights;
    expect(h).toHaveLength(1); // 2 máy cùng tên gốc → khử còn 1
    expect(h[0]).toBe("Máy lọc nước biển thành nước ngọt");
    expect(groups[1].highlights[0]).toContain("Thiết bị giám sát");
  });

  it("nhóm nào cũng có blurb tiếng đời thường", () => {
    for (const g of groups) {
      expect(g.blurb.length).toBeGreaterThan(10);
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
