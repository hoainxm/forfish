import { describe, expect, it, vi } from "vitest";
import {
  deliverWithRetry,
  describePushFailures,
  tallyFanout,
  type PushAttempt,
} from "@/lib/push-delivery";

/** Chuỗi kết quả lần lượt cho từng lần gửi + đếm số lần gửi/chờ. */
function scripted(...results: PushAttempt[]) {
  const attempt = vi.fn(async () => results.shift()!);
  const sleep = vi.fn(async () => {});
  return { attempt, sleep };
}

describe("deliverWithRetry", () => {
  it("403 (khoá VAPID lệch) → KHÔNG thử lại, KHÔNG báo gone, giữ mã", async () => {
    const { attempt, sleep } = scripted({ ok: false, status: 403 });
    expect(await deliverWithRetry(attempt, sleep)).toEqual({ ok: false, gone: false, status: 403 });
    expect(attempt).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it.each([404, 410])("%i → gone, không thử lại", async (status) => {
    const { attempt, sleep } = scripted({ ok: false, status });
    expect(await deliverWithRetry(attempt, sleep)).toEqual({ ok: false, gone: true, status });
    expect(attempt).toHaveBeenCalledTimes(1);
  });

  it("5xx / mất mạng → thử lại đúng MỘT lần", async () => {
    const a = scripted({ ok: false, status: 503 }, { ok: true });
    expect(await deliverWithRetry(a.attempt, a.sleep)).toEqual({ ok: true });
    expect(a.attempt).toHaveBeenCalledTimes(2);
    expect(a.sleep).toHaveBeenCalledTimes(1);

    const b = scripted({ ok: false }, { ok: false });
    expect(await deliverWithRetry(b.attempt, b.sleep)).toEqual({ ok: false, gone: false, status: undefined });
    expect(b.attempt).toHaveBeenCalledTimes(2);
  });

  it("thử lại mà gặp 410 → vẫn báo gone", async () => {
    const { attempt, sleep } = scripted({ ok: false, status: 500 }, { ok: false, status: 410 });
    expect((await deliverWithRetry(attempt, sleep)).gone).toBe(true);
  });
});

describe("tallyFanout", () => {
  it("đếm gửi được / chết / hỏng theo mã — 403 KHÔNG nằm trong goneIds", () => {
    const t = tallyFanout([
      { id: "a", ok: true },
      { id: "b", ok: false, gone: true, status: 410 },
      { id: "c", ok: false, gone: false, status: 403 },
      { id: "d", ok: false, gone: false, status: 403 },
      { id: "e", ok: false, gone: false },
    ]);
    expect(t).toEqual({ sent: 1, goneIds: ["b"], failed: 3, failedByStatus: { "403": 2, network: 1 } });
  });
});

describe("describePushFailures", () => {
  it("rỗng khi không có lỗi", () => {
    expect(describePushFailures(undefined)).toBe("");
    expect(describePushFailures({})).toBe("");
  });
  it("403 → gọi đích danh khoá VAPID", () => {
    const s = describePushFailures({ "403": 2, network: 1 });
    expect(s).toContain("mã 403: 2");
    expect(s).toContain("mất kết nối: 1");
    expect(s).toMatch(/VAPID/);
  });
  it("không có 403 → không nhắc VAPID", () => {
    expect(describePushFailures({ "500": 1 })).not.toMatch(/VAPID/);
  });
});
