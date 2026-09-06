import { afterEach, describe, it, expect, vi } from "vitest";
import { isFavorite, loadFavorites, MARKET_FAV_KEY, saveFavorites, toggleFavorite, type FavItem } from "@/lib/market/favorites";
import { FAVORITES_MAX } from "@/lib/market/validate";

const fav = (id: string, savedAt = 1): FavItem => ({
  productId: id, savedAt, snapshot: { title: `Món ${id}`, priceVnd: 1000, shopName: "SDVICO" },
});

describe("toggleFavorite / isFavorite", () => {
  it("chưa ⇒ thêm đầu; có ⇒ bỏ", () => {
    let list = toggleFavorite([], fav("a", 1));
    list = toggleFavorite(list, fav("b", 2));
    expect(list.map((x) => x.productId)).toEqual(["b", "a"]);
    expect(isFavorite(list, "a")).toBe(true);
    list = toggleFavorite(list, fav("a", 3));
    expect(list.map((x) => x.productId)).toEqual(["b"]);
    expect(isFavorite(list, "a")).toBe(false);
  });
  it("đầy 100 ⇒ bỏ cũ nhất", () => {
    let list: FavItem[] = [];
    for (let i = 0; i < FAVORITES_MAX; i++) list = toggleFavorite(list, fav(`p${i}`, i + 10));
    expect(list).toHaveLength(FAVORITES_MAX);
    list = toggleFavorite(list, fav("moi", 9999));
    expect(list).toHaveLength(FAVORITES_MAX);
    expect(list[0].productId).toBe("moi");
    expect(isFavorite(list, "p0")).toBe(false);
    expect(isFavorite(list, "p1")).toBe(true);
  });
});

describe("ngăn SĐT", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("save/load; ngăn khác ⇒ []; JSON hỏng ⇒ []", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
        removeItem: (k: string) => void store.delete(k),
      },
    });
    expect(saveFavorites("0901000001", [fav("a")])).toBe(true);
    expect(loadFavorites("0901000001")).toEqual([fav("a")]);
    expect(loadFavorites("0902000002")).toEqual([]);
    expect(loadFavorites(undefined)).toEqual([]);
    store.set(MARKET_FAV_KEY, "[");
    expect(loadFavorites("0901000001")).toEqual([]);
  });
});
