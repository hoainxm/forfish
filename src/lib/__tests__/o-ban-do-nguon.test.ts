// @vitest-environment node
import { describe, expect, it } from "vitest";
import { HOP_BIEN_VN, URL_NGUON, laPng, oTrongHop } from "../o-ban-do-nguon.mjs";
import { upstreamTileUrl } from "../tile-proxy";

describe("laPng", () => {
  it("chỉ nhận chữ ký PNG", () => {
    expect(laPng(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]))).toBe(true);
    expect(laPng(Buffer.from("<html>…"))).toBe(false);
    expect(laPng(null)).toBe(false);
  });
});

describe("oTrongHop + URL nguồn", () => {
  it("hộp biển VN: z0 = 1 ô, số ô tăng theo zoom, mọi ô là ô hợp lệ của tile-proxy", () => {
    expect(oTrongHop(HOP_BIEN_VN, 0, 0)).toEqual([{ z: 0, x: 0, y: 0 }]);
    const z7 = oTrongHop(HOP_BIEN_VN, 7, 7);
    expect(z7.length).toBeGreaterThan(40);
    expect(z7.length).toBeLessThan(100);
    for (const t of oTrongHop(HOP_BIEN_VN, 0, 10)) expect(upstreamTileUrl("chart", t.z, t.x, t.y)).not.toBeNull();
    // một ô z10 ven bờ Bắc Bộ nằm trong hộp
    expect(oTrongHop(HOP_BIEN_VN, 10, 10)).toContainEqual({ z: 10, x: 809, y: 457 });
  });
  it("URL nguồn là một chỗ: tile-proxy dùng đúng URL_NGUON", () => {
    expect(upstreamTileUrl("chlorophyll", 5, 25, 14)).toBe(URL_NGUON.chlorophyll(5, 25, 14));
    expect(URL_NGUON.sst(5, 25, 14, "2026-11-01")).toContain("/2026-11-01/GoogleMapsCompatible_Level7/5/14/25.png");
  });
});
