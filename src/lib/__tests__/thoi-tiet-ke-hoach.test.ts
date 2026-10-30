import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { keHoachUrlOM } from "@/lib/thoi-tiet-lam-moi";
import { laUrlOM } from "@/lib/goi-nguon-om";
import { PORTS } from "@/data/ports";

describe("keHoachUrlOM — danh sách URL máy nhà phải tải", () => {
  it("đủ cảng (chính + dự phòng) và lưới các khung, toàn URL Open-Meteo", async () => {
    const urls = await keHoachUrlOM();
    expect(urls.every(laUrlOM)).toBe(true);
    expect(new Set(urls).size).toBe(urls.length);
    // mỗi cảng ≥ 2 URL nguồn chính + 2 URL dự phòng ECMWF
    expect(urls.filter((u) => u.includes("models=ecmwf_wam025")).length).toBeGreaterThanOrEqual(PORTS.length);
    expect(urls.some((u) => u.includes("forecast_days=16"))).toBe(true);
    expect(urls.some((u) => u.includes("ocean_current_velocity"))).toBe(true);
    expect(urls.length).toBeLessThan(400); // trần docGoiOM
  });
});
