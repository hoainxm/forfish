import { afterEach, describe, expect, it } from "vitest";
import { apiUrl } from "@/lib/api-base";

const KEY = "NEXT_PUBLIC_API_BASE";

afterEach(() => {
  delete process.env[KEY];
});

describe("apiUrl", () => {
  it("base rỗng → path tương đối giữ nguyên (web như cũ)", () => {
    delete process.env[KEY];
    expect(apiUrl("/api/fuel-price")).toBe("/api/fuel-price");
    expect(apiUrl("/api/sea-scalar?kind=ssha")).toBe(
      "/api/sea-scalar?kind=ssha",
    );
  });

  it("có base → nối tuyệt đối (native)", () => {
    process.env[KEY] = "https://sdfish.vercel.app";
    expect(apiUrl("/api/fuel-price")).toBe(
      "https://sdfish.vercel.app/api/fuel-price",
    );
  });

  it("base có '/' cuối → không nhân đôi dấu gạch", () => {
    process.env[KEY] = "https://sdfish.vercel.app/";
    expect(apiUrl("/api/storms")).toBe("https://sdfish.vercel.app/api/storms");
  });

  it("path không bắt đầu bằng '/' vẫn ghép đúng", () => {
    process.env[KEY] = "https://sdfish.vercel.app";
    expect(apiUrl("api/x")).toBe("https://sdfish.vercel.app/api/x");
  });

  it("path tuyệt đối (http) giữ nguyên dù có base", () => {
    process.env[KEY] = "https://sdfish.vercel.app";
    expect(apiUrl("https://other.com/x")).toBe("https://other.com/x");
  });
});
