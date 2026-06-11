import { describe, expect, it } from "vitest";
import { parseDieselDo } from "../fuel-price";

// shape thật của giaxanghomnay: mảng-lồng-mảng các bản ghi
const JSON_OK = [
  [
    { title: "Xăng E5 RON 92-II", zone1_price: 21780, zone2_price: 22210, date: "2026-06-10 00:00:00" },
    { title: "DO 0,05S-II", zone1_price: 26860, zone2_price: 27390, date: "2026-06-10 00:00:00" },
    { title: "DO 0,001S-V", zone1_price: 27000, zone2_price: 27500, date: "2026-06-10 00:00:00" },
  ],
];

describe("parseDieselDo", () => {
  it("lấy đúng dầu DO 0,05S (dầu tàu cá), vùng 1 + vùng 2 + ngày", () => {
    const f = parseDieselDo(JSON_OK)!;
    expect(f.do005Zone1).toBe(26860);
    expect(f.do005Zone2).toBe(27390);
    expect(f.date).toBe("2026-06-10");
  });
  it("thiếu DO 0,05S → null (không lấy nhầm xăng/DO khác)", () => {
    expect(
      parseDieselDo([[{ title: "Xăng E5 RON 92-II", zone1_price: 21780 }]]),
    ).toBeNull();
    expect(parseDieselDo(null)).toBeNull();
    expect(parseDieselDo({})).toBeNull();
  });
  it("vùng 2 hỏng → dùng vùng 1", () => {
    const f = parseDieselDo([
      [{ title: "DO 0,05S-II", zone1_price: 26860, date: "2026-06-10" }],
    ])!;
    expect(f.do005Zone2).toBe(26860);
  });
});
