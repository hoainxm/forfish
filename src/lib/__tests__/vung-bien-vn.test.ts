import { describe, expect, it } from "vitest";
import {
  khungOTrongVung,
  locBanDoCaTrongVung,
  locOTrongVung,
  trongVungBienVN,
} from "@/lib/vung-bien-vn";

// Điểm mốc: toạ độ biển đã đo với lưới độ sâu thật lúc viết (2026-10-29).
const TRONG: [string, number, number][] = [
  ["Vũng Tàu ngoài cảng", 10.35, 107.07],
  ["Bạch Long Vĩ", 20.13, 107.72],
  ["Trường Sa", 8.64, 111.92],
  ["Hoàng Sa (vùng cần chú ý — vẫn là biển Việt Nam)", 16.5, 111.6],
  ["giữa Biển Đông 14°B 114°Đ", 14, 114],
  ["vịnh Thái Lan phía Việt Nam", 9, 103],
  ["sát bờ Phan Thiết", 10.9, 108.15],
];
const NGOAI: [string, number, number][] = [
  ["Philippines", 12, 121],
  ["biển Campuchia gần Sihanoukville", 10.35, 103.6],
  ["Hải Nam (Trung Quốc)", 19, 110.5],
  ["Malaysia — Natuna", 3, 107],
  ["quá đường ranh ngoài khơi phía Đông", 10, 117.5],
];

describe("trongVungBienVN — hợp ba vùng VMS", () => {
  it.each(TRONG)("%s ⇒ trong", (_, la, lo) => expect(trongVungBienVN(la, lo)).toBe(true));
  it.each(NGOAI)("%s ⇒ ngoài", (_, la, lo) => expect(trongVungBienVN(la, lo)).toBe(false));
  it("toạ độ hỏng ⇒ ngoài (không bịa là trong)", () => {
    expect(trongVungBienVN(NaN, 107)).toBe(false);
    expect(trongVungBienVN(10, Infinity)).toBe(false);
  });
});

describe("lọc bản đồ cá", () => {
  const cells = [
    { lat: 10.35, lon: 107.07, s: 80 }, // trong
    { lat: 12, lon: 121, s: 95 }, // Philippines — điểm cao nhất mà ngoài vùng
    { lat: 19, lon: 110.5, s: 70 }, // Hải Nam
  ];
  it("bỏ ô có tâm ngoài vùng, giữ ô trong vùng", () => {
    expect(locOTrongVung(cells).map((c) => c.s)).toEqual([80]);
  });
  it("bản đồ cá giữ các trường khác, không đụng mảng cũ", () => {
    const f = { ok: true as const, date: "2026-10-29", cells };
    const g = locBanDoCaTrongVung(f);
    expect(g.cells).toHaveLength(1);
    expect(g.date).toBe("2026-10-29");
    expect(f.cells).toHaveLength(3);
  });
  it("không có cells ⇒ trả nguyên", () => {
    const f = { ok: false } as { ok: boolean; cells?: { lat: number; lon: number }[] };
    expect(locBanDoCaTrongVung(f)).toBe(f);
  });
});

describe("khungOTrongVung — vẽ ô cắt theo biên", () => {
  it("ô nằm trọn trong vùng ⇒ một hình vuông như cũ", () => {
    expect(khungOTrongVung(14, 113, 0.125)).toEqual([[112.875, 13.875, 113.125, 14.125]]);
  });
  it("ô vắt qua biên ⇒ chỉ còn mảnh có tâm trong vùng, không mảnh nào ở ngoài", () => {
    // dò một ô cắt đường ranh ngoài khơi phía Đông (tìm theo kinh độ để test không phụ thuộc số cứng)
    let lon = 112;
    while (lon < 120 && trongVungBienVN(10, lon + 0.125)) lon += 0.05;
    const khung = khungOTrongVung(10, lon, 0.125);
    expect(khung.length).toBeGreaterThan(0);
    expect(khung.length).toBeLessThan(64);
    for (const [x0, y0, x1, y1] of khung) expect(trongVungBienVN((y0 + y1) / 2, (x0 + x1) / 2)).toBe(true);
  });
  it("ô ngoài hẳn ⇒ không vẽ gì", () => {
    expect(khungOTrongVung(12, 121, 0.125)).toEqual([]);
  });
});
