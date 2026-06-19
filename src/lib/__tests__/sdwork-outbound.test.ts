import { describe, expect, it } from "vitest";
import { signOutbound, type PasswordSyncPayload } from "@/lib/sdwork-outbound";
import { verifyWebhookSignature } from "@/lib/sdwork-webhook";

describe("signOutbound (SDFish → SDWork)", () => {
  const payload: PasswordSyncPayload = { phone: "0901234567", password: "new456" };
  const raw = JSON.stringify(payload);

  it("hex digest ổn định + đối xứng với verify inbound (cùng secret)", () => {
    const sig = signOutbound(raw, "shared-secret");
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
    // SDWork verify bằng cùng thuật toán HMAC-SHA256 → khớp
    expect(verifyWebhookSignature(raw, sig, "shared-secret")).toBe(true);
  });

  it("sai secret → chữ ký khác", () => {
    expect(signOutbound(raw, "a")).not.toBe(signOutbound(raw, "b"));
    expect(verifyWebhookSignature(raw, signOutbound(raw, "a"), "b")).toBe(false);
  });
});
