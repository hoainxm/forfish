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
  applyIdentityAction,
  clearTierMark,
  forgetIdentity,
  identityAction,
  offlineIdentityPhone,
  rememberIdentity,
  subscribeIdentity,
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

/* ── R5: HAI NGƯỜI KHÁC NHAU KHÔNG ĐƯỢC RA CÙNG MỘT DANH TÍNH ──────────────
   `normalizeVnPhone` bóc hết chữ rồi thêm "0" vào đầu, nên localpart
   `duclong292` và `abc292` cùng ra "0292", `ketoan2` ra "02". Chốt cũ
   `cur?.phone === phone` vì thế coi hai người là một ⇒ `return` sớm TRƯỚC khối
   xoá dấu hạng ⇒ người sau thừa hưởng premium của người trước, đúng thứ chú
   thích đầu file tuyên bố đang chặn. */
describe("đổi người mà SĐT chuẩn hoá TRÙNG NHAU — vẫn phải xoá quyền", () => {
  it("duclong292 → abc292 (cùng ra '0292') vẫn là ĐỔI NGƯỜI → xoá dấu tier", () => {
    rememberIdentity("duclong292");
    localStorage.setItem(TIER_CACHE_KEY, "1");
    localStorage.setItem(TIER_UNTIL_KEY, "2027-08-01T00:00:00Z");

    expect(rememberIdentity("abc292")).toBe(normalizeVnPhone("abc292"));

    expect(localStorage.getItem(TIER_CACHE_KEY)).toBeNull();
    expect(localStorage.getItem(TIER_UNTIL_KEY)).toBeNull();
  });

  it("cùng người viết hoa-thường khác nhau → GIỮ dấu tier (không xoá oan)", () => {
    rememberIdentity("duclong292");
    localStorage.setItem(TIER_CACHE_KEY, "1");

    rememberIdentity("DucLong292");

    expect(localStorage.getItem(TIER_CACHE_KEY)).toBe("1");
    expect(offlineIdentityPhone()).toBe(normalizeVnPhone("duclong292"));
  });

  it("SĐT thật viết khác kiểu vẫn là một người → giữ dấu", () => {
    rememberIdentity("0912345678");
    localStorage.setItem(TIER_CACHE_KEY, "1");
    rememberIdentity(" 0912345678 ");
    expect(localStorage.getItem(TIER_CACHE_KEY)).toBe("1");
  });

  it("BẢN GHI ĐỜI CŨ (chưa có `key`) → không ném, KHÔNG xoá oan dấu tier", () => {
    // đúng thứ đang nằm trên máy bà con trước bản vá này
    localStorage.setItem(
      IDENTITY_KEY,
      JSON.stringify({ phone: "0912345678", boundAt: 1 }),
    );
    localStorage.setItem(TIER_CACHE_KEY, "1");
    localStorage.setItem(TIER_UNTIL_KEY, "2027-08-01T00:00:00Z");

    expect(() => rememberIdentity("0912345678")).not.toThrow();

    expect(localStorage.getItem(TIER_CACHE_KEY)).toBe("1");
    expect(localStorage.getItem(TIER_UNTIL_KEY)).toBe("2027-08-01T00:00:00Z");
    expect(offlineIdentityPhone()).toBe("0912345678");
    // và được nâng cấp tại chỗ để lần sau so đúng NGƯỜI
    const s = JSON.parse(localStorage.getItem(IDENTITY_KEY)!) as {
      key?: string;
    };
    expect(s.key).toBe("0912345678");
  });

  it("bản ghi đời cũ + ĐÚNG là người khác → vẫn xoá dấu như trước", () => {
    localStorage.setItem(
      IDENTITY_KEY,
      JSON.stringify({ phone: "0912345678", boundAt: 1 }),
    );
    localStorage.setItem(TIER_CACHE_KEY, "1");
    rememberIdentity("0987654321");
    expect(localStorage.getItem(TIER_CACHE_KEY)).toBeNull();
  });
});

/* ── K7: CỔNG DUY NHẤT ĐỔI DANH TÍNH ───────────────────────────────────────
   `use-auth` cố ý bất đối xứng (có user thì nhớ, `null` thì KHÔNG đụng). Viết
   tay thì trông y hệt chỗ thiếu vế `else`; người sau "dọn dẹp" một nhát là
   C-1 + C-7 + C-8 sống lại cùng lúc mà test cũ vẫn xanh 100%. */
describe("identityAction — bảng chân trị (ô SIGNED_OUT là ô dễ sai nhất)", () => {
  it("có user trong session → NHỚ, bất kể tên sự kiện", () => {
    for (const e of [
      "INITIAL_SESSION",
      "SIGNED_IN",
      "TOKEN_REFRESHED",
      "USER_UPDATED",
      "MFA_CHALLENGE_VERIFIED",
      "WHATEVER",
    ]) {
      expect(identityAction(e, true)).toBe("remember");
    }
  });

  it("session null → GIỮ NGUYÊN, kể cả sự kiện lạ", () => {
    for (const e of [
      "INITIAL_SESSION",
      "TOKEN_REFRESHED",
      "USER_UPDATED",
      "PASSWORD_RECOVERY",
      "MFA_CHALLENGE_VERIFIED",
      "WHATEVER",
    ]) {
      expect(identityAction(e, false)).toBe("keep");
    }
  });

  it("⚠️ SIGNED_OUT + null → GIỮ, KHÔNG quên (đó chính là tín hiệu của C-7)", () => {
    // auth-js `_removeSession()` kết thúc bằng
    // `_notifyAllSubscribers('SIGNED_OUT', null)` khi làm mới token gặp lỗi
    // KHÔNG phải mạng. Nghe theo nó = khoá lại đúng con bug vừa vá.
    expect(identityAction("SIGNED_OUT", false)).toBe("keep");
  });

  it("bà con TỰ BẤM đăng xuất / gỡ khỏi máy → QUÊN", () => {
    expect(identityAction("user-signed-out", false)).toBe("forget");
    expect(identityAction("device-forget", false)).toBe("forget");
    // kể cả khi phiên vẫn còn user (signOut xong auth-js chưa kịp dọn)
    expect(identityAction("user-signed-out", true)).toBe("forget");
  });

  /* LƯỚI ĐỠ của use-tier (2026-08-02c): đã kiểm xong phiên, KHÔNG lỗi, không
     có ai đăng nhập, máy cũng không nhớ ai (`shouldClearPremiumMark`). Lúc đó
     không còn danh tính nào để mất — việc duy nhất là bỏ dấu hạng. Đi qua cổng
     để repo không có đường ghi thứ hai (identity-gate canh `clearTierMark`). */
  it("lưới đỡ `session-gone-no-identity` → QUÊN (nhưng chỉ là một đường vào cổng)", () => {
    expect(identityAction("session-gone-no-identity", false)).toBe("forget");
  });

  /* Ba tên đó là DANH SÁCH ĐÓNG. Tên nào khác + null phải ra "keep" — nếu
     không thì một sự kiện auth-js mới của thư viện là dựng lại C-1/C-7/C-8. */
  it("chỉ BA tên đó mới quên — mọi tên khác + null vẫn GIỮ", () => {
    for (const e of [
      "signed-out",
      "user_signed_out",
      "SIGNED_OUT",
      "logout",
      "device_forget",
      "",
    ]) {
      expect(identityAction(e, false)).toBe("keep");
    }
  });
});

/* ── subscribeIdentity — MỘT CỬA NGHE CHO MỌI HOOK ─────────────────────────
   Hook nào cũng phải nghe ĐỦ (sự kiện trong tab + `storage` của tab khác).
   Ca chạy thật nằm ở use-auth-identity.test.ts (env jsdom); ở đây chỉ khoá
   phần KHÔNG ĐƯỢC NÉM — `window` giả trong test env node, WebView lạ, SSR. */
describe("subscribeIdentity — không bao giờ làm sập app", () => {
  it("`window` không có addEventListener → trả hàm gỡ rỗng, không ném", () => {
    // đúng cái `window` giả ở đầu file này ({ localStorage })
    let off: (() => void) | undefined;
    expect(() => {
      off = subscribeIdentity(() => {});
    }).not.toThrow();
    expect(off).toBeTypeOf("function");
    expect(() => off!()).not.toThrow();
  });

  it("gắn/gỡ được trên window có sự kiện, và gỡ rồi thì thôi gọi", () => {
    const listeners = new Map<string, Set<(e: Event) => void>>();
    vi.stubGlobal("window", {
      localStorage: _ls,
      addEventListener: (t: string, f: (e: Event) => void) => {
        if (!listeners.has(t)) listeners.set(t, new Set());
        listeners.get(t)!.add(f);
      },
      removeEventListener: (t: string, f: (e: Event) => void) =>
        void listeners.get(t)?.delete(f),
    });
    let n = 0;
    const off = subscribeIdentity(() => n++);
    expect(listeners.get("forfish:identity")?.size).toBe(1);
    expect(listeners.get("storage")?.size).toBe(1);

    for (const f of listeners.get("forfish:identity")!) f(new Event("x"));
    expect(n).toBe(1);

    off();
    expect(listeners.get("forfish:identity")?.size).toBe(0);
    expect(listeners.get("storage")?.size).toBe(0);

    vi.unstubAllGlobals();
    (globalThis as unknown as { window: unknown }).window = { localStorage: _ls };
  });
});

describe("applyIdentityAction — người ghi DUY NHẤT", () => {
  it("keep → không đụng kho, trả undefined để chỗ gọi giữ nguyên state", () => {
    rememberIdentity("0912345678");
    localStorage.setItem(TIER_CACHE_KEY, "1");

    expect(applyIdentityAction("SIGNED_OUT", false)).toBeUndefined();

    expect(offlineIdentityPhone()).toBe("0912345678");
    expect(localStorage.getItem(TIER_CACHE_KEY)).toBe("1");
  });

  it("remember → ghi danh tính, trả SĐT chuẩn hoá", () => {
    expect(applyIdentityAction("SIGNED_IN", true, "+84 912 345 678")).toBe(
      "0912345678",
    );
    expect(offlineIdentityPhone()).toBe("0912345678");
  });

  it("forget → quên sạch danh tính VÀ dấu hạng, trả null", () => {
    rememberIdentity("0912345678");
    localStorage.setItem(TIER_CACHE_KEY, "1");

    expect(applyIdentityAction("user-signed-out", false)).toBeNull();

    expect(offlineIdentityPhone()).toBeNull();
    expect(localStorage.getItem(TIER_CACHE_KEY)).toBeNull();
  });
});
