import { describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
import {
  applyDayShift,
  dayShiftFor,
  boxOf,
  cellDeltaLogKg,
  chainDay,
  moonDelta,
  moonFracAt,
  moonWhy,
  parseOni,
  parsePdo,
  type ChainDrivers,
  type ChainParams,
} from "@/lib/fish-chain";
import { assembleDrivers, boxMeans } from "@/lib/fish-chain-drivers";
import { scoreBase } from "@/lib/fish-base";
import { moonPhase } from "@/lib/moon";
import paramsJson from "@/data/fish-chain-params.json";
import { BOXES } from "../../../scripts/dong-dan/hop.mjs";

const P0 = paramsJson as unknown as ChainParams;
/** thông số thử: mọi cổng tắt, trừ chỗ test bật */
const base = (): ChainParams => ({
  ...P0,
  trang: {},
  moi: {},
  gio: {},
  enso: {},
  luzon: {},
  khiHau: {},
});
const drivers = (o: Partial<ChainDrivers> = {}): ChainDrivers => ({
  date: "2026-07-15",
  moonFrac: 0,
  oni: { gannhat: 1.5, muaGanNhat: "MJJ 2026", djf: 1.2, nguon: "cpc" },
  pdo: { giaTri: -1, thang: "2026-06", nguon: "ncei" },
  luzon: { dAdt: 0.3, ngay: "2026-07-14" },
  hop: { SCU: { chlLog: -0.2, sst: 28 } },
  ...o,
});

describe("hộp nước trồi", () => {
  it("điểm trong SCU/MKU, ngoài mọi hộp ⇒ null", () => {
    expect(boxOf(11.5, 109.5, P0)).toBe("SCU");
    expect(boxOf(9.0, 107.5, P0)).toBe("MKU");
    expect(boxOf(20, 107, P0)).toBeNull();
  });
  it("hộp trong file thông số = hop.mjs (một nguồn)", () => {
    for (const [k, v] of Object.entries(BOXES)) expect(P0.hop[k as keyof typeof P0.hop]).toEqual(v);
  });
});

describe("trăng theo nhóm loài", () => {
  it("cổng tắt ⇒ 0; bật ⇒ c·cos + s·sin", () => {
    const p = base();
    expect(moonDelta("cephalopod", 0, p)).toBe(0);
    p.trang.cephalopod = { c: 0.1, s: 0, ap: true, lyDo: "test" };
    expect(moonDelta("cephalopod", 0, p)).toBeCloseTo(0.1);
    expect(moonDelta("cephalopod", 0.5, p)).toBeCloseTo(-0.1);
    expect(moonDelta("cephalopod", 0.25, p)).toBeCloseTo(0);
  });
  it("dScore = log kg × điểm/log kg, kẹp ±dichToiDa, và chỉ nhóm có thay đổi", () => {
    const p = base();
    p.trang.cephalopod = { c: 0.1, s: 0, ap: true, lyDo: "test" };
    p.trang["pelagic-small"] = { c: 1, s: 0, ap: true, lyDo: "test" }; // rất lớn ⇒ bị kẹp
    p.trang.demersal = { c: 0.5, s: 0, ap: false, lyDo: "chưa qua" };
    const day = chainDay(drivers({ moonFrac: 0 }), p);
    expect(day.dScore.cephalopod).toBe(Math.round(0.1 * p.doiDiem.diemMoiLogKg));
    expect(day.dScore["pelagic-small"]).toBe(p.doiDiem.dichToiDa);
    expect(day.dScore.demersal).toBeUndefined();
    expect(day.dangAp).toEqual(expect.arrayContaining(["trang:cephalopod", "trang:pelagic-small"]));
    expect(day.chuaAp).toContain("trang:demersal");
  });
  it("trăng theo LOÀI thắng thông số nhóm, kể cả khi bằng 0 (không lùi về nhóm)", () => {
    const p = base();
    p.trang["pelagic-small"] = { c: 0.1, s: 0, ap: true, lyDo: "test" };
    p.trangLoai = {
      "Cá nục": { c: 0.2, s: 0, ap: true, coDuLieu: true, lyDo: "test" },
      "Cá cơm": { c: -0.1, s: 0, ap: false, coDuLieu: true, lyDo: "có dữ liệu, chưa qua cổng" },
      "Cá trích": { c: 0.9, s: 0, ap: false, lyDo: "ít chuyến" },
    };
    const day = chainDay(drivers({ moonFrac: 0 }), p);
    expect(dayShiftFor(day, "Cá nục", "pelagic-small")).toBe(Math.round(0.2 * p.doiDiem.diemMoiLogKg));
    expect(dayShiftFor(day, "Cá cơm", "pelagic-small")).toBe(0); // có dữ liệu riêng mà không qua ⇒ 0, KHÔNG lùi về nhóm
    expect(dayShiftFor(day, "Cá trích", "pelagic-small")).toBe(day.dScore["pelagic-small"]); // chưa đủ dữ liệu ⇒ dùng nhóm
    expect(dayShiftFor(null, "Cá nục", "pelagic-small")).toBeUndefined();
  });
  it("applyDayShift kẹp 0..100; moonWhy chỉ nói khi |d| ≥ 2", () => {
    expect(applyDayShift(98, 8)).toBe(100);
    expect(applyDayShift(3, -8)).toBe(0);
    expect(applyDayShift(50, undefined)).toBe(50);
    expect(moonWhy(1)).toBeNull();
    expect(moonWhy(4)).toBe("tuần trăng thuận");
    expect(moonWhy(-4)).toBe("tuần trăng không thuận");
  });
  it("pha trăng lấy lúc 20:00 giờ VN (13:00 UTC) theo lib/moon.ts; lặp sau một chu kỳ giao hội", () => {
    expect(moonFracAt("2026-10-23")).toBeCloseTo(moonPhase(new Date("2026-10-23T13:00:00Z")).frac, 10);
    const d = moonFracAt("2026-07-01") - moonFracAt("2026-07-31"); // 30 ngày ≈ 1 chu kỳ + 0,47 ngày
    expect(Math.abs(d)).toBeLessThan(0.03);
  });
});

describe("thành phần theo vùng", () => {
  it("không có cổng / không có khí hậu ⇒ 0 (an toàn)", () => {
    const p = base();
    expect(cellDeltaLogKg("pelagic-small", 11.5, 109.5, drivers(), p)).toBe(0);
    p.moi["SCU|pelagic-small"] = { beta: 0.1, ap: true, lyDo: "test" };
    expect(cellDeltaLogKg("pelagic-small", 11.5, 109.5, drivers(), p)).toBe(0); // thiếu khí hậu chlLog
  });
  it("phù du: β × dị thường chuẩn hoá theo tháng; ngoài hộp ⇒ 0", () => {
    const p = base();
    p.moi["SCU|pelagic-small"] = { beta: 0.1, ap: true, lyDo: "test" };
    p.khiHau = { chlLog: { SCU: { "7": [-0.4, 0.1] } } };
    expect(cellDeltaLogKg("pelagic-small", 11.5, 109.5, drivers(), p)).toBeCloseTo(0.1 * 2); // (-0.2+0.4)/0.1 = 2
    expect(cellDeltaLogKg("pelagic-small", 20, 107, drivers(), p)).toBe(0);
  });
  it("ENSO chỉ trong tháng khai báo", () => {
    const p = base();
    p.enso["SCU|cephalopod"] = { beta: -0.05, ap: true, thang: [6, 7, 8, 9], lyDo: "test" };
    expect(cellDeltaLogKg("cephalopod", 11.5, 109.5, drivers(), p)).toBeCloseTo(-0.05 * 1.2);
    expect(cellDeltaLogKg("cephalopod", 11.5, 109.5, drivers({ date: "2026-12-01" }), p)).toBe(0);
  });
});

describe("file thông số", () => {
  it("áp ⇒ đã qua cổng thống kê; gió chưa có đầu vào production ⇒ KHÔNG BAO GIỜ áp", () => {
    for (const rec of [P0.trang, P0.trangLoai ?? {}, P0.moi, P0.gio, P0.enso, P0.luzon] as Record<string, { ap: boolean; quaCong?: boolean; lyDo: string }>[]) {
      for (const g of Object.values(rec)) {
        if (g.ap) expect(g.quaCong).toBe(true);
        expect(typeof g.lyDo).toBe("string");
      }
    }
    for (const g of Object.values(P0.gio)) expect(g.ap).toBe(false);
  });
});

describe("đọc chỉ số khí hậu", () => {
  it("ONI: mùa gần nhất + DJF năm", () => {
    const t = " SEAS  YR   TOTAL   ANOM\n  DJF 2026  26.1  -0.39\n  MAM 2026  27.9   0.46\n  JAS 2026  29.1   2.16\n";
    expect(parseOni(t, 2026)).toEqual({ gannhat: 2.16, muaGanNhat: "JAS 2026", djf: -0.39 });
  });
  it("PDO: tháng gần nhất có số, bỏ 99.99", () => {
    const t = "ERSST PDO Index:\n Year Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec\n2026 -1.24 -1.00 -1.42 -1.62 -1.68 -1.72 -2.16 -1.89 -1.55 99.99 99.99 99.99\n";
    expect(parsePdo(t)).toEqual({ giaTri: -1.55, thang: "2026-09" });
  });
});

describe("đầu vào ngày (server)", () => {
  it("thiếu mạng ⇒ dự phòng trong thông số, không ném", () => {
    const d = assembleDrivers("2026-10-23", null, {}, P0);
    expect(d.oni.nguon).toBe("du-phong");
    expect(d.pdo.nguon).toBe("du-phong");
    expect(d.luzon.dAdt).toBeNull();
    expect(d.hop.SCU).toEqual({ chlLog: null, sst: null });
  });
  it("trung bình hộp từ lưới, phù du lấy log10", () => {
    const lats = [11, 11.25, 11.5, 11.75], lons = [109, 109.25, 109.5];
    const g = { lats, lons, values: lats.map(() => lons.map(() => 1)) };
    expect(boxMeans(g, P0).SCU).toBe(1);
    expect(boxMeans(g, P0, Math.log10).SCU).toBe(0);
    expect(boxMeans(g, P0).NCU).toBeNull(); // không đủ 4 ô
  });
});

describe("scoreBase nhận offset trước xếp hạng", () => {
  it("offset đổi thứ hạng giữa hai ô bằng nhau; vắng offset = như cũ", () => {
    const p = { coef: { other: [0, 0, 0, 0, 0] }, coefNoCatch: { other: [0, 0, 0, 0] }, hotShare: 0.5, mode: "irls" as const };
    const feats = [[0, 0, 0, 1], [0, 0, 0, 1]] as never;
    const a = scoreBase(p as never, "other", feats, true);
    expect(a[0]).toBe(a[1]);
    const b = scoreBase(p as never, "other", feats, true, [0, 1]);
    expect(b[1]).toBeGreaterThan(b[0]);
  });
});
