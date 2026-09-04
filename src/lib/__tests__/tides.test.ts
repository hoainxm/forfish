/*  THUỶ TRIỀU — BỘ TEST QUAN TRỌNG NHẤT CỦA TRỤC 1.
    Sai giờ con nước là bà con MẮC CẠN, nên ở đây không có dữ liệu giả: test mở
    file hằng số THẬT trong public/data rồi đối chiếu với SỐ ĐO MỰC NƯỚC THẬT
    tại chính hai trạm Hòn Dấu và Vũng Tàu (UHSLC/JASL Research Quality Data
    Set — cùng loại số liệu mà cơ quan hải văn dùng để lập bảng thuỷ triều).

    ── VÌ SAO ĐỐI CHIẾU SỐ ĐO CHỨ KHÔNG PHẢI "BẢNG THUỶ TRIỀU IN SẴN" ────────
    Bảng thuỷ triều bản thân nó cũng chỉ là một BẢN DỰ TÍNH; các trang tra cứu
    tiếng Việt trên mạng không nói họ lấy hằng số từ đâu, lấy chúng làm chuẩn
    thì hoá ra đi đo mình bằng một cái thước không rõ nguồn. Số đo triều ký là
    sự thật gốc — chính nó sinh ra mọi bảng thuỷ triều. Ngoài ra bộ test còn
    đối chiếu với hai điều đã CÔNG BỐ và kiểm chứng được: phân loại chế độ
    triều từng cảng (nhật triều đều / bán nhật triều không đều…) và mực nước
    trung bình Hòn Dấu trên số 0 hải đồ.

    ── SAI SỐ CHẤP NHẬN ĐƯỢC & VÌ SAO ───────────────────────────────────────
    Dự báo ở đây là phần THIÊN VĂN thuần. Số đo thật còn cõng thêm nước dâng do
    gió mùa, áp thấp, lũ sông — vài chục cm là bình thường và KHÔNG phải lỗi
    của bộ hằng số. Đo được trên chính các ngày nhúng dưới đây:
      · lệch quân phương (RMS) từng ngày: 4,9 – 8,3 cm
      · lệch lớn nhất một giờ nào đó:     11,3 – 20,2 cm
    Nên ngưỡng chốt là RMS ≤ 12 cm và lệch đỉnh ≤ 30 cm — rộng hơn số đo thật
    khoảng 1,5 lần, đủ chỗ cho một mùa gió khác, nhưng siết đủ để BẮT NGAY nếu
    ai đó làm lệch quy ước pha, đổi công thức thiên văn hay sinh lại hằng số
    hỏng (những lỗi đó đẩy sai số lên hàng nửa mét, không phải vài cm).
    Giờ đỉnh/chân: ≤ 45 phút so với giờ số đo cao/thấp nhất — số đo chỉ có từng
    giờ nên bản thân nó đã thô tới ±30 phút.  */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  decodeTideStations,
  isModelStation,
  nearestTideStation,
  tideClockText,
  tideDraftWarning,
  tideExtremeText,
  tideExtremesForDay,
  tideHeightAt,
  tideHeightText,
  tideModelCaveat,
  tideRangeText,
  tideTrustText,
  tideCardAt,
  tideDaySeries,
  tideMoonText,
  tideTrendAt,
  tideTrendText,
  tideUpcoming,
  tideUpcomingText,
  vnIsoDate,
  TIDE_FAR_KM,
  type TideStation,
} from "../tides";

const FILE = join(process.cwd(), "public", "data", "tide-stations.v1.json");
const raw = JSON.parse(readFileSync(FILE, "utf8"));
const stations = decodeTideStations(raw);
const byId = (id: string): TideStation => {
  const st = stations.find((s) => s.id === id);
  if (!st) throw new Error(`thiếu trạm ${id}`);
  return st;
};

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

/* ── SỐ ĐO THẬT ────────────────────────────────────────────────────────────
   Mực nước từng giờ (mm, mốc "station zero" riêng của trạm), giờ 00h→23h theo
   NGÀY LỊCH VIỆT NAM. Nguồn: UHSLC/JASL RQDS bản ghi #3832 (Vũng Tàu) và #6502
   (Hòn Dấu), tải qua ERDDAP. Giấy phép UHSLC: dùng và phát hành lại tự do.
   Chọn mỗi trạm một ngày NƯỚC CƯỜNG và một ngày NƯỚC KÉM — hai chế độ khó
   nhất: nước cường thử biên độ, nước kém thử việc không bịa ra con nước giả. */
const OBSERVED: { id: string; days: { date: string; mm: number[] }[] }[] = [
  {
    id: "vung-tau",
    days: [
      // nước cường
      {
        date: "2024-06-07",
        mm: [
          2794, 3383, 3736, 3787, 3657, 3397, 3153, 2953, 2926, 3040, 3269,
          3453, 3605, 3628, 3457, 3127, 2603, 1924, 1238, 633, 221, 210, 657,
          1382,
        ],
      },
      // nước kém
      {
        date: "2024-06-16",
        mm: [
          2112, 1948, 1843, 1954, 2152, 2425, 2751, 3052, 3260, 3387, 3337,
          3185, 2927, 2629, 2350, 2118, 1993, 1966, 2063, 2259, 2499, 2620,
          2752, 2744,
        ],
      },
    ],
  },
  {
    id: "hon-dau",
    days: [
      // nước cường
      {
        date: "1995-11-26",
        mm: [
          1950, 2430, 2810, 3140, 3390, 3540, 3590, 3560, 3440, 3230, 2910,
          2530, 2160, 1790, 1420, 1090, 850, 690, 590, 480, 420, 440, 600, 920,
        ],
      },
      // nước kém — cả ngày nước gần như đứng, biên độ 0,6 m
      {
        date: "1995-11-05",
        mm: [
          2020, 2060, 2020, 1950, 1910, 1860, 1840, 1820, 1870, 1890, 1880,
          1860, 1820, 1810, 1790, 1750, 1760, 1740, 1760, 1840, 2000, 2070,
          2220, 2350,
        ],
      },
    ],
  },
];

const RMS_MAX_M = 0.12;
const PEAK_MAX_M = 0.3;
const TIME_MAX_MIN = 45;

/** epoch ms của giờ `h` (0..23) ngày lịch VN `date`. */
function vnHourMs(date: string, h: number): number {
  return Date.parse(`${date}T00:00:00Z`) - VN_OFFSET_MS + h * 3600000;
}

describe("hằng số điều hoà thật ↔ số đo mực nước thật", () => {
  for (const grp of OBSERVED) {
    const st = byId(grp.id);
    /*  Mốc số đo ("station zero") KHÁC số 0 hải đồ của mình, nên trước khi so
        phải trừ đi một hằng số. Hằng số đó tính MỘT LẦN cho cả trạm trên toàn
        bộ số đo nhúng ở đây — KHÔNG chỉnh riêng từng ngày, vì chỉnh từng ngày
        là tự tay xoá mất sai số mình đang muốn đo. */
    const all = grp.days.flatMap((d) =>
      d.mm.map((mm, h) => mm / 1000 - tideHeightAt(st, vnHourMs(d.date, h))),
    );
    const offset = all.reduce((a, v) => a + v, 0) / all.length;

    it(`${st.name}: lệch mốc số đo là MỘT hằng số (không trôi giữa các ngày)`, () => {
      for (const d of grp.days) {
        const dayOffset =
          d.mm.reduce(
            (a, mm, h) => a + mm / 1000 - tideHeightAt(st, vnHourMs(d.date, h)),
            0,
          ) / d.mm.length;
        // trôi > 20 cm giữa hai ngày cách nhau chục hôm = pha hoặc thiên văn sai
        expect(Math.abs(dayOffset - offset)).toBeLessThan(0.2);
      }
    });

    for (const d of grp.days) {
      it(`${st.name} ${d.date}: dự báo bám số đo trong ${RMS_MAX_M * 100} cm`, () => {
        let se = 0;
        let peak = 0;
        for (let h = 0; h < 24; h++) {
          const err = d.mm[h] / 1000 - offset - tideHeightAt(st, vnHourMs(d.date, h));
          se += err * err;
          peak = Math.max(peak, Math.abs(err));
        }
        expect(Math.sqrt(se / 24)).toBeLessThan(RMS_MAX_M);
        expect(peak).toBeLessThan(PEAK_MAX_M);
      });

      /*  NGÀY NƯỚC ĐỨNG KHÔNG SO GIỜ ĐỈNH ĐƯỢC. Hòn Dấu 5/11/1995 cả ngày chỉ
          nhích 0,6 m; ở mức đó "giờ nước ròng" bị nước dâng do gió đẩy đi cả
          tiếng — đó là chuyện của thời tiết chứ không phải bộ hằng số sai (ca
          RMS phía trên vẫn 6,6 cm). Nên hai ca dưới chỉ chạy khi con nước hôm
          đó đủ rõ (≥ 1 m) và đỉnh/chân không dính mép ngày. */
      const obsRange = (Math.max(...d.mm) - Math.min(...d.mm)) / 1000;
      const distinct = obsRange >= 1;

      it(`${st.name} ${d.date}: giờ nước lớn / nước ròng khớp số đo`, () => {
        const ex = tideExtremesForDay(st, d.date);
        expect(ex.length).toBeGreaterThan(0);
        if (!distinct) return;

        const hiObs = d.mm.indexOf(Math.max(...d.mm));
        const loObs = d.mm.indexOf(Math.min(...d.mm));
        const nearest = (kind: "high" | "low", hourObs: number) => {
          const target = vnHourMs(d.date, hourObs);
          const cands = ex.filter((e) => e.kind === kind);
          if (!cands.length) return Infinity;
          return Math.min(
            ...cands.map((e) => Math.abs(e.atMs - target) / 60000),
          );
        };
        /*  Chỉ so khi giờ cao/thấp nhất KHÔNG dính mép ngày: dính mép thì đỉnh
            thật có thể nằm sang hôm sau, so là so nhầm. */
        if (hiObs > 0 && hiObs < 23) {
          expect(nearest("high", hiObs)).toBeLessThan(TIME_MAX_MIN);
        }
        if (loObs > 0 && loObs < 23) {
          expect(nearest("low", loObs)).toBeLessThan(TIME_MAX_MIN);
        }
      });

      it(`${st.name} ${d.date}: biên độ ngày khớp số đo trong 25 cm`, () => {
        const ex = tideExtremesForDay(st, d.date);
        if (!distinct || ex.length < 2) return;
        const predRange =
          Math.max(...ex.map((e) => e.heightM)) -
          Math.min(...ex.map((e) => e.heightM));
        expect(Math.abs(predRange - obsRange)).toBeLessThan(0.25);
      });

      if (!distinct) {
        it(`${st.name} ${d.date}: ngày nước đứng KHÔNG bịa ra con nước giả`, () => {
          // 0,6 m cả ngày ⇒ nhiều lắm một lên một xuống, không phải bốn con nước
          expect(tideExtremesForDay(st, d.date).length).toBeLessThanOrEqual(2);
        });
      }
    }
  }
});

describe("đối chiếu với đặc trưng triều đã công bố của từng cảng", () => {
  /*  Hệ số F = (K1+O1)/(M2+S2) phân loại chế độ triều (thang dùng phổ biến
      trong hải văn: F > 3 nhật triều đều · 1,5–3 nhật triều không đều ·
      0,25–1,5 bán nhật triều không đều · < 0,25 bán nhật triều đều).
      Bốn cảng dưới đây có phân loại đã in trong tài liệu hải văn Việt Nam —
      nếu bộ hằng số sinh sai thì F rơi ngay ra khỏi ô của nó. */
  const amp = (st: TideStation, name: string) =>
    st.cons.find((c) => c.name === name)?.amp ?? 0;
  const form = (st: TideStation) =>
    (amp(st, "K1") + amp(st, "O1")) / (amp(st, "M2") + amp(st, "S2"));

  it("Hòn Dấu là nhật triều ĐỀU (F > 3) — vịnh Bắc Bộ", () => {
    expect(form(byId("hon-dau"))).toBeGreaterThan(3);
  });

  it("Vũng Tàu là bán nhật triều KHÔNG ĐỀU (0,25 < F < 1,5)", () => {
    const f = form(byId("vung-tau"));
    expect(f).toBeGreaterThan(0.25);
    expect(f).toBeLessThan(1.5);
  });

  it("Quy Nhơn và Vũng Áng là nhật triều KHÔNG ĐỀU (1,5 < F < 3)", () => {
    for (const id of ["quy-nhon", "vung-ang"]) {
      const f = form(byId(id));
      expect(f).toBeGreaterThan(1.5);
      expect(f).toBeLessThan(3);
    }
  });

  it("Hòn Dấu: mực nước trung bình ≈ 1,9 m trên số 0 hải đồ (giá trị công bố)", () => {
    // z0 của mình là mực nước thấp nhất lý thuyết tự tính; nó phải trùng
    // xấp xỉ số 0 hải đồ Hòn Dấu — mốc độ cao quốc gia, đã công bố ~1,86–1,90 m
    expect(byId("hon-dau").z0).toBeGreaterThan(1.6);
    expect(byId("hon-dau").z0).toBeLessThan(2.3);
  });

  it("Hòn Dấu ngày nước cường chỉ có MỘT con nước lên xuống", () => {
    const ex = tideExtremesForDay(byId("hon-dau"), "1995-11-26");
    expect(ex.filter((e) => e.kind === "high")).toHaveLength(1);
    expect(ex.filter((e) => e.kind === "low")).toHaveLength(1);
  });

  it("Vũng Tàu ngày nước cường có HAI con nước lên xuống", () => {
    const ex = tideExtremesForDay(byId("vung-tau"), "2024-06-07");
    expect(ex.filter((e) => e.kind === "high")).toHaveLength(2);
    expect(ex.filter((e) => e.kind === "low")).toHaveLength(2);
  });
});

describe("file public/data/tide-stations.v1.json", () => {
  /*  Gate KHÔNG cứng "đúng 4": trần nguồn UHSLC/JASL+IOC hôm nay là 4 trạm VN
      (xem docs/research/thuy-trieu-2026-09.md), nhưng ngày nào nguồn mở thêm
      trạm thì chỉ được PHÉP THÊM, không được bớt. Nên gate là:
        · giữ nguyên 4 trạm gốc (tập con bắt buộc),
        · tổng số trạm ≥ 4,
        · MỖI trạm — cũ hay mới — có nguồn UHSLC, có RMSE kiểm chứng, đủ sóng. */
  const REQUIRED = ["hon-dau", "quy-nhon", "vung-ang", "vung-tau"];
  const gauges = stations.filter((s) => s.nguon !== "model");
  const models = stations.filter((s) => s.nguon === "model");

  it("giữ đủ 4 trạm ĐO gốc, chỉ được thêm — không được bớt", () => {
    const ids = stations.map((s) => s.id);
    for (const id of REQUIRED) expect(ids).toContain(id);
    // 4 trạm gốc phải là trạm ĐO (không được biến thành trạm mô hình)
    for (const id of REQUIRED) {
      expect(stations.find((s) => s.id === id)!.nguon).not.toBe("model");
    }
    expect(stations.length).toBeGreaterThanOrEqual(REQUIRED.length);
    expect(new Set(ids).size).toBe(ids.length); // không id trùng
  });

  it("trạm ĐO (gauge): nguồn UHSLC, sai số kiểm chứng ngoài mẫu, đủ sóng", () => {
    expect(gauges.length).toBeGreaterThanOrEqual(4);
    for (const st of gauges) {
      expect(st.source).toMatch(/UHSLC/);
      expect(st.rmseM).not.toBeNull();
      expect(st.rmseM!).toBeLessThan(0.2); // kiểm chứng ngoài mẫu < 20 cm
      expect(st.cons.length).toBeGreaterThan(15);
    }
  });

  it("trạm MÔ HÌNH (model): gắn cờ EOT20 rõ, KHÔNG đội lốt trạm đo", () => {
    for (const st of models) {
      // KHÔNG bao giờ được ghi nguồn UHSLC — đó là chỗ dễ đội lốt nhất
      expect(st.source).not.toMatch(/UHSLC/);
      expect(st.source).toMatch(/EOT20/);
      expect(st.nguon).toBe("model");
      // độ tin có con số thật (sai số EOT20↔trạm đo), rộng hơn ngưỡng trạm đo
      expect(st.rmseM).not.toBeNull();
      expect(st.rmseM!).toBeLessThan(0.5);
      // đủ 8 sóng thiên văn chính để tính được con nước
      expect(st.cons.length).toBeGreaterThanOrEqual(6);
      for (const main of ["M2", "K1", "O1"]) {
        expect(st.cons.some((c) => c.name === main)).toBe(true);
      }
    }
  });

  it("ghi nguồn + cảnh báo quy ước pha nằm ngay trong file", () => {
    expect(raw.credit).toMatch(/UHSLC/);
    expect(raw.credit).toMatch(/tham khảo/);
    expect(raw.phaseConvention).toMatch(/tides\.ts/);
  });

  it("toạ độ trạm nằm trong vùng biển Việt Nam", () => {
    for (const st of stations) {
      expect(st.lat).toBeGreaterThan(8);
      expect(st.lat).toBeLessThan(23);
      expect(st.lon).toBeGreaterThan(102);
      expect(st.lon).toBeLessThan(112);
    }
  });

  it("số 0 hải đồ đúng là mực nước thấp nhất — cả năm không âm quá 5 cm", () => {
    for (const st of stations) {
      let min = Infinity;
      const t0 = Date.UTC(2026, 0, 1);
      for (let t = t0; t < t0 + 366 * 86400000; t += 30 * 60000) {
        min = Math.min(min, tideHeightAt(st, t));
      }
      expect(min).toBeGreaterThan(-0.05);
      expect(min).toBeLessThan(0.35);
    }
  });

  it("decodeTideStations chặn file sai phiên bản / sai định dạng", () => {
    expect(() => decodeTideStations(null)).toThrow();
    expect(() => decodeTideStations({ v: 2, stations: [] })).toThrow();
    expect(() => decodeTideStations({ v: 1, stations: "x" })).toThrow();
  });

  it("decodeTideStations bỏ bản ghi hỏng nhưng giữ bản ghi lành", () => {
    const good = raw.stations[0];
    const out = decodeTideStations({
      v: 1,
      stations: [good, { id: "xx", name: "X" }, { ...good, cons: [] }],
    });
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe(good.id);
  });

  it("decodeTideStations bỏ bản ghi có tên sóng lạ (không đoán bừa)", () => {
    const bad = {
      ...raw.stations[0],
      cons: [{ name: "XYZ9", amp: 1, phase: 0 }],
    };
    expect(decodeTideStations({ v: 1, stations: [bad] })).toHaveLength(0);
  });
});

describe("nói tiếng người", () => {
  const at = (date: string, h: number, m = 0) =>
    Date.parse(`${date}T00:00:00Z`) - VN_OFFSET_MS + h * 3600000 + m * 60000;

  it("giờ đọc theo buổi kiểu bà con nói", () => {
    expect(tideClockText(at("2026-06-15", 14))).toBe("2 giờ chiều");
    expect(tideClockText(at("2026-06-15", 20, 30))).toBe("8 giờ rưỡi tối");
    expect(tideClockText(at("2026-06-15", 5, 15))).toBe("5 giờ 15 sáng");
    expect(tideClockText(at("2026-06-15", 12))).toBe("12 giờ trưa");
    expect(tideClockText(at("2026-06-15", 0))).toBe("12 giờ đêm");
    expect(tideClockText(at("2026-06-15", 2))).toBe("2 giờ khuya");
    expect(tideClockText(at("2026-06-15", 23, 40))).toBe("11 giờ 40 đêm");
  });

  it("làm tròn 5 phút — không giả vờ chính xác từng phút", () => {
    expect(tideClockText(at("2026-06-15", 14, 2))).toBe("2 giờ chiều");
    expect(tideClockText(at("2026-06-15", 14, 13))).toBe("2 giờ 15 chiều");
  });

  it("độ cao viết dấu phẩy kiểu Việt Nam, một số lẻ", () => {
    expect(tideHeightText(1.83)).toBe("1,8 m");
    expect(tideHeightText(0.44)).toBe("0,4 m");
    expect(tideHeightText(2)).toBe("2 m");
  });

  it("mỗi con nước một dòng, đúng kiểu chữ đã chốt", () => {
    expect(
      tideExtremeText({ atMs: at("2026-06-15", 14), heightM: 1.83, kind: "high" }),
    ).toBe("Nước lớn lúc 2 giờ chiều · 1,8 m");
    expect(
      tideExtremeText({ atMs: at("2026-06-15", 20), heightM: 0.42, kind: "low" }),
    ).toBe("Nước ròng lúc 8 giờ tối · 0,4 m");
  });

  it("câu biên độ phân biệt nước cường / nước kém trên CHÍNH trạm đó", () => {
    const vt = byId("vung-tau");
    expect(tideRangeText(vt, "2024-06-07")).toMatch(/nước cường/);
    expect(tideRangeText(vt, "2024-06-16")).toMatch(/nước kém/);
    expect(tideRangeText(vt, "khong-phai-ngay")).toBeNull();
  });

  it("ngày chỉ một lần quay đầu vẫn có câu, không trả về trống", () => {
    // Hòn Dấu 1/9/2026: nhật triều gặp kỳ nước kém — cả ngày một lần quay đầu
    const hd = byId("hon-dau");
    expect(tideExtremesForDay(hd, "2026-09-01").length).toBeLessThan(2);
    expect(tideRangeText(hd, "2026-09-01")).toMatch(/nước gần như đứng/);
  });

  it("mọi ngày trong một năm đều nói được một câu biên độ", () => {
    for (const st of stations) {
      for (let d = 0; d < 365; d += 17) {
        const iso = new Date(Date.UTC(2026, 0, 1) + d * 86400000)
          .toISOString()
          .slice(0, 10);
        expect(tideRangeText(st, iso)).toMatch(/^Nước lên xuống /);
      }
    }
  });

  it("mọi câu xuất ra đều là chữ Việt đời thường, không có jargon", () => {
    const vt = byId("vung-tau");
    const lines = tideExtremesForDay(vt, "2024-06-07").map(tideExtremeText);
    expect(lines.length).toBeGreaterThan(0);
    for (const l of lines) {
      expect(l).not.toMatch(/UTC|amplitude|phase|biên độ|m MSL|LAT/);
      expect(l).toMatch(/^Nước (lớn|ròng) lúc /);
    }
  });
});

describe("cảnh báo mắc cạn", () => {
  const lows = [
    { atMs: Date.UTC(2026, 5, 15, 13, 0), heightM: 0.4, kind: "low" as const },
  ];

  it("cảnh báo khi nước ròng không đủ cho mớn tàu + khoảng hở", () => {
    const msg = tideDraftWarning(lows, { draftM: 2.5, chartDepthM: 2.2 });
    expect(msg).toMatch(/Coi chừng cạn/);
    expect(msg).toMatch(/chờ nước lên/);
  });

  it("im lặng khi nước vẫn đủ sâu", () => {
    expect(tideDraftWarning(lows, { draftM: 2.5, chartDepthM: 6 })).toBeNull();
  });

  it("KHÔNG đoán khi thiếu độ sâu hải đồ hoặc mớn tàu", () => {
    expect(
      tideDraftWarning(lows, { draftM: 2.5, chartDepthM: NaN }),
    ).toBeNull();
    expect(tideDraftWarning(lows, { draftM: 0, chartDepthM: 2 })).toBeNull();
    expect(tideDraftWarning([], { draftM: 2.5, chartDepthM: 0.1 })).toBeNull();
  });
});

describe("chọn trạm gần nhất + nói thật về độ tin cậy", () => {
  it("Hải Phòng ra Hòn Dấu, Cần Giờ ra Vũng Tàu", () => {
    expect(nearestTideStation(stations, 20.85, 106.68)?.station.id).toBe(
      "hon-dau",
    );
    expect(nearestTideStation(stations, 10.41, 106.96)?.station.id).toBe(
      "vung-tau",
    );
  });

  it("toạ độ hỏng / danh sách rỗng → null, không đoán", () => {
    expect(nearestTideStation(stations, NaN, 106)).toBeNull();
    expect(nearestTideStation([], 20, 106)).toBeNull();
  });

  it("trạm càng xa câu cảnh báo càng nặng", () => {
    expect(tideTrustText(10)).toBeNull();
    expect(tideTrustText(80)).toMatch(/hơi xa/);
    expect(tideTrustText(400)).toMatch(/ở xa/);
    expect(tideTrustText(NaN)).toBeNull();
  });

  it("trạm MÔ HÌNH luôn được gắn cờ 'ước tính' — kể cả khi Ở GẦN", () => {
    const model = stations.find((s) => s.nguon === "model");
    expect(model, "cần ít nhất một trạm mô hình để kiểm").toBeTruthy();
    // ở gần (dưới 30 km): trạm đo thật thì im, trạm mô hình vẫn phải nhắc
    expect(tideTrustText(5)).toBeNull();
    expect(tideTrustText(5, model)).toMatch(/ước tính/i);
    // ở xa: câu mô hình vẫn có mặt
    expect(tideTrustText(400, model)).toMatch(/ước tính/i);
    // trạm đo truyền vào thì KHÔNG bịa ra câu mô hình
    const gauge = byId("hon-dau");
    expect(tideModelCaveat(gauge)).toBeNull();
    expect(isModelStation(gauge)).toBe(false);
    expect(isModelStation(model!)).toBe(true);
  });
});

describe("chống sập giữa biển", () => {
  it("ngày hỏng → mảng rỗng chứ không ném", () => {
    expect(tideExtremesForDay(byId("vung-tau"), "khong-phai-ngay")).toEqual([]);
    expect(tideExtremesForDay(byId("vung-tau"), "")).toEqual([]);
  });

  it("mọi ngày trong một tháng đều ra ít nhất một con nước", () => {
    for (const st of stations) {
      for (let d = 1; d <= 28; d++) {
        const iso = `2026-03-${String(d).padStart(2, "0")}`;
        expect(tideExtremesForDay(st, iso).length).toBeGreaterThan(0);
      }
    }
  });

  it("đỉnh và chân luân phiên, không bao giờ hai đỉnh liền nhau", () => {
    for (const st of stations) {
      for (let d = 1; d <= 28; d++) {
        const ex = tideExtremesForDay(st, `2026-09-${String(d).padStart(2, "0")}`);
        for (let i = 1; i < ex.length; i++) {
          expect(ex[i].kind).not.toBe(ex[i - 1].kind);
          expect(ex[i].atMs).toBeGreaterThan(ex[i - 1].atMs);
        }
      }
    }
  });
});

/* ── THẺ CON NƯỚC (2026-09-04) — dữ liệu cho một thẻ dùng chung ở bốn chỗ ── */
describe("thẻ con nước: dữ liệu và luật im lặng", () => {
  const vungTau = () => byId("vung-tau");
  // 4/9/2026 17:00 giờ VN — có số đo thật cùng ngày ở phần trên
  const LUC = Date.UTC(2026, 8, 4, 10, 0, 0);

  it("vnIsoDate lấy ngày theo giờ VIỆT NAM, không theo UTC", () => {
    // 4/9 23:30 VN = 4/9 16:30 UTC → vẫn là 4/9; 5/9 01:00 VN = 4/9 18:00 UTC → 5/9
    expect(vnIsoDate(Date.UTC(2026, 8, 4, 16, 30))).toBe("2026-09-04");
    expect(vnIsoDate(Date.UTC(2026, 8, 4, 18, 0))).toBe("2026-09-05");
  });

  it("xu hướng lên/xuống khớp với mực nước 30 phút sau; đỉnh triều = nước đứng", () => {
    const st = vungTau();
    const t = tideTrendAt(st, LUC);
    const d = tideHeightAt(st, LUC + 30 * 60000) - tideHeightAt(st, LUC);
    expect(t).toBe(d > 0.02 ? "len" : d < -0.02 ? "xuong" : "dung");
    // đúng giờ nước lớn thì 30 phút sau chênh không đáng kể
    const dinh = tideExtremesForDay(st, "2026-09-04").find((e) => e.kind === "high")!;
    expect(tideTrendAt(st, dinh.atMs - 15 * 60000)).toBe("dung");
    expect(tideTrendText("len")).toBe("Nước đang lên");
    expect(tideTrendText("xuong")).toBe("Nước đang xuống");
  });

  it("hai con nước KẾ TIẾP: sau giờ hỏi, hết hôm nay thì lấy sang ngày mai và ghi (mai)", () => {
    const st = vungTau();
    const u = tideUpcoming(st, LUC, 2);
    expect(u).toHaveLength(2);
    for (const x of u) expect(x.atMs).toBeGreaterThan(LUC);
    expect(u[0].atMs).toBeLessThan(u[1].atMs);
    // hỏi lúc 23:30 → con nước kế phần lớn rơi sang ngày mai
    const khuya = tideUpcoming(st, Date.UTC(2026, 8, 4, 16, 30), 2);
    expect(khuya.some((x) => x.ngayMai)).toBe(true);
    const mai = khuya.find((x) => x.ngayMai)!;
    expect(tideUpcomingText(mai)).toMatch(/^Nước (lớn|ròng) lúc .* \(mai\) · \d/);
    expect(tideUpcoming(st, NaN)).toEqual([]);
  });

  it("đường nước cả ngày: 49 điểm mỗi 30 phút, đỉnh của đường khớp con nước", () => {
    const st = vungTau();
    const s = tideDaySeries(st, "2026-09-04");
    expect(s).toHaveLength(49);
    const dinh = Math.max(...tideExtremesForDay(st, "2026-09-04").map((e) => e.heightM));
    expect(Math.abs(Math.max(...s) - dinh)).toBeLessThan(0.05);
    expect(tideDaySeries(st, "khong-phai-ngay")).toEqual([]);
  });

  it("tuần trăng ghép được vào một dòng — chỉ nửa tên trăng, không kèm vế nghề đèn", () => {
    const m = tideMoonText(LUC);
    expect(m).toMatch(/^Trăng /);
    expect(m).not.toContain("—");
    expect(m).not.toMatch(/đèn/);
  });

  it("chỗ gần trạm: đủ lúc này + hai con nước + dòng trăng·cường/kém + độ tin", () => {
    // Cần Giờ → Vũng Tàu (~20 km)
    const c = tideCardAt(stations, 10.41, 106.95, LUC)!;
    expect(c.station.id).toBe("vung-tau");
    expect(c.far).toBe(false);
    expect(c.nowM).not.toBeNull();
    expect(c.upcoming).toHaveLength(2);
    expect(c.moonRange).toMatch(/^Trăng .* · Nước lên xuống \d/);
    expect(c.trust).toBeNull(); // trạm đo, gần: không có gì phải dè chừng
  });

  it(`chỗ xa mọi trạm hơn ${TIDE_FAR_KM} km: CHỈ lên/xuống — không giờ, không số`, () => {
    // giữa Biển Đông, cách bờ ~300 km
    const c = tideCardAt(stations, 12, 112.5, LUC)!;
    expect(c.far).toBe(true);
    expect(c.nowM).toBeNull();
    expect(c.upcoming).toEqual([]);
    expect(c.moonRange).toBeNull();
    expect(["len", "xuong", "dung"]).toContain(c.trend);
    // trạm gần nhất ngoài đó là Nha Trang (mô hình): câu ước-tính đã tự nói
    // "chỉ xem lên hay xuống" nên không lặp câu khoảng cách — nhưng KHÔNG được null
    expect(c.trust).toMatch(/lên hay xuống/);
  });

  it("trạm mô hình gần vẫn mang chữ ước tính; toạ độ hỏng / không trạm → null", () => {
    const c = tideCardAt(stations, 9.55, 106.6, LUC)!; // Định An (model)
    expect(c.model).toBe(true);
    expect(c.trust).toMatch(/ƯỚC TÍNH/);
    expect(tideCardAt(stations, NaN, 107, LUC)).toBeNull();
    expect(tideCardAt([], 10, 107, LUC)).toBeNull();
    expect(tideCardAt(stations, 10, 107, NaN)).toBeNull();
  });
});

/*
  ĐÃ NỐI VÀO BẢN ĐỒ CHƯA (2026-09-02) — cổng ba-mảnh cho tài sản không-nối
  thứ NĂM. Engine này nằm đủ test trong repo mà 0 component import, trong khi
  "thuỷ triều" và "làm mớn" là hai món in đậm trên tờ quảng cáo máy hải đồ
  5 triệu bà con đang phải mua.
*/
import { readFileSync as _rf } from "node:fs";
import path from "node:path";

describe("thuỷ triều + làm mớn phải được NỐI, không chỉ nằm trong repo", () => {
  const strip = (t: string) =>
    t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
  const doc = (p: string) => strip(_rf(path.join(process.cwd(), p), "utf8"));

  it("component nạp trạm và dùng cảnh báo mớn trong thẻ độ sâu", () => {
    const v = doc("src/components/fishing-map-view.tsx");
    expect(v, "chưa gọi fetchTideStations").toContain("fetchTideStations(");
    expect(v, "chưa dùng tideDraftWarning").toContain("tideDraftWarning(");
    expect(v, "thiếu câu độ-tin khi trạm xa").toContain("tideTrustText(");
  });

  it("trạm triều nằm trong vỏ SỐNG-CÒN — mất sóng vẫn tính được con nước", () => {
    const sw = _rf(path.join(process.cwd(), "public/sw.js"), "utf8");
    const critical = sw.slice(sw.indexOf("const CRITICAL_SHELL"), sw.indexOf("const SHELL"));
    expect(critical).toContain("/data/tide-stations.v1.json");
  });

  it("hồ sơ tàu có ô mớn nước, và ĐỂ TRỐNG nghĩa là im — không đoán hộ", () => {
    const rp = doc("src/components/route-planner.tsx");
    expect(rp, "chưa có state mớn nước").toContain("draftM");
    // luật "vắng số không phải là số": giá trị lạ phải về null
    const lib = doc("src/lib/route-plan.ts");
    expect(lib).toContain("draftM?: number | null");
  });

  /* LỚP TRẠM + THẺ CON NƯỚC (2026-09-04) — cổng ba-mảnh cho từng chỗ hiện */
  it("lớp trạm con nước: vẽ được, chạm được, có công tắc mặc định BẬT", () => {
    const v = doc("src/components/fishing-map-view.tsx");
    expect(v, "chưa dựng nguồn trạm").toContain("tideGeo");
    expect(v, "chưa vẽ lớp trạm").toContain("TIDE_STATION_LAYER");
    expect(v, "chưa cho chạm trạm").toContain('ids.push("tram-trieu-dot")');
    expect(v, "chạm trạm chưa mở sheet").toContain("TideStationSheet");
    // lớp KHÔNG được treo vào công tắc "Hải đồ chi tiết" — miễn phí, riêng
    expect(v).not.toMatch(/chartDetailOn && [^\n]*prefs\.tideStations/);
    const rk = doc("src/components/ra-khoi-controls.tsx");
    expect(rk, "chưa có công tắc").toContain("prefs.tideStations");
    const mp = doc("src/lib/map-prefs.ts");
    expect(mp, "công tắc phải mặc định bật").toContain("tideStations: p.tideStations !== false");
  });

  it("thẻ con nước có ở sheet điểm, trang chủ; sheet điểm không treo vào công tắc lớp", () => {
    const v = doc("src/components/fishing-map-view.tsx");
    expect(v).toContain("<TideCard");
    const home = doc("src/app/page.tsx");
    expect(home).toContain("<TideHomeCard");
    const card = doc("src/components/tide-card.tsx");
    // câu chữ lấy từ lib — component không tự dựng giờ nước
    expect(card).toContain("tideCardAt(");
    expect(card).not.toMatch(/phán|nên đi|không nên đi/);
  });

  it("thẻ tuyến có hàng 'Con nước' cho hai đầu tuyến", () => {
    const rh = doc("src/lib/route-hazards.ts");
    expect(rh).toContain('loai: "con-nuoc"');
    const di = doc("src/lib/route-danger-items.ts");
    expect(di).toContain('"con-nuoc": "Con nước"');
  });
});
