// CẦU OPEN-METEO + SNAPSHOT HÔM NAY (2026-10-27, anh Long: "tất cả tải lưu server đi" + "thường ko có dự báo, chỉ có
// ngày hôm nay thôi"): máy bà con không gọi thẳng nguồn nữa; cầu chỉ nhận danh sách trắng; bản hôm nay cắt từ bản gốc.
import { describe, expect, it, vi } from "vitest";
import { isOmApi, isOmModelCode, omDays, omServerUrl, omShape, omUpstream, omUrl } from "@/lib/om-url";
import { cat1Ngay, goc1Ngay, snapshotChoMay } from "@/lib/snapshot-today";
import { stepHourIndices } from "@/lib/forecast-grid";

const q = (s: string) => new URLSearchParams(s);

describe("omUpstream — danh sách trắng", () => {
  it("lượt hợp lệ ⇒ URL đúng host, giữ tham số", () => {
    const u = omUpstream("marine", q("latitude=10.5,11&longitude=107,108.25&forecast_days=1&hourly=wave_height&timezone=Asia/Ho_Chi_Minh"))!;
    expect(u.startsWith("https://marine-api.open-meteo.com/v1/marine?")).toBe(true);
    expect(u).toContain("forecast_days=1");
    expect(omUpstream("ensemble", q("latitude=10&longitude=107&forecast_days=15&m=e1"))).toContain("ensemble-api");
  });
  it("chặn: API lạ, tham số lạ, toạ độ hỏng, số ngày ngoài 1–16, ký tự lạ", () => {
    expect(omUpstream("archive", q("latitude=10&longitude=107&forecast_days=1"))).toBeNull();
    expect(omUpstream("__proto__", q("latitude=10&longitude=107&forecast_days=1"))).toBeNull();
    expect(omUpstream("forecast", q("latitude=10&longitude=107&forecast_days=1&past_days=90"))).toBeNull();
    expect(omUpstream("forecast", q("latitude=abc&longitude=107&forecast_days=1"))).toBeNull();
    expect(omUpstream("forecast", q("longitude=107&forecast_days=1"))).toBeNull();
    expect(omUpstream("forecast", q("latitude=10&longitude=107&forecast_days=17"))).toBeNull();
    expect(omUpstream("forecast", q("latitude=10&longitude=107&forecast_days=0"))).toBeNull();
    expect(omUpstream("forecast", q("latitude=10&longitude=107&forecast_days=1&hourly=a<b"))).toBeNull();
    const nhieu = Array.from({ length: 201 }, () => "10").join(",");
    expect(omUpstream("forecast", q(`latitude=${nhieu}&longitude=${nhieu}&forecast_days=1`))).toBeNull();
  });
  it("omDays: thiếu ⇒ 7 (mặc định nguồn, tức cần gói); hỏng ⇒ null", () => {
    expect(omDays(q("forecast_days=1"))).toBe(1);
    expect(omDays(q(""))).toBe(7);
    expect(omDays(q("forecast_days=1x"))).toBeNull();
    expect(isOmApi("forecast")).toBe(true);
    expect(isOmApi("toString")).toBe(false);
  });
  it("omUrl: trên máy (có window) đi cầu same-origin; máy chủ (cron) gọi thẳng nguồn", () => {
    expect(omUrl("forecast", "forecast_days=1")).toBe("https://api.open-meteo.com/v1/forecast?forecast_days=1");
    vi.stubGlobal("window", {});
    try {
      expect(omUrl("forecast", "latitude=10&longitude=107&forecast_days=1")).toBe(
        "/api/om/forecast?latitude=10&longitude=107&forecast_days=1",
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("không lộ mô hình (khong-lo-nguon nợ #3)", () => {
  it("máy gửi mã mờ m=…, máy chủ đổi ra models=…; mã lạ ⇒ route từ chối, cron bỏ qua", () => {
    expect(omUpstream("marine", q("latitude=10&longitude=107&forecast_days=1&m=s1"))).toContain("models=ncep_gfswave025");
    expect(omUpstream("marine", q("latitude=10&longitude=107&forecast_days=1&m=zz"))).toBeNull();
    // tên thật không còn được nhận từ máy
    expect(omUpstream("marine", q("latitude=10&longitude=107&forecast_days=1&models=ncep_gfswave025"))).toBeNull();
    expect(omServerUrl("forecast", "latitude=10&m=g2&forecast_days=1")).toBe(
      "https://api.open-meteo.com/v1/forecast?latitude=10&models=ecmwf_ifs025&forecast_days=1",
    );
    expect(omServerUrl("forecast", "m=zz&latitude=10")).toBe("https://api.open-meteo.com/v1/forecast?&latitude=10");
    for (const c of ["s1", "s2", "g2", "g3", "e1"]) expect(isOmModelCode(c), c).toBe(true);
  });
  it("omShape: dựng lại hình riêng — bỏ trường phụ của nguồn, giữ số; lưới nhiều điểm là mảng", () => {
    const tho = { latitude: 10, longitude: 107, generationtime_ms: 0.2, utc_offset_seconds: 25200, timezone: "Asia/Bangkok", timezone_abbreviation: "+07", elevation: 0, hourly_units: { time: "iso8601" }, hourly: { time: ["t"], wave_height: [1] } };
    expect(omShape(tho)).toEqual({ latitude: 10, longitude: 107, utc_offset_seconds: 25200, hourly: { time: ["t"], wave_height: [1] } });
    expect(omShape([tho, tho])).toHaveLength(2);
    expect(omShape("x")).toBeNull();
  });
});

describe("snapshot hôm nay — dựng từ bản gốc", () => {
  it("id hôm nay ⇒ id gốc; id thường ⇒ null", () => {
    expect(goc1Ngay("grid:d1")).toBe("grid:d3");
    expect(goc1Ngay("scalar:cloud:d1")).toBe("scalar:cloud:d3");
    expect(goc1Ngay("sea:vung-tau:d1")).toBe("sea:vung-tau");
    for (const id of ["grid:d3", "sea:vung-tau", "scalar:cloud:d16", "curdepth:t50:d1"]) expect(goc1Ngay(id), id).toBeNull();
  });
  it("cảng: chỉ giữ ngày đầu (cả dạng mảng trần lẫn {savedAt, days})", () => {
    const d = [{ date: "2026-10-27" }, { date: "2026-10-28" }];
    expect(cat1Ngay("sea:vung-tau:d1", d)).toEqual([{ date: "2026-10-27" }]);
    expect(cat1Ngay("sea:vung-tau:d1", { savedAt: 5, days: d })).toEqual({ savedAt: 5, days: [{ date: "2026-10-27" }] });
  });
  it("lưới dải màu: cắt theo đúng số mẫu khung 1 ngày, giữ tiền tố", () => {
    const times = Array.from({ length: 40 }, (_, i) => `t${i}`);
    const g = { kind: "cloud", times, cells: [{ lat: 1, lon: 2, values: times.map((_, i) => i) }] };
    const n = stepHourIndices(1, 25).length;
    const out = cat1Ngay("scalar:cloud:d1", g) as typeof g;
    expect(out.times).toEqual(times.slice(0, n));
    expect(out.cells[0].values).toEqual(times.map((_, i) => i).slice(0, n));
    expect(cat1Ngay("scalar:cloud:d1", null)).toBeNull();
  });
});

describe("snapshotChoMay — không đưa dấu nguồn xuống máy (khong-lo-nguon nợ #4)", () => {
  it("bỏ sources, giữ nguyên số + savedAt; mảng trần đi nguyên", () => {
    const g = { savedAt: 5, times: [1], cells: [{ lat: 1 }], sources: [{ id: "x", savedAt: 5, days: ["d"] }] };
    expect(snapshotChoMay(g)).toEqual({ savedAt: 5, times: [1], cells: [{ lat: 1 }] });
    const d = [{ date: "2026-10-27" }];
    expect(snapshotChoMay(d)).toBe(d);
    expect(snapshotChoMay(null)).toBeNull();
  });
});
