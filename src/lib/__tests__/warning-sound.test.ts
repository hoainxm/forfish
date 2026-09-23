import { describe, it, expect } from "vitest";
import { hazardVoices, offRouteVoices, warningVoices } from "@/lib/warning-sound";

// Phần thuần của chuông cảnh báo (bung motif × bồi âm). Web Audio không test
// được trong jsdom, nhưng lịch giọng là dữ liệu thuần → soi được ở đây.
describe("warningVoices — lịch giọng chuông cảnh báo SDVICO", () => {
  const voices = warningVoices();

  it("5 nốt × 4 bồi âm = 20 giọng", () => {
    expect(voices.length).toBe(20);
  });

  it("mọi giọng hợp lệ: freq>0, peakGain trong (0,1], attack>0, decay>attack, startOffset>=0", () => {
    for (const v of voices) {
      expect(v.freq).toBeGreaterThan(0);
      expect(v.peakGain).toBeGreaterThan(0);
      expect(v.peakGain).toBeLessThanOrEqual(1);
      expect(v.attack).toBeGreaterThan(0);
      expect(v.decay).toBeGreaterThan(v.attack);
      expect(v.startOffset).toBeGreaterThanOrEqual(0);
    }
  });

  it("có đủ tần số gốc chữ ký D5·A5·D6 (motif nhận diện)", () => {
    const fundamentals = voices.map((v) => Math.round(v.freq));
    expect(fundamentals).toContain(587); // D5
    expect(fundamentals).toContain(880); // A5
    expect(fundamentals).toContain(1175); // D6
  });

  it("bồi âm cao tắt NHANH hơn gốc (giữ hồn chuông)", () => {
    // cùng nốt D5 (start 0): giọng gốc (587Hz) phải ngân lâu hơn giọng bồi 2× (1174Hz)
    const d5Voices = voices.filter((v) => v.startOffset === 0);
    const fund = d5Voices.find((v) => Math.round(v.freq) === 587);
    const oct = d5Voices.find((v) => Math.round(v.freq) === 1175);
    expect(fund).toBeDefined();
    expect(oct).toBeDefined();
    expect(oct!.decay).toBeLessThan(fund!.decay);
  });
});

describe("offRouteVoices — chuông LỆCH TUYẾN phải KHÁC chuông ranh giới", () => {
  const off = offRouteVoices();
  const border = warningVoices();

  it("2 nốt × 4 bồi âm = 8 giọng (ngắn hơn hẳn chuông ranh giới)", () => {
    expect(off.length).toBe(8);
    expect(off.length).toBeLessThan(border.length);
  });

  it("motif ĐI XUỐNG (A5 trước, D5 sau) — ngược chiều chuông ranh giới đi lên", () => {
    const firstNote = off.filter((v) => v.startOffset === 0);
    const laterNote = off.filter((v) => v.startOffset > 0);
    const fund = (vs: typeof off) => Math.min(...vs.map((v) => Math.round(v.freq)));
    expect(fund(firstNote)).toBe(880); // A5
    expect(fund(laterNote)).toBe(587); // D5 — thấp hơn ⇒ đi xuống
  });

  it("chỉ 2 mốc vào — không có đuôi ngân 3 tầng như chuông ranh giới", () => {
    const starts = [...new Set(off.map((v) => v.startOffset))];
    const borderStarts = [...new Set(border.map((v) => v.startOffset))];
    expect(starts).toHaveLength(2);
    expect(borderStarts.length).toBeGreaterThan(starts.length);
  });

  it("tắt nhanh hơn chuông ranh giới (không ngân dài như cảnh báo biên)", () => {
    expect(Math.max(...off.map((v) => v.startOffset + v.decay))).toBeLessThan(
      Math.max(...border.map((v) => v.startOffset + v.decay)),
    );
  });

  it("chuông RANH GIỚI vẫn y nguyên 20 giọng — bất biến, không được đổi", () => {
    expect(border.length).toBe(20);
  });
});

describe("hazardVoices — chuông HIỂM HOẠ (motif 3) phải KHÁC hai chuông kia", () => {
  const hz = hazardVoices();
  const off = offRouteVoices();
  const border = warningVoices();
  const fund = (vs: typeof hz) => Math.min(...vs.map((v) => Math.round(v.freq)));

  it("2 nốt × 4 bồi âm = 8 giọng", () => {
    expect(hz.length).toBe(8);
  });

  it("hai nốt CÙNG cao độ A5 (880 Hz) — không lên (ranh giới), không xuống (lệch tuyến)", () => {
    const starts = [...new Set(hz.map((v) => v.startOffset))].sort((a, b) => a - b);
    expect(starts).toHaveLength(2);
    const n1 = hz.filter((v) => v.startOffset === starts[0]);
    const n2 = hz.filter((v) => v.startOffset === starts[1]);
    expect(fund(n1)).toBe(880);
    expect(fund(n2)).toBe(880);
    // đối chiếu: lệch tuyến A5→D5 đi xuống, ranh giới D5→A5→D6 đi lên
    const offStarts = [...new Set(off.map((v) => v.startOffset))].sort((a, b) => a - b);
    expect(fund(off.filter((v) => v.startOffset === offStarts[1]))).toBeLessThan(880);
    expect(fund(border.filter((v) => v.startOffset === 0))).toBeLessThan(880);
  });

  it("GIẬT: nốt 2 vào đúng 90 ms sau khi nốt 1 tắt", () => {
    const starts = [...new Set(hz.map((v) => v.startOffset))].sort((a, b) => a - b);
    const n1Fund = hz.find((v) => v.startOffset === starts[0] && Math.round(v.freq) === 880)!;
    expect(starts[1] - (n1Fund.startOffset + n1Fund.decay)).toBeCloseTo(0.09, 6);
  });

  it("ngắn hơn cả chuông lệch tuyến, và ngắn hơn hẳn chuông ranh giới", () => {
    const len = (vs: typeof hz) => Math.max(...vs.map((v) => v.startOffset + v.decay));
    expect(len(hz)).toBeLessThan(len(off));
    expect(len(hz)).toBeLessThan(len(border));
  });

  it("hai chuông cũ vẫn y nguyên (20 và 8 giọng, cao độ gốc không đổi)", () => {
    expect(border.length).toBe(20);
    expect(off.length).toBe(8);
    expect(fund(off.filter((v) => v.startOffset === 0))).toBe(880);
  });
});
