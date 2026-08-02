import { describe, it, expect, beforeEach, vi } from "vitest";

/* localStorage mock (env node — không jsdom), khớp mẫu inbox-read.test */
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
  IDENTITY_KEY,
  clearTierMark,
  forgetIdentity,
  offlineIdentityPhone,
  rememberIdentity,
} from "@/lib/offline-identity";
import { TIER_CACHE_KEY, TIER_UNTIL_KEY } from "@/lib/tier";
import { normalizeVnPhone } from "@/lib/phone";

beforeEach(() => {
  localStorage.clear();
});

describe("offline-identity — ai đang dùng máy này khi không hỏi được máy chủ", () => {
  it("chưa gắn ai → null", () => {
    expect(offlineIdentityPhone()).toBeNull();
  });

  it("ghi rồi đọc lại được, và lưu SĐT ĐÃ CHUẨN HOÁ", () => {
    rememberIdentity("+84 912 345 678");
    expect(offlineIdentityPhone()).toBe("0912345678");
  });

  it("localpart 'duclong292' → khớp ĐÚNG thứ máy chủ ghi (normalizeVnPhone)", () => {
    // /api/me/messages ghi ngăn bằng normalizeVnPhone(email.split("@")[0]);
    // client phải ra cùng chuỗi, nếu không hộp thư offline rỗng vĩnh viễn (K6)
    rememberIdentity("duclong292");
    expect(offlineIdentityPhone()).toBe(normalizeVnPhone("duclong292"));
  });

  it("xoá thì quên hẳn (chỉ gọi khi ĐÃ đăng xuất được)", () => {
    rememberIdentity("0912345678");
    forgetIdentity();
    expect(offlineIdentityPhone()).toBeNull();
    expect(localStorage.getItem(IDENTITY_KEY)).toBeNull();
  });

  it("rỗng / không ra số nào → không lưu rác, vẫn không ném", () => {
    expect(rememberIdentity("")).toBeNull();
    expect(rememberIdentity(null)).toBeNull();
    expect(rememberIdentity("abc")).toBeNull();
    expect(offlineIdentityPhone()).toBeNull();
  });
});

describe("đổi người trên máy dùng chung — KHÔNG thừa hưởng quyền", () => {
  it("SĐT MỚI khác SĐT cũ → ghi đè danh tính VÀ xoá dấu tier cùng lúc", () => {
    rememberIdentity("0912345678");
    localStorage.setItem(TIER_CACHE_KEY, "1");
    localStorage.setItem(TIER_UNTIL_KEY, "2027-08-01T00:00:00Z");

    rememberIdentity("0987654321");

    expect(offlineIdentityPhone()).toBe("0987654321");
    expect(localStorage.getItem(TIER_CACHE_KEY)).toBeNull();
    expect(localStorage.getItem(TIER_UNTIL_KEY)).toBeNull();
  });

  it("CÙNG người (kể cả viết khác kiểu) → giữ nguyên dấu tier, không xoá oan", () => {
    rememberIdentity("0912345678");
    localStorage.setItem(TIER_CACHE_KEY, "1");
    rememberIdentity("84912345678");
    expect(offlineIdentityPhone()).toBe("0912345678");
    expect(localStorage.getItem(TIER_CACHE_KEY)).toBe("1");
  });

  it("KHÔNG bao giờ tự BẬT dấu premium (chỉ trả lời AI, không trả lời HẠNG GÌ)", () => {
    rememberIdentity("0912345678");
    expect(localStorage.getItem(TIER_CACHE_KEY)).toBeNull();
  });

  /* HỒI QUY 2026-08-02: normalize() trả null (email thật / tài khoản kỹ thuật)
     thì rememberIdentity `return` sớm ⇒ danh tính VÀ dấu premium của NGƯỜI
     TRƯỚC nằm nguyên trên máy ⇒ người mới thừa hưởng quyền khi ra khơi mất
     sóng. Không biết là ai thì không được giữ quyền của ai. */
  it("SĐT không chuẩn hoá được → QUÊN người cũ và xoá dấu hạng, không giữ lại", () => {
    rememberIdentity("0912345678");
    localStorage.setItem(TIER_CACHE_KEY, "1");
    localStorage.setItem(TIER_UNTIL_KEY, "2027-08-01T00:00:00Z");

    expect(rememberIdentity("ketoan@sdvico.vn")).toBeNull();

    expect(offlineIdentityPhone()).toBeNull();
    expect(localStorage.getItem(TIER_CACHE_KEY)).toBeNull();
    expect(localStorage.getItem(TIER_UNTIL_KEY)).toBeNull();
  });
});

describe("quên người = bỏ quyền (không phụ thuộc thứ tự lập lịch React)", () => {
  /* HỒI QUY 2026-08-02: dấu premium trước đây chỉ được xoá bởi một useEffect
     canh `shouldClearPremiumMark`. Lúc bấm Đăng xuất, auth-js bắn SIGNED_OUT
     ngay trong `await signOut()` nên effect chạy khi danh tính VẪN CÒN (không
     xoá), rồi forgetIdentity() chạy sau không đổi dep nào (effect không chạy
     lại) ⇒ dấu premium ở lại máy cho bạn thuyền dùng. */
  it("forgetIdentity xoá LUÔN dấu hạng, một hành động không tách rời", () => {
    rememberIdentity("0912345678");
    localStorage.setItem(TIER_CACHE_KEY, "1");
    localStorage.setItem(TIER_UNTIL_KEY, "2027-08-01T00:00:00Z");

    forgetIdentity();

    expect(offlineIdentityPhone()).toBeNull();
    expect(localStorage.getItem(TIER_CACHE_KEY)).toBeNull();
    expect(localStorage.getItem(TIER_UNTIL_KEY)).toBeNull();
  });

  it("clearTierMark xoá dấu hạng mà KHÔNG đụng danh tính (gọi thẳng được)", () => {
    rememberIdentity("0912345678");
    localStorage.setItem(TIER_CACHE_KEY, "1");
    localStorage.setItem(TIER_UNTIL_KEY, "2027-08-01T00:00:00Z");

    clearTierMark();

    expect(localStorage.getItem(TIER_CACHE_KEY)).toBeNull();
    expect(localStorage.getItem(TIER_UNTIL_KEY)).toBeNull();
    expect(offlineIdentityPhone()).toBe("0912345678");
  });

  it("máy chưa có gì → gọi vẫn im lặng, không ném", () => {
    expect(() => clearTierMark()).not.toThrow();
    expect(() => forgetIdentity()).not.toThrow();
  });
});

describe("localStorage ném (chế độ riêng tư) — không bao giờ làm sập app", () => {
  const boom = () => {
    throw new Error("QuotaExceeded");
  };
  const broken = {
    getItem: boom,
    setItem: boom,
    removeItem: boom,
  } as unknown as Storage;

  it("đọc → null, ghi/xoá → im lặng, không ném ra ngoài", () => {
    vi.stubGlobal("window", { localStorage: broken });
    expect(offlineIdentityPhone()).toBeNull();
    expect(() => rememberIdentity("0912345678")).not.toThrow();
    expect(() => forgetIdentity()).not.toThrow();
    vi.unstubAllGlobals();
    (globalThis as unknown as { window: unknown }).window = { localStorage: _ls };
  });

  it("JSON hỏng trong khoá → coi như chưa gắn ai", () => {
    localStorage.setItem(IDENTITY_KEY, "{không phải json");
    expect(offlineIdentityPhone()).toBeNull();
  });

  it("khoá theo quy ước forfish.* (state-registry)", () => {
    expect(IDENTITY_KEY.startsWith("forfish.")).toBe(true);
  });
});
