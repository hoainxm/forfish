// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ĐỔI KHOÁ VAPID (2026-10-07): lúc mở app heartbeat + hero-account gọi
// syncPushAccount CÙNG LÚC. Lượt sau không được POST endpoint CŨ đè lên lúc
// lượt đầu vừa hủy — để lại một dòng 403 vĩnh viễn trên server.

const OLD_KEY = "BA7gxuKUApzkQIdGEDwnTC";
const NEW_KEY = "ZZ7gxuKUApzkQIdGEDwnTC";

function bytes(k: string): ArrayBuffer {
  const s = atob(k.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (k.length % 4)) % 4));
  return Uint8Array.from(s, (c) => c.charCodeAt(0)).buffer as ArrayBuffer;
}

function fakeSub(endpoint: string, key: string) {
  return {
    endpoint,
    options: { applicationServerKey: bytes(key) },
    toJSON: () => ({ endpoint, keys: { p256dh: "p", auth: "a" } }),
    unsubscribe: vi.fn(async () => {
      current = null;
      return true;
    }),
  };
}

let current: ReturnType<typeof fakeSub> | null;
let posted: Array<{ endpoint: string; oldEndpoint?: string }>;
let subscribeImpl: () => Promise<unknown>;

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  current = fakeSub("https://push/old", OLD_KEY);
  posted = [];
  subscribeImpl = async () => {
    current = fakeSub("https://push/new", NEW_KEY);
    return current;
  };
  const reg = {
    pushManager: {
      getSubscription: async () => current,
      subscribe: () => subscribeImpl(),
    },
  };
  vi.stubGlobal("Notification", { permission: "granted" });
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: { ready: Promise.resolve(reg) },
  });
  vi.stubGlobal("PushManager", function PushManager() {});
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("vapid-public-key")) {
        return new Response(JSON.stringify({ key: NEW_KEY }), { status: 200 });
      }
      const body = JSON.parse(String(init?.body));
      posted.push({ endpoint: body.subscription.endpoint, oldEndpoint: body.oldEndpoint });
      return new Response(JSON.stringify({ ok: true, attached: true }), { status: 200 });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("syncPushAccount — đổi khoá VAPID", () => {
  it("hai lượt gọi cùng lúc: hủy MỘT lần, không lượt nào POST lại endpoint cũ", async () => {
    const { syncPushAccount } = await import("@/lib/push-client");
    const old = current!;
    const [a, b] = await Promise.all([syncPushAccount(), syncPushAccount()]);
    expect([a, b]).toEqual(["attached", "attached"]);
    expect(old.unsubscribe).toHaveBeenCalledTimes(1);
    expect(posted.map((p) => p.endpoint)).toEqual(["https://push/new", "https://push/new"]);
    expect(posted[0].oldEndpoint).toBe("https://push/old");
    expect(localStorage.getItem("forfish.push.rekey.v1")).toBeNull();
  });

  it("subscribe treo (sóng sống mà chết) → hết 15s trả failed, GIỮ dấu để lần sau làm nốt", async () => {
    subscribeImpl = () => new Promise(() => {}); // không bao giờ xong
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    const { syncPushAccount } = await import("@/lib/push-client");
    const run = syncPushAccount();
    await vi.advanceTimersByTimeAsync(15_000);
    expect(await run).toBe("failed");
    expect(posted).toEqual([]);
    expect(JSON.parse(localStorage.getItem("forfish.push.rekey.v1")!).oldEndpoint).toBe("https://push/old");
  });
});
