import { describe, expect, it } from "vitest";
import {
  horizonPrior,
  combineConfidence,
  skillForLead,
  applyBiasCorrection,
  assessForecast,
  leadOf,
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

/* LỖI đã sửa: tầm ngày tính theo VỊ TRÍ MẢNG → bản dự báo lưu trong máy từ
   mấy hôm trước vẫn được coi là "dự báo gần — khá sát" và nắn bias theo hàng
   lead 1. Sai theo hướng LẠC QUAN, đúng chỗ nguy hiểm nhất. */
describe("leadOf — tầm ngày tính từ HÔM NAY, không theo vị trí mảng", () => {
  it("không biết hôm nay → đành lùi về vị trí mảng", () => {
    expect(leadOf("2026-07-25", 0)).toBe(0);
    expect(leadOf("2026-07-27", 2, null)).toBe(2);
  });
  it("biết hôm nay → đếm ngày thật", () => {
    expect(leadOf("2026-07-25", 0, "2026-07-25")).toBe(0);
    expect(leadOf("2026-07-25", 0, "2026-07-20")).toBe(5); // bản lưu 5 hôm trước
    expect(leadOf("2026-07-20", 0, "2026-07-25")).toBe(0); // ngày đã qua → kẹp 0
  });
});

describe("bản lưu cũ bị hạ độ tin đúng mức", () => {
  const saved = [
    day("2026-07-25", 0.5, 12),
    day("2026-07-26", 0.6, 15),
    day("2026-07-27", 1.0, 25),
  ];

  it("assessForecast: phần tử đầu của bản lưu 5 hôm trước KHÔNG còn là ngày 0", () => {
    const q = assessForecast(saved, null, SKILL, "2026-07-20");
    expect(q[0].daysAhead).toBe(5);
    expect(q[0].conf.tone).toBe("warn");
    // so với đúng ngày hôm nay thì độ tin phải cao hơn hẳn
    const tuoi0 = assessForecast(saved, null, SKILL, "2026-07-25");
    expect(tuoi0[0].daysAhead).toBe(0);
    expect(tuoi0[0].confidence).toBeGreaterThan(q[0].confidence);
  });

  it("applyBiasCorrection: bản lưu cũ không được nắn theo hàng lead 1", () => {
    // lead thật của phần tử đầu = 5+1 = 6, bảng không có → giữ nguyên số gốc
    const out = applyBiasCorrection(saved, SKILL, "2026-07-20");
    expect(out[0].windMaxKmh).toBe(saved[0].windMaxKmh);
    // cùng dữ liệu nhưng đúng hôm nay thì mới được nắn theo lead 1
    const homNay = applyBiasCorrection(saved, SKILL, "2026-07-25");
    expect(homNay[0].windMaxKmh).toBeCloseTo(saved[0].windMaxKmh - 4, 6);
  });
});
