import { describe, expect, it } from "vitest";
import { hourChip, suggestionsFor, taskChip } from "@/lib/assistant/suggestions";
import { parseUtterance } from "@/lib/assistant/parse";
import type { DeviceSnapshot } from "@/lib/assistant/types";

/*  CHIP GỢI Ý (13 §5.3, AC-T26): ≤4 chip, không trùng ý, đúng 1 chip theo giờ,
    chip theo việc chỉ khi máy có việc đỏ/vàng.  */

const NOW = Date.parse("2026-09-06T05:00:00Z"); // 12:00 VN

function snap(over: Partial<DeviceSnapshot> = {}): DeviceSnapshot {
  return {
    takenAt: NOW, route: "/", online: true, premium: false, home: null, weather: null,
    storm: { savedAt: NOW - 3600_000, storms: [] }, tide: null, boat: null, docs: [], maintenance: [],
    crew: null, cart: { lines: 0, titles: [] }, orders: null, fishPrices: null, fuel: null, inboxUnread: 0,
    placeNames: [], ...over,
  };
}

const CTX = { route: "/", awaitingConfirm: false, boatNames: [], portNames: [], placeNames: [] };

describe("assistant-suggestions", () => {
  it("chip theo giờ đúng bảng 13 §5.3", () => {
    expect(hourChip(5).label).toBe("Hôm nay đi được không");
    expect(hourChip(12).label).toBe("Giá cá hôm nay");
    expect(hourChip(17).label).toBe("Ngày mai sao");
    expect(hourChip(22).label).toBe("Có bão không");
    expect(hourChip(1).label).toBe("Có bão không");
  });

  it("≤4 chip, không trùng ý sau parse, mọi route trong bảng", () => {
    for (const route of ["/", "/ngu-truong", "/tau", "/tau?tab=dich-vu", "/tau?tab=san-pham", "/nguoi", "/tien", "/cho", "/cho/tim", "/cho/sp/abc", "/cho/gio", "/cho/don", "/cho/don/x", "/ban-hang", "/ban-hang/don", "/cang", "/la-lam"]) {
      const chips = suggestionsFor(route, 12, snap(), NOW);
      expect(chips.length, route).toBeLessThanOrEqual(4);
      expect(chips.length, route).toBeGreaterThanOrEqual(2);
      const intents = chips.map((c) => parseUtterance(c.utterance, { ...CTX, route }).intent);
      expect(new Set(intents).size, `${route}: ${intents.join(",")}`).toBe(intents.length);
      for (const c of chips) {
        expect(c.label.split(" ").length, c.label).toBeLessThanOrEqual(5);
        expect(parseUtterance(c.utterance, { ...CTX, route }).confidence, c.utterance).toBeGreaterThanOrEqual(0.6);
      }
    }
  });

  it("chip theo việc: chỉ khi có việc, ưu tiên bão → giấy → bảo dưỡng → đơn → tin", () => {
    expect(taskChip(null, NOW)).toBeNull();
    expect(taskChip(snap(), NOW)).toBeNull();
    expect(taskChip(snap({ storm: { savedAt: NOW - 13 * 3600_000, storms: [] } }), NOW)?.label).toBe("Tin bão");
    expect(taskChip(snap({ docs: [{ label: "Đăng kiểm", expiresOn: "2026-09-10", daysLeft: 4, level: "soon" }] }), NOW)?.label).toBe("Giấy tờ cần lo");
    expect(taskChip(snap({ maintenance: [{ item: "Thay nhớt", dueOn: "2026-09-01", daysLeft: -5, level: "overdue" }] }), NOW)?.label).toBe("Bảo dưỡng quá hạn");
    expect(taskChip(snap({ orders: { savedAt: NOW, items: [{ code: "SD1", status: "dang_giao", shopName: "A", totalVnd: 1 }] } }), NOW)?.label).toBe("Đơn đang giao");
    expect(taskChip(snap({ inboxUnread: 2 }), NOW)?.label).toBe("Tin mới");
    // có việc → chip thứ 4 xuất hiện
    const chips = suggestionsFor("/", 12, snap({ inboxUnread: 2 }), NOW);
    expect(chips.map((c) => c.label)).toContain("Tin mới");
  });

  it("chip /cho/sp/[id] không có 'Thêm món này vào giỏ' (F-27)", () => {
    const labels = suggestionsFor("/cho/sp/abc", 12, null, NOW).map((c) => c.label.toLowerCase());
    expect(labels.some((l) => l.includes("thêm"))).toBe(false);
    expect(labels).toContain("gọi shop");
  });
});
