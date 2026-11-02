import { describe, expect, it } from "vitest";
import { alertToEvent, collectVoiceEvents, initVoiceMemory, type VoiceSources } from "@/lib/nav-voice/events";
import { stormObservation } from "@/lib/nav-voice/nav-storm";
import type { StormStatus } from "@/lib/storms";

// Bốn lỗ giọng đọc rà đối chiếu Vietmap (15 §33, 2026-11-02)
const base: VoiceSources = {
  nowMs: 0, unit: "nm", alerts: [], border: null, offRoute: null, gps: "tracking", info: null, storm: null, sea: null,
  depthHere: null, moving: true, legsPassed: 0, legsTotal: 0, arrived: false,
};
const chay = (...luot: Partial<VoiceSources>[]) => {
  let mem = initVoiceMemory();
  const text: string[] = [];
  for (const l of luot) {
    const r = collectVoiceEvents(mem, { ...base, ...l });
    mem = r.mem;
    text.push(...r.events.map((e) => e.text));
  }
  return text;
};

describe("1. cảnh báo đỏ tính mạng được nhắc lại", () => {
  it("đỏ bậc 1 ⇒ persist; vàng / đỏ bậc khác ⇒ không", () => {
    const a = { id: "x", cau: "Rạn phía trước.", chuong: true, rung: true, distKm: 0.3, etaMin: 2 };
    expect(alertToEvent({ ...a, bac: 1, muc: "do" }).persist).toBe(true);
    expect(alertToEvent({ ...a, bac: 1, muc: "vang" }).persist).toBe(false);
    expect(alertToEvent({ ...a, bac: 3, muc: "vang" }).persist).toBe(false);
  });
});

describe("2. bão gần đọc khu trú bão gần nhất", () => {
  const status = {
    kind: "co-bao",
    checkedAt: 0,
    storms: [{ id: "b1", name: "", kindLabel: "Bão", lat: 15.5, lon: 110, track: [], forecast: [], areas: [] }],
  } as unknown as StormStatus;
  it("≤200 km ⇒ có câu khu trú; không có khu ⇒ không bịa", () => {
    const pos = { lat: 15, lon: 109.5 };
    expect(stormObservation(status, pos, 0, "nm", { ten: "Sa Kỳ", km: 40 })?.text).toContain(
      "Khu tránh trú bão gần nhất là Sa Kỳ, còn chừng",
    );
    expect(stormObservation(status, pos, 0, "nm", null)?.text).not.toContain("Khu tránh trú");
  });
  it("bão xa ⇒ không đọc khu trú", () => {
    expect(stormObservation(status, { lat: 9, lon: 104 }, 0, "nm", { ten: "Sa Kỳ", km: 40 })?.text).not.toContain("Khu tránh trú");
  });
});

describe("3. báo trước khi tới đích", () => {
  it("vào mốc 10 phút đọc một lần, lùi xa gấp đôi mới đọc lại", () => {
    const t = chay(
      { conLaiKm: 20, tocDoKmh: 15 },
      { conLaiKm: 2.4, tocDoKmh: 15 },
      { conLaiKm: 2.2, tocDoKmh: 15 },
      { conLaiKm: 2.6, tocDoKmh: 15 },
    );
    expect(t.filter((x) => x.includes("tới điểm đến"))).toEqual(["Còn chừng 1,3 hải lý tới điểm đến."]);
  });
  it("không tuyến / đã tới ⇒ im", () => {
    expect(chay({ conLaiKm: null }, { conLaiKm: 0.3, arrived: true }).some((x) => x.startsWith("Còn chừng"))).toBe(false);
  });
});

describe("4. định vị yếu", () => {
  it("vượt 150 m đọc một lần; dao động 110–200 m không đọc lại; về dưới 100 m rồi yếu lại ⇒ đọc lại", () => {
    const t = chay({ saiSoM: 30 }, { saiSoM: 200 }, { saiSoM: 120 }, { saiSoM: 180 }, { saiSoM: 50 }, { saiSoM: 300 });
    expect(t.filter((x) => x.startsWith("Định vị lệch")).length).toBe(2);
  });
  it("đang mất định vị ⇒ không đọc định vị yếu", () => {
    expect(chay({ gps: "lost", saiSoM: 900 }).some((x) => x.startsWith("Định vị lệch"))).toBe(false);
  });
});
