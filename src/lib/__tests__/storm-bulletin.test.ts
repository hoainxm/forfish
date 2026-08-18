import { describe, expect, it } from "vitest";
import {
  khoangCachKm,
  parseDangerBox,
  parseForecastPoints,
  parseGioNgay,
  parseHuongTocDo,
  parseNchmfFull,
  stormKeyFor,
  type NchmfBulletin,
} from "@/lib/storm-bulletin";

/*  BẢN TIN ĐẦY ĐỦ → KHO → VẼ (2026-08-18).
 *
 *  Chủ dự án: "nên có DB lưu các bản tin để vẽ cho chuẩn… lúc update thì update
 *  phần mới" + "cái bão đã đi qua và sắp tới, mỗi lần update thì hiệu chỉnh
 *  phần sắp tới thôi". Mọi ca dưới đây dựng từ BẢN TIN THẬT (NCHMF 08h00
 *  18/8/2026, post53205) — nguồn là trang HTML nên chỉ test bằng chữ thật mới
 *  bắt được lúc nó đổi bố cục.
 */

const BAN_TIN =
  "TIN ÁP THẤP NHIỆT ĐỚI TRÊN BIỂN ĐÔNG 📍 Hiện trạng áp thấp nhiệt đới: " +
  "🔹 Hồi 07 giờ , vị trí tâm áp thấp nhiệt đới ở khoảng 19,8°N; 117,6°E , " +
  "trên vùng biển phía Đông khu vực Bắc Biển Đông . " +
  "🔹 Cường độ: cấp 6 (39–49km/h), giật cấp 8. " +
  "🔹 Hướng và tốc độ di chuyển: chậm theo hướng Tây, tốc độ khoảng 5km/h. " +
  "📍 Dự báo diễn biến áp thấp nhiệt đới (trong 24 đến 48 giờ tới): " +
  "07 giờ ngày 19/8 Tây, khoảng 10 km/h 19,9N-115,3E; trên vùng biển phía Đông " +
  "khu vực Bắc Biển Đông Cấp 6, giật cấp 8 19,0-21,0N; 114,5-118,5E " +
  "Cấp 3: vùng biển phía Đông khu vực Bắc Biển Đông " +
  "07 giờ ngày 20/8 Tây Tây Bắc, khoảng 10 km/h 20,1N-113,2E; cách đảo Hải Nam " +
  "(Trung Quốc) khoảng 740 km về phía Đông Đông Bắc Cấp 6, giật cấp 8 " +
  "19,0-21,5N; 112,5-116,5E Cấp 3: khu vực Bắc Biển Đông " +
  "📍 Tin phát lúc: 08h00 ngày 18/8 📍 Bản tin tiếp theo: 14h00 ngày 18/8";

const NOW = new Date("2026-08-18T03:00:00Z");

describe("parseDangerBox — vùng nguy hiểm là thứ NGUỒN PHÁT, không phải bán kính bịa", () => {
  it("đọc đúng khung 4 số", () => {
    expect(parseDangerBox("19,0-21,0N; 114,5-118,5E")).toEqual({
      latMin: 19,
      latMax: 21,
      lonMin: 114.5,
      lonMax: 118.5,
    });
  });

  it("đảo thứ tự vẫn ra min/max đúng", () => {
    expect(parseDangerBox("21,0-19,0N; 118,5-114,5E")).toEqual({
      latMin: 19,
      latMax: 21,
      lonMin: 114.5,
      lonMax: 118.5,
    });
  });

  it("ngoài khung Biển Đông → null (đọc nhầm số khác)", () => {
    expect(parseDangerBox("45,0-50,0N; 150,0-160,0E")).toBeNull();
  });

  it("không phải khung → null", () => {
    expect(parseDangerBox("sóng cao 2,0–3,5m, biển động")).toBeNull();
  });
});

describe("parseGioNgay", () => {
  const phat = Date.parse("2026-08-18T01:00:00Z"); // 08h00 giờ VN

  it("'07 giờ ngày 19/8' → 07h00 VN = 00:00Z ngày 19", () => {
    expect(new Date(parseGioNgay("07 giờ ngày 19/8", phat, NOW)!).toISOString()).toBe(
      "2026-08-19T00:00:00.000Z",
    );
  });

  it("'Hồi 07 giờ' lấy NGÀY của giờ phát tin", () => {
    expect(new Date(parseGioNgay("Hồi 07 giờ", phat, NOW)!).toISOString()).toBe(
      "2026-08-18T00:00:00.000Z",
    );
  });

  it("giờ quan trắc tính ra SAU giờ phát → lùi một ngày (bản tin sau nửa đêm)", () => {
    const phatKhuya = Date.parse("2026-08-18T17:00:00Z"); // 00h00 ngày 19 giờ VN
    const ms = parseGioNgay("Hồi 23 giờ", phatKhuya, NOW)!;
    expect(ms).toBeLessThan(phatKhuya);
  });

  it("dự báo sang năm mới (bản tin 31/12 nói ngày 1/1) không lùi về quá khứ", () => {
    const cuoiNam = Date.parse("2026-12-31T15:00:00Z");
    const ms = parseGioNgay("07 giờ ngày 1/1", cuoiNam, NOW)!;
    expect(ms).toBeGreaterThan(cuoiNam);
    expect(new Date(ms).getUTCFullYear()).toBe(2027);
  });
});

describe("parseHuongTocDo", () => {
  it("hướng GHÉP không bị cắt cụt", () => {
    expect(parseHuongTocDo("theo hướng Tây Tây Bắc, khoảng 10 km/h").dir).toBe(
      "Tây Tây Bắc",
    );
  });

  it("dải tốc độ lấy trung bình", () => {
    expect(parseHuongTocDo("mỗi giờ đi được khoảng 5–10km/h").speedKmh).toBe(8);
  });

  it("không có thì null, không đoán", () => {
    expect(parseHuongTocDo("ít dịch chuyển")).toEqual({ dir: null, speedKmh: null });
  });
});

describe("parseForecastPoints — phần SẮP TỚI của bản đồ", () => {
  const pts = parseForecastPoints(
    BAN_TIN.slice(BAN_TIN.indexOf("Dự báo diễn biến")),
    Date.parse("2026-08-18T01:00:00Z"),
    NOW,
  );

  it("đủ hai mốc dự báo của bản tin thật", () => {
    expect(pts).toHaveLength(2);
    expect(pts[0].lat).toBe(19.9);
    expect(pts[0].lon).toBe(115.3);
    expect(pts[1].lat).toBe(20.1);
    expect(pts[1].lon).toBe(113.2);
  });

  it("mỗi mốc mang giờ hiệu lực + hướng + tốc độ", () => {
    expect(new Date(pts[0].validAt!).toISOString()).toBe("2026-08-19T00:00:00.000Z");
    expect(pts[0].dir).toBe("Tây");
    expect(pts[1].dir).toBe("Tây Tây Bắc");
    expect(pts[0].speedKmh).toBe(10);
  });

  it("cấp gió KHÔNG lẫn cấp giật, cũng KHÔNG lẫn 'rủi ro cấp 3'", () => {
    expect(pts[0].cap).toBe(6);
    expect(pts[0].giat).toBe(8);
    expect(pts[1].cap).toBe(6);
  });

  it("vùng nguy hiểm từng mốc — thứ để vẽ vòng ảnh hưởng", () => {
    expect(pts[0].danger).toEqual({
      latMin: 19,
      latMax: 21,
      lonMin: 114.5,
      lonMax: 118.5,
    });
    expect(pts[1].danger?.lonMin).toBe(112.5);
  });
});

describe("parseNchmfFull — một hàng trong kho", () => {
  const b = parseNchmfFull(BAN_TIN, NOW, "https://x/post53205.html")!;

  it("giờ PHÁT và giờ QUAN TRẮC là hai mốc khác nhau", () => {
    expect(new Date(b.issuedAt!).toISOString()).toBe("2026-08-18T01:00:00.000Z");
    expect(new Date(b.observedAt!).toISOString()).toBe("2026-08-18T00:00:00.000Z");
    expect(b.observedAt!).toBeLessThan(b.issuedAt!);
  });

  it("tâm + cấp + giật + hướng + tốc độ của HIỆN TRẠNG, không lẫn số dự báo", () => {
    expect(b.lat).toBe(19.8);
    expect(b.lon).toBe(117.6);
    expect(b.cap).toBe(6);
    expect(b.giat).toBe(8);
    expect(b.dir).toBe("Tây");
    expect(b.speedKmh).toBe(5);
  });

  it("ATNĐ: không có số bão, KHÔNG có bán kính (nguồn không phát)", () => {
    expect(b.laBao).toBe(false);
    expect(b.soBao).toBeNull();
    expect(b.radiusKm).toBeNull();
  });

  it("bản tin BÃO có bán kính thì mới lấy — không bịa", () => {
    const bao = parseNchmfFull(
      "TIN BÃO KHẨN CẤP (CƠN BÃO SỐ 5) Hồi 13 giờ, vị trí tâm bão số 5 ở khoảng " +
        "16,2°N; 110,5°E. Cường độ: cấp 12, giật cấp 15. Bán kính gió mạnh cấp 6 " +
        "khoảng 250km tính từ tâm bão. Hướng di chuyển: Tây Bắc, tốc độ 15km/h. " +
        "Tin phát lúc: 14h00 ngày 18/8",
      NOW,
    )!;
    expect(bao.laBao).toBe(true);
    expect(bao.soBao).toBe("5");
    expect(bao.radiusKm).toBe(250);
    expect(bao.cap).toBe(12);
  });

  it("giữ mốc dự báo để vẽ phần sắp tới", () => {
    expect(b.forecast).toHaveLength(2);
  });

  it("thiếu toạ độ → null, không ghi hàng rác vào kho", () => {
    expect(parseNchmfFull("Áp thấp nhiệt đới đã suy yếu thành vùng áp thấp.", NOW)).toBeNull();
  });
});

describe("stormKeyFor — gom bản tin về cùng một cơn", () => {
  const b = (over: Partial<NchmfBulletin> = {}): NchmfBulletin => ({
    issuedAt: Date.parse("2026-08-18T01:00:00Z"),
    observedAt: null,
    laBao: false,
    soBao: null,
    lat: 19.8,
    lon: 117.6,
    cap: 6,
    giat: 8,
    dir: "Tây",
    speedKmh: 5,
    radiusKm: null,
    danger: null,
    risk: 3,
    forecast: [],
    url: null,
    ...over,
  });

  it("bão có số → khoá theo số + năm, ổn định tuyệt đối", () => {
    expect(stormKeyFor(b({ soBao: "5", laBao: true }))).toBe("bao-so-5-2026");
  });

  it("ATNĐ nối tiếp bản tin trước (≤12 giờ, tâm gần) → CÙNG khoá", () => {
    const truoc = {
      key: "atnd-20260817",
      issuedAt: Date.parse("2026-08-17T19:00:00Z"),
      lat: 19.5,
      lon: 118.4,
    };
    expect(stormKeyFor(b(), truoc)).toBe("atnd-20260817");
  });

  it("cách quá lâu → cơn MỚI (không nối nhầm hai cơn khác nhau)", () => {
    const truoc = {
      key: "atnd-20260810",
      issuedAt: Date.parse("2026-08-10T01:00:00Z"),
      lat: 19.5,
      lon: 118.4,
    };
    expect(stormKeyFor(b(), truoc)).toBe("atnd-20260818");
  });

  it("tâm nhảy quá xa → cơn MỚI", () => {
    const truoc = {
      key: "atnd-20260817",
      issuedAt: Date.parse("2026-08-17T19:00:00Z"),
      lat: 8.0,
      lon: 108.0,
    };
    expect(stormKeyFor(b(), truoc)).toBe("atnd-20260818");
  });

  it("ATNĐ mạnh lên thành bão → khoá ĐỔI sang số bão (chỗ ghi kho phải nối lại)", () => {
    const truoc = {
      key: "atnd-20260817",
      issuedAt: Date.parse("2026-08-17T19:00:00Z"),
      lat: 19.5,
      lon: 118.4,
    };
    expect(stormKeyFor(b({ soBao: "6", laBao: true }), truoc)).toBe("bao-so-6-2026");
  });
});

describe("khoangCachKm", () => {
  it("hai tâm liên tiếp của cơn thật cách nhau vài chục km", () => {
    const km = khoangCachKm(19.8, 117.6, 19.9, 115.3);
    expect(km).toBeGreaterThan(200);
    expect(km).toBeLessThan(280);
  });
});
