import { afterEach, describe, it, expect, vi } from "vitest";
import {
  loadAddresses,
  MARKET_ADDR_KEY,
  removeAddress,
  saveAddresses,
  seedAddress,
  setDefaultAddress,
  upsertAddress,
  type SavedAddress,
} from "@/lib/market/addresses";
import { ADDRESS_MAX } from "@/lib/market/validate";

const a = (id: string, p: Partial<SavedAddress> = {}): SavedAddress => ({
  id, name: "Ba", phone: "0901000001", province: "Khánh Hòa", detail: `Cảng ${id}`, isPort: true, isDefault: false, ...p,
});

function fakeWindow(throwOnSet = false) {
  const store = new Map<string, string>();
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        if (throwOnSet) throw new Error("full");
        store.set(k, v);
      },
      removeItem: (k: string) => void store.delete(k),
    },
    dispatchEvent: () => true,
  });
  return store;
}

describe("upsert / setDefault / remove — THUẦN", () => {
  it("thêm đầu tiên tự thành mặc định; sửa theo id; chỉ một isDefault", () => {
    let list = upsertAddress([], a("1"));
    expect(list[0].isDefault).toBe(true);
    list = upsertAddress(list, a("2", { isDefault: true }));
    expect(list.map((x) => x.isDefault)).toEqual([false, true]);
    list = upsertAddress(list, a("1", { detail: "Cảng mới" }));
    expect(list[0].detail).toBe("Cảng mới");
    expect(list).toHaveLength(2);
  });
  it("đầy 10 ⇒ thay cái cũ nhất KHÔNG default", () => {
    let list: SavedAddress[] = [];
    for (let i = 0; i < ADDRESS_MAX; i++) list = upsertAddress(list, a(`${i}`, { isDefault: i === 0 }));
    expect(list).toHaveLength(ADDRESS_MAX);
    list = upsertAddress(list, a("new"));
    expect(list).toHaveLength(ADDRESS_MAX);
    expect(list.find((x) => x.id === "1")).toBeUndefined(); // cái cũ nhất không default bị thay
    expect(list.find((x) => x.id === "0")?.isDefault).toBe(true);
    expect(list.at(-1)?.id).toBe("new");
  });
  it("setDefault đổi đúng một; remove mặc định ⇒ cái đầu thành mặc định", () => {
    const list = [a("1", { isDefault: true }), a("2"), a("3")];
    expect(setDefaultAddress(list, "3").map((x) => x.isDefault)).toEqual([false, false, true]);
    expect(setDefaultAddress(list, "zzz")).toBe(list);
    const rem = removeAddress(list, "1");
    expect(rem.map((x) => x.id)).toEqual(["2", "3"]);
    expect(rem[0].isDefault).toBe(true);
    expect(removeAddress([a("1", { isDefault: true })], "1")).toEqual([]);
  });
  it("seedAddress: tên/SĐT/tỉnh, detail rỗng, isPort mặc định", () => {
    expect(seedAddress({ name: " Ba ", phone: "0901000001", province: "Khánh Hòa" })).toEqual({
      name: "Ba", phone: "0901000001", province: "Khánh Hòa", detail: "", isPort: true,
    });
    expect(seedAddress({ phone: "0901000001" }).province).toBe("");
  });
});

describe("ngăn SĐT", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("save/load cùng số; ngăn khác ⇒ []; máy đầy ⇒ false", () => {
    const store = fakeWindow();
    expect(saveAddresses("0901000001", [a("1", { isDefault: true })])).toBe(true);
    expect(loadAddresses("0901000001")).toEqual([a("1", { isDefault: true })]);
    expect(loadAddresses("0902000002")).toEqual([]);
    store.set(MARKET_ADDR_KEY, "{hỏng");
    expect(loadAddresses("0901000001")).toEqual([]);
    vi.unstubAllGlobals();
    fakeWindow(true);
    expect(saveAddresses("0901000001", [a("1")])).toBe(false);
  });
});
