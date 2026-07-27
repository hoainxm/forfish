import { describe, expect, it } from "vitest";
import {
  seaSnapshotId,
  gridSnapshotId,
  isValidSnapshotId,
  SNAPSHOT_GRID_DAYS,
} from "@/lib/weather-snapshot-id";

describe("weather-snapshot id — khoá + whitelist", () => {
  it("dựng khoá cảng / lưới đúng dạng", () => {
    expect(seaSnapshotId("phu-quy")).toBe("sea:phu-quy");
    expect(gridSnapshotId(3)).toBe("grid:d3");
    expect(gridSnapshotId(SNAPSHOT_GRID_DAYS)).toBe("grid:d3");
  });

  it("chấp nhận đúng 2 dạng khoá hợp lệ", () => {
    expect(isValidSnapshotId("sea:phu-quy")).toBe(true);
    expect(isValidSnapshotId("sea:cua_lo")).toBe(true);
    expect(isValidSnapshotId("grid:d3")).toBe(true);
    expect(isValidSnapshotId("grid:d16")).toBe(true);
  });

  it("chặn id lạ (khỏi thành proxy đọc bảng tuỳ ý)", () => {
    expect(isValidSnapshotId("")).toBe(false);
    expect(isValidSnapshotId("customers")).toBe(false);
    expect(isValidSnapshotId("sea:")).toBe(false);
    expect(isValidSnapshotId("sea:a b")).toBe(false); // khoảng trắng
    expect(isValidSnapshotId("grid:x")).toBe(false);
    expect(isValidSnapshotId("sea:phu-quy;drop")).toBe(false);
    expect(isValidSnapshotId("SEA:phu-quy")).toBe(false); // hoa
  });

  it("khung snapshot công khai chỉ là d3 (miễn phí)", () => {
    expect(SNAPSHOT_GRID_DAYS).toBe(3);
  });
});
