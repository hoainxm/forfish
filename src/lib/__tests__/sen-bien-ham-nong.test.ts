// @vitest-environment jsdom
// Hâm nóng đường máy nhà lúc mở micro (15 §35, 2026-11-03): một lượt ấm / HAM_CACH_MS, chỉ khi có sóng + đăng nhập.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEVICE_TOKEN_KEY } from "@/lib/device-token-store";
import { DEVICE_TOKEN_LEN, DEVICE_TOKEN_PREFIX } from "@/lib/device-token";
import { HAM_CACH_MS, hamNongMayNha } from "@/lib/sen-bien/hoi-may-chu";

const TOKEN = DEVICE_TOKEN_PREFIX + "a".repeat(DEVICE_TOKEN_LEN - DEVICE_TOKEN_PREFIX.length);
// mốc riêng mỗi ca — hàm nhớ lần gửi cuối ở cấp module
let t = 10_000_000;

describe("hamNongMayNha", () => {
  let goi: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    goi = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
    vi.stubGlobal("fetch", goi);
    window.localStorage.setItem(DEVICE_TOKEN_KEY, TOKEN);
    t += 10 * HAM_CACH_MS;
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    window.localStorage.clear();
  });
  it("có sóng + đăng nhập ⇒ một lượt POST {am:1} kèm chuỗi thiết bị, lượt sau trong 45 s thì không", () => {
    expect(hamNongMayNha(t)).toBe(true);
    expect(goi).toHaveBeenCalledTimes(1);
    const [url, init] = goi.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/sen-bien/hoi");
    expect(JSON.parse(String(init.body))).toEqual({ am: 1 });
    expect(hamNongMayNha(t + HAM_CACH_MS - 1)).toBe(false);
    expect(hamNongMayNha(t + HAM_CACH_MS)).toBe(true);
    expect(goi).toHaveBeenCalledTimes(2);
  });
  it("chưa đăng nhập ⇒ không gửi", () => {
    window.localStorage.clear();
    expect(hamNongMayNha(t)).toBe(false);
    expect(goi).not.toHaveBeenCalled();
  });
  it("mất sóng ⇒ không gửi", () => {
    vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(false);
    expect(hamNongMayNha(t)).toBe(false);
    expect(goi).not.toHaveBeenCalled();
  });
  it("fetch ném ⇒ nuốt êm, không ném ra chỗ gọi", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new TypeError("mất mạng"))));
    expect(() => hamNongMayNha(t)).not.toThrow();
    await Promise.resolve();
  });
});
