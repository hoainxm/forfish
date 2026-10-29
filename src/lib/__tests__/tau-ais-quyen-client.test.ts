// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { TAU_AIS_QUYEN_KEY, fetchQuyenAis, peekQuyenAis } from "@/lib/tau-ais";

const traLoi = (status: number, body: unknown) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("quyền xem AIS — phía máy", () => {
  it("máy chủ trả lời ⇒ nhớ theo SĐT; SĐT khác không đọc được bản nhớ", async () => {
    vi.stubGlobal("fetch", traLoi(200, { ok: true, ais: true }));
    expect(await fetchQuyenAis("0938635689")).toBe(true);
    expect(peekQuyenAis("0938635689")).toBe(true);
    expect(peekQuyenAis("0901234567")).toBeNull();
  });
  it("mất sóng / 401 / 503 ⇒ null và GIỮ bản nhớ cũ (không tự tắt nút giữa biển)", async () => {
    localStorage.setItem(TAU_AIS_QUYEN_KEY, JSON.stringify({ phone: "0938635689", ais: true }));
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("offline"); }));
    expect(await fetchQuyenAis("0938635689")).toBeNull();
    vi.stubGlobal("fetch", traLoi(503, { ok: false, code: "unavailable" }));
    expect(await fetchQuyenAis("0938635689")).toBeNull();
    expect(peekQuyenAis("0938635689")).toBe(true);
  });
  it("bị gỡ quyền ⇒ false, bản nhớ cập nhật", async () => {
    localStorage.setItem(TAU_AIS_QUYEN_KEY, JSON.stringify({ phone: "0938635689", ais: true }));
    vi.stubGlobal("fetch", traLoi(200, { ok: true, ais: false }));
    expect(await fetchQuyenAis("0938635689")).toBe(false);
    expect(peekQuyenAis("0938635689")).toBe(false);
  });
  it("bản nhớ hỏng ⇒ null", () => {
    localStorage.setItem(TAU_AIS_QUYEN_KEY, "{hỏng");
    expect(peekQuyenAis("0938635689")).toBeNull();
  });
});
