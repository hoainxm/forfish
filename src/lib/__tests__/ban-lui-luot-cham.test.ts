import { describe, expect, it } from "vitest";
import { cauLuotCham, soLuotCham } from "@/lib/source-cadence";
import { chonBanLui, type SeaPointConditions } from "@/lib/marine-weather";

// Mốc nguồn: 04 · 10 · 16 · 22 giờ UTC (4 lượt/ngày)
const T = (s: string) => Date.parse(s);
const NOW = T("2026-10-30T09:00:00Z");

const ban = (source: SeaPointConditions["source"], savedAt: number | null): SeaPointConditions => ({
  point: { lat: 13, lon: 110.5 },
  onSea: true,
  windKmh: null,
  gustKmh: null,
  windDirDeg: null,
  waveM: null,
  wavePeriodS: null,
  days: [],
  stale: true,
  savedAt,
  source,
});

describe("soLuotCham — chậm mấy lượt cập nhật của nguồn", () => {
  it("lưu sau mốc gần nhất ⇒ 0", () => expect(soLuotCham(T("2026-10-30T05:00:00Z"), NOW)).toBe(0));
  it("lưu trước mốc 04h hôm nay ⇒ 1", () => expect(soLuotCham(T("2026-10-30T03:00:00Z"), NOW)).toBe(1));
  it("lưu 4 ngày trước ⇒ đếm đủ mốc", () => expect(soLuotCham(T("2026-10-26T05:00:00Z"), NOW)).toBe(16));
  it("không rõ / đồng hồ lùi ⇒ Infinity", () => {
    expect(soLuotCham(null, NOW)).toBe(Infinity);
    expect(soLuotCham(NOW + 1000, NOW)).toBe(Infinity);
  });
  it("câu nhãn", () => {
    expect(cauLuotCham(0)).toBe("");
    expect(cauLuotCham(undefined)).toBe("");
    expect(cauLuotCham(3)).toBe(" · chậm 3 lượt cập nhật");
  });
});

describe("chonBanLui — chọn bản lùi theo lượt chậm", () => {
  it("DB mới hơn bản đúng toạ độ trong máy ⇒ lấy DB, ghi số lượt chậm", () => {
    const r = chonBanLui([ban("saved-point", T("2026-10-26T05:00:00Z")), ban("saved-grid", T("2026-10-30T05:00:00Z"))], NOW);
    expect(r?.savedAt).toBe(T("2026-10-30T05:00:00Z"));
    expect(r?.luotCham).toBe(0);
  });
  it("hoà lượt ⇒ giữ bản đúng toạ độ (chi tiết hơn ô lưới)", () => {
    const r = chonBanLui([ban("saved-point", T("2026-10-30T04:30:00Z")), ban("saved-grid", T("2026-10-30T08:00:00Z"))], NOW);
    expect(r?.source).toBe("saved-point");
  });
  it("bản không rõ giờ lưu chỉ thắng khi không còn gì", () => {
    expect(chonBanLui([ban("saved-grid", null), ban("saved-point", T("2026-10-20T00:00:00Z"))], NOW)?.source).toBe("saved-point");
    expect(chonBanLui([ban("saved-grid", null)], NOW)?.luotCham).toBeUndefined();
  });
  it("rỗng ⇒ null", () => expect(chonBanLui([], NOW)).toBeNull());
});
