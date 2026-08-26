import { describe, expect, it } from "vitest";

import {
  borderProximity,
  haversineKm,
  insideAllowed,
  VN_ALLOWED_RINGS,
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
    expect(VN_ALLOWED_RINGS.length).toBeGreaterThan(0);
    const outer = VN_ALLOWED_RINGS[0];
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
