import { describe, expect, it } from "vitest";
import { SEA_SCALARS, SEA_SCALAR_ORDER } from "../sea-scalars";
import { buildScalarCells, loadSeaScalar, NGUON } from "../sea-scalars-server";

describe("SEA_SCALARS config", () => {
  it("đủ lớp, URL trỏ đúng vùng VN, stops xen kẽ số-màu", () => {
    // sss rút khỏi UI (nguồn chết — xem comment trong sea-scalars.ts) nhưng
    // config vẫn phải hợp lệ để bật lại được
    expect(SEA_SCALAR_ORDER).toEqual(["ssha"]);
    for (const [kind, def] of Object.entries(SEA_SCALARS)) {
      const src = NGUON[kind as keyof typeof NGUON];
      const u = src.url("(last)");
      expect(u).toContain("(102.0)");
      expect(u).toContain("(22.0)");
      expect(u).toContain(encodeURIComponent("(last)"));
      expect(src.timeAttempts.length).toBeGreaterThan(0);
      // phần máy không còn URL nguồn (khong-lo-nguon nợ #6)
      expect(JSON.stringify(def)).not.toMatch(/http|erddap|noaa/i);
      for (let i = 0; i < def.colorStops.length; i += 2) {
        expect(typeof def.colorStops[i]).toBe("number");
        expect(typeof def.colorStops[i + 1]).toBe("string");
      }
    }
  });
});

describe("buildScalarCells", () => {
  it("bỏ ô NaN (đất liền), giữ số đã làm tròn", () => {
    const cells = buildScalarCells({
      lats: [10, 10.5],
      lons: [108, 108.5],
      values: [
        [0.12345, NaN],
        [NaN, -0.04567],
      ],
      date: "2026-06-09",
    });
    expect(cells).toHaveLength(2);
    expect(cells[0]).toEqual({ lat: 10, lon: 108, v: 0.123 });
    expect(cells[1].v).toBe(-0.046);
  });
});

describe("loadSeaScalar", () => {
  it("nguồn trả đủ ô → ok; thưa/lỗi → thử lùi ngày rồi mới ok:false", async () => {
    // 25 ô (≥ ngưỡng 20)
    const rows: unknown[][] = [];
    for (let i = 0; i < 5; i++)
      for (let j = 0; j < 5; j++)
        rows.push(["2026-06-09T00:00:00Z", 10 + i * 0.5, 108 + j * 0.5, 0.1]);
    const okFetch = (() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ table: { rows } }),
      })) as unknown as typeof fetch;
    const r = await loadSeaScalar("ssha", okFetch);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.cells).toHaveLength(25);
      expect(r.date).toBe("2026-06-09");
    }

    const badFetch = (() =>
      Promise.resolve({ ok: false })) as unknown as typeof fetch;
    expect((await loadSeaScalar("ssha", badFetch)).ok).toBe(false);

    // sss thưa → thử đủ 4 mốc thời gian rồi trả ok:false
    let calls = 0;
    const sparseFetch = (() => {
      calls++;
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ table: { rows: [] } }),
      });
    }) as unknown as typeof fetch;
    expect((await loadSeaScalar("sss", sparseFetch)).ok).toBe(false);
    expect(calls).toBe(4); // (last) → (last-3)
  });
});
