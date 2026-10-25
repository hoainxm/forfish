import { describe, expect, it } from "vitest";
import {
  cauConTan,
  dichDenTuQuery,
  docQueryBanDo,
  duongDanBanDoToi,
  nhanChipNgay,
  THAM_SO_BAN_DO,
  timConTheoLink,
} from "@/lib/ban-do-link";
import { stormKeyOf } from "@/lib/storm-identity";
import { stormPushUrl } from "@/lib/storm-push";
import type { StormAlert } from "@/lib/storms";

const T0 = Date.UTC(2026, 9, 25, 3, 0);

function bao(over: Partial<StormAlert> = {}): StormAlert {
  return {
    id: "nchmf-3",
    name: "Bão số 3",
    kindLabel: "Bão",
    windKmh: 110,
    lat: 16,
    lon: 112,
    alert: "danger",
    updated: new Date(T0).toISOString(),
    track: [],
    areas: [],
    ...over,
  };
}

describe("docQueryBanDo", () => {
  it("đọc lat/lon/bao/t từ link push thật", () => {
    const url = stormPushUrl("bao-so-3-2026", { alert: 1, kind: 3 }, {
      lat: 16.123,
      lon: 112.456,
      tMs: T0,
    });
    const q = docQueryBanDo(url.slice(url.indexOf("?")));
    expect(q.bao).toBe("bao-so-3-2026");
    expect(q.lat).toBeCloseTo(16.12, 2);
    expect(q.lon).toBeCloseTo(112.46, 2);
    expect(q.tMs).toBe(Math.round(T0 / 1000) * 1000);
  });
  it("chỉ có một trong hai toạ độ ⇒ bỏ cả hai; số rác ⇒ null", () => {
    expect(docQueryBanDo("?lat=16")).toEqual({ lat: null, lon: null, bao: null, tMs: null });
    expect(docQueryBanDo("?lat=abc&lon=112")).toEqual({ lat: null, lon: null, bao: null, tMs: null });
    expect(docQueryBanDo("?lat=95&lon=112").lat).toBeNull();
    expect(docQueryBanDo("?bao=&t=-5")).toEqual({ lat: null, lon: null, bao: null, tMs: null });
    expect(docQueryBanDo("")).toEqual({ lat: null, lon: null, bao: null, tMs: null });
  });
  it("danh sách tham số dọn địa chỉ bao đủ thứ push ghi", () => {
    for (const k of ["bao", "cap", "muc", "lat", "lon", "t"]) expect(THAM_SO_BAN_DO).toContain(k);
  });
});

describe("dichDenTuQuery", () => {
  it("không tham số ⇒ không làm gì", () => {
    expect(dichDenTuQuery(docQueryBanDo(""), [bao()], T0)).toEqual({ kind: "khong" });
  });
  it("chỉ toạ độ (từ danh bạ cảng) ⇒ toa-do", () => {
    const q = docQueryBanDo(duongDanBanDoToi(14.673556, 109.069755).split("?")[1]);
    expect(dichDenTuQuery(q, [], T0)).toEqual({ kind: "toa-do", lat: 14.6736, lon: 109.0698 });
  });
  it("khoá trùng cơn đang có ⇒ con-bao, kể cả khi không có lat/lon", () => {
    const s = bao();
    const q = docQueryBanDo(`?bao=${stormKeyOf(s, T0)}`);
    expect(dichDenTuQuery(q, [s], T0)).toEqual({ kind: "con-bao", storm: s });
  });
  it("khoá lệch nhưng tâm + giờ nối được ⇒ vẫn con-bao (áp thấp đổi khoá)", () => {
    const s = bao({ id: "nchmf-x", name: "Áp thấp nhiệt đới", lat: 15.5, lon: 111.5 });
    const q = docQueryBanDo(`?bao=atnd-20261024-15.0-111.0&lat=15.0&lon=111.0&t=${Math.round((T0 - 6 * 3600_000) / 1000)}`);
    expect(timConTheoLink(q, [s], T0)).toBe(s);
  });
  it("cơn không còn ⇒ con-tan mang toạ độ + giờ bản tin", () => {
    const q = docQueryBanDo(`?bao=bao-so-9-2026&lat=14.5&lon=115&t=${Math.round(T0 / 1000)}`);
    expect(dichDenTuQuery(q, [bao()], T0)).toEqual({
      kind: "con-tan",
      lat: 14.5,
      lon: 115,
      banTinMs: Math.round(T0 / 1000) * 1000,
    });
    // cách xa 350 km + 0 giờ ⇒ không được nối nhầm vào cơn khác
    expect(dichDenTuQuery(q, [bao({ lat: 20, lon: 120 })], T0).kind).toBe("con-tan");
  });
  it("mất sóng: danh sách rỗng mà link có khoá ⇒ con-tan (không bịa cơn)", () => {
    const q = docQueryBanDo("?bao=bao-so-3-2026");
    expect(dichDenTuQuery(q, [], T0)).toEqual({ kind: "con-tan", lat: null, lon: null, banTinMs: null });
  });
});

describe("cauConTan", () => {
  it("ngày bản tin theo giờ Việt Nam", () => {
    // 24/10 23:30 UTC = 25/10 06:30 VN
    expect(cauConTan(Date.UTC(2026, 9, 24, 23, 30))).toBe("Cơn này đã tan — bản tin 25/10");
    expect(cauConTan(null)).toBe("Cơn này đã tan");
  });
});

describe("nhanChipNgay", () => {
  it("hôm nay / mai / thứ + ngày, không tháng", () => {
    expect(nhanChipNgay("2026-10-25", "2026-10-25")).toBe("Hôm nay");
    expect(nhanChipNgay("2026-10-26", "2026-10-25")).toBe("Ngày mai");
    expect(nhanChipNgay("2026-10-27", "2026-10-25")).toBe("T3 27");
    expect(nhanChipNgay("2026-11-01", "2026-10-25")).toBe("CN 1");
    expect(nhanChipNgay("2026-10-24", "2026-10-25")).toBe("T7 24");
  });
});
