import { describe, expect, it } from "vitest";
import {
  seaSnapshotId,
  gridSnapshotId,
  scalarSnapshotId,
  rawSourceId,
  curDepthSnapshotId,
  isValidSnapshotId,
  snapshotNeedsPremium,
  SNAPSHOT_GRID_DAYS,
  SNAPSHOT_PREMIUM_GRID_DAYS,
  SNAPSHOT_DAY_SET,
  CUR_DEPTH_TIERS,
  CUR_DEPTH_MAX_DAYS,
} from "@/lib/weather-snapshot-id";

describe("weather-snapshot id — khoá + whitelist", () => {
  it("dựng khoá cảng / lưới / lớp dải màu đúng dạng", () => {
    expect(seaSnapshotId("phu-quy")).toBe("sea:phu-quy");
    expect(gridSnapshotId(3)).toBe("grid:d3");
    expect(gridSnapshotId(SNAPSHOT_GRID_DAYS)).toBe("grid:d3");
    expect(scalarSnapshotId("cloud", 3)).toBe("scalar:cloud:d3");
  });

  it("chấp nhận đúng 3 dạng khoá hợp lệ", () => {
    expect(isValidSnapshotId("sea:phu-quy")).toBe(true);
    expect(isValidSnapshotId("sea:cua_lo")).toBe(true);
    expect(isValidSnapshotId("grid:d3")).toBe(true);
    expect(isValidSnapshotId("grid:d16")).toBe(true);
    // 5 lớp dải màu Open-Meteo (KHÔNG có salinity — đã server-side riêng)
    for (const k of ["cloud", "rain", "airtemp", "storm", "pressure"]) {
      expect(isValidSnapshotId(`scalar:${k}:d3`)).toBe(true);
    }
  });

  it("chặn id lạ (khỏi thành proxy đọc bảng tuỳ ý)", () => {
    expect(isValidSnapshotId("")).toBe(false);
    expect(isValidSnapshotId("customers")).toBe(false);
    expect(isValidSnapshotId("sea:")).toBe(false);
    expect(isValidSnapshotId("sea:a b")).toBe(false); // khoảng trắng
    expect(isValidSnapshotId("grid:x")).toBe(false);
    expect(isValidSnapshotId("sea:phu-quy;drop")).toBe(false);
    expect(isValidSnapshotId("SEA:phu-quy")).toBe(false); // hoa
    expect(isValidSnapshotId("scalar:salinity:d3")).toBe(false); // không public
    expect(isValidSnapshotId("scalar:cloud:x")).toBe(false);
    expect(isValidSnapshotId("scalar:evil:d3")).toBe(false);
  });

  it("khung snapshot công khai chỉ là d3 (miễn phí)", () => {
    expect(SNAPSHOT_GRID_DAYS).toBe(3);
  });

  /* 2026-07-29: dòng chảy THEO TẦNG — 4 tầng cố định, d3 miễn phí, d10 premium
     (chung luật >3 ngày). */
  it("curdepth: đúng 4 tầng qua whitelist; d10 cần premium, d3 không; tầng lạ chặn", () => {
    for (const t of CUR_DEPTH_TIERS) {
      expect(isValidSnapshotId(curDepthSnapshotId(t, 3))).toBe(true);
      expect(isValidSnapshotId(curDepthSnapshotId(t, CUR_DEPTH_MAX_DAYS))).toBe(true);
    }
    expect(snapshotNeedsPremium(curDepthSnapshotId(150, CUR_DEPTH_MAX_DAYS))).toBe(true);
    expect(snapshotNeedsPremium(curDepthSnapshotId(150, 3))).toBe(false);
    expect(isValidSnapshotId("curdepth:t100:d10")).toBe(false); // tầng không có
    expect(isValidSnapshotId("curdepth:t50:dx")).toBe(false);
  });

  /* 2026-07-29: cron ghép 2 nguồn giữ bản THÔ từng nguồn ở hàng raw:<id>:<src>
     — hàng nội bộ, /api/weather-snapshot KHÔNG được trả ra. */
  it("hàng THÔ raw:<id>:<src> KHÔNG lọt whitelist đọc public", () => {
    expect(rawSourceId("grid:d16", "ecmwf")).toBe("raw:grid:d16:ecmwf");
    for (const id of [
      rawSourceId("grid:d3", "om"),
      rawSourceId("grid:d16", "ecmwf"),
      rawSourceId("sea:phu-quy", "om"),
      rawSourceId("scalar:d3", "ecmwf"),
    ]) {
      expect(isValidSnapshotId(id)).toBe(false);
    }
  });

  /*
    2026-07-29: cron snapshot THÊM khung premium d16 — vì màn Ra khơi tự đặt tầm
    theo hạng nên premium LUÔN xin d16, trước đây không bao giờ có lưới an toàn.
    Không lộ hàng: route /api/weather-snapshot chặn thật các id cần premium.
  */
  describe("khung premium d16 (snapshotNeedsPremium)", () => {
    it("cron tính sẵn cả 2 khung: miễn phí d3 + premium d16", () => {
      expect(SNAPSHOT_PREMIUM_GRID_DAYS).toBe(16);
      expect([...SNAPSHOT_DAY_SET]).toEqual([3, 16]);
    });

    it("id khung >3 ngày CẦN premium; d3 và cảng thì KHÔNG", () => {
      expect(snapshotNeedsPremium("grid:d16")).toBe(true);
      expect(snapshotNeedsPremium("scalar:cloud:d16")).toBe(true);
      expect(snapshotNeedsPremium("grid:d3")).toBe(false);
      expect(snapshotNeedsPremium("scalar:rain:d3")).toBe(false);
      // dự báo theo cảng không mang khung ngày → public
      expect(snapshotNeedsPremium("sea:phu-quy")).toBe(false);
    });

    it("id premium vẫn phải qua whitelist (không mở cửa cho id lạ)", () => {
      expect(isValidSnapshotId(gridSnapshotId(16))).toBe(true);
      expect(isValidSnapshotId(scalarSnapshotId("storm", 16))).toBe(true);
      expect(isValidSnapshotId("scalar:salinity:d16")).toBe(false);
    });
  });
});
