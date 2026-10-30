// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";

/*  Bắt 30/10 (log dev): forecast-grid đọc thân qua taiJsonCoNhip rồi mới gọi `noteResponse` ⇒
    `res.clone()` ném "body already used" ⇒ unhandledRejection, máy bị đá không được phát hiện ở
    đường này. `noteResponse` hứa KHÔNG BAO GIỜ ném; thân đã đọc thì nhận qua tham số thứ hai. */

import { DEVICE_TOKEN_KEY, noteResponse } from "@/lib/device-token-store";

const res401 = (code: string) =>
  new Response(JSON.stringify({ ok: false, code }), { status: 401, headers: { "content-type": "application/json" } });

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(DEVICE_TOKEN_KEY, "sdf_" + "a".repeat(43));
});

describe("noteResponse với thân đã đọc", () => {
  it("thân đã đọc, không đưa lại ⇒ không ném, không coi là bị đá", async () => {
    const r = res401("token_revoked");
    await r.json();
    await expect(noteResponse(r)).resolves.toBeNull();
    expect(localStorage.getItem(DEVICE_TOKEN_KEY)).not.toBeNull();
  });
  it("thân đã đọc, chỗ gọi đưa json ⇒ vẫn bắt được máy bị đá", async () => {
    const r = res401("token_revoked");
    const j = await r.json();
    await expect(noteResponse(r, j)).resolves.toBe("token_revoked");
    expect(localStorage.getItem(DEVICE_TOKEN_KEY)).toBeNull();
  });
  it("thân chưa đọc ⇒ như cũ, và chỗ gọi vẫn đọc được thân sau đó", async () => {
    const r = res401("unknown_token");
    await expect(noteResponse(r)).resolves.toBe("unknown_token");
    expect(await r.json()).toMatchObject({ code: "unknown_token" });
  });
});
