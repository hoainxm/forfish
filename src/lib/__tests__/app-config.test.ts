// Gác helper thuần của app-config (nguồn hiệu lực DB-đè-env + che secret).
import { describe, expect, it } from "vitest";
import {
  CONFIG_KEYS,
  isConfigKey,
  resolveConfigCell,
} from "@/lib/app-config-keys";

describe("resolveConfigCell — DB đè env, che secret", () => {
  it("có DB → nguồn db, trả giá trị (khoá thường)", () => {
    expect(resolveConfigCell("dbval", "envval", false)).toEqual({
      source: "db",
      set: true,
      value: "dbval",
    });
  });
  it("chỉ env → nguồn env", () => {
    expect(resolveConfigCell(undefined, "envval", false)).toEqual({
      source: "env",
      set: true,
      value: "envval",
    });
  });
  it("không có gì → none, value null", () => {
    expect(resolveConfigCell("", "  ", false)).toEqual({
      source: "none",
      set: false,
      value: null,
    });
  });
  it("khoá secret: set=true nhưng value KHÔNG lộ (null)", () => {
    const cell = resolveConfigCell("supersecret", undefined, true);
    expect(cell.source).toBe("db");
    expect(cell.set).toBe(true);
    expect(cell.value).toBeNull();
  });
  it("bỏ khoảng trắng thừa", () => {
    expect(resolveConfigCell("  x  ", undefined, false).value).toBe("x");
  });
});

describe("isConfigKey", () => {
  it("nhận khoá hợp lệ", () => {
    for (const m of CONFIG_KEYS) expect(isConfigKey(m.key)).toBe(true);
  });
  it("từ chối khoá lạ", () => {
    expect(isConfigKey("drop_table")).toBe(false);
    expect(isConfigKey("")).toBe(false);
  });
});
