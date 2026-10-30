// Bộ đo fit/đo dự báo cá (mảnh 2B, rà pipeline 2026-10-18): chạy selftest của các script thuần mỗi `npm test`.
import { describe, expect, it } from "vitest";
import { selftest as fitLibSelftest } from "../../../scripts/fish-fit-lib.mjs";
import { selftest as metricsSelftest } from "../../../scripts/fish-metrics-local.mjs";
import { selftest as exp2dSelftest } from "../../../scripts/fish-2d-experiment.mjs";
import { decodeFeatures, encodeFeatures } from "../../../scripts/fish-features-cache.mjs";
import { SPECIES_PROFILES, scoreCell, seasonWeights } from "../fish-predict";

describe("scripts/fish-fit-lib.mjs", () => {
  it("selftest: AUC histogram, trong-nghề, nếp đệm, chuỗi tiến, bootstrap khối (kể cả chênh động), Benjamini–Hochberg", async () => {
    await expect(fitLibSelftest()).resolves.toBeUndefined();
  });
});

describe("scripts/fish-metrics-local.mjs", () => {
  it("selftest: AUC cục bộ 1°×1° và Spearman dị thường", () => {
    expect(() => metricsSelftest()).not.toThrow();
  });
});

describe("scripts/fish-2d-experiment.mjs", () => {
  it("selftest: logistic có offset + khoá dấu khớp irlsLogistic, dấu βk theo hồ sơ loài", async () => {
    await expect(exp2dSelftest()).resolves.toBeUndefined();
  });
});

describe("scripts/fish-features-cache.mjs", () => {
  it("mã hoá Float32 ↔ giải mã giữ null/NaN và cho cùng điểm scoreCell (lệch < 1e-4)", () => {
    const p = SPECIES_PROFILES.find((x) => x.short === "ngừ vằn")!;
    const regions: string[] = [];
    const F = {
      i: 3, j: 4, lat: 12.25, lon: 110.5, regionId: "nam-trung-bo" as const, t: 28.4, tBottom: null, tDeep: 12.5, c: 0.31,
      fThermFront: 0.2, fChlFront: 0.1, fEddy: 0.3, coldStr: 0.1, warmStr: 0, upwTerm: null, convTerm: 0.4, thermoAnomM: -6,
      depthM: 850, coastKm: 40, hasReef: true,
    };
    const G = decodeFeatures(encodeFeatures([F], regions), regions)[0];
    expect(G.tBottom).toBeNull();
    expect(G.upwTerm).toBeNull();
    expect(G.hasReef).toBe(true);
    const sW = seasonWeights("nam-trung-bo", 8).get(p.species)!;
    const k = { month: 8, climo: null };
    expect(Math.abs(scoreCell(F, p, sW, 0.3, 0.2, k) - scoreCell(G, p, sW, 0.3, 0.2, k))).toBeLessThan(1e-4);
  });
});
