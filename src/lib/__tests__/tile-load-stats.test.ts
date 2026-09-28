import { describe, it, expect } from "vitest";
import { tallyStates, readTileTallies } from "@/lib/tile-load-stats";

describe("tallyStates", () => {
  it("% = ô xong ÷ (xong + đang tải + lỗi); unloaded không đếm", () => {
    const t = tallyStates("ocean-data", ["loaded", "loaded", "loading", "errored", "unloaded"]);
    expect(t).toEqual({ source: "ocean-data", total: 4, loaded: 2, loading: 1, errored: 1, pct: 50 });
  });

  it("reloading/expired vẫn đang hiện ảnh ⇒ tính là xong", () => {
    expect(tallyStates("b", ["reloading", "expired"]).pct).toBe(100);
  });

  it("chưa có ô nào ⇒ pct null (chưa biết), không phải 0%", () => {
    expect(tallyStates("b", []).pct).toBeNull();
  });
});

describe("readTileTallies", () => {
  const fakeManager = (states: string[]) => ({
    getIds: () => states.map((_, i) => String(i)),
    getTileByID: (id: string) => ({ state: states[Number(id)] }),
  });

  it("đọc tileManagers (MapLibre 5.x)", () => {
    const map = { style: { tileManagers: { basemap: fakeManager(["loaded", "errored"]) } } };
    expect(readTileTallies(map)).toEqual([
      { source: "basemap", total: 2, loaded: 1, loading: 0, errored: 1, pct: 50 },
    ]);
  });

  it("rơi về sourceCaches (MapLibre 4.x)", () => {
    const map = { style: { sourceCaches: { x: fakeManager(["loading"]) } } };
    expect(readTileTallies(map)[0].pct).toBe(0);
  });

  it("bản đồ chưa sẵn / sai hình ⇒ mảng rỗng, không ném", () => {
    expect(readTileTallies(null)).toEqual([]);
    expect(readTileTallies({})).toEqual([]);
    expect(readTileTallies({ style: { tileManagers: { a: {} } } })).toEqual([]);
  });
});
