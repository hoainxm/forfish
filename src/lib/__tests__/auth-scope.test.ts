import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearUserScopedData,
  purgeApiCache,
  shouldReloadForScope,
  syncAuthScope,
  __USER_SCOPED_KEYS_FOR_TEST,
  __LAST_PHONE_KEY_FOR_TEST,
  __RELOAD_AT_KEY_FOR_TEST,
} from "@/lib/auth-scope";

function makeStore() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    get raw() {
      return map;
    },
  };
}

const store = makeStore();
const session = makeStore();
vi.stubGlobal("window", { localStorage: store, sessionStorage: session });

beforeEach(() => {
  store.clear();
  session.clear();
});

describe("syncAuthScope", () => {
  it("phone đầu tiên (last null) → xoá data + lưu phone (an toàn cho login đầu)", () => {
    store.setItem("forfish.boats.v1", JSON.stringify(["boat-A"]));
    store.setItem("forfish.documents.v1", "[]");

    expect(syncAuthScope("0901111111")).toBe(true);

    for (const k of __USER_SCOPED_KEYS_FOR_TEST) expect(store.getItem(k)).toBe(null);
    expect(store.getItem(__LAST_PHONE_KEY_FOR_TEST)).toBe("0901111111");
  });

  it("cùng phone gọi lại → no-op (giữ data hiện tại)", () => {
    store.setItem(__LAST_PHONE_KEY_FOR_TEST, "0901111111");
    store.setItem("forfish.boats.v1", JSON.stringify(["boat-A"]));

    expect(syncAuthScope("0901111111")).toBe(false);
    expect(store.getItem("forfish.boats.v1")).toBe(JSON.stringify(["boat-A"]));
  });

  it("đổi user (A → B) → xoá data A, lưu phone B", () => {
    store.setItem(__LAST_PHONE_KEY_FOR_TEST, "0901111111");
    store.setItem("forfish.boats.v1", JSON.stringify(["boat-A"]));
    store.setItem("forfish.documents.v1", JSON.stringify(["doc-A"]));
    store.setItem("forfish.displaymode.v1", "to"); // UI prefs giữ

    expect(syncAuthScope("0902222222")).toBe(true);

    expect(store.getItem("forfish.boats.v1")).toBe(null);
    expect(store.getItem("forfish.documents.v1")).toBe(null);
    expect(store.getItem("forfish.displaymode.v1")).toBe("to");
    expect(store.getItem(__LAST_PHONE_KEY_FOR_TEST)).toBe("0902222222");
  });

  it("logout (phone null + có last) → xoá data + xoá tracking", () => {
    store.setItem(__LAST_PHONE_KEY_FOR_TEST, "0901111111");
    store.setItem("forfish.boats.v1", JSON.stringify(["boat-A"]));
    store.setItem("forfish.maplayer.v1", "satellite"); // UI prefs giữ

    expect(syncAuthScope(null)).toBe(true);

    expect(store.getItem("forfish.boats.v1")).toBe(null);
    expect(store.getItem(__LAST_PHONE_KEY_FOR_TEST)).toBe(null);
    expect(store.getItem("forfish.maplayer.v1")).toBe("satellite");
  });

  it("logout khi không có last → no-op", () => {
    expect(syncAuthScope(null)).toBe(false);
  });

  it("xoá HẾT các key trong USER_SCOPED_KEYS (regression: thêm key mới phải nhớ scope)", () => {
    for (const k of __USER_SCOPED_KEYS_FOR_TEST) store.setItem(k, "data");
    store.setItem(__LAST_PHONE_KEY_FOR_TEST, "0901111111");

    syncAuthScope("0902222222");

    for (const k of __USER_SCOPED_KEYS_FOR_TEST) expect(store.getItem(k)).toBe(null);
  });

  it("đổi user → xoá cả gán SDVICO + dấu premium (không rò sang tài khoản sau)", () => {
    expect(__USER_SCOPED_KEYS_FOR_TEST).toContain("forfish.sdvico-boat.v1");
    expect(__USER_SCOPED_KEYS_FOR_TEST).toContain("forfish.tier.premium.v1");

    store.setItem(__LAST_PHONE_KEY_FOR_TEST, "0901111111");
    store.setItem("forfish.sdvico-boat.v1", JSON.stringify({ "asset-A": "boat-A" }));
    store.setItem("forfish.tier.premium.v1", "1"); // A là premium

    expect(syncAuthScope("0902222222")).toBe(true);

    expect(store.getItem("forfish.sdvico-boat.v1")).toBe(null);
    expect(store.getItem("forfish.tier.premium.v1")).toBe(null);
  });
});

describe("purgeApiCache — nhờ SW xoá kho /api/* (bản cache riêng tư user cũ)", () => {
  it("có SW controller → postMessage đúng type", () => {
    const posted: unknown[] = [];
    vi.stubGlobal("navigator", {
      serviceWorker: { controller: { postMessage: (m: unknown) => posted.push(m) } },
    });
    purgeApiCache();
    expect(posted).toEqual([{ type: "forfish:purge-api-cache" }]);
    vi.stubGlobal("navigator", undefined);
  });

  it("không có SW (chưa control / trình duyệt cũ) → không ném", () => {
    vi.stubGlobal("navigator", { serviceWorker: { controller: null } });
    expect(() => purgeApiCache()).not.toThrow();
    vi.stubGlobal("navigator", undefined);
  });
});

describe("shouldReloadForScope — circuit-breaker chống vòng lặp reload", () => {
  it("lần đầu (chưa có mốc) → cho reload + ghi mốc", () => {
    expect(shouldReloadForScope(1_000_000)).toBe(true);
    expect(session.getItem(__RELOAD_AT_KEY_FOR_TEST)).toBe("1000000");
  });

  it("gọi lại NGAY trong cửa sổ 5s → CHẶN reload (bug nhấp nháy vô hạn)", () => {
    expect(shouldReloadForScope(1_000_000)).toBe(true);
    expect(shouldReloadForScope(1_000_050)).toBe(false); // +50ms
    expect(shouldReloadForScope(1_004_999)).toBe(false); // +4.999s
  });

  it("qua khỏi cửa sổ 5s (đổi user thật) → cho reload lại", () => {
    expect(shouldReloadForScope(1_000_000)).toBe(true);
    expect(shouldReloadForScope(1_005_001)).toBe(true); // +5.001s
    expect(session.getItem(__RELOAD_AT_KEY_FOR_TEST)).toBe("1005001");
  });

  it("mô phỏng flap user↔null liên tục → chỉ reload 1 lần rồi thôi", () => {
    // Trước fix: mỗi lần đảo lại reload → vô hạn. Giờ chỉ lần đầu true.
    const t = 2_000_000;
    const results = [0, 1, 2, 3, 5, 8].map((ms) => shouldReloadForScope(t + ms));
    expect(results).toEqual([true, false, false, false, false, false]);
  });
});

describe("clearUserScopedData", () => {
  it("xoá data KH nhưng GIỮ tracking phone (dùng cho pagehide re-clear)", () => {
    for (const k of __USER_SCOPED_KEYS_FOR_TEST) store.setItem(k, "data");
    store.setItem(__LAST_PHONE_KEY_FOR_TEST, "0901111111");
    store.setItem("forfish.displaymode.v1", "to");

    clearUserScopedData();

    for (const k of __USER_SCOPED_KEYS_FOR_TEST) expect(store.getItem(k)).toBe(null);
    expect(store.getItem(__LAST_PHONE_KEY_FOR_TEST)).toBe("0901111111");
    expect(store.getItem("forfish.displaymode.v1")).toBe("to");
  });

  it("data hồi sinh giữa clear và reload → gọi lại vẫn xoá sạch (đóng race)", () => {
    store.setItem(__LAST_PHONE_KEY_FOR_TEST, "0901111111");
    store.setItem("forfish.boats.v1", "boat-A");
    syncAuthScope(null); // clear lần 1
    store.setItem("forfish.boats.v1", "boat-A"); // save-effect ghi ngược

    clearUserScopedData(); // pagehide xoá lần cuối

    expect(store.getItem("forfish.boats.v1")).toBe(null);
  });
});
