import { describe, expect, it } from "vitest";
import { FORBIDDEN_SNAPSHOT_KEYS, validateAssistantRequest } from "@/lib/assistant/validate";
import type { DeviceSnapshot } from "@/lib/assistant/types";

/*  HỢP ĐỒNG BODY `POST /api/tro-ly` (14 §6.1/§8/§9.1, 13 AC-T51/T53): sai hình →
    invalid; trường nhạy cảm → bad_snapshot (từ chối, không lặng lẽ bỏ); không
    nhận `history`; text 1..300.  */

function snapshot(over: Partial<DeviceSnapshot> = {}): DeviceSnapshot {
  const now = Date.now();
  return {
    takenAt: now, route: "/", online: true, premium: false,
    home: { portId: "quy-nhon", portName: "Quy Nhơn", province: "Gia Lai" },
    weather: null, storm: { savedAt: now, storms: [] }, tide: null, boat: null, docs: [], maintenance: [],
    crew: { count: 8, issues: 2 }, cart: { lines: 0, titles: [] }, orders: null, fishPrices: null, fuel: null,
    inboxUnread: 0, placeNames: [], ...over,
  };
}
const body = (text: string, over: Partial<DeviceSnapshot> = {}) => ({ text, route: "/", snapshot: snapshot(over) });

describe("assistant-validate", () => {
  it("body đúng → ok, text được trim", () => {
    const r = validateAssistantRequest(body("  thời tiết hôm nay "));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.body.text).toBe("thời tiết hôm nay");
  });

  it("sai hình → invalid (không ném)", () => {
    const cases: unknown[] = [
      null, "x", [], {},
      { route: "/", snapshot: snapshot() },
      body(""),
      body("   "),
      body("a".repeat(400)),
      { text: "x", route: "/" },
      { text: "x", route: "/", snapshot: "rác" },
      { text: "x", route: "/", snapshot: { ...snapshot(), cart: null } },
      { ...body("x"), history: [] },
    ];
    for (const c of cases) {
      const r = validateAssistantRequest(c);
      expect(r.ok, JSON.stringify(c).slice(0, 80)).toBe(false);
      if (!r.ok) expect(r.code).toBe("invalid");
    }
    expect(validateAssistantRequest(body("x"), 20_000)).toMatchObject({ ok: false, code: "invalid" });
  });

  it("AC-T53: trường nhạy cảm ở bất kỳ tầng nào → bad_snapshot", () => {
    const bad: Record<string, unknown>[] = [
      { cccd: "012345678901" },
      { phone: "0901000001" },
      { docNumber: "KH-91234/ĐK" },
      { bank: "Vietcombank 0123456789" },
      { stk: "0123456789" },
      { address: "Cảng Hòn Rớ" },
      { lat: 12.2, lon: 109.2 },
      { crew: { count: 1, issues: 0, cccd: "012345678901" } },
      { names: ["BĐ-91234"] },
      { orders: { savedAt: 1, items: [{ code: "SD1", status: "dang_giao", shopName: "A", totalVnd: 1, shopPhone: "0909" }] } },
      { boat: { name: "BĐ 91234", count: 1, names: [] } },
      { boat: { name: "", count: 1, names: ["x"] } },
    ];
    for (const b of bad) {
      const r = validateAssistantRequest(body("x", b as Partial<DeviceSnapshot>));
      expect(r.ok, Object.keys(b).join("+")).toBe(false);
      if (!r.ok) expect(r.code, Object.keys(b).join("+")).toBe("bad_snapshot");
    }
    // snapshot vừa SAI HÌNH vừa có khoá cấm (client cũ gửi `crew` thành mảng kèm CCCD):
    // khoá cấm quét TRƯỚC → mã `bad_snapshot` cụ thể, không chìm trong `invalid` (QA 2026-09-06)
    const crewArr = validateAssistantRequest(body("x", { crew: [{ name: "Nguyễn Văn Tâm", cccd: "012345678901" }] } as unknown as Partial<DeviceSnapshot>));
    expect(crewArr).toMatchObject({ ok: false, code: "bad_snapshot" });
    if (!crewArr.ok) expect(crewArr.why).not.toContain("012345678901");
    // sai hình mà KHÔNG có khoá cấm vẫn là invalid
    expect(validateAssistantRequest(body("x", { crew: [{ count: 1 }] } as unknown as Partial<DeviceSnapshot>))).toMatchObject({ ok: false, code: "invalid" });
    // boat đã strip (name rỗng, names rỗng) thì qua
    expect(validateAssistantRequest(body("x", { boat: { name: "", count: 2, names: [] } })).ok).toBe(true);
    expect(FORBIDDEN_SNAPSHOT_KEYS).toContain("cccd");
    expect(FORBIDDEN_SNAPSHOT_KEYS).toContain("shopphone");
  });
});
