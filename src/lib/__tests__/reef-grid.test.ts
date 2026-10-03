import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { OUT, SOURCES, sourceHash, STEP } from "../../../scripts/build-reef-grid.mjs";
import reefGrid from "@/data/reef-grid-025.v1.json";

/*  LƯỚI RẠN 0,25° (C6, 2026-10-03) — cổng nền rạn cho cá hồng/mú/kẽm. Cổng:
    (1) file src/data khớp 3 nguồn public/data (hash) — đổi lớp rạn mà quên chạy
    scripts/build-reef-grid.mjs là đỏ; (2) hình dạng = ScalarGrid 80×64 bước 0,25°
    trùm khung biển VN; (3) vài mốc địa lý đã biết: rạn Trường Sa trên nền sâu
    (Đá Ba Đầu), Hoàng Sa (Phú Lâm), ven bờ (Côn Đảo, Hòn Mê) PHẢI có rạn; biển
    hở 14°N/112°E KHÔNG; (4) server (fish-forecast-run.ts) thật sự truyền lưới
    này vào buildFishForecast — không thì cổng rạn im lặng coi mọi ô "không rạn". */

const ROOT = process.cwd();
const g = reefGrid as { lats: number[]; lons: number[]; values: number[][]; sourceHash: string; builtFrom: string[] };
const at = (lat: number, lon: number) => {
  const i = g.lats.findIndex((v) => Math.abs(v - lat) <= STEP / 2);
  const j = g.lons.findIndex((v) => Math.abs(v - lon) <= STEP / 2);
  return g.values[i][j];
};

describe("src/data/reef-grid-025.v1.json ↔ nguồn public/data", () => {
  it("hash nguồn khớp (chạy lại scripts/build-reef-grid.mjs nếu đỏ)", () => {
    expect(g.builtFrom).toEqual(SOURCES);
    expect(g.sourceHash).toBe(sourceHash(ROOT));
    expect(OUT).toBe("src/data/reef-grid-025.v1.json");
  });

  it("hình dạng ScalarGrid 80×64, bước 0,25°, lat/lon tăng dần, giá trị 0..1", () => {
    expect(g.lats.length).toBe(80);
    expect(g.lons.length).toBe(64);
    expect(g.values.length).toBe(80);
    expect(g.values.every((r) => r.length === 64)).toBe(true);
    expect(g.lats[1] - g.lats[0]).toBeCloseTo(STEP, 6);
    expect(g.lons[1] - g.lons[0]).toBeCloseTo(STEP, 6);
    expect(g.values.flat().every((v) => v >= 0 && v <= 1)).toBe(true);
  });

  it("mốc địa lý: rạn Trường Sa/Hoàng Sa trên nền sâu CÓ rạn, biển hở KHÔNG", () => {
    expect(at(9.99, 114.66)).toBeGreaterThan(0); // Đá Ba Đầu (Trường Sa)
    expect(at(11.43, 114.33)).toBeGreaterThan(0); // Song Tử Tây
    expect(at(16.5, 112.0)).toBeGreaterThan(0); // Hoàng Sa
    expect(at(8.7, 106.6)).toBeGreaterThan(0); // Côn Đảo
    expect(at(19.4, 105.9)).toBeGreaterThan(0); // Hòn Mê
    expect(at(14.0, 112.0)).toBe(0); // biển hở giữa Hoàng Sa – Trường Sa
  });

  it("server truyền lưới rạn vào buildFishForecast (fish-forecast-run.ts)", () => {
    const src = readFileSync(join(ROOT, "src/lib/fish-forecast-run.ts"), "utf8");
    expect(src).toContain('from "@/data/reef-grid-025.v1.json"');
    expect(src).toMatch(/reef:\s*reefGridJson/);
  });
});
