// Vận hành train dự báo cá (mảnh 2F, rà pipeline 2026-10-18): selftest runner + bộ chuyển DataLake (PII-strip) mỗi `npm test`.
import { describe, expect, it } from "vitest";
import { selftest as runnerSelftest, WINDOWS, MONTHS } from "../../../scripts/train/run.mjs";
import { selftest as adaptSelftest } from "../../../scripts/dl-adapt-local.mjs";
import { dataDir } from "../../../scripts/lib/data-dir.mjs";

describe("scripts/train/run.mjs", () => {
  it("selftest: DAG đúng thứ tự, khoá cache đổi theo mã/đầu vào, --only/--from-stage", async () => {
    await expect(runnerSelftest()).resolves.toBeUndefined();
  });
  it("5 khúc nhãn phủ liền 01/01 → 11/10 không hở không chồng", () => {
    const w = WINDOWS.map((x: string) => x.split(","));
    expect(w[0][0]).toBe("2026-01-01");
    for (let i = 1; i < w.length; i++) expect(Date.parse(w[i][0]) - Date.parse(w[i - 1][1])).toBe(86400e3);
    expect(MONTHS).toHaveLength(10);
  });
});

describe("scripts/dl-adapt-local.mjs", () => {
  it("selftest: tên chủ tàu, số đăng ký, số nhật ký KHÔNG lọt ra đầu ra", async () => {
    await expect(adaptSelftest()).resolves.toBeUndefined();
  });
});

describe("scripts/lib/data-dir.mjs", () => {
  it("SDFISH_DATA_DIR thắng mặc định ~/sdfish-data", () => {
    const old = process.env.SDFISH_DATA_DIR;
    process.env.SDFISH_DATA_DIR = "/tmp/xyz";
    expect(dataDir()).toBe("/tmp/xyz");
    delete process.env.SDFISH_DATA_DIR;
    expect(dataDir()).toMatch(/sdfish-data$/);
    if (old !== undefined) process.env.SDFISH_DATA_DIR = old;
  });
});
