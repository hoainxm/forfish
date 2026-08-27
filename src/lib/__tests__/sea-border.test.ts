import { describe, expect, it } from "vitest";

import {
  borderProximity,
  haversineKm,
  insideAllowed,
  VN_ALLOWED_POLYS,
  VN_OUTER_BORDER,
} from "@/lib/geofence";

/*  BIÊN THẬT = MÉP NGOÀI VÙNG VMS (chủ dự án chốt 2026-08-25).
    Cổng này khoá hai bất biến vừa sửa xong, cả hai đều do bà con bắt được:
     (1) app phải đo tới ĐÚNG đường đang vẽ trên bản đồ (cung ngoài khơi), chứ
         không phải đường 75 điểm đã bị gỡ khỏi bản đồ từ 2026-07-28;
     (2) chỗ NGOÀI vùng được phép phải nói "đã ngoài ranh giới", không được nói
         "cách ranh giới N hải lý" (đúng số, sai nghĩa). */

describe("nguồn dữ liệu biên", () => {
  it("cung ngoài khơi có đủ điểm và nằm trong khung biển VN", () => {
    expect(VN_OUTER_BORDER.length).toBeGreaterThan(50);
    for (const [lng, lat] of VN_OUTER_BORDER) {
      expect(lng).toBeGreaterThan(100);
      expect(lng).toBeLessThan(120);
      expect(lat).toBeGreaterThan(5);
      expect(lat).toBeLessThan(24);
    }
  });

  it("vùng được phép có vòng ngoài kín (điểm đầu trùng điểm cuối)", () => {
    expect(VN_ALLOWED_POLYS.length).toBeGreaterThan(0);
    const outer = VN_ALLOWED_POLYS[VN_ALLOWED_POLYS.length - 1][0];
    expect(outer.length).toBeGreaterThan(3);
    const [first, last] = [outer[0], outer[outer.length - 1]];
    expect(first[0]).toBeCloseTo(last[0], 6);
    expect(first[1]).toBeCloseTo(last[1], 6);
  });
});

describe("insideAllowed — trong hay ngoài vùng được phép", () => {
  it("vùng biển ngay ngoài Quy Nhơn là TRONG", () => {
    expect(insideAllowed(13.7, 109.5)).toBe(true);
  });

  it("giữa vịnh Bắc Bộ là TRONG", () => {
    expect(insideAllowed(19.5, 107.0)).toBe(true);
  });

  it("chỗ xa về phía đông (ngoài khung dữ liệu) là NGOÀI", () => {
    expect(insideAllowed(14.0, 119.5)).toBe(false);
  });

  it("xuống tận Indonesia là NGOÀI", () => {
    expect(insideAllowed(2.0, 108.0)).toBe(false);
  });
});

describe("borderProximity — đo tới cung ngoài khơi ĐANG VẼ trên bản đồ", () => {
  it("nearest luôn nằm ĐÚNG trên đường biên đang vẽ", () => {
    const p = borderProximity(13.7, 109.5);
    // điểm gần nhất phải nằm trên một đoạn của VN_OUTER_BORDER: kiểm bằng cách
    // đòi nó cách ít nhất một đỉnh của đường đó không quá độ dài một đoạn
    const minToVertex = Math.min(
      ...VN_OUTER_BORDER.map((c) => haversineKm(p.nearest[1], p.nearest[0], c[1], c[0])),
    );
    expect(minToVertex).toBeLessThan(200);
  });

  it("distanceNm khớp với haversine tới chính nearest nó trả về", () => {
    for (const [lat, lon] of [
      [13.7, 109.5],
      [16.0, 111.0],
      [10.2, 107.5],
      [19.0, 107.5],
    ]) {
      const p = borderProximity(lat, lon);
      const nm = haversineKm(lat, lon, p.nearest[1], p.nearest[0]) / 1.852;
      // xấp xỉ mặt phẳng của pointToSegmentKm lệch vài phần trăm ở quãng dài
      expect(Math.abs(nm - p.distanceNm)).toBeLessThan(Math.max(1, p.distanceNm * 0.05));
    }
  });

  it("chỗ NGOÀI biên: cờ outside bật + câu chữ nói ĐÃ NGOÀI, không nói 'cách'", () => {
    const p = borderProximity(14.0, 119.5);
    expect(p.outside).toBe(true);
    expect(p.level).toBe("very_near");
    expect(p.label).toContain("ĐÃ NGOÀI");
    expect(p.label).not.toContain("Cách ranh giới");
    expect(p.label).not.toContain("Gần ranh giới");
  });

  it("chỗ TRONG biên và còn xa: outside=false, level ok, nói 'Cách ranh giới'", () => {
    const p = borderProximity(13.7, 109.5);
    expect(p.outside).toBe(false);
    expect(p.level).toBe("ok");
    expect(p.label).toContain("Cách ranh giới");
  });

  it("KHÔNG bao giờ vừa outside vừa nói 'còn ... hải lý mới tới biên'", () => {
    for (const [lat, lon] of [
      [14.0, 119.5],
      [2.0, 108.0],
      [22.5, 105.0],
    ]) {
      const p = borderProximity(lat, lon);
      if (p.outside) expect(p.label).not.toMatch(/còn ~/);
    }
  });
});

/*  CỔNG CHỐNG TÁI PHÁT — hai bất biến bắt được nhờ chạy thử theo đúng lời bà
    con dặn: "biên chỉ áp dụng với đường biển thôi". */
describe("bất biến: cảng cá VN không bao giờ ở ngoài vùng biển VN", () => {
  it("cả 10 cảng đều TRONG biên và KHÔNG bị báo 'đã ngoài'", async () => {
    const { PORTS } = await import("@/data/ports");
    for (const p of PORTS) {
      const prox = borderProximity(p.lat, p.lon);
      expect({ cang: p.id, outside: prox.outside }).toEqual({
        cang: p.id,
        outside: false,
      });
      expect(prox.label).not.toContain("ĐÃ NGOÀI");
    }
  });

  /*  BIÊN CHỈ LÀ ĐƯỜNG BIỂN — không bao giờ đo tới đoạn bờ của vòng kín (bà con
      qua VSS Quân 2026-08-25). Nếu đường biên lỡ đi sát bờ thì tàu đang neo ở
      cảng nhà cũng bị hét "rất gần ranh giới", báo động giả kiểu đó vài lần là
      bà con tắt cảnh báo, tới lúc vượt thật thì không ai nghe. */
  it("đường biên giữ khoảng cách với MỌI cảng cá — không có đoạn nào bám bờ", async () => {
    const { PORTS } = await import("@/data/ports");
    for (const p of PORTS) {
      const nm =
        Math.min(
          ...VN_OUTER_BORDER.map((c) => haversineKm(p.lat, p.lon, c[1], c[0])),
        ) / 1.852;
      expect({ cang: p.id, xa: nm > 30 }).toEqual({ cang: p.id, xa: true });
    }
  });
});

describe("không có vùng kín thì KHÔNG được đoán trong/ngoài", () => {
  it("chỉ có đường biên (admin đánh dấu vùng dạng ĐƯỜNG) → outside luôn false", () => {
    const src = {
      line: [
        [110, 9],
        [110, 11],
      ] as [number, number][],
      polys: [] as [number, number][][][],
    };
    for (const [lat, lon] of [
      [10, 111],
      [10, 109],
      [10, 110],
    ]) {
      const p = borderProximity(lat, lon, src);
      expect(p.outside).toBe(false);
      expect(p.label).not.toContain("ĐÃ NGOÀI");
    }
  });
});

/*  LÚC NÀO MỚI NÓI CHUYỆN RANH GIỚI (chủ dự án 2026-08-25: "các điểm ở trên bờ
    phía trong của VN thì đừng hiển thị cái tính khoảng cách tới biên").
    Vùng `allowed` chỉ phủ MẶT BIỂN nên chỉ cần đọc vị trí so với nó là biết
    điểm ở biển hay trên cạn — không cần thêm dữ liệu đất liền nào. */
describe("applies — chỉ nói chuyện ranh giới khi điểm ở trên biển", () => {
  const trongDatLien: [number, number, string][] = [
    [21.028, 105.852, "Hà Nội"],
    [12.68, 108.05, "Buôn Ma Thuột"],
    [10.776, 106.7, "TP.HCM"],
    [22.33, 103.84, "Lào Cai"],
  ];
  it("điểm trong đất liền: applies=false, label rỗng, level ok", () => {
    for (const [lat, lon, ten] of trongDatLien) {
      const p = borderProximity(lat, lon);
      expect({ ten, applies: p.applies }).toEqual({ ten, applies: false });
      expect({ ten, label: p.label }).toEqual({ ten, label: "" });
      expect({ ten, level: p.level }).toEqual({ ten, level: "ok" });
      expect({ ten, outside: p.outside }).toEqual({ ten, outside: false });
    }
  });

  it("điểm ngoài khơi trong vùng biển VN: applies=true, có câu chữ", () => {
    for (const [lat, lon] of [
      [13.7, 109.5],
      [16.0, 111.0],
      [19.5, 107.0],
    ]) {
      const p = borderProximity(lat, lon);
      expect(p.applies).toBe(true);
      expect(p.label.length).toBeGreaterThan(0);
    }
  });

  it("điểm đã vượt biên ngoài khơi: applies=true để còn kịp cảnh báo", () => {
    const p = borderProximity(14.0, 119.5);
    expect(p.applies).toBe(true);
    expect(p.outside).toBe(true);
  });

  /*  BẤT BIẾN AN TOÀN: không áp dụng thì phải IM HOÀN TOÀN. Caller nào quên
      kiểm `applies` cũng chỉ im, không bao giờ hét cảnh báo sai. */
  it("applies=false thì KHÔNG BAO GIỜ kèm level cảnh báo hay câu chữ", () => {
    for (const [lat, lon] of trongDatLien.map(([a, b]) => [a, b])) {
      const p = borderProximity(lat, lon);
      expect(p.level).toBe("ok");
      expect(p.label).toBe("");
    }
  });
});
