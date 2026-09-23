// Gác helper thuần của app-config (nguồn hiệu lực DB-đè-env + che secret).
import { describe, expect, it } from "vitest";
import {
  configCacheFresh,
  nextConfigCache,
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

/*  Án lệ 2026-09-15 — cron ĐỎ vì `app_config` bị cache RỖNG sau một lượt đọc
    hỏng: cron_secret biến mất ⇒ 401, VAPID biến mất ⇒ không đẩy cảnh báo bão. */
describe("nextConfigCache — đọc hỏng KHÔNG được xoá cấu hình đã có", () => {
  const TTL = { okMs: 30_000, failMs: 3_000 };
  const good = { cron_secret: "s3cr3t", vapid_public_key: "pub" };

  it("đọc được → thay bản mới, hẹn dài", () => {
    expect(nextConfigCache(null, { ok: true, map: good }, 1000, TTL)).toEqual({
      at: 1000,
      ttlMs: 30_000,
      map: good,
    });
  });

  it("đọc HỎNG → GIỮ bản cũ, KHÔNG rỗng hoá", () => {
    const prev = { at: 0, ttlMs: 30_000, map: good };
    const next = nextConfigCache(prev, { ok: false }, 40_000, TTL);
    expect(next.map).toEqual(good);
    expect(next.ttlMs).toBe(3_000); // hẹn thử lại SỚM
  });

  it("đọc HỎNG lúc chưa từng có bản nào → rỗng, nhưng hẹn NGẮN để thử lại", () => {
    const next = nextConfigCache(null, { ok: false }, 500, TTL);
    expect(next.map).toEqual({});
    expect(next.ttlMs).toBe(3_000);
  });

  it("hỏi ĐƯỢC mà bảng trống → đúng là rỗng, hẹn dài (khác với hỏng)", () => {
    const prev = { at: 0, ttlMs: 30_000, map: good };
    const next = nextConfigCache(prev, { ok: true, map: {} }, 40_000, TTL);
    expect(next.map).toEqual({});
    expect(next.ttlMs).toBe(30_000);
  });
});

describe("configCacheFresh — hết hạn theo ttl của chính lượt ghi ra nó", () => {
  it("chưa có cache → không tươi", () => {
    expect(configCacheFresh(null, 0)).toBe(false);
  });
  it("trong hạn → tươi", () => {
    expect(configCacheFresh({ at: 1000, ttlMs: 30_000, map: {} }, 30_999)).toBe(true);
  });
  it("quá hạn → không tươi", () => {
    expect(configCacheFresh({ at: 1000, ttlMs: 30_000, map: {} }, 31_000)).toBe(false);
  });
  it("bản ghi từ lượt HỎNG hết hạn sau 3s, không phải 30s", () => {
    expect(configCacheFresh({ at: 0, ttlMs: 3_000, map: {} }, 3_000)).toBe(false);
  });
});
