import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import {
  CONFIG_KEYS,
  dataKeyShift,
  isConfigKey,
  isDataKeyValue,
  validateConfigValue,
} from "@/lib/app-config-keys";

/*  CẤU HÌNH ỨNG DỤNG — LƯU SAI LÀ CHẾT HỆ THỐNG (chủ dự án 2026-09-17: "thao tác
    cái là chết hệ thống mà không cảnh báo"). Ba lớp, cổng canh cả ba:
    (1) mỗi khoá có câu HẬU QUẢ (`risk`) hiện ở bước xác nhận;
    (2) kiểm dạng `validateConfigValue` — chặn đúng ca đã xảy ra trên prod:
        trình duyệt tự điền SĐT vào VAPID Public Key;
    (3) trang quản trị: input tắt tự điền, bấm Lưu mở hộp xác nhận, "Lưu thật"
        mới ghi; PATCH server kiểm lại lần nữa.
    Khoá dữ liệu bản đồ: đổi khoá hiện hành thì khoá cũ trượt xuống prev. */

const hex = (n: number) => Buffer.from(randomBytes(n)).toString("hex");
const HEX = hex(32);
const HEX2 = hex(32);
const ROOT = process.cwd();

describe("registry app_config", () => {
  it("MỌI khoá có câu hậu quả, không rỗng, nói được bằng lời thường", () => {
    for (const k of CONFIG_KEYS) {
      expect(k.risk.trim().length, k.key).toBeGreaterThan(30);
      expect(k.risk, `${k.key}: hậu quả phải nói bằng lời thường, không jargon`).not.toMatch(/env|JSON|API|route/i);
    }
  });

  it("có data_key_current (secret, sinh được) + data_key_prev (secret)", () => {
    const cur = CONFIG_KEYS.find((k) => k.key === "data_key_current")!;
    const prev = CONFIG_KEYS.find((k) => k.key === "data_key_prev")!;
    expect(cur.secret && prev.secret).toBe(true);
    expect(cur.generate).toBe("hex32");
    expect(cur.envVar).toBe("SDFISH_DATA_KEY");
    expect(isConfigKey("data_key_current")).toBe(true);
  });
});

describe("validateConfigValue — chặn ở ranh giới", () => {
  it("SĐT tự điền vào VAPID Public Key (ảnh prod 2026-09-17) bị chặn; khoá thật qua", () => {
    expect(validateConfigValue("vapid_public_key", "0938635689")).toBe(false);
    expect(
      validateConfigValue(
        "vapid_public_key",
        "BA7gxuKUApzkQIdGEDwnTC7C--0U7_eLJU3V5KQnNybQ24Z07CUszcZy1L83fomS-rjMaB1Pxbri_OHt7RKWz10",
      ),
    ).toBe(true);
  });

  it("từng khoá", () => {
    expect(validateConfigValue("vapid_private_key", "matkhau1")).toBe(false);
    expect(validateConfigValue("vapid_private_key", "a".repeat(43))).toBe(true);
    expect(validateConfigValue("vapid_subject", "https://sdvico.vn")).toBe(true);
    expect(validateConfigValue("vapid_subject", "mailto:a@b.vn")).toBe(true);
    expect(validateConfigValue("vapid_subject", "sdvico.vn")).toBe(false);
    expect(validateConfigValue("cron_secret", "ngan")).toBe(false);
    expect(validateConfigValue("cron_secret", "x".repeat(32))).toBe(true);
    expect(validateConfigValue("data_key_current", HEX)).toBe(true);
    expect(validateConfigValue("data_key_current", "0938635689")).toBe(false);
    expect(validateConfigValue("data_key_prev", "  ")).toBe(false);
  });

  it("isDataKeyValue: đúng 64 hex (không phân biệt hoa/thường, cắt khoảng trắng)", () => {
    expect(isDataKeyValue(HEX)).toBe(true);
    expect(isDataKeyValue(` ${HEX.toUpperCase()} `)).toBe(true);
    expect(isDataKeyValue(HEX.slice(1))).toBe(false);
    expect(isDataKeyValue("zz".repeat(32))).toBe(false);
  });
});

describe("dataKeyShift", () => {
  it("khoá cũ trượt xuống prev; cùng khoá thì không; chưa có cũ thì chỉ ghi current", () => {
    expect(dataKeyShift(HEX, HEX2)).toEqual([
      { key: "data_key_prev", value: HEX },
      { key: "data_key_current", value: HEX2 },
    ]);
    expect(dataKeyShift(HEX, HEX.toUpperCase())).toEqual([{ key: "data_key_current", value: HEX }]);
    expect(dataKeyShift(null, HEX2)).toEqual([{ key: "data_key_current", value: HEX2 }]);
  });
});

describe("DÂY NỐI — trang quản trị + route thật sự dùng ba lớp", () => {
  const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
  const page = strip(readFileSync(join(ROOT, "src/app/quan-tri/page.tsx"), "utf8"));
  const route = strip(readFileSync(join(ROOT, "src/app/api/admin/app-config/route.ts"), "utf8"));

  it("input cấu hình tắt tự điền của trình duyệt", () => {
    expect(page).toContain('autoComplete={row.secret ? "new-password" : "off"}');
    expect(page).toContain("name={`cfg-${row.key}`}");
  });

  it("Lưu mở hộp xác nhận có hậu quả; 'Lưu thật' mới gọi save; sai dạng thì khoá nút", () => {
    expect(page).toContain("onClick={() => setConfirm(row.key)}");
    expect(page).toContain("{row.risk}");
    expect(page).toContain("Lưu thật");
    expect(page).toContain("disabled={busy === row.key || !draft.trim() || bad}");
    expect(page).toContain("validateConfigValue(row.key as ConfigKey, draft)");
  });

  it("PATCH kiểm dạng MỌI khoá trước khi ghi", () => {
    expect(route).toContain("validateConfigValue(body.key, body.value)");
  });
});
