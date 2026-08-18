import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearCachedOrders,
  loadCachedOrders,
  ordersBucket,
  saveCachedOrders,
  type CatalogOrder,
} from "@/lib/catalog-orders";
import {
  loadCachedCatalog,
  saveCachedCatalog,
  type ProductListing,
} from "@/lib/product-catalog";

/*  BẢN LƯU CỦA KHU CỬA HÀNG (2026-08-18, chủ dự án chốt: "cửa hàng nó ít đổi
 *  món và đơn, nên cứ xem bình thường, online lại thì tự động tải mới").
 *
 *  Hai bất biến khoá ở đây:
 *   1. CÁCH LY MÁY DÙNG CHUNG — đơn mang SĐT nhận hàng/điểm giao, ngăn của SĐT
 *      khác phải đọc ra RỖNG (cùng luật `inbox`/`cart`). Máy dùng chung trên
 *      tàu là ca thật, không phải giả thuyết.
 *   2. GHI HỎNG KHÔNG ĐƯỢC LÀM SẬP — kho đầy/bị chặn thì bỏ qua, vì đây là dữ
 *      liệu TẢI LẠI ĐƯỢC, tuyệt đối không được đẩy dự báo ra để lấy chỗ.
 */

const store = new Map<string, string>();
let choGhi = true;
const ls = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => {
    if (!choGhi) throw new Error("QuotaExceededError");
    store.set(k, v);
  },
  removeItem: (k: string) => void store.delete(k),
};

beforeEach(() => {
  store.clear();
  choGhi = true;
  vi.stubGlobal("window", { localStorage: ls });
});

const don = (id: string): CatalogOrder => ({
  id,
  customerPhone: "0901234567",
  items: [],
  totalVnd: 120000,
  contactPhone: "0901234567",
  status: "moi",
  createdAt: "2026-08-18T01:00:00.000Z",
  updatedAt: "2026-08-18T01:00:00.000Z",
});

const mon = (id: string): ProductListing => ({
  id,
  vendorKind: "sdvico",
  title: "Đá cây",
  features: [],
  priceVnd: 30000,
  unit: "cây",
  orderable: true,
  visible: true,
  sortOrder: 0,
  createdAt: "",
});

describe("bản lưu ĐƠN — ngăn theo SĐT", () => {
  it("ghi rồi đọc lại đúng đơn của SĐT đó, kèm mốc lưu", () => {
    saveCachedOrders("0901234567", [don("o1")]);
    const r = loadCachedOrders("0901234567");
    expect(r?.orders.map((o) => o.id)).toEqual(["o1"]);
    expect(typeof r?.savedAt).toBe("number");
  });

  it("SĐT KHÁC → rỗng (máy dùng chung không lộn đơn người trước)", () => {
    saveCachedOrders("0901234567", [don("o1")]);
    expect(loadCachedOrders("0912999888")).toBeNull();
    expect(loadCachedOrders(null)).toBeNull();
  });

  it("SĐT cùng người khác định dạng vẫn ra ĐÚNG ngăn", () => {
    saveCachedOrders("0901234567", [don("o1")]);
    expect(loadCachedOrders("84901234567")?.orders).toHaveLength(1);
    expect(ordersBucket("84901234567")).toBe(ordersBucket("0901234567"));
  });

  it("đăng xuất / gỡ máy → xoá sạch", () => {
    saveCachedOrders("0901234567", [don("o1")]);
    clearCachedOrders();
    expect(loadCachedOrders("0901234567")).toBeNull();
  });

  it("kho đầy → KHÔNG ném, chỉ là không có bản lưu", () => {
    choGhi = false;
    expect(() => saveCachedOrders("0901234567", [don("o1")])).not.toThrow();
    choGhi = true;
    expect(loadCachedOrders("0901234567")).toBeNull();
  });

  it("khoá giữ rác → đọc ra null, không ném", () => {
    store.set("forfish.orders.v1", "{khong-phai-json");
    expect(loadCachedOrders("0901234567")).toBeNull();
  });
});

describe("bản lưu DANH MỤC cửa hàng", () => {
  it("ghi rồi đọc lại được (không cần SĐT — giá ai xem cũng như nhau)", () => {
    saveCachedCatalog([mon("p1"), mon("p2")]);
    const r = loadCachedCatalog();
    expect(r?.items).toHaveLength(2);
    expect(typeof r?.savedAt).toBe("number");
  });

  it("KHÔNG ghi danh mục rỗng — rỗng là 'chưa tải được', không phải 'hết hàng'", () => {
    saveCachedCatalog([mon("p1")]);
    saveCachedCatalog([]);
    expect(loadCachedCatalog()?.items).toHaveLength(1);
  });

  it("món mất hình dạng (thiếu id/title) bị bỏ, không làm hỏng cả bản", () => {
    store.set(
      "forfish.catalog.v1",
      JSON.stringify({ savedAt: Date.now(), items: [mon("p1"), { id: 7 }] }),
    );
    expect(loadCachedCatalog()?.items.map((p) => p.id)).toEqual(["p1"]);
  });

  it("kho đầy → không ném", () => {
    choGhi = false;
    expect(() => saveCachedCatalog([mon("p1")])).not.toThrow();
  });
});
