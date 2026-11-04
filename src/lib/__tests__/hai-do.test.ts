import { describe, expect, it } from "vitest";
import { apBangMauLop, apBangMauStyle, docMau, doiMau, ICON_DUC, tuongPhan } from "../hai-do/bang-mau";
import { dauVecTo, diemTheoPhuongVi, duongAnToanM, vecToGeo } from "../hai-do/an-toan";
import { BO_XA_MAXZOOM, buildHaiDoStyle, SAFETY_LAYER_ID } from "../hai-do/style";
import { bangKeTiep, docHaiDoPrefs, HAI_DO_MAC_DINH } from "../hai-do/prefs";
import { DEPTH_BANDS, OFFLINE_COAST_BEFORE_ID } from "../ocean-map";
import { haversineKm } from "../route-plan";

describe("bảng màu ngày/chiều/đêm", () => {
  it("đọc được #rgb, #rrggbb, rgba()", () => {
    expect(docMau("#fff")).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    expect(docMau("#1a73e8")).toMatchObject({ r: 26, g: 115, b: 232 });
    expect(docMau("rgba(0,0,0,0.5)")).toMatchObject({ a: 0.5 });
    expect(docMau("Noto Sans Bold")).toBeNull();
  });

  it("ngày giữ nguyên; chuỗi không phải màu giữ nguyên", () => {
    expect(doiMau("#d5e8eb", "ngay")).toBe("#d5e8eb");
    expect(doiMau("Noto Sans Bold", "dem")).toBe("Noto Sans Bold");
  });

  it("đêm: biển sáng thành tối, trần sáng thấp (không loá)", () => {
    for (const b of DEPTH_BANDS) {
      const dem = doiMau(b.color, "dem");
      expect(tuongPhan(dem, "#000000")).toBeLessThan(2.2);
    }
  });

  it("đêm: giữ phân biệt các dải độ sâu (thứ tự đảo, không dải nào trùng)", () => {
    const dem = DEPTH_BANDS.map((b) => doiMau(b.color, "dem"));
    expect(new Set(dem).size).toBe(dem.length);
  });

  it("đêm: chữ đẳng sâu vẫn đọc được trên biển đêm (≥ 3:1)", () => {
    const bien = doiMau(DEPTH_BANDS[0].color, "dem");
    const chu = doiMau("#14324f", "dem");
    expect(tuongPhan(bien, chu)).toBeGreaterThanOrEqual(3);
  });

  it("chiều: tối hơn ngày nhưng giữ thứ tự sáng/tối", () => {
    const a = doiMau("#f8fbfc", "chieu");
    const b = doiMau("#14324f", "chieu");
    expect(tuongPhan(a, "#000000")).toBeLessThan(tuongPhan("#f8fbfc", "#000000"));
    expect(tuongPhan(a, "#000000")).toBeGreaterThan(tuongPhan(b, "#000000"));
  });

  it("đổi màu trong cả biểu thức MapLibre, chỉ ở thuộc tính *-color; icon hạ độ đục", () => {
    const l = apBangMauLop(
      {
        id: "x",
        type: "symbol",
        layout: { "icon-image": "buoy" },
        paint: { "text-color": ["match", ["get", "k"], "a", "#ffffff", "#000000"], "text-halo-width": 1 },
      },
      "dem",
    );
    expect(JSON.stringify(l.paint)).not.toContain("#ffffff");
    const paint = l.paint as Record<string, unknown>;
    expect(paint["text-halo-width"]).toBe(1);
    expect(paint["icon-opacity"]).toBe(ICON_DUC.dem);
  });

  it("ngày: style trả nguyên object", () => {
    const s = { layers: [{ id: "a", type: "fill", paint: { "fill-color": "#fff" } }] };
    expect(apBangMauStyle(s, "ngay")).toBe(s);
  });
});

describe("đường an toàn", () => {
  it("không mớn ⇒ 10 m (sàn)", () => {
    expect(duongAnToanM(null)).toBe(10);
    expect(duongAnToanM(undefined)).toBe(10);
  });
  it("mớn tàu cá thường (≤ 9 m) vẫn 10 m — không hạ xuống đẳng sâu 5 m kém tin", () => {
    expect(duongAnToanM(1.8)).toBe(10);
    expect(duongAnToanM(9)).toBe(10);
  });
  it("mớn + 1 m vượt 10 ⇒ lên mức kế tiếp", () => {
    expect(duongAnToanM(9.5)).toBe(20);
    expect(duongAnToanM(30)).toBe(50);
    expect(duongAnToanM(80)).toBe(50);
  });
  it("bà con tự chọn thắng mớn; số lạ bị bỏ", () => {
    expect(duongAnToanM(1.8, 50)).toBe(50);
    expect(duongAnToanM(1.8, 7)).toBe(10);
  });
});

describe("véc-tơ hướng đi", () => {
  const p = { lat: 10, lon: 107 };
  it("6 phút ở 18,52 km/h (10 hải lý/giờ) ⇒ ~1 hải lý theo đúng hướng", () => {
    const d = dauVecTo(p, 90, 18.52, 6)!;
    expect(haversineKm(p, d)).toBeCloseTo(1.852, 2);
    expect(d.lat).toBeCloseTo(10, 3);
    expect(d.lon).toBeGreaterThan(107);
  });
  it("tàu đứng / thiếu hướng ⇒ không vạch (không vẽ theo nhiễu GPS)", () => {
    expect(dauVecTo(p, 90, null, 6)).toBeNull();
    expect(dauVecTo(p, null, 10, 6)).toBeNull();
    expect(dauVecTo(null, 90, 10, 6)).toBeNull();
    expect(vecToGeo(p, null).features).toHaveLength(0);
  });
  it("đi về Bắc thì vĩ độ tăng, kinh độ giữ", () => {
    const d = diemTheoPhuongVi(p, 0, 11.1);
    expect(d.lat).toBeCloseTo(10.1, 2);
    expect(d.lon).toBeCloseTo(107, 5);
  });
});

describe("style chế độ hải đồ", () => {
  const lop = (s: ReturnType<typeof buildHaiDoStyle>, id: string) =>
    (s.layers as Array<{ id: string; filter?: unknown }>).find((l) => l.id === id);

  it("đường an toàn lọc đúng mức đã chọn", () => {
    const s = buildHaiDoStyle({ bang: "ngay", anToanM: 20, matSong: false });
    expect(JSON.stringify(lop(s, SAFETY_LAYER_ID)?.filter)).toContain("20");
  });
  it("không raster báo hiệu OpenSeaMap, không ảnh EMODnet (lớp gói); CÓ đẳng sâu tự dựng", () => {
    const s = buildHaiDoStyle({ bang: "ngay", anToanM: 10, matSong: false });
    expect(lop(s, "seamarks")).toBeUndefined();
    expect(lop(s, "ocean-data")).toBeUndefined();
    expect((s.sources as Record<string, unknown>)["ocean-data"]).toBeUndefined();
    expect(lop(s, "isobath-lines")).toBeDefined();
  });
  it("hình bờ trong máy NGAY TRÊN mốc base-top (không chui dưới mask Hoàng Sa/Trường Sa)", () => {
    const s = buildHaiDoStyle({ bang: "ngay", anToanM: 10, matSong: true });
    const ids = (s.layers as Array<{ id: string }>).map((l) => l.id);
    expect(ids.indexOf("hd-coast-fill")).toBe(ids.indexOf(OFFLINE_COAST_BEFORE_ID) + 1);
  });
  it("có sóng: hình bờ chỉ ở nấc xa; mất sóng: mọi nấc", () => {
    const co = buildHaiDoStyle({ bang: "ngay", anToanM: 10, matSong: false });
    const mat = buildHaiDoStyle({ bang: "ngay", anToanM: 10, matSong: true });
    expect((lop(co, "hd-coast-fill") as { maxzoom?: number }).maxzoom).toBe(BO_XA_MAXZOOM);
    expect((lop(mat, "hd-coast-fill") as { maxzoom?: number }).maxzoom).toBeUndefined();
  });
  it("có đảo tên Việt; đêm đổi màu nền nước", () => {
    const ngay = buildHaiDoStyle({ bang: "ngay", anToanM: 10, matSong: false });
    const dem = buildHaiDoStyle({ bang: "dem", anToanM: 10, matSong: false });
    expect(lop(ngay, "hd-island-label")).toBeDefined();
    const nen = (s: typeof ngay) =>
      JSON.stringify((s.layers as Array<{ id: string; paint?: object }>).find((l) => l.id === "sea-bg")?.paint);
    expect(nen(ngay)).not.toBe(nen(dem));
  });
});

describe("tuỳ chọn chế độ hải đồ", () => {
  it("bản lưu hỏng/lạ ⇒ mặc định", () => {
    expect(docHaiDoPrefs(null)).toEqual(HAI_DO_MAC_DINH);
    expect(docHaiDoPrefs("{")).toEqual(HAI_DO_MAC_DINH);
    expect(docHaiDoPrefs(JSON.stringify({ bang: "tim", anToanM: 7, vecPhut: 99, moHaiDo: "co", huong: "xeo", vong: 1 }))).toEqual(HAI_DO_MAC_DINH);
  });
  it("giữ giá trị hợp lệ", () => {
    expect(docHaiDoPrefs(JSON.stringify({ bang: "dem", anToanM: 20, vecPhut: 12, moHaiDo: true, huong: "huong-di", vong: true, nutZoom: true }))).toEqual({
      bang: "dem",
      anToanM: 20,
      vecPhut: 12,
      moHaiDo: true,
      huong: "huong-di",
      vong: true,
      nutZoom: true,
    });
  });
  it("nút Màu xoay vòng Ngày → Chiều → Đêm → Ngày", () => {
    expect(bangKeTiep("ngay")).toBe("chieu");
    expect(bangKeTiep("chieu")).toBe("dem");
    expect(bangKeTiep("dem")).toBe("ngay");
  });
});
