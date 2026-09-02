import { describe, it, expect, beforeEach, vi } from "vitest";

/*  CHUỖI ĐI KÈM HẠNG — chủ dự án 2026-09-02: *"chuỗi chỉ ghi success khi có
    hạng gán vào"*, *"1 token ứng với premium thì có hạn theo cái dữ liệu trên
    server, rồi sau đó nó cứ chạy hoài"*.

    Trước đây chuỗi và hạng là HAI lần ghi rời: chuỗi có đọc lại xác minh, hạng
    thì ghi rồi nuốt lỗi. Đẻ ra trạng thái thứ ba — "có chuỗi mà chưa biết
    hạng" — và chính nó ẩn sạch công cụ của bà con premium.

    Nay ghi CẶP: hạng trước, chuỗi sau, xác minh cả hai. Thiếu một vế thì đăng
    nhập coi như CHƯA XONG (màn báo, bà con bấm lại) — thà bấm lại một lần còn
    hơn đăng nhập "thành công" rồi ngồi nhìn màn thiếu nút. */

function makeLs() {
  const m = new Map<string, string>();
  let chanKhoa: string | null = null;
  return {
    m,
    chan: (k: string | null) => (chanKhoa = k),
    ls: {
      getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
      setItem: (k: string, v: string) => {
        if (chanKhoa === k) throw new Error("QuotaExceededError");
        m.set(k, String(v));
      },
      removeItem: (k: string) => void m.delete(k),
      clear: () => m.clear(),
      key: (i: number) => [...m.keys()][i] ?? null,
      get length() {
        return m.size;
      },
    } as unknown as Storage,
  };
}
const kho = makeLs();
(globalThis as unknown as { window: unknown }).window = {
  localStorage: kho.ls,
  dispatchEvent: () => true,
};
(globalThis as unknown as { localStorage: Storage }).localStorage = kho.ls;
vi.mock("@/lib/offline-identity", () => ({ applyIdentityAction: () => {} }));

import { saveToken, readToken, DEVICE_TOKEN_KEY } from "../device-token-store";
import { DEVICE_TOKEN_LEN } from "../device-token";
import { TIER_CACHE_KEY, TIER_UNTIL_KEY, readPremiumMark } from "../tier";

const CHUOI = "sdf_" + "a".repeat(DEVICE_TOKEN_LEN - 4);
const HAN = "2027-12-31T00:00:00+07:00";

beforeEach(() => {
  kho.m.clear();
  kho.chan(null);
});

describe("ghi CẶP — không bao giờ có chuỗi mà thiếu hạng", () => {
  it("đăng nhập premium: cả chuỗi lẫn hạng cùng nằm xuống", () => {
    expect(saveToken(CHUOI, "premium", HAN)).toBe(true);
    expect(readToken()).toBe(CHUOI);
    expect(readPremiumMark(kho.m.get(TIER_CACHE_KEY) ?? null)).toBe("premium");
    expect(kho.m.get(TIER_UNTIL_KEY)).toBe(HAN);
  });

  it("đăng nhập hạng thường: hạng ghi '0', KHÔNG để trống hạn", () => {
    expect(saveToken(CHUOI, "basic", null)).toBe(true);
    expect(readPremiumMark(kho.m.get(TIER_CACHE_KEY) ?? null)).toBe("basic");
    expect(kho.m.has(TIER_UNTIL_KEY)).toBe(false);
  });

  it("GHI HẠNG HỤT ⇒ trả false VÀ chuỗi KHÔNG được nằm xuống", () => {
    /*  Đây là cả điểm của bản vá: hạng ghi trước, hụt thì dừng luôn. Nếu chuỗi
        vào được mà hạng hụt thì lại đúng trạng thái thứ ba đang muốn diệt. */
    kho.chan(TIER_CACHE_KEY);
    expect(saveToken(CHUOI, "premium", HAN)).toBe(false);
    expect(kho.m.has(DEVICE_TOKEN_KEY)).toBe(false);
    expect(readToken()).toBeNull();
  });

  it("GHI CHUỖI HỤT ⇒ trả false (màn báo, bà con bấm lại)", () => {
    kho.chan(DEVICE_TOKEN_KEY);
    expect(saveToken(CHUOI, "premium", HAN)).toBe(false);
    expect(readToken()).toBeNull();
  });

  it("BẤT BIẾN: có chuỗi thì LUÔN có hạng — quét mọi ca ghi", () => {
    for (const [tier, until] of [
      ["premium", HAN],
      ["basic", null],
    ] as const) {
      kho.m.clear();
      saveToken(CHUOI, tier, until);
      const coChuoi = kho.m.has(DEVICE_TOKEN_KEY);
      const coHang = kho.m.has(TIER_CACHE_KEY);
      // không bao giờ có chuỗi mà thiếu hạng
      expect(coChuoi && !coHang).toBe(false);
    }
  });
});
