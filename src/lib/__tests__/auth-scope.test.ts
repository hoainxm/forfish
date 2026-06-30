import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  syncAuthScope,
  __USER_SCOPED_KEYS_FOR_TEST,
  __LAST_PHONE_KEY_FOR_TEST,
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
vi.stubGlobal("window", { localStorage: store });

beforeEach(() => {
  store.clear();
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
});
