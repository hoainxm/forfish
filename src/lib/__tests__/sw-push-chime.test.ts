import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  PUSH_CHIME_MSG,
  PUSH_CHIME_WAIT_MS,
  pushChimeUrgent,
} from "@/lib/push-message";
import { hazardVoices, offRouteVoices, pushVoices, warningVoices } from "@/lib/warning-sound";

/*  CHUÔNG RIÊNG KHI TIN TỚI LÚC APP ĐANG MỞ (2026-10-20).
    sw.js hỏi trang đang hiện → trang phát chuông SDFish → trả lời "đã phát"
    thì thông báo `silent`. Bất biến phải giữ: KHÔNG BAO GIỜ để tin tới mà im
    cả hai đường (trang không trả lời / không phát được ⇒ giữ tiếng mặc định). */

const SW = readFileSync(join(process.cwd(), "public", "sw.js"), "utf8");

/** Tách đúng thân `function <name>(…) {…}` trong sw.js (đếm ngoặc). */
function extractFunction(name: string): string {
  const start = SW.indexOf(`function ${name}(`);
  expect(start, `sw.js phải có function ${name}`).toBeGreaterThan(-1);
  let depth = 0;
  for (let i = SW.indexOf("{", start); i < SW.length; i++) {
    if (SW[i] === "{") depth++;
    else if (SW[i] === "}" && --depth === 0) return SW.slice(start, i + 1);
  }
  throw new Error("không khớp ngoặc");
}

type FakeClient = {
  visibilityState: "visible" | "hidden";
  focused?: boolean;
  postMessage: (msg: unknown, ports: MessagePort[]) => void;
};

function loadAskPageChime(clients: FakeClient[] | (() => Promise<FakeClient[]>)) {
  const self = {
    clients: {
      matchAll: typeof clients === "function" ? clients : async () => clients,
    },
  };
  return new Function(
    "self",
    "PUSH_CHIME_MSG",
    "PUSH_CHIME_WAIT_MS",
    `${extractFunction("askPageChime")}; return askPageChime;`,
  )(self, PUSH_CHIME_MSG, PUSH_CHIME_WAIT_MS) as (tag?: string) => Promise<boolean>;
}

/** Trang giả: nhận tin, trả lời qua cổng (hoặc im nếu reply = undefined). */
function page(opts: { visible?: boolean; focused?: boolean; reply?: boolean; seen?: unknown[] }): FakeClient {
  return {
    visibilityState: opts.visible === false ? "hidden" : "visible",
    focused: opts.focused,
    postMessage: (msg, ports) => {
      opts.seen?.push(msg);
      if (opts.reply !== undefined) ports[0].postMessage({ played: opts.reply });
    },
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("sw.js giữ ĐÚNG bản sao hằng của push-message.ts", () => {
  it("PUSH_CHIME_MSG + PUSH_CHIME_WAIT_MS khớp bản canonical", () => {
    const msg = SW.match(/const PUSH_CHIME_MSG = "([^"]+)";/);
    const wait = SW.match(/const PUSH_CHIME_WAIT_MS = ([^;]+);/);
    expect(msg?.[1]).toBe(PUSH_CHIME_MSG);
    expect(eval(wait![1])).toBe(PUSH_CHIME_WAIT_MS);
  });
});

describe("askPageChime — hỏi trang đang mở phát chuông", () => {
  it("không có trang nào đang HIỆN ⇒ false (giữ tiếng mặc định), không nhắn ai", async () => {
    const seen: unknown[] = [];
    const ask = loadAskPageChime([page({ visible: false, reply: true, seen })]);
    expect(await ask("giay-to")).toBe(false);
    expect(seen).toHaveLength(0);
  });

  it("trang trả lời đã phát ⇒ true; tin nhắn mang đúng loại + tag", async () => {
    const seen: unknown[] = [];
    const ask = loadAskPageChime([page({ reply: true, seen })]);
    expect(await ask("bao-so-5-2026")).toBe(true);
    expect(seen).toEqual([{ type: PUSH_CHIME_MSG, tag: "bao-so-5-2026" }]);
  });

  it("trang trả lời KHÔNG phát được (chưa chạm, tiếng bị chặn) ⇒ false", async () => {
    const ask = loadAskPageChime([page({ reply: false })]);
    expect(await ask()).toBe(false);
  });

  it("trang im (treo, đóng tab giữa chừng) ⇒ hết PUSH_CHIME_WAIT_MS thì false", async () => {
    vi.useFakeTimers();
    const ask = loadAskPageChime([page({})]);
    const p = ask();
    await vi.advanceTimersByTimeAsync(PUSH_CHIME_WAIT_MS + 1);
    expect(await p).toBe(false);
  });

  it("hai trang cùng hiện ⇒ chỉ nhắn MỘT (ưu tiên trang đang focus) — một chuông, không hai", async () => {
    const a: unknown[] = [];
    const b: unknown[] = [];
    const ask = loadAskPageChime([page({ reply: true, seen: a }), page({ focused: true, reply: true, seen: b })]);
    expect(await ask()).toBe(true);
    expect(a).toHaveLength(0);
    expect(b).toHaveLength(1);
  });

  it("matchAll hỏng ⇒ false, không ném (thông báo vẫn phải hiện)", async () => {
    const ask = loadAskPageChime(async () => {
      throw new Error("boom");
    });
    expect(await ask()).toBe(false);
  });
});

describe("push handler — `silent` CHỈ khi trang đã phát chuông", () => {
  const handler = SW.slice(SW.indexOf('self.addEventListener("push"'), SW.indexOf('self.addEventListener("notificationclick"'));

  it("hiện thông báo SAU khi hỏi trang, và giữ trong waitUntil", () => {
    expect(handler).toContain("askPageChime(data.tag)");
    expect(handler).toMatch(/event\.waitUntil\(Promise\.all\(\[show, ack\]\)\)/);
  });

  it("nhánh silent có đường lùi về bản thường khi trình duyệt từ chối", () => {
    expect(handler).toMatch(/silent: true \}\)\s*\.catch\(\(\) => self\.registration\.showNotification\(title, options\)\)/);
  });
});

describe("pushChimeUrgent — tin bão kêu 2 lượt", () => {
  it("tag bão `bao-…` ⇒ true; tag khác / thiếu ⇒ false", () => {
    expect(pushChimeUrgent("bao-so-5-2026")).toBe(true);
    expect(pushChimeUrgent("giay-to")).toBe(false);
    expect(pushChimeUrgent("don-123")).toBe(false);
    expect(pushChimeUrgent(null)).toBe(false);
    expect(pushChimeUrgent(42)).toBe(false);
  });
});

describe("pushVoices — motif 4 khác hẳn ba chuông cảnh báo", () => {
  const v = pushVoices();

  it("một tiếng chuông đơn: mọi nốt gõ CÙNG LÚC (không chuyển động cao độ)", () => {
    expect(v.length).toBeGreaterThan(0);
    expect(new Set(v.map((x) => x.startOffset))).toEqual(new Set([0]));
  });

  it("hợp lệ: freq>0, peakGain trong (0,1], decay>attack", () => {
    for (const x of v) {
      expect(x.freq).toBeGreaterThan(0);
      expect(x.peakGain).toBeGreaterThan(0);
      expect(x.peakGain).toBeLessThanOrEqual(1);
      expect(x.decay).toBeGreaterThan(x.attack);
    }
  });

  it("ba chuông cảnh báo đều có nốt vào SAU — chỉ chuông tin mới gõ một nhịp", () => {
    for (const other of [warningVoices(), offRouteVoices(), hazardVoices()]) {
      expect(Math.max(...other.map((x) => x.startOffset))).toBeGreaterThan(0);
    }
  });
});
