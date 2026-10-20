import { describe, expect, it } from "vitest";
import { buildSeaCells, type SeaCellInput } from "@/lib/sea-cells";
import type { SeaPointDay } from "@/lib/marine-weather";

const day = (over: Partial<SeaPointDay> = {}): SeaPointDay =>
  ({
    date: "2026-10-20",
    waveMaxM: 1.2,
    windMaxKmh: 30,
    gustMaxKmh: 45,
    precipMm: 0,
    score: 70,
    level: "ok",
    ...over,
  }) as SeaPointDay;

const base = (over: Partial<SeaCellInput> = {}): SeaCellInput => ({
  day: day(),
  cond: { windKmh: 12, windDirDeg: 45, waveM: 0.5, curKmh: null, curDirDeg: null, stale: false },
  isToday: true,
  tide: null,
  fish: null,
  season: [],
  depth: null,
  ...over,
});

const keys = (inp: SeaCellInput) => buildSeaCells(inp).map((c) => c.k.split(" ")[0]);

describe("buildSeaCells — lưới số ngăn gió sóng", () => {
  it("gió/sóng đứng TRƯỚC âm lịch và trăng (ngăn chỉ cao 1/3 màn)", () => {
    const k = keys(base());
    expect(k.indexOf("Gió")).toBe(0);
    expect(k.indexOf("Sóng")).toBeLessThan(k.indexOf("Âm"));
    expect(k.indexOf("Sóng")).toBeLessThan(k.indexOf("Trăng"));
  });

  it("số mới hôm nay: dùng số lúc này + thêm ô 'tới' khi mức cao nhất lớn hơn", () => {
    const c = buildSeaCells(base());
    expect(c.find((x) => x.k === "Sóng")?.v).toBe("0,5 m");
    expect(c.find((x) => x.k === "Sóng tới")?.v).toBe("1,2 m");
    expect(c.find((x) => x.k === "Gió tới")).toBeTruthy();
  });

  it("BẢN LƯU: không dùng số 'lúc này' (là lúc lưu) — lấy mức cao nhất ngày, không ô 'tới'", () => {
    const c = buildSeaCells(base({ cond: { ...base().cond, stale: true } }));
    expect(c.find((x) => x.k === "Sóng")?.v).toBe("1,2 m");
    expect(c.find((x) => x.k === "Sóng tới")).toBeUndefined();
    expect(c.find((x) => x.k === "Gió tới")).toBeUndefined();
    expect(c.find((x) => x.k.startsWith("Gió"))?.v).toBe("cấp 5");
  });

  it("sóng ước theo gió: có '~' và màu cảnh báo", () => {
    const c = buildSeaCells(base({ isToday: false, day: day({ waveEstimated: true }) }));
    const s = c.find((x) => x.k === "Sóng");
    expect(s?.v).toBe("~1,2 m");
    expect(s?.tone).toBe("text-warn");
  });

  it("mưa thường thành ô 'Trời'; mưa to / dông KHÔNG thành ô (đã là dòng cảnh báo)", () => {
    expect(buildSeaCells(base({ day: day({ wmoCode: 61 }) })).find((x) => x.k === "Trời")?.v).toBe("Có mưa");
    expect(buildSeaCells(base({ day: day({ wmoCode: 95 }) })).find((x) => x.k === "Trời")).toBeUndefined();
  });

  it("con nước, cá, độ sâu theo đúng dữ liệu bên gọi tra sẵn", () => {
    const c = buildSeaCells(
      base({
        tide: { now: { m: 2.1, trend: "len" }, events: [{ kind: "high", atMs: Date.UTC(2026, 9, 20, 3, 30), heightM: 3 }] },
        fish: { tempC: 28.4, names: ["Cá ngừ"] },
        depth: { label: "Cạn dưới 5 m", tone: "danger" },
      }),
    );
    expect(c.find((x) => x.k === "Nước ↑ lên")).toBeTruthy();
    expect(c.find((x) => x.k === "Lớn 10:30")).toBeTruthy();
    expect(c.find((x) => x.k === "Cá")?.full).toBe(true);
    expect(c.find((x) => x.k === "Độ sâu")?.tone).toBe("text-danger");
  });
});
