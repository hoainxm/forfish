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
  INBOX_KEY,
  INBOX_READ_KEY,
  acceptRefresh,
  clearInbox,
  inboxBucket,
  loadInbox,
  markRead,
  refreshInbox,
  unreportedIds,
} from "@/lib/inbox";
import { normalizeVnPhone } from "@/lib/phone";
import { offlineIdentityPhone, rememberIdentity } from "@/lib/offline-identity";

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

/* ── NGĂN LƯU: client và server phải gọi CÙNG MỘT TÊN ──────────────────────
   Máy chủ (src/app/api/me/messages/route.ts) ghi ngăn bằng
   `normalizeVnPhone(email.split("@")[0])`. Client trước đây tra bằng localpart
   THÔ ⇒ tài khoản có email không phải SĐT thì hộp thư offline rỗng vĩnh viễn
   (biên bản audit-offline-2026-08-02, K6). */
describe("inboxBucket — khớp từng ký tự với khoá máy chủ ghi", () => {
  it("localpart của email ảo → cùng chuỗi máy chủ dùng", () => {
    for (const local of ["0912345678", "84912345678", "duclong292", "0292"]) {
      expect(inboxBucket(local)).toBe(normalizeVnPhone(local));
    }
  });

  it("chưa đăng nhập → ngăn khách (không phải chuỗi rỗng, không phải '0')", () => {
    expect(inboxBucket(null)).toBe(inboxBucket(undefined));
    expect(inboxBucket("")).toBe(inboxBucket(null));
    // 'abc' không có số nào → cũng về ngăn khách, không tạo ngăn rác "0"
    expect(inboxBucket("abc")).toBe(inboxBucket(null));
  });
});

const MSG = [
  {
    id: "m1",
    title: "Bão số 3 vào Biển Đông",
    body: "Gió giật cấp 12",
    url: null,
    sentAt: "2026-08-01T02:00:00Z",
    mine: true,
  },
];

/** Ghi thẳng một bản lưu v2 (như sau một lần làm mới lúc còn sóng ở bờ) */
function seedV2(phone: string) {
  localStorage.setItem(
    INBOX_KEY,
    JSON.stringify({ phone, savedAt: Date.now(), messages: MSG }),
  );
}

describe("C-1 — hộp thư KHÔNG được biến mất sau 1 giờ mất sóng", () => {
  it("có bản lưu + user=null nhưng CÒN danh tính offline → vẫn đọc đủ tin", () => {
    seedV2("0912345678");
    rememberIdentity("0912345678"); // gắn lúc còn đăng nhập được ở bờ
    // giữa biển: token hết hạn, useAuthUser trả user=null ⇒ `phone` lùi về đây
    const phone = offlineIdentityPhone();
    expect(phone).toBe("0912345678");
    expect(loadInbox(phone)).toHaveLength(1);
  });

  it("KHÔNG có danh tính (máy chưa ai đăng nhập) → không đọc được ngăn người khác", () => {
    seedV2("0912345678");
    expect(loadInbox(null)).toEqual([]);
    expect(loadInbox("0987654321")).toEqual([]);
  });
});

describe("migrate v1 → v2 — không được làm mất tin bà con đang có", () => {
  it("bản v1 được dời sang v2 nguyên vẹn, khoá cũ dọn đi", () => {
    localStorage.setItem(
      "forfish.inbox.v1",
      JSON.stringify({ phone: "0912345678", savedAt: 1, messages: MSG }),
    );
    expect(loadInbox("0912345678")).toEqual(MSG);
    expect(localStorage.getItem("forfish.inbox.v1")).toBeNull();
    expect(localStorage.getItem(INBOX_KEY)).not.toBeNull();
    // đọc lại lần nữa (đã hết v1) vẫn còn đủ tin
    expect(loadInbox("0912345678")).toEqual(MSG);
  });

  it("đã có v2 rồi → KHÔNG để bản v1 cũ đè lên", () => {
    seedV2("0912345678");
    localStorage.setItem(
      "forfish.inbox.v1",
      JSON.stringify({ phone: "0912345678", savedAt: 1, messages: [] }),
    );
    expect(loadInbox("0912345678")).toHaveLength(1);
  });

  it("v1 hỏng (JSON lỗi) → không ném, coi như chưa có gì", () => {
    localStorage.setItem("forfish.inbox.v1", "{hỏng");
    expect(() => loadInbox("0912345678")).not.toThrow();
    expect(loadInbox("0912345678")).toEqual([]);
  });
});

describe("K4/F2 — nhánh khách KHÔNG được đè ngăn của người đã đăng nhập", () => {
  it("máy chủ trả ok:true + phone:null (không đọc được phiên) → giữ nguyên bản của SĐT", async () => {
    seedV2("0912345678");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ ok: true, phone: null, messages: [] }),
      })),
    );
    await refreshInbox();
    // tin gửi riêng vẫn còn nguyên trong máy
    expect(loadInbox("0912345678")).toHaveLength(1);
  });

  it("máy chưa đăng nhập bao giờ → nhánh khách vẫn ghi được bình thường", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ ok: true, phone: null, messages: MSG }),
      })),
    );
    await refreshInbox();
    expect(loadInbox(null)).toHaveLength(1);
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

/* ── C-1/R2: CÂU TRẢ LỜI CỦA NGĂN KHÁC KHÔNG ĐƯỢC VẼ LÊN MÀN HÌNH ──────────
   Máy chủ trả `{ok:true, phone:null, messages:[chỉ tin chung]}` khi không đọc
   được phiên (token Supabase sống ~1 giờ, chuyến biển dài hơn thế nhiều). Đó
   là 200 HỢP LỆ nên mọi lá chắn kiểu `if (!ok) return` đều trượt. `saveInbox`
   có lá chắn này rồi; `setMessages` ở inbox-section thì chưa ⇒ hai tin nhắm
   riêng BIẾN KHỎI MÀN HÌNH dù vẫn nằm nguyên trong máy. */
describe("acceptRefresh — chỉ vẽ câu trả lời của ĐÚNG ngăn đang xem", () => {
  it("đang xem ngăn của một SĐT mà máy chủ trả ngăn khách → KHÔNG vẽ", () => {
    expect(acceptRefresh("0912345678", null)).toBe(false);
  });

  it("khách xem ngăn khách → vẽ bình thường", () => {
    expect(acceptRefresh(null, null)).toBe(true);
  });

  it("cùng SĐT → vẽ", () => {
    expect(acceptRefresh("0912345678", "0912345678")).toBe(true);
  });

  it("cùng người viết khác kiểu (84…) → vẫn là một ngăn → vẽ", () => {
    expect(acceptRefresh("0912345678", "84912345678")).toBe(true);
  });

  it("SĐT khác hẳn → KHÔNG vẽ (máy dùng chung trên tàu)", () => {
    expect(acceptRefresh("0912345678", "0987654321")).toBe(false);
  });

  it("cùng luật với saveInbox — so NGĂN, không so chuỗi thô", () => {
    expect(acceptRefresh("+84 912 345 678", "0912345678")).toBe(true);
    // chuỗi không ra số nào = ngăn khách, cả hai bên đều vậy
    expect(acceptRefresh("abc", undefined)).toBe(true);
  });
});

/* Chốt cấu trúc: chỗ gọi phải THẬT SỰ đi qua acceptRefresh, và `refresh` phải
   THẤY được `phone` (bản cũ `useCallback(…, [])` nên có muốn so cũng chỉ so
   vào giá trị đầu tiên — hàm không hề thấy phone đổi). */
describe("inbox-section — nối đúng dây (K7)", () => {
  const src = readFileSync(
    join(process.cwd(), "src", "components", "inbox-section.tsx"),
    "utf8",
  );

  it("gọi acceptRefresh trước khi setMessages", () => {
    const block = src.slice(src.indexOf("const refresh = useCallback"));
    const body = block.slice(0, block.indexOf("useEffect("));
    expect(body).toContain("acceptRefresh(");
    expect(body.indexOf("acceptRefresh(")).toBeLessThan(
      body.indexOf("setMessages("),
    );
  });

  it("useCallback của refresh có `phone` trong deps", () => {
    const block = src.slice(src.indexOf("const refresh = useCallback"));
    expect(block.slice(0, block.indexOf("useEffect("))).toMatch(
      /\}, \[phone\]\);/,
    );
  });
});
