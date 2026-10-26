// Gác helper thuần của app-config (nguồn hiệu lực DB-đè-env + che secret).
import { describe, expect, it } from "vitest";
import {
  configCacheFresh,
  nextConfigCache,
  CONFIG_KEYS,
  isConfigKey,
  resolveConfigCell,
  configPrecedenceText,
} from "@/lib/app-config-keys";

describe("resolveConfigCell — DB đè env, che secret", () => {
  it("có DB → nguồn db, trả giá trị (khoá thường)", () => {
    expect(resolveConfigCell("dbval", "envval", false)).toEqual({
      source: "db",
      set: true,
      value: "dbval",
      overridden: true,
    });
  });
  it("chỉ env → nguồn env", () => {
    expect(resolveConfigCell(undefined, "envval", false)).toEqual({
      source: "env",
      set: true,
      value: "envval",
      overridden: false,
    });
  });
  it("không có gì → none, value null", () => {
    expect(resolveConfigCell("", "  ", false)).toEqual({
      source: "none",
      set: false,
      value: null,
      overridden: false,
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
  it("khoá envFirst (nhập tin Kairos): env THẮNG DB, báo DB đang bị bỏ qua", () => {
    expect(resolveConfigCell("dbval", "envval", false, true)).toEqual({ source: "env", set: true, value: "envval", overridden: true });
    // không có env ⇒ DB có hiệu lực, không ai bị đè
    expect(resolveConfigCell("dbval", " ", false, true)).toEqual({ source: "db", set: true, value: "dbval", overridden: false });
    expect(resolveConfigCell(undefined, undefined, true, true)).toEqual({ source: "none", set: false, value: null, overridden: false });
  });
  it("chỉ khoá máy thu ở nhà (Kairos, tàu AIS) đi theo env-thắng — các khoá khác giữ DB đè env", () => {
    expect(CONFIG_KEYS.filter((k) => k.envFirst).map((k) => k.key)).toEqual(["kairos_ingest_key", "tau_ais_key"]);
  });
});

describe("configPrecedenceText — trang quản trị nói đúng bên thắng", () => {
  it("khoá Kairos: nói env thắng; env đang đè thì cảnh báo ô không hiệu lực", () => {
    const quiet = configPrecedenceText({ envFirst: true, envVar: "KAIROS_INGEST_KEY", overridden: false });
    expect(quiet.order).toMatch(/env KAIROS_INGEST_KEY .*thắng ô này/);
    expect(quiet.warn).toBeNull();
    const shadow = configPrecedenceText({ envFirst: true, envVar: "KAIROS_INGEST_KEY", overridden: true });
    expect(shadow.warn).toMatch(/đang đè.*KHÔNG có hiệu lực/);
  });
  it("khoá thường: nói ô này thắng env, KHÔNG bao giờ nói env đè", () => {
    const t = configPrecedenceText({ envFirst: false, envVar: "CRON_SECRET", overridden: true });
    expect(t.order).toMatch(/ô này thắng env CRON_SECRET/);
    expect(t.warn).toMatch(/Ô này đang đè env/);
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
