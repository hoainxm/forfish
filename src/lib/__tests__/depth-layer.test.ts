/**
 * LỚP SỐ ĐO SÂU CHÍNH THỨC — cổng canh phần nối vào bản đồ (2026-08-31).
 *
 * Vì sao file này tồn tại: `soundings.v1.json` và `fairway-depths.v1.json` đã
 * nằm trong repo và được đẩy xuống máy bà con SUỐT MỘT THỜI GIAN mà KHÔNG có
 * dòng code nào đọc — mọi tham chiếu trong `src/` đều là chú thích. Dữ liệu có,
 * test có, mà bà con không nhìn thấy gì. Không cổng nào bắt được chuyện đó.
 *
 * Nên ở đây canh ĐÚNG cái đã hỏng: dữ liệu phải được NỐI, phải CÒN khi mất
 * sóng, và phải ĐỌC ĐƯỢC dưới nắng.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  DEPTH_DANGER_COLOR,
  DEPTH_SHALLOW_COLOR,
  DEPTH_SAFE_COLOR,
  DEPTH_DANGER_M,
  DEPTH_SHALLOW_M,
  FAIRWAY_DEPTH_MINZOOM,
  SOUNDING_DOT_MINZOOM,
  SOUNDING_LABEL_MINZOOM,
  SEA_MASK_COLOR,
  depthColorExpr,
  DEPTH_LINE_LAYER,
  SOUNDING_DOT_LAYER,
  SOUNDING_LABEL_LAYER,
} from "@/lib/ocean-map";
import { fmtDepthM } from "@/lib/map-prefs";

const root = process.cwd();
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");

describe("fmtDepthM — số in cạnh chấm đo sâu", () => {
  it("bỏ dấu thập phân thừa vì '12' đọc nhanh hơn '12,0' dưới nắng", () => {
    expect(fmtDepthM(12)).toBe("12");
    expect(fmtDepthM(12.0)).toBe("12");
  });
  it("dấu PHẨY thập phân — kiểu Việt, khớp tờ thông báo bà con cầm", () => {
    expect(fmtDepthM(5.2)).toBe("5,2");
    expect(fmtDepthM(0.8)).toBe("0,8");
  });
  it("làm tròn tới 0,1 m — thông báo hàng hải không ghi mịn hơn", () => {
    expect(fmtDepthM(2.34)).toBe("2,3");
    expect(fmtDepthM(2.36)).toBe("2,4");
  });
});

/* Diễn giải biểu thức `step` của MapLibre để kiểm ĐÚNG cái bản đồ sẽ vẽ, chứ
   không kiểm lại hằng số bằng chính hằng số đó. */
function evalStep(expr: readonly unknown[], v: number): string {
  const [op, , base, ...rest] = expr as [string, unknown, string, ...unknown[]];
  expect(op).toBe("step");
  let out = base;
  for (let i = 0; i < rest.length; i += 2) {
    if (v >= (rest[i] as number)) out = rest[i + 1] as string;
  }
  return out;
}

describe("dải màu theo mức nguy hiểm", () => {
  const e = depthColorExpr("d");
  it("dưới 4 m là ĐỎ — mớn tàu cá vỏ gỗ cộng sóng lừng là chạm đáy", () => {
    expect(evalStep(e, 0.5)).toBe(DEPTH_DANGER_COLOR);
    expect(evalStep(e, 3.9)).toBe(DEPTH_DANGER_COLOR);
  });
  it("ĐÚNG 4 m đã sang dải giữa — mép dải là chỗ hay sai nhất", () => {
    expect(evalStep(e, DEPTH_DANGER_M)).toBe(DEPTH_SHALLOW_COLOR);
    expect(evalStep(e, 11.9)).toBe(DEPTH_SHALLOW_COLOR);
  });
  it("từ 12 m là lam — không phải chuyện phải lo", () => {
    expect(evalStep(e, DEPTH_SHALLOW_M)).toBe(DEPTH_SAFE_COLOR);
    expect(evalStep(e, 60)).toBe(DEPTH_SAFE_COLOR);
  });
  it("ba màu PHẢI khác nhau — trùng là mất hẳn thông tin nguy hiểm", () => {
    expect(
      new Set([DEPTH_DANGER_COLOR, DEPTH_SHALLOW_COLOR, DEPTH_SAFE_COLOR]).size,
    ).toBe(3);
  });
});

/*
  CỔNG TƯƠNG PHẢN — cùng bài học với nét đẳng sâu: màu đặc đủ chuẩn KHÔNG có
  nghĩa là màu THỰC TẾ đủ chuẩn, vì `-opacity` pha nền vào. Phải tính SAU pha.
*/
describe("đọc được dưới nắng chói (tính sau khi pha độ mờ)", () => {
  const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const lum = (c: number[]) => {
    const s = c.map((v) => {
      const x = v / 255;
      return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * s[0] + 0.7152 * s[1] + 0.0722 * s[2];
  };
  const ratio = (a: number[], b: number[]) => {
    const [l1, l2] = [lum(a), lum(b)];
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  };
  const blend = (fg: number[], bg: number[], a: number) =>
    fg.map((v, i) => Math.round(v * a + bg[i] * (1 - a)));

  // độ mờ THẬT đang dùng trong fishing-map-view: đường 0,8
  for (const [name, color] of [
    ["nguy hiểm", DEPTH_DANGER_COLOR],
    ["nông", DEPTH_SHALLOW_COLOR],
    ["đủ sâu", DEPTH_SAFE_COLOR],
  ] as const) {
    it(`màu "${name}" đạt tối thiểu 3:1 trên nền biển sau khi pha 0,8`, () => {
      const r = ratio(blend(hex(color), hex(SEA_MASK_COLOR), 0.8), hex(SEA_MASK_COLOR));
      expect(
        r,
        `${name} (${color}) chỉ đạt ${r.toFixed(2)}:1 — dưới sàn 3:1 của WCAG`,
      ).toBeGreaterThanOrEqual(3);
    });
  }

  it("phép đo không rỗng — một màu nhạt cố ý PHẢI trượt", () => {
    const r = ratio(blend(hex("#cfe3e6"), hex(SEA_MASK_COLOR), 0.8), hex(SEA_MASK_COLOR));
    expect(r).toBeLessThan(3);
  });
});

describe("nấc zoom — dữ liệu cửa luồng, bày từ xa là che mất bờ", () => {
  it("đường luồng hiện TRƯỚC chấm, chấm hiện TRƯỚC số", () => {
    expect(FAIRWAY_DEPTH_MINZOOM).toBeLessThan(SOUNDING_DOT_MINZOOM);
    expect(SOUNDING_DOT_MINZOOM).toBeLessThan(SOUNDING_LABEL_MINZOOM);
  });
});

/*
  CỔNG NGOÀI KHƠI — cổng quan trọng nhất file này.

  Bà con vào lạch lúc đêm, sau nhiều ngày xa bờ, sóng chập chờn. Lớp độ sâu mà
  chỉ có khi online thì đúng lúc cần nhất là lúc không có.
*/
describe("mất sóng vẫn còn — hai file phải nằm trong vỏ SỐNG-CÒN", () => {
  const sw = read("public/sw.js");
  const critical = sw.slice(
    sw.indexOf("const CRITICAL_SHELL"),
    sw.indexOf("const SHELL"),
  );
  for (const f of ["/data/soundings.v1.json", "/data/fairway-depths.v1.json"]) {
    it(`${f} nằm trong CRITICAL_SHELL`, () => {
      expect(
        critical,
        `${f} chưa vào vỏ — ngoài khơi mất sóng là mất lớp độ sâu`,
      ).toContain(f);
    });
  }
});

/*
  CỔNG "ĐÃ NỐI CHƯA" — canh đúng kiểu lỗi đã xảy ra: file có, test có, mà
  không dòng nào đọc. Kiểm THAM CHIẾU THẬT, bỏ mọi dòng chú thích trước khi tìm.
*/
describe("dữ liệu phải được NỐI, không chỉ nằm trong repo", () => {
  const strip = (s: string) =>
    s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
  it("có hàm nạp thật gọi tới hai file", () => {
    expect(strip(read("src/lib/soundings.ts"))).toContain("/data/soundings.v1.json");
    expect(strip(read("src/lib/fairway-depth.ts"))).toContain(
      "/data/fairway-depths.v1.json",
    );
  });
  it("bản đồ có lớp vẽ chúng ra", () => {
    const v = strip(read("src/components/fishing-map-view.tsx"));
    for (const spec of ["DEPTH_LINE_LAYER", "SOUNDING_DOT_LAYER", "SOUNDING_LABEL_LAYER"])
      expect(v, `thiếu lớp ${spec}`).toContain(spec);
    expect(v, "chưa gọi fetchSoundings").toContain("fetchSoundings(");
    expect(v, "chưa gọi fetchFairwayDepths").toContain("fetchFairwayDepths(");
  });
});

/*
  CỔNG "MAPLIBRE CÓ CHỊU KHÔNG" — cổng thay cho việc nhìn bằng mắt.

  Vì sao phải có (2026-08-31): ba lớp này trước viết THẲNG trong JSX, nên chúng
  đứng NGOÀI cổng "style phải hợp lệ" vốn chỉ soi thứ `buildMapStyle` dựng ra.
  Đó đúng là loại lỗi MapLibre KHÔNG kêu: biểu thức sai thì nó lặng lẽ bỏ cả
  lớp — giữa biển mất sạch số đo sâu mà không một dòng lỗi nào, và nhìn màn hình
  ở zoom thấp cũng không thấy vì lớp vốn đã ẩn theo thiết kế.

  Nay spec nằm ở `ocean-map.ts` và JSX chỉ trải ra, nên bộ kiểm của chính thư
  viện soi được ĐÚNG cái sẽ chạy — không phải bản chép tay đoán lại.
*/
describe("ba lớp phải HỢP LỆ với chính MapLibre", () => {
  it("không lỗi khi ghép vào một style thật", async () => {
    const { validateStyleMin } = await import("@maplibre/maplibre-gl-style-spec");
    const style = {
      version: 8 as const,
      glyphs: "/fonts/{fontstack}/{range}.pbf",
      sources: {
        soundings: { type: "geojson", data: { type: "FeatureCollection", features: [] } },
        "depth-lines": { type: "geojson", data: { type: "FeatureCollection", features: [] } },
      },
      layers: [
        { ...DEPTH_LINE_LAYER, source: "depth-lines" },
        { ...SOUNDING_DOT_LAYER, source: "soundings" },
        { ...SOUNDING_LABEL_LAYER, source: "soundings" },
      ],
    };
    const errs = validateStyleMin(style as unknown as Parameters<typeof validateStyleMin>[0]);
    expect(errs.map((e) => `${e.message}`)).toEqual([]);
  });

  it("phép kiểm không rỗng — một biểu thức hỏng PHẢI bị bắt", async () => {
    const { validateStyleMin } = await import("@maplibre/maplibre-gl-style-spec");
    const style = {
      version: 8 as const,
      sources: {
        s: { type: "geojson", data: { type: "FeatureCollection", features: [] } },
      },
      layers: [
        {
          ...SOUNDING_DOT_LAYER,
          source: "s",
          // "steps" không tồn tại — đúng kiểu sai mà MapLibre nuốt lặng lẽ
          paint: { ...SOUNDING_DOT_LAYER.paint, "circle-color": ["steps", ["get", "d"], "#000"] },
        },
      ],
    };
    expect(
      validateStyleMin(style as unknown as Parameters<typeof validateStyleMin>[0]).length,
    ).toBeGreaterThan(0);
  });

  it("font dùng trong nhãn phải CÓ SẴN trong máy — không thì số câm giữa biển", () => {
    const fonts = SOUNDING_LABEL_LAYER.layout["text-font"] as readonly string[];
    for (const f of fonts)
      expect(
        fs.existsSync(path.join(root, "public/fonts", f)),
        `thiếu bộ chữ public/fonts/${f} — nhãn độ sâu sẽ không vẽ ra khi mất sóng`,
      ).toBe(true);
  });
});

/*
  NẠP LẠI ĐƯỢC SAU KHI HỎNG — mất sóng KHÔNG được khoá vĩnh viễn. Đây là lỗi
  dễ mắc nhất của kiểu "nhớ một lần": nhớ luôn cả lần hỏng, rồi sóng về vẫn
  trống. Cùng án lệ với fetchSeamarks.
*/
describe("hỏng thì lần sóng về sau thử lại được", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("fetchSoundings: lần 1 lỗi, lần 2 gọi lại mạng chứ không trả lỗi cũ", async () => {
    vi.resetModules();
    const { fetchSoundings } = await import("@/lib/soundings");
    const body = { v: 1, thongBao: [], diem: [], tuyen: [] };
    const spy = vi
      .fn()
      .mockRejectedValueOnce(new Error("mat song"))
      .mockResolvedValueOnce({ ok: true, json: async () => body });
    vi.stubGlobal("fetch", spy);

    await expect(fetchSoundings()).rejects.toThrow();
    await expect(fetchSoundings()).resolves.toEqual({ diem: [], tuyen: [] });
    expect(
      spy,
      "lần 2 phải gọi lại mạng — nhớ cả lần hỏng là khoá vĩnh viễn",
    ).toHaveBeenCalledTimes(2);
  });

  it("fetchSoundings: thành công thì NHỚ, không gọi mạng lần nữa", async () => {
    vi.resetModules();
    const { fetchSoundings } = await import("@/lib/soundings");
    const spy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ v: 1, thongBao: [], diem: [], tuyen: [] }),
    });
    vi.stubGlobal("fetch", spy);
    await fetchSoundings();
    await fetchSoundings();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("fetchFairwayDepths: HTTP 404 cũng phải cho thử lại", async () => {
    vi.resetModules();
    const { fetchFairwayDepths } = await import("@/lib/fairway-depth");
    const spy = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 404 })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ v: 1, doan: [] }) });
    vi.stubGlobal("fetch", spy);
    await expect(fetchFairwayDepths()).rejects.toThrow(/404/);
    await expect(fetchFairwayDepths()).resolves.toEqual([]);
    expect(spy).toHaveBeenCalledTimes(2);
  });
});

/*
  CÔNG TẮC TỔNG "HẢI ĐỒ CHI TIẾT" (2026-09-02) — cổng canh hai luật.
*/
describe("công tắc tổng Hải đồ chi tiết", () => {
  const strip = (s: string) =>
    s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
  const v = strip(read("src/components/fishing-map-view.tsx"));

  it("che được CẢ CỤM lớp hải đồ — một chạm cho màn thoáng", () => {
    // đủ 5 nhóm: báo hiệu OSM, báo hiệu chính thức, đèn biển, số đo sâu, đường luồng
    const n = (v.match(/chartDetailOn &&/g) || []).length;
    expect(n, "cụm hải đồ phải cùng nghe một công tắc tổng").toBeGreaterThanOrEqual(5);
  });

  it("KHÔNG chặn tải dữ liệu — công tắc là chuyện nhìn (luật chủ dự án 2026-08-31)", () => {
    // các effect nạp không được đọc cờ này: tắt lớp ở bờ, ra khơi bật lại
    // thì lúc đó không còn mạng để tải.
    for (const f of ["fetchSoundings(", "fetchDenBien(", "fetchVnAids(", "fetchSeamarks("]) {
      const i = v.indexOf(f);
      expect(i, `${f} phải tồn tại`).toBeGreaterThan(-1);
      const vung = v.slice(Math.max(0, i - 600), i);
      expect(
        vung.includes("chartDetailOn"),
        `effect nạp ${f} KHÔNG được đọc công tắc hiển thị`,
      ).toBe(false);
    }
  });
});

/*
  THỨ BẬC LỚP HẢI ĐỒ (2026-09-03) — soi thấy khi chụp màn: 135 chấm đo sâu ở
  luồng Vũng Tàu vẽ ĐÈ lên phao + xác tàu + đèn, làm ký hiệu điều hướng biến
  mất giữa cụm sounding. Trên hải đồ giấy số đo sâu là NỀN, ký hiệu là vật phải
  tránh nằm TRÊN. Cổng này khoá đúng thứ tự đó trong JSX (react-map-gl vẽ theo
  thứ tự khai báo: khai trước = vẽ dưới).
*/
describe("thứ bậc lớp: số đo sâu DƯỚI ký hiệu điều hướng", () => {
  const v = read("src/components/fishing-map-view.tsx");
  const viTri = (marker: string) => v.indexOf(marker);

  it("số đo sâu + đường luồng khai TRƯỚC (vẽ dưới) phao/xác tàu/đèn", () => {
    const sounding = viTri('id="soundings"');
    const depthLine = viTri('id="depth-lines"');
    const vnAid = viTri('id="vn-aids"');
    const xacTau = viTri('id="xac-tau-src"');
    const denBien = viTri('id="den-bien"');
    for (const [ten, pos] of [["vn-aid", vnAid], ["xác tàu", xacTau], ["đèn biển", denBien]] as const) {
      expect(sounding, `số đo sâu phải khai TRƯỚC ${ten} (nếu không sẽ đè lên nó)`).toBeLessThan(pos);
      expect(depthLine, `đường luồng phải khai TRƯỚC ${ten}`).toBeLessThan(pos);
    }
  });

  it("vòng chọn khai SAU CÙNG — luôn nổi trên mọi lớp", () => {
    const halo = viTri('id="sel-halo"');
    for (const m of ['id="soundings"', 'id="vn-aids"', 'id="den-bien"', 'id="xac-tau-src"'])
      expect(halo, `vòng chọn phải khai sau ${m}`).toBeGreaterThan(viTri(m));
  });
});

/*
  BẬT HẢI ĐỒ CHI TIẾT → ẨN HẲN ẢNH VỆ TINH (2026-09-03, chủ dự án chốt).
  Ảnh SST/phù du đục 0,85 làm chìm phao·luồng·số đo sâu ở z9–12. Chế độ hải
  đồ chi tiết dùng nền hải đồ trơn cho bà con quen mắt; muốn xem ảnh vệ tinh
  thì tắt chi tiết. Cổng canh mã ép layerId về bathymetry khi cờ bật.
*/
describe("hải đồ chi tiết ép nền hải đồ trơn, ẩn ảnh vệ tinh", () => {
  const v = read("src/components/fishing-map-view.tsx");
  it("mapStyle ép bathymetry khi chartDetailOn (không dùng layerId vệ tinh)", () => {
    // chuỗi điều kiện phải gồm chartDetailOn cùng anyExclusiveOverlay
    expect(v).toMatch(/anyExclusiveOverlay \|\| chartDetailOn \? "bathymetry" : layerId/);
  });
});
