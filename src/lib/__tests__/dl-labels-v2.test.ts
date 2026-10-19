/**
 * Cổng cho NHÃN v2 của lớp dự báo cá (rà pipeline 2026-10-18, mảnh 2C).
 * Các hàm thuần ở scripts/ (fishing-def · gear-infer · dl-calibrate-bands · dl-labels-v2) — nhãn sai thì mọi
 * phép đo AUCeff phía sau đều vô nghĩa, nên định nghĩa "giờ đánh" và bộ suy nghề được canh bằng test.
 */
import { describe, it, expect } from "vitest";
import {
  makePortIndex, nearAnyPort, bandAt, fishingVerdict, inPortIntervals, segmentsRaw, gearGroup, isNightVN, pointInRing, loadVnRing,
} from "../../../scripts/fishing-def.mjs";
import { inferGears, THR } from "../../../scripts/gear-infer.mjs";
import { calibrateBand, bandGrid } from "../../../scripts/dl-calibrate-bands.mjs";
import { huberFit, choosePairs, linkMates, lenClass, softFactor, trustScore, tapShareOf, isRoundSingle, SOFT_SIGNALS } from "../../../scripts/dl-labels-v2.mjs";

const TABLE = { maxGapH: 4, minPortKm: 10, nightStill: { gears: ["vay"], from: 18, to: 6 }, bands: { vay: { band: [0.6, 3] }, re: { band: [0.3, 1] }, khac: { band: [0.3, 1] } } };
const tNight = Date.UTC(2026, 7, 1, 15, 0) / 1000; // 22:00 giờ VN
const tDay = Date.UTC(2026, 7, 1, 5, 0) / 1000; // 12:00 giờ VN

describe("định nghĩa giờ đánh dùng chung (fishing-def)", () => {
  const ports = makePortIndex([{ lat: 10, lng: 107 }, { lat: NaN, lng: 1 }]);
  const ctx = { table: TABLE, ports };
  const far = { t: tNight, lat: 11, lon: 108, dtH: 1, kn: 0.1 };

  it("cách cảng 10 km: trong thì loại, ngoài thì không", () => {
    expect(nearAnyPort(ports, 10.05, 107)).toBe(true);
    expect(nearAnyPort(ports, 10.2, 107)).toBe(false);
  });
  it("vmin = 0 chỉ vây và chỉ ban đêm", () => {
    expect(isNightVN(tNight)).toBe(true);
    expect(isNightVN(tDay)).toBe(false);
    expect(bandAt(TABLE, "vay", tNight)[0]).toBe(0);
    expect(bandAt(TABLE, "vay", tDay)[0]).toBe(0.6);
    expect(bandAt(TABLE, "re", tNight)[0]).toBe(0.3);
    expect(fishingVerdict(far, "vay", ctx)).toBe("fish");
    expect(fishingVerdict(far, "re", ctx)).toBe("band");
  });
  it("phán quyết theo thứ tự gap → dải → IN/OUT → cảng", () => {
    const ivs = inPortIntervals([["IN", 1000, "K", "x"], ["OUT", 5000, "K", "x"]], 0, 100000);
    expect(fishingVerdict({ ...far, dtH: 5 }, "vay", ctx)).toBe("gap");
    expect(fishingVerdict({ ...far, kn: 9 }, "vay", ctx)).toBe("band");
    expect(fishingVerdict({ ...far, t: 3000, kn: 1 }, "vay", ctx, ivs)).toBe("inport");
    expect(fishingVerdict({ ...far, lat: 10.02, lon: 107 }, "vay", ctx)).toBe("port");
  });
  it("OUT không có IN: tàu đang ở cảng từ đầu; IN không có OUT: ở cảng tới hết", () => {
    expect(inPortIntervals([["OUT", 5000, "K", "x"]], 3000, 9000)[0][1]).toBe(5000);
    expect(inPortIntervals([["IN", 9000, "K", "x"]], 0, 9500)[0][1]).toBe(Infinity);
    expect(inPortIntervals(undefined, 0, 1)).toEqual([]);
  });
  it("đoạn VMS và nhóm nghề", () => {
    const sg = segmentsRaw([[0, 10, 107], [3600, 10, 107.0167]]);
    expect(sg).toHaveLength(1);
    expect(sg[0].kn).toBeCloseTo(1, 1);
    expect(gearGroup("Lưới rê")).toBe("re");
    expect(gearGroup("?")).toBe("khac");
  });
});

describe("suy nghề tàu NULL (gear-infer)", () => {
  const vs = new Map<string, { lengthM: number; powerCv: number; gear: string | null }>();
  const lbs: unknown[] = [];
  let n = 0;
  const add = (code: string, len: number, pw: number, gear: string, copies: number) => {
    for (let i = 0; i < copies; i++) {
      const id = `V${n++}`;
      vs.set(id, { lengthM: len + (i % 3), powerCv: pw + i, gear });
      for (let t = 0; t < 5; t++) lbs.push({ vessel: { id }, landedKg: 100, species: { landed: [{ code, kg: 90 }, { code: "ZZ", kg: 10 }] } });
    }
  };
  add("AAA", 8, 50, "Câu", 120); add("BBB", 20, 500, "Kéo", 120); add("CCC", 22, 600, "Vây", 120);
  const unk = (id: string, code: string, len: number, pw: number, kg: number) => {
    vs.set(id, { lengthM: len, powerCv: pw, gear: null });
    for (let t = 0; t < 5; t++) lbs.push({ vessel: { id }, landedKg: kg, species: { landed: [{ code, kg }] } });
  };
  unk("U1", "AAA", 8, 50, 1000); unk("U2", "BBB", 20, 500, 1000); unk("U3", "CCC", 22, 600, 1000); unk("U9", "AAA", 8, 50, 10);

  it("tàu thiếu nghề về đúng lớp; tàu ít kg giữ '?'", () => {
    const r = inferGears(lbs, vs);
    const m = r.map as Record<string, { group: string }>;
    expect(m.U1.group).toBe("cau");
    expect(m.U2.group).toBe("keo");
    expect(m.U3.group).toBe("vay");
    expect(m.U9).toBeUndefined();
    expect(r.holdout.accuracy).toBeGreaterThan(0.95);
    expect(r.params.thr).toBe(THR);
  });
});

describe("bảng dải tốc độ (dl-calibrate-bands)", () => {
  it("lưới dò không có vmin = 0", () => {
    expect(bandGrid().every(([a, b]: number[]) => a > 0 && b > a + 0.4)).toBe(true);
  });
  it("chọn đúng dải khi giờ trong dải tỉ lệ với số mẻ; ít chuyến thì lùi về", () => {
    let seed = 1;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const trips = Array.from({ length: 300 }, () => {
      const hauls = 1 + Math.floor(rnd() * 9), kn: number[] = [], dt: number[] = [];
      for (let i = 0; i < hauls * 3; i++) { kn.push(1 + rnd()); dt.push(1); }
      for (let i = 0; i < 20; i++) { kn.push(rnd() < 0.5 ? 0.3 * rnd() : 3 + 2 * rnd()); dt.push(1); }
      return { segs: { kn: Float32Array.from(kn), dt: Float32Array.from(dt) }, hauls };
    });
    const c = calibrateBand(trips, { boot: 10 });
    expect(c.band).not.toBeNull();
    expect(c.band![0]).toBeLessThanOrEqual(1);
    expect(c.band![1]).toBe(2);
    expect(c.rho).toBeGreaterThan(0.9);
    expect(calibrateBand(trips.slice(0, 10)).fallback).toBe(true);
  });
});

describe("trọng số Huber, tàu thu mua, cặp kéo đôi (dl-labels-v2)", () => {
  it("Huber hạ trọng số ngoại lai, giữ hệ số đúng", () => {
    let seed = 3;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const rows = Array.from({ length: 200 }, () => { const x1 = rnd() * 3, x2 = rnd() * 3; return { x1, x2, y: 1 + 0.8 * x1 + 0.2 * x2 + (rnd() - 0.5) * 0.1 }; });
    for (let i = 0; i < 5; i++) rows[i].y += 6;
    const f = huberFit(rows);
    expect(f.beta[1]).toBeCloseTo(0.8, 1);
    expect(f.w[0]).toBeLessThan(0.2);
    expect(f.w[100]).toBeGreaterThan(0.9);
  });
  it("chỉ nhận cặp MỘT-ĐỐI-MỘT, đủ sự kiện, hai phía cùng thừa nhận", () => {
    const c = new Map([
      ["A", new Map([["B", 30]])], ["B", new Map([["A", 30]])],
      ["C", new Map([["D", 25], ["E", 20]])], ["D", new Map([["C", 25]])],
      ["F", new Map([["G", 5]])], ["G", new Map([["F", 5]])],
    ]);
    const p = choosePairs(c);
    expect(p).toEqual({ A: "B", B: "A" });
  });
  it("nối chuyến của hai tàu trong cặp theo chồng giờ ≥ 50 %", () => {
    const p = { A: "B", B: "A" };
    const rs: { vid: string; dep: number; arr: number; mate?: unknown }[] = [{ vid: "A", dep: 0, arr: 100 }, { vid: "B", dep: 10, arr: 95 }, { vid: "B", dep: 500, arr: 600 }, { vid: "X", dep: 0, arr: 100 }];
    expect(linkMates(rs, p)).toBe(1);
    expect(rs[0].mate).toBe(rs[1]);
    expect(rs[2].mate).toBeFalsy();
    expect(rs[3].mate).toBeFalsy();
  });
  it("lớp dài tàu", () => {
    expect(lenClass(11.9)).toBe("<12");
    expect(lenClass(24)).toBe(">=24");
    expect(lenClass(null)).toBe("?");
  });
});

describe("điểm tin cậy theo chuyến (khai sai có chủ đích)", () => {
  it("mỗi tín hiệu mềm: sạch = 1, lệch càng nhiều càng hạ, có sàn 0,3", () => {
    expect(softFactor("c2_repeat", { rep: 0 })).toBe(1);
    expect(softFactor("c2_repeat", { rep: 2 })).toBe(0.5);
    expect(softFactor("c4_mismatch", { ratio: 1.9 })).toBe(1);
    expect(softFactor("c4_mismatch", { ratio: 100 })).toBe(0.3);
    expect(softFactor("d1_port", { portKm: 100 })).toBe(0.5);
    expect(softFactor("d2_time", { arrDevH: 24 })).toBe(0.5);
    expect(softFactor("c5_carrier", { carrier: true })).toBe(0.7);
  });
  it("điểm = tích các tín hiệu đang bật; tắt hết = 1 (đúng cho ablation)", () => {
    const sig = { rep: 2, round: true, ratio: 1, carrier: false, portKm: 0, arrDevH: 0 };
    expect(trustScore(sig, SOFT_SIGNALS)).toBeCloseTo(0.4, 9);
    expect(trustScore(sig, SOFT_SIGNALS.filter((n: string) => n !== "c2_repeat"))).toBeCloseTo(0.8, 9);
    expect(trustScore(sig, [])).toBe(1);
  });
  it("tỉ trọng cá tạp/xô và số tròn một loài", () => {
    expect(tapShareOf([{ code: "CTA", kg: 60 }, { code: "SKJ", kg: 40 }])).toBe(0.6);
    expect(tapShareOf([])).toBeNull();
    expect(isRoundSingle([{ code: "X", kg: 600 }])).toBe(true);
    expect(isRoundSingle([{ code: "X", kg: 650 }])).toBe(false);
    expect(isRoundSingle([{ code: "X", kg: 600 }, { code: "Y", kg: 100 }])).toBe(false);
  });
  it("vòng vùng biển VN đọc từ vn-maritime-border.ts: trong / ngoài", () => {
    const ring = loadVnRing();
    expect(ring).not.toBeNull();
    expect(pointInRing(107, 20.5, ring)).toBe(true);
    expect(pointInRing(109.5, 12, ring)).toBe(true);
    expect(pointInRing(118, 14, ring)).toBe(false);
  });
});
