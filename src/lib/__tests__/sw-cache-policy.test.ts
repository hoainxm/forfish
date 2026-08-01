import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { API_CACHE_ALLOW, isCacheableApiPath } from "@/lib/sw-cache-policy";

describe("isCacheableApiPath — chỉ cache thứ không gắn danh tính", () => {
  it("dữ liệu công khai/dùng chung → cache", () => {
    expect(isCacheableApiPath("/api/fish-forecast")).toBe(true);
    expect(isCacheableApiPath("/api/storms")).toBe(true);
    expect(isCacheableApiPath("/api/port-prices")).toBe(true);
    expect(isCacheableApiPath("/api/port-prices/history")).toBe(true);
    expect(isCacheableApiPath("/api/weather-snapshot")).toBe(true);
  });

  it("HỒ SƠ CÁ NHÂN + hành động → KHÔNG cache (máy dùng chung trên tàu)", () => {
    expect(isCacheableApiPath("/api/me")).toBe(false);
    expect(isCacheableApiPath("/api/crew-reports")).toBe(false);
    expect(isCacheableApiPath("/api/product-inquiries")).toBe(false);
    expect(isCacheableApiPath("/api/push")).toBe(false);
    expect(isCacheableApiPath("/api/auth/callback")).toBe(false);
    expect(isCacheableApiPath("/api/admin/accounts")).toBe(false);
    expect(isCacheableApiPath("/api/cron/refresh-weather")).toBe(false);
    expect(isCacheableApiPath("/api/sdwork/webhook")).toBe(false);
  });

  it("KHÔNG khớp tiền tố nửa vời (đừng để /api/mexxx lọt)", () => {
    expect(isCacheableApiPath("/api/stormsxyz")).toBe(false);
    expect(isCacheableApiPath("/api/fish-forecast-secret")).toBe(false);
  });
});

describe("public/sw.js giữ ĐÚNG bản sao danh sách", () => {
  // sw.js là file tĩnh, không import được TS → giữ bản sao. Test này bắt lệch.
  it("API_CACHE_ALLOW trong sw.js khớp bản canonical", () => {
    const sw = readFileSync(join(process.cwd(), "public", "sw.js"), "utf8");
    const block = sw.match(/const API_CACHE_ALLOW = \[([\s\S]*?)\];/);
    expect(block, "sw.js phải có const API_CACHE_ALLOW = [...]").toBeTruthy();
    const inSw = [...block![1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    expect(inSw).toEqual([...API_CACHE_ALLOW]);
  });

  it("sw.js KHÔNG bao giờ cache /api/me hay /api/crew-reports", () => {
    const sw = readFileSync(join(process.cwd(), "public", "sw.js"), "utf8");
    const block = sw.match(/const API_CACHE_ALLOW = \[([\s\S]*?)\];/);
    const inSw = block![1];
    expect(inSw).not.toContain("/api/me");
    expect(inSw).not.toContain("/api/crew-reports");
    expect(inSw).not.toContain("/api/admin");
  });
});
