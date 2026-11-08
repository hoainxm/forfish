// BỎ CHÚ THÍCH public/*.js LÚC BUILD + ĐỔI TÊN FILE TRUNG TÍNH (2026-11-08, docs/app-map/ops/khong-lo-nguon.md nợ #12).
// Cổng: (1) bản phát của sw.js không còn chú thích (tên nguồn sống trong chú thích) mà vẫn là JS hợp lệ, giữ nguyên
// các hằng/nhánh offline; (2) tên file rạn mới có trong vỏ pmtiles, tên cũ chỉ còn trong bảng ánh xạ để đọc bản đã cất.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { boChuThichJs, tepCongKhai } from "../../../scripts/bo-chu-thich-public.mjs";

const SW = readFileSync("public/sw.js", "utf8");

describe("bỏ chú thích public/*.js", () => {
  it("sw.js: hết chú thích, vẫn biên dịch được, giữ hằng kho + nhánh pmtiles + bảng tên cũ", async () => {
    const ra = await boChuThichJs(SW);
    expect(ra.length).toBeLessThan(SW.length / 2);
    expect(ra).not.toMatch(/\/\*|^\s*\/\//m);
    expect(ra).not.toMatch(/gdacs|protomaps|openstreetmap|copernicus|noaa|open-meteo/i);
    expect(() => new Function(ra)).not.toThrow();
    for (const k of ["SDFISH_CACHE_V", "SDFISH_BASEMAP_V", "PMTILES_ARCHIVES", "TEN_CU_DATA", "basemapFirst", "API_CACHE_ALLOW"])
      expect(ra, k).toContain(k);
  });
  it("mọi .js ở gốc public đều qua được (worker Sen Biển)", async () => {
    const ds = tepCongKhai();
    expect(ds.some((p) => p.endsWith("sw.js"))).toBe(true);
    for (const p of ds) expect(() => new Function(readFileSync(p, "utf8"))).not.toThrow();
    for (const p of ds) await expect(boChuThichJs(readFileSync(p, "utf8"))).resolves.toBeTypeOf("string");
  });
});

describe("đổi tên file rạn trung tính — không mất bản đã cất", () => {
  it("vỏ pmtiles dùng tên mới; tên cũ chỉ nằm trong bảng ánh xạ; đọc kho trượt tên mới thì thử tên cũ", () => {
    const m = /const PMTILES_ARCHIVES = \[([\s\S]*?)\];/.exec(SW)![1];
    expect(m).toContain('"/data/ran-chi-tiet.v1.pmtiles"');
    expect(m).not.toContain("reef-shapes-aca");
    expect(SW).toMatch(/"\/data\/ran-chi-tiet\.v1\.pmtiles": "\/data\/reef-shapes-aca\.v1\.pmtiles"/);
    expect(SW).toMatch(/c\.match\(path\)\.then\(\(hit\) => hit \|\| \(TEN_CU_DATA\[path\]/);
    expect(SW).toMatch(/if \(TEN_CU_DATA\[path\] && \(await c\.match\(TEN_CU_DATA\[path\]\)\)\) return;/);
  });
});
