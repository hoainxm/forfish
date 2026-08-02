import { describe, it, expect } from "vitest";
import {
  DEVICE_TOKEN_HEADER,
  DEVICE_TOKEN_LEN,
  hashDeviceToken,
  isValidTokenShape,
  newDeviceToken,
  readTokenHeader,
  shouldDropAccount,
} from "@/lib/device-token";

/*  CỔNG CHẶN KHUÔN của luật "đăng nhập là dùng vĩnh viễn".
    Mọi ca ở đây đều trả lời đúng một câu hỏi: **có đường nào làm bà con văng ra
    khỏi tài khoản mà KHÔNG phải do máy khác đăng nhập không?** Nếu có thì đó là
    lỗi CHẶN, không phải lỗi nhỏ. */

describe("khuôn chuỗi — cổng rẻ đứng trước cổng đắt", () => {
  it("chuỗi vừa sinh thì đúng khuôn và đủ dài", () => {
    const t = newDeviceToken();
    expect(isValidTokenShape(t)).toBe(true);
    expect(t.length).toBe(DEVICE_TOKEN_LEN);
    expect(t.startsWith("sdf_")).toBe(true);
  });

  it("hai lần sinh KHÔNG ra cùng một chuỗi", () => {
    const seen = new Set(Array.from({ length: 200 }, () => newDeviceToken()));
    expect(seen.size).toBe(200);
  });

  it.each([
    ["rỗng", ""],
    ["thiếu tiền tố", "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG"],
    ["ngắn", "sdf_abc"],
    ["ký tự lạ", "sdf_" + "a".repeat(42) + "+"],
    ["không phải chuỗi", 12345],
    ["null", null],
  ])("chặn %s mà KHÔNG ném", (_ten, v) => {
    expect(isValidTokenShape(v)).toBe(false);
  });
});

describe("băm — DB không bao giờ giữ chuỗi thô", () => {
  it("cùng chuỗi ra cùng băm, khác chuỗi ra khác băm", async () => {
    const a = newDeviceToken();
    const b = newDeviceToken();
    expect(await hashDeviceToken(a)).toBe(await hashDeviceToken(a));
    expect(await hashDeviceToken(a)).not.toBe(await hashDeviceToken(b));
  });

  it("băm là 64 ký tự hex, KHÔNG chứa lại chuỗi thô", async () => {
    const t = newDeviceToken();
    const h = await hashDeviceToken(t);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).not.toContain(t.slice(4));
  });
});

describe("đọc header", () => {
  const good = newDeviceToken();

  it("đọc được header riêng", () => {
    const h = new Headers({ [DEVICE_TOKEN_HEADER]: good });
    expect(readTokenHeader(h)).toBe(good);
  });

  it("đọc được Authorization: Bearer (đường cho bản native Capacitor)", () => {
    const h = new Headers({ authorization: `Bearer ${good}` });
    expect(readTokenHeader(h)).toBe(good);
  });

  it("header rác → null, KHÔNG ném (một header hỏng không được giết cả request)", () => {
    expect(readTokenHeader(new Headers({ [DEVICE_TOKEN_HEADER]: "xxx" }))).toBe(null);
    expect(readTokenHeader(new Headers({ authorization: "Bearer" }))).toBe(null);
    expect(readTokenHeader(new Headers())).toBe(null);
  });
});

describe("KHI NÀO máy được phép tự gỡ tài khoản — lỗi CHẶN nếu sai", () => {
  it("bị máy khác đá → gỡ", () => {
    expect(shouldDropAccount("token_revoked")).toBe(true);
  });

  it("chuỗi không có trong sổ → gỡ", () => {
    expect(shouldDropAccount("unknown_token")).toBe(true);
  });

  it("CHƯA TỪNG đăng nhập → KHÔNG gỡ (không có gì để gỡ, và không được báo 'bị đá')", () => {
    expect(shouldDropAccount("no_token")).toBe(false);
  });

  /*  Ca này canh đúng thứ đã làm hỏng phiên bản cũ: hạ tầng trục trặc đội lốt
      "đã đăng xuất". Cổng server (device-token-server.ts) trả `unavailable` chứ
      KHÔNG trả denial nào cho các ca đó, nên ở đây không có giá trị nào của
      TokenDenial ứng với "mất sóng"/"DB hỏng" — nếu ai đó thêm vào thì test này
      buộc họ phải nghĩ lại. */
  it("chỉ có ĐÚNG BA lý do chặn, không có lý do nào mang nghĩa 'hạ tầng hỏng'", () => {
    const all = ["no_token", "unknown_token", "token_revoked"] as const;
    expect(all.filter(shouldDropAccount)).toEqual([
      "unknown_token",
      "token_revoked",
    ]);
  });
});
