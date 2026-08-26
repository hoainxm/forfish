import { describe, it, expect } from "vitest";
import { warningVoices } from "@/lib/warning-sound";

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
