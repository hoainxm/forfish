import { beforeEach, describe, expect, it, vi } from "vitest";

// Cùng pattern boats.test.ts — stub window.localStorage (không cần jsdom).
const map = new Map<string, string>();
vi.stubGlobal("window", {
  localStorage: {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
  },
});

import { computeUrgent, type BoatCtx } from "@/lib/urgent";

// Dữ liệu BỊA.
const TODAY = new Date("2026-05-26T05:00:00Z");
const names = new Map([
  ["b1", "Tàu A"],
  ["b2", "Tàu B"],
]);
const ctx = (multi: boolean): BoatCtx => ({
  multi,
  nameOf: (id) => (id ? names.get(id) : undefined),
  assign: {},
});

beforeEach(() => {
  map.clear();
  map.set(
    "forfish.documents.v1",
    JSON.stringify([
      { id: "d1", kind: "khac", label: "Đăng kiểm", boatId: "b2", expiresOn: "2026-06-01" },
      { id: "d2", kind: "khac", label: "Giấy chung", expiresOn: "2026-06-01" },
      { id: "d3", kind: "khac", label: "Tàu đã bán", boatId: "b9", expiresOn: "2026-06-01" },
    ]),
  );
  map.set(
    "forfish.maintenance.v1",
    JSON.stringify([
      { id: "m1", item: "Thay nhớt", lastDone: "2026-01-01", intervalDays: 30, boatId: "b1" },
    ]),
  );
});

describe("dải khẩn — bấm việc mở ĐÚNG TÀU của nó (O2, 08 AC-12)", () => {
  it("nhiều tàu: giấy/bảo dưỡng gắn tàu ⇒ href mang ?tau=; chưa gắn / tàu không còn ⇒ không", () => {
    const href = Object.fromEntries(computeUrgent(TODAY, ctx(true)).map((i) => [i.id, i.href]));
    expect(href["doc-d1"]).toBe("/tau?tab=giay-to&tau=b2");
    expect(href["maint-m1"]).toBe("/tau?tab=dich-vu&tau=b1");
    expect(href["doc-d2"]).toBe("/tau?tab=giay-to");
    expect(href["doc-d3"]).toBe("/tau?tab=giay-to");
  });
  it("một tàu ⇒ không gắn tham số", () => {
    for (const i of computeUrgent(TODAY, ctx(false))) expect(i.href).not.toContain("tau=");
  });
});
