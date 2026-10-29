import { describe, it, expect } from "vitest";
import { archiveKey, lamMoiKhoPmtiles, nguonCanNapLai } from "@/lib/pmtiles-protocol";

/*  NẠP LẠI LỚP SAU KHI KHOÁ VỀ (nợ 07 §10.3 C, trả 2026-10-29): chỉ những nguồn ĐÃ BÁO LỖI và đọc qua bộ giải mã
    (pmtiles:// · sdfdata://) mới được nạp lại — nguồn khác nạp lại cũng không chữa được gì. */

const moTa: Record<string, { type: string; url?: string; data?: unknown }> = {
  basemap: { type: "vector", url: "pmtiles:///data/vn-basemap.pmtiles" },
  "reef-shapes": { type: "vector", url: "pmtiles:///data/reef-shapes-aca.v1.pmtiles" },
  islands: { type: "geojson", data: "sdfdata:///data/islands.v1.json" },
  "sea-scalar": { type: "geojson", data: { type: "FeatureCollection", features: [] } },
  "ve-tinh": { type: "raster", url: "https://example.org/tiles.json" },
  "ngoai-vector": { type: "vector", url: "https://example.org/v.json" },
};
const tra = (id: string) => moTa[id];

describe("nguonCanNapLai", () => {
  it("chọn đúng nguồn lỗi đọc qua bộ giải mã, kèm khoá kho pmtiles", () => {
    expect(nguonCanNapLai(["basemap", "islands", "sea-scalar", "ve-tinh", "ngoai-vector"], tra)).toEqual([
      { id: "basemap", kind: "vector", url: "pmtiles:///data/vn-basemap.pmtiles", archive: "/data/vn-basemap.pmtiles" },
      { id: "islands", kind: "geojson", url: "sdfdata:///data/islands.v1.json" },
    ]);
  });

  it("nguồn không còn trên bản đồ (đổi style) ⇒ bỏ; trùng id ⇒ một lần", () => {
    expect(nguonCanNapLai(["mat-roi", "reef-shapes", "reef-shapes"], tra)).toEqual([
      {
        id: "reef-shapes",
        kind: "vector",
        url: "pmtiles:///data/reef-shapes-aca.v1.pmtiles",
        archive: "/data/reef-shapes-aca.v1.pmtiles",
      },
    ]);
  });

  it("chưa nguồn nào lỗi ⇒ rỗng (khoá về không làm bản đồ nạp lại vô cớ)", () => {
    expect(nguonCanNapLai([], tra)).toEqual([]);
  });

  it("khoá kho khớp đường lát MapLibre xin (archiveKey)", () => {
    expect(archiveKey("pmtiles:///data/vn-basemap.pmtiles/7/101/57")).toBe("/data/vn-basemap.pmtiles");
  });

  it("chưa đăng ký protocol (server/test) ⇒ lamMoiKhoPmtiles không ném", () => {
    expect(() => lamMoiKhoPmtiles(["/data/vn-basemap.pmtiles"])).not.toThrow();
  });
});
