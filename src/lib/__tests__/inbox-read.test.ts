import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/* localStorage mock (env node — không jsdom), khớp mẫu boat-store.test */
const _ls = (() => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() {
      return m.size;
    },
  } as unknown as Storage;
})();
(globalThis as unknown as { window: unknown }).window = { localStorage: _ls };
(globalThis as unknown as { localStorage: Storage }).localStorage = _ls;

import {
  INBOX_READ_KEY,
  clearInbox,
  markRead,
  unreportedIds,
} from "@/lib/inbox";

/* navigator của Node là getter (không gán đè được) và KHÔNG có onLine — đúng
   như trình duyệt chưa biết trạng thái mạng, tức nhánh "cứ thử gửi". */
const offline = () => vi.stubGlobal("navigator", { onLine: false });

beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

/** fetch giả trả `ok:true` — đếm số lần bị gọi */
function stubFetch(res: { httpOk?: boolean; ok?: boolean } = {}) {
  const calls: unknown[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init?: { body?: string }) => {
      calls.push(init?.body ? JSON.parse(init.body) : null);
      return {
        ok: res.httpOk ?? true,
        json: async () => ({ ok: res.ok ?? true }),
      };
    }),
  );
  return calls;
}

describe("unreportedIds — mở app lần thứ mười không gọi lại", () => {
  it("chưa báo lần nào → trả hết", () => {
    expect(unreportedIds("0900000001", ["a", "b"])).toEqual(["a", "b"]);
  });

  it("đã báo được rồi → loại ra", async () => {
    const calls = stubFetch();
    await markRead("0900000001", ["a"]);
    expect(calls).toHaveLength(1);
    expect(unreportedIds("0900000001", ["a", "b"])).toEqual(["b"]);
  });

  it("ĐỔI TÀI KHOẢN trên cùng máy → coi như chưa báo (người khác đọc là việc khác)", async () => {
    stubFetch();
    await markRead("0900000001", ["a"]);
    expect(unreportedIds("0900000002", ["a"])).toEqual(["a"]);
    // khách chưa đăng nhập cũng là một ngăn riêng
    expect(unreportedIds(null, ["a"])).toEqual(["a"]);
  });
});

describe("markRead — biên nhận KHÔNG được cản việc đọc tin", () => {
  it("mất sóng (onLine=false) → không gọi mạng, KHÔNG ghi là đã báo", async () => {
    offline();
    const calls = stubFetch();
    await markRead("0900000001", ["a"]);
    expect(calls).toHaveLength(0);
    // quan trọng: lần sau có sóng phải báo lại, không được mất luôn
    expect(unreportedIds("0900000001", ["a"])).toEqual(["a"]);
  });

  it("máy chủ lỗi (HTTP không ok) → KHÔNG ghi là đã báo", async () => {
    stubFetch({ httpOk: false });
    await markRead("0900000001", ["a"]);
    expect(unreportedIds("0900000001", ["a"])).toEqual(["a"]);
  });

  it("máy chủ trả ok:false → KHÔNG ghi là đã báo", async () => {
    stubFetch({ ok: false });
    await markRead("0900000001", ["a"]);
    expect(unreportedIds("0900000001", ["a"])).toEqual(["a"]);
  });

  it("fetch ném (mất sóng giữa chừng / hết giờ) → nuốt lỗi, không ném ra ngoài", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network");
      }),
    );
    await expect(markRead("0900000001", ["a"])).resolves.toBeUndefined();
    expect(unreportedIds("0900000001", ["a"])).toEqual(["a"]);
  });

  it("danh sách rỗng → không gọi mạng", async () => {
    const calls = stubFetch();
    await markRead("0900000001", []);
    expect(calls).toHaveLength(0);
  });

  it("client KHÔNG khai mình là ai — thân request không mang SĐT/danh tính", async () => {
    const calls = stubFetch();
    await markRead("0900000001", ["a", "b"]);
    const sent = calls[0] as Record<string, unknown>;
    expect(sent.ids).toEqual(["a", "b"]);
    // chỉ được có ids (+endpoint của CHÍNH máy này); SĐT do máy chủ lấy từ phiên
    expect(Object.keys(sent).every((k) => k === "ids" || k === "endpoint")).toBe(
      true,
    );
    expect(JSON.stringify(sent)).not.toContain("0900000001");
  });
});

describe("clearInbox — máy dùng chung trên tàu", () => {
  it("đăng xuất xoá luôn sổ đã-báo, không để lại dấu của người trước", async () => {
    stubFetch();
    await markRead("0900000001", ["a"]);
    expect(localStorage.getItem(INBOX_READ_KEY)).not.toBeNull();
    clearInbox();
    expect(localStorage.getItem(INBOX_READ_KEY)).toBeNull();
  });

  it("khoá theo quy ước forfish.* (state-registry)", () => {
    expect(INBOX_READ_KEY.startsWith("forfish.")).toBe(true);
  });
});

/* ── SERVICE WORKER ────────────────────────────────────────────────────────
   Lỗi thật đã dính: cú fetch báo "đã đọc" nằm NGOÀI waitUntil ⇒ trình duyệt
   giết service worker ngay khi mở xong cửa sổ, cắt request đang bay. iOS giết
   SW rất mạnh tay đúng lúc PWA bật lên foreground, nên bà con CÓ bấm mà cột
   "đọc" vẫn không lên. Test đọc thẳng sw.js để không tái phát. */
describe("sw.js notificationclick — cú báo 'đã đọc' phải sống tới lúc gửi xong", () => {
  const sw = readFileSync(join(process.cwd(), "public", "sw.js"), "utf8");
  const handler = sw.slice(sw.indexOf('addEventListener("notificationclick"'));
  const body = handler.slice(0, handler.indexOf("\n});"));

  it("waitUntil giữ CẢ cú ack lẫn việc mở cửa sổ", () => {
    expect(body).toMatch(/waitUntil\(\s*Promise\.all\(\[\s*focus,\s*ack\s*\]\)/);
  });

  it("ack được dựng thành promise rồi mới đưa vào waitUntil (không bắn rời)", () => {
    expect(body).toMatch(/const ack =/);
    // nuốt lỗi: biên nhận hỏng không được cản bà con vào app
    expect(body).toMatch(/\.catch\(\(\) => \{\}\)/);
  });

  it("nhánh push cũng giữ nguyên luật đó (đã đúng từ 0023, chống rơi lại)", () => {
    const push = sw.slice(sw.indexOf('addEventListener("push"'));
    expect(push).toMatch(/waitUntil\(\s*Promise\.all\(\[/);
  });
});
