import { describe, expect, it } from "vitest";
import { buildSeaCells, savedStampVN, type SeaCellInput } from "@/lib/sea-cells";
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

  it("cạn NGUY HIỂM đứng đầu lưới; cạn thường vẫn ở cuối", () => {
    const nguy = buildSeaCells(base({ depth: { label: "Cạn dưới 5 m", tone: "danger" } }));
    expect(nguy[0]).toMatchObject({ k: "Độ sâu", tone: "text-danger", full: true });
    expect(nguy.filter((x) => x.k === "Độ sâu")).toHaveLength(1);
    const thuong = buildSeaCells(base({ depth: { label: "Sâu 30–50 m", tone: "plain" } }));
    expect(thuong[thuong.length - 1].k).toBe("Độ sâu");
  });

  it("dòng chảy BẢN LƯU: bỏ số lúc lưu, lấy dòng đại diện của ngày", () => {
    const c = buildSeaCells(
      base({
        day: day({ curKmh: 1.5, curDirDeg: 180 }),
        cond: { ...base().cond, curKmh: 4, curDirDeg: 0, stale: true },
      }),
    );
    expect(c.find((x) => x.k.startsWith("Dòng"))?.v).toBe("1,5 km/h");
  });

  it("thiếu số thì im: không giật, sóng '—', không dòng", () => {
    const c = buildSeaCells(base({ isToday: false, day: day({ gustMaxKmh: 0, waveMaxM: 0 }) }));
    expect(c.find((x) => x.k === "Giật")).toBeUndefined();
    expect(c.find((x) => x.k === "Sóng")?.v).toBe("—");
    expect(c.find((x) => x.k.startsWith("Dòng"))).toBeUndefined();
  });

  it("sóng lúc này và mức cao nhất cùng in một số sau làm tròn → không thêm ô 'Sóng tới'", () => {
    const c = buildSeaCells(base({ day: day({ waveMaxM: 0.86 }), cond: { ...base().cond, waveM: 0.9 } }));
    expect(c.find((x) => x.k === "Sóng tới")).toBeUndefined();
  });
});

describe("savedStampVN — dấu giờ bản lưu", () => {
  it("lưu hôm nay: chỉ HH:MM giờ VN", () => {
    // 01:30 UTC = 08:30 VN, ngày 20/10
    expect(savedStampVN(Date.UTC(2026, 9, 20, 1, 30), "2026-10-20")).toBe("08:30");
  });
  it("lưu ngày khác: kèm dd/MM", () => {
    expect(savedStampVN(Date.UTC(2026, 9, 18, 1, 30), "2026-10-20")).toBe("18/10 08:30");
  });
  it("ranh giới ngày theo giờ VN, không theo UTC", () => {
    // 17:30 UTC ngày 19 = 00:30 VN ngày 20 → vẫn là hôm nay
    expect(savedStampVN(Date.UTC(2026, 9, 19, 17, 30), "2026-10-20")).toBe("00:30");
  });
});
