import { describe, expect, it } from "vitest";
import {
  cauVung,
  initVungTheoDoi,
  theoDoiVung,
  vungDangTrong,
  VUNG_XAC_NHAN,
  type VungTheoDoi,
  type VungTrong,
} from "@/lib/nav-vung";

const vuong = (lat: number, lon: number, d: number): [number, number][] => [
  [lon, lat],
  [lon + d, lat],
  [lon + d, lat + d],
  [lon, lat + d],
  [lon, lat],
];
const bb = (lat: number, lon: number, d: number) => ({ latMin: lat, latMax: lat + d, lonMin: lon, lonMax: lon + d });

const ctx = {
  noGo: [{ id: "ng1", ten: "vùng cấm vào giàn khoan", ring: vuong(10, 107, 0.1), bbox: bb(10, 107, 0.1) }],
  restricted: [
    { id: "bt1", ten: "khu bảo tồn biển Hòn Mun", loai: "bao-ton", ring: vuong(12, 109, 0.1), bbox: bb(12, 109, 0.1) },
    {
      id: "mua1",
      ten: "vùng cấm khai thác theo mùa (vịnh)",
      loai: "cam-thoi-han",
      ring: vuong(12, 109, 0.1),
      bbox: bb(12, 109, 0.1),
      mua: [{ tuNgay: 1, tuThang: 4, denNgay: 30, denThang: 6 }],
    },
  ],
};

describe("vungDangTrong", () => {
  it("điểm trong vùng cấm vào ⇒ mức đỏ", () => {
    expect(vungDangTrong(ctx as never, { lat: 10.05, lon: 107.05 }, Date.UTC(2026, 0, 5))).toEqual([
      { id: "ng1", ten: "vùng cấm vào giàn khoan", muc: "do" },
    ]);
  });
  it("vùng theo mùa chỉ tính trong mùa cấm", () => {
    const p = { lat: 12.05, lon: 109.05 };
    expect(vungDangTrong(ctx as never, p, new Date(2026, 0, 5).getTime()).map((v) => v.id)).toEqual(["bt1"]);
    expect(vungDangTrong(ctx as never, p, new Date(2026, 4, 5).getTime()).map((v) => v.id)).toEqual(["bt1", "mua1"]);
  });
  it("ngoài mọi vùng / thiếu kho / thiếu vị trí ⇒ rỗng", () => {
    expect(vungDangTrong(ctx as never, { lat: 0, lon: 0 }, 0)).toEqual([]);
    expect(vungDangTrong(null, { lat: 10.05, lon: 107.05 }, 0)).toEqual([]);
    expect(vungDangTrong(ctx as never, null, 0)).toEqual([]);
  });
});

describe("theoDoiVung — vào/ra phải giữ đủ lần đo liền", () => {
  const bt: VungTrong = { id: "bt1", ten: "khu bảo tồn biển Hòn Mun", muc: "vang" };
  const chay = (st: VungTheoDoi, ...luot: VungTrong[][]) => {
    const su = [];
    for (const l of luot) {
      const r = theoDoiVung(st, l);
      st = r.st;
      su.push(...r.su);
    }
    return { st, su };
  };

  it(`vào sau ${VUNG_XAC_NHAN} lần đo, ra sau ${VUNG_XAC_NHAN} lần đo`, () => {
    let r = chay(initVungTheoDoi(), [bt]);
    expect(r.su).toEqual([]);
    expect(r.st.trong).toEqual([]);
    r = chay(r.st, [bt]);
    expect(r.su.map((e) => e.loai)).toEqual(["vao"]);
    expect(r.st.trong).toEqual([bt]);
    r = chay(r.st, []);
    expect(r.su).toEqual([]);
    expect(r.st.trong).toEqual([bt]); // một lần mất chưa tính là ra
    r = chay(r.st, []);
    expect(r.su.map((e) => e.loai)).toEqual(["ra"]);
    expect(r.st.trong).toEqual([]);
  });

  it("GPS nhảy qua lại mép vùng ⇒ không đọc vào/ra", () => {
    const r = chay(initVungTheoDoi(), [bt], [], [bt], [], [bt], []);
    expect(r.su).toEqual([]);
  });

  it("đang trong, nhảy ra một lần rồi vào lại ⇒ không phát gì, bỏ đếm", () => {
    let r = chay(initVungTheoDoi(), [bt], [bt]);
    r = chay(r.st, [], [bt], []);
    expect(r.su).toEqual([]);
    expect(r.st.trong).toEqual([bt]);
  });

  it("không đổi gì ⇒ trả đúng đối tượng cũ", () => {
    const r = chay(initVungTheoDoi(), [bt], [bt]);
    expect(theoDoiVung(r.st, [bt]).st).toBe(r.st);
  });

  it("ra rồi vào lại ⇒ số lần tăng để key giọng không trùng", () => {
    const r = chay(initVungTheoDoi(), [bt], [bt], [], [], [bt], [bt]);
    expect(r.su.map((e) => `${e.loai}${e.lan}`)).toEqual(["vao1", "ra2", "vao3"]);
  });

  it("vùng đỏ xếp trước", () => {
    const ng: VungTrong = { id: "ng1", ten: "vùng cấm vào", muc: "do" };
    const r = chay(initVungTheoDoi(), [bt, ng], [bt, ng]);
    expect(r.st.trong.map((v) => v.id)).toEqual(["ng1", "bt1"]);
  });
});

describe("cauVung", () => {
  it("vào vùng vàng đọc, vào vùng đỏ để nav-hazards đọc, ra thì luôn đọc", () => {
    const e = { id: "x", ten: "khu bảo tồn biển Hòn Mun", lan: 1 };
    expect(cauVung({ ...e, loai: "vao", muc: "vang" })).toBe("Đang trong khu bảo tồn biển Hòn Mun.");
    expect(cauVung({ ...e, loai: "vao", muc: "do" })).toBeNull();
    expect(cauVung({ ...e, loai: "ra", muc: "do" })).toBe("Tàu đã ở ngoài khu bảo tồn biển Hòn Mun.");
  });
});

describe("giọng đọc: collectVoiceEvents nhận vào/ra vùng + khúc rẽ", async () => {
  const { collectVoiceEvents, initVoiceMemory } = await import("@/lib/nav-voice/events");
  const base = {
    nowMs: 0, unit: "nm" as const, alerts: [], border: null, offRoute: null, gps: "tracking" as const,
    info: null, storm: null, sea: null, depthHere: null, moving: true, legsPassed: 0, legsTotal: 0, arrived: false,
  };
  it("vào vùng vàng ⇒ câu vàng; ra ⇒ câu tin; vào vùng đỏ ⇒ im (nav-hazards đọc)", () => {
    const { events } = collectVoiceEvents(initVoiceMemory(), {
      ...base,
      vung: [
        { loai: "vao", id: "bt1", ten: "khu bảo tồn biển Hòn Mun", muc: "vang", lan: 1 },
        { loai: "ra", id: "ng1", ten: "vùng cấm vào", muc: "do", lan: 2 },
        { loai: "vao", id: "ng2", ten: "vùng cấm vào", muc: "do", lan: 3 },
      ],
    });
    expect(events.map((e) => [e.key, e.tier, e.text])).toEqual([
      ["vung:vao:bt1:1", "vang", "Đang trong khu bảo tồn biển Hòn Mun."],
      ["vung:ra:ng1:2", "tin", "Tàu đã ở ngoài vùng cấm vào."],
    ]);
  });
  it("khúc rẽ: nhịp trước là tin, nhịp tới là vàng", () => {
    const ev = (step: 1 | 2) =>
      collectVoiceEvents(initVoiceMemory(), { ...base, khucRe: { key: `re:1:3:${step}`, idx: 3, step, text: "x" } }).events[0];
    expect(ev(1).tier).toBe("tin");
    expect(ev(2).tier).toBe("vang");
  });
});
