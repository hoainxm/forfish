import { describe, it, expect, vi } from "vitest";
import { randomBytes } from "node:crypto";
import { isDataKeyValue } from "@/lib/app-config-keys";
import { resolveBuildKey } from "../../../scripts/encode-data.mjs";
import { hexOf } from "@/lib/data-codec.mjs";

/*  KHOÁ DỮ LIỆU BẢN ĐỒ CẤU HÌNH Ở /quan-tri (2026-09-17): (1) hai khoá nằm trong
    registry app_config, secret, có nút sinh; (2) đổi khoá hiện hành thì khoá
    cũ trượt xuống "trước đó" — không thì máy đang dùng file cũ đọc hỏng;
    (3) build lấy khoá theo thứ tự env → DB → TỰ SINH (không ai phải làm gì ở
    lần deploy đầu), thiếu cả Supabase lẫn env ⇒ null. */

const HEX = hexOf(new Uint8Array(randomBytes(32)));
const HEX2 = hexOf(new Uint8Array(randomBytes(32)));

describe("resolveBuildKey — build lấy khoá ở đâu", () => {
  const SB = { NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co/", SUPABASE_SERVICE_ROLE_KEY: "srk" };
  const resp = (status: number, body: unknown) => ({ ok: status < 300, status, json: async () => body });

  it("env thắng, không đụng DB; env sai dạng ⇒ ném", async () => {
    const f = vi.fn();
    const got = await resolveBuildKey({ env: { ...SB, SDFISH_DATA_KEY: HEX }, fetchImpl: f as unknown as typeof fetch });
    expect(got?.source).toBe("env");
    expect(hexOf(got!.key)).toBe(HEX);
    expect(f).not.toHaveBeenCalled();
    await expect(resolveBuildKey({ env: { SDFISH_DATA_KEY: "abc" }, fetchImpl: f as unknown as typeof fetch })).rejects.toThrow(/sai dạng/);
  });

  it("DB có khoá ⇒ dùng, gửi service-role đúng header", async () => {
    const f = vi.fn().mockResolvedValue(resp(200, [{ key: "data_key_current", value: HEX }]));
    const got = await resolveBuildKey({ env: SB, fetchImpl: f as unknown as typeof fetch });
    expect(got?.source).toBe("db");
    expect(hexOf(got!.key)).toBe(HEX);
    const [url, init] = f.mock.calls[0] as [string, { headers: Record<string, string> }];
    expect(url).toBe("https://x.supabase.co/rest/v1/app_config?select=key,value&key=eq.data_key_current");
    expect(init.headers.Authorization).toBe("Bearer srk");
  });

  it("DB trống ⇒ TỰ SINH + ghi (ignore-duplicates) + đọc lại", async () => {
    let stored: string | null = null;
    const f = vi.fn().mockImplementation(async (url: string, init?: { method?: string; body?: string; headers?: Record<string, string> }) => {
      if (init?.method === "POST") {
        expect(init.headers?.Prefer).toContain("ignore-duplicates");
        const body = JSON.parse(init.body!) as { key: string; value: string };
        expect(body.key).toBe("data_key_current");
        expect(isDataKeyValue(body.value)).toBe(true);
        stored ??= body.value;
        return resp(201, null);
      }
      return resp(200, stored ? [{ key: "data_key_current", value: stored }] : []);
    });
    const log = vi.fn();
    const got = await resolveBuildKey({ env: SB, fetchImpl: f as unknown as typeof fetch, log });
    expect(got?.source).toBe("bootstrap");
    expect(hexOf(got!.key)).toBe(stored);
    expect(log).toHaveBeenCalledWith(expect.stringContaining("TỰ SINH"));
  });

  it("hai build chạy đua: build sau bị ignore-duplicates thì lấy khoá của build trước", async () => {
    const f = vi.fn()
      .mockResolvedValueOnce(resp(200, []))            // đọc: trống
      .mockResolvedValueOnce(resp(201, null))          // POST: bị bỏ qua vì đã có
      .mockResolvedValueOnce(resp(200, [{ key: "data_key_current", value: HEX2 }])); // đọc lại: khoá của build trước
    const got = await resolveBuildKey({ env: SB, fetchImpl: f as unknown as typeof fetch });
    expect(hexOf(got!.key)).toBe(HEX2);
  });

  it("không env, không Supabase ⇒ null (encodeDir sẽ ném ⇒ build đỏ)", async () => {
    expect(await resolveBuildKey({ env: {}, fetchImpl: vi.fn() as unknown as typeof fetch })).toBeNull();
  });

  it("DB lỗi HTTP ⇒ ném, không lặng lẽ sinh khoá mới đè lên khoá đang dùng", async () => {
    const f = vi.fn().mockResolvedValue(resp(500, null));
    await expect(resolveBuildKey({ env: SB, fetchImpl: f as unknown as typeof fetch })).rejects.toThrow(/HTTP 500/);
  });
});
