import { describe, expect, it } from "vitest";
import {
  horizonPrior,
  combineConfidence,
  skillForLead,
  applyBiasCorrection,
  assessForecast,
  type SkillTable,
} from "../forecast-quality";
import { scoreDay, levelOf, type ScoredSeaDay } from "../sea";

function day(date: string, waveMaxM: number, windMaxKmh: number): ScoredSeaDay {
  const d = { date, waveMaxM, windMaxKmh, gustMaxKmh: windMaxKmh * 1.4, precipMm: 0 };
  const score = scoreDay(d);
  return { ...d, score, level: levelOf(score) };
}

describe("horizonPrior", () => {
  it("giảm đơn điệu theo tầm ngày, kẹp [0.3,1]", () => {
    expect(horizonPrior(0)).toBeGreaterThan(horizonPrior(7));
    expect(horizonPrior(7)).toBeGreaterThan(horizonPrior(14));
    expect(horizonPrior(0)).toBeLessThanOrEqual(1);
    expect(horizonPrior(30)).toBeGreaterThanOrEqual(0.3);
  });
});

describe("combineConfidence", () => {
  it("không có ensemble/skill → bằng horizonPrior", () => {
    expect(combineConfidence(3)).toBeCloseTo(horizonPrior(3), 6);
  });
  it("ensemble kém chắc kéo độ tin xuống dưới prior", () => {
    const withLow = combineConfidence(1, 0.1, null);
    expect(withLow).toBeLessThan(horizonPrior(1));
  });
  it("ensemble chắc cao kéo độ tin lên trên prior ở ngày xa", () => {
    const withHigh = combineConfidence(10, 0.95, null);
    expect(withHigh).toBeGreaterThan(horizonPrior(10));
  });
  it("kẹp [0,1]", () => {
    expect(combineConfidence(0, 5, 5)).toBeLessThanOrEqual(1);
    expect(combineConfidence(20, -3, -3)).toBeGreaterThanOrEqual(0);
  });
});

const SKILL: SkillTable = {
  perLeadDay: [
    { leadDay: 1, windBias: 4, waveBias: 0.3, confidence: 0.9, n: 100 },
    { leadDay: 2, windBias: 0, waveBias: 0, confidence: 0.8, n: 50 },
    { leadDay: 3, windBias: 2, waveBias: 0.1, confidence: 0.6, n: 0 }, // n=0 → bỏ
  ],
};

describe("skillForLead", () => {
  it("trả dòng khớp lead khi đủ mẫu", () => {
    expect(skillForLead(SKILL, 1)?.confidence).toBe(0.9);
  });
  it("bỏ dòng n=0 và bảng rỗng", () => {
    expect(skillForLead(SKILL, 3)).toBeNull();
    expect(skillForLead({ perLeadDay: [] }, 1)).toBeNull();
    expect(skillForLead(null, 1)).toBeNull();
  });
});

describe("applyBiasCorrection", () => {
  it("trừ bias dương → gió/sóng giảm → điểm không thấp hơn (biển bớt động)", () => {
    const days = [day("2026-07-25", 1.5, 40), day("2026-07-26", 1.5, 40)];
    const out = applyBiasCorrection(days, SKILL);
    // ngày 1 có bias dương (mô hình báo cao hơn thực) → nắn xuống → điểm ≥ gốc
    expect(out[0].windMaxKmh).toBeCloseTo(36, 6);
    expect(out[0].waveMaxM).toBeCloseTo(1.2, 6);
    expect(out[0].score).toBeGreaterThanOrEqual(days[0].score);
    // ngày 2 bias 0 → giữ nguyên
    expect(out[1].windMaxKmh).toBe(days[1].windMaxKmh);
  });
  it("bảng rỗng → trả nguyên (không đụng input)", () => {
    const days = [day("2026-07-25", 1.0, 20)];
    const out = applyBiasCorrection(days, { perLeadDay: [] });
    expect(out[0]).toEqual(days[0]);
  });
  it("không mutate mảng gốc", () => {
    const days = [day("2026-07-25", 1.5, 40)];
    const before = days[0].windMaxKmh;
    applyBiasCorrection(days, SKILL);
    expect(days[0].windMaxKmh).toBe(before);
  });
});

describe("assessForecast", () => {
  const days = [
    day("2026-07-25", 0.5, 12),
    day("2026-07-26", 0.6, 15),
    day("2026-07-27", 1.0, 25),
  ];
  it("gộp ensemble theo date + trả cùng độ dài", () => {
    const ens = [
      { date: "2026-07-25", windSpreadKmh: 2, confidence: 0.95, members: 31 },
      { date: "2026-07-27", windSpreadKmh: 30, confidence: 0.2, members: 31 },
    ];
    const q = assessForecast(days, ens, SKILL);
    expect(q).toHaveLength(3);
    expect(q[0].daysAhead).toBe(0);
    expect(q[0].ensembleSpreadKmh).toBe(2);
    expect(q[0].skillBacked).toBe(true); // lead 1 có skill
    // ngày ensemble kém chắc → độ tin thấp hơn ngày ensemble chắc
    expect(q[2].confidence).toBeLessThan(q[0].confidence);
    expect(q[1].ensembleSpreadKmh).toBeNull(); // không có ensemble ngày này
  });
  it("không ensemble/skill vẫn chạy (degrade)", () => {
    const q = assessForecast(days, null, null);
    expect(q).toHaveLength(3);
    expect(q[0].confidence).toBeGreaterThan(q[2].confidence);
  });
});
