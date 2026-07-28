import { describe, expect, it } from "vitest";
import {
  validatePushSubscription,
  type PushSubscriptionInput,
} from "@/lib/push-subscriptions";

function sub(over: Partial<PushSubscriptionInput> = {}): PushSubscriptionInput {
  return {
    endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
    keys: { p256dh: "p256dh-key", auth: "auth-key" },
    ...over,
  };
}

describe("validatePushSubscription", () => {
  it("đủ endpoint + keys → hợp lệ", () => {
    expect(validatePushSubscription(sub())).toBeNull();
  });
  it("null/undefined → báo lỗi", () => {
    expect(validatePushSubscription(null)).toMatch(/endpoint/i);
    expect(validatePushSubscription(undefined)).toMatch(/endpoint/i);
  });
  it("thiếu endpoint → báo lỗi", () => {
    expect(validatePushSubscription(sub({ endpoint: "" }))).toMatch(
      /endpoint/i,
    );
  });
  it("thiếu keys → báo lỗi", () => {
    expect(
      validatePushSubscription(sub({ keys: { p256dh: "", auth: "auth-key" } })),
    ).toMatch(/khoá/i);
    expect(
      validatePushSubscription(sub({ keys: { p256dh: "p256dh-key", auth: "" } })),
    ).toMatch(/khoá/i);
  });
});
