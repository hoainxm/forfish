import { describe, it, expect, beforeEach, vi } from "vitest";

// localStorage mock (env node — không có jsdom). route-stops.ts đi qua
// user-list-store/user-store nên gắn cả window lẫn globalThis.
const _ls = (() => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() {
      return m.size;
    },
  } as Storage;
})();
(globalThis as unknown as { window: unknown }).window = { localStorage: _ls };
(globalThis as unknown as { localStorage: Storage }).localStorage = _ls;

import {
  MAX_STOPS,
  addStop,
  clearStops,
  removeStop,
  routeMatchesStops,
  routeStartMatches,
  stopAt,
  type RouteStop,
} from "../route-stops";

const KEY = "forfish.routestops.v1";

/** Nạp module MỚI — cờ `readFailed` nằm ở tầng module, phải làm sạch giữa các ca */
async function freshModule() {
  vi.resetModules();
  return import("../route-stops");
}

describe("addStop — chuỗi chỗ ghé theo đúng thứ tự bà con chấm", () => {
  it("thêm vào CUỐI, giữ nguyên thứ tự đã chấm", () => {
    let l: RouteStop[] = [];
    l = addStop(l, 13, 110.5);
    l = addStop(l, 14, 111.5);
    l = addStop(l, 15, 112.5);
    expect(l.map((s) => s.lat)).toEqual([13, 14, 15]);
  });

  it("chấm lại ĐÚNG CHỖ CŨ (trong ~100 m) không thêm trùng, không đổi thứ tự", () => {
    let l: RouteStop[] = [];
    l = addStop(l, 13, 110.5);
    l = addStop(l, 14, 111.5);
    const before = l;
    l = addStop(l, 13.0004, 110.4996); // cùng placeId với chỗ 1
    expect(l).toBe(before); // trả nguyên danh sách, không tạo bản mới
    expect(l).toHaveLength(2);
    expect(l[0].lat).toBe(13); // vẫn là chỗ ghé số 1
  });

  it("đủ trần MAX_STOPS thì trả NGUYÊN danh sách (nơi gọi so độ dài để nói ra)", () => {
    let l: RouteStop[] = [];
    for (let i = 0; i < MAX_STOPS; i++) l = addStop(l, 10 + i, 110 + i);
    expect(l).toHaveLength(MAX_STOPS);
    const full = l;
    l = addStop(l, 30, 118);
    expect(l).toBe(full);
    expect(l).toHaveLength(MAX_STOPS);
  });
});

describe("stopAt / removeStop / clearStops", () => {
  const l = addStop([], 13, 110.5);

  it("stopAt nhận ra chỗ đang xem đã nằm trong đường đi", () => {
    expect(stopAt(l, 13.0004, 110.4996)?.lat).toBe(13);
    expect(stopAt(l, 20, 115)).toBeNull();
  });

  it("removeStop bỏ đúng một chỗ, giữ thứ tự các chỗ còn lại", () => {
    let x: RouteStop[] = [];
    x = addStop(x, 13, 110.5);
    x = addStop(x, 14, 111.5);
    x = addStop(x, 15, 112.5);
    const out = removeStop(x, x[1].id);
    expect(out.map((s) => s.lat)).toEqual([13, 15]);
  });

  it("clearStops trả danh sách rỗng", () => {
    expect(clearStops()).toEqual([]);
  });
});

describe("loadStops / persistStops — án lệ K4 (đọc hỏng ⇒ KHOÁ CỬA GHI)", () => {
  beforeEach(() => _ls.clear());

  it("chưa có gì trong máy thì đọc ra rỗng và VẪN ghi được", async () => {
    const m = await freshModule();
    expect(m.loadStops()).toEqual([]);
    expect(m.stopsReadFailed()).toBe(false);
    expect(m.persistStops([{ id: "13.000,110.500", lat: 13, lon: 110.5 }])).toBe(
      true,
    );
    expect(JSON.parse(_ls.getItem(KEY)!)).toHaveLength(1);
  });

  it("đọc lại đúng thứ tự đã ghi", async () => {
    const m = await freshModule();
    m.loadStops();
    m.persistStops([
      { id: "a", lat: 13, lon: 110.5 },
      { id: "b", lat: 14, lon: 111.5 },
    ]);
    const m2 = await freshModule();
    expect(m2.loadStops().map((s) => s.id)).toEqual(["a", "b"]);
  });

  it("JSON hỏng ⇒ đọc ra rỗng, báo readFailed, và KHÔNG cho ghi đè bản gốc", async () => {
    _ls.setItem(KEY, '[{"id":"a","lat":13,'); // ghi dở lúc máy đầy / pin sập
    const m = await freshModule();
    expect(m.loadStops()).toEqual([]);
    expect(m.stopsReadFailed()).toBe(true);
    expect(m.persistStops([{ id: "x", lat: 1, lon: 2 }])).toBe(false);
    expect(_ls.getItem(KEY)).toBe('[{"id":"a","lat":13,'); // bản gốc còn nguyên
  });

  it("bỏ phần tử méo và cắt về trần MAX_STOPS khi đọc", async () => {
    _ls.setItem(
      KEY,
      JSON.stringify([
        { id: "a", lat: 13, lon: 110.5 },
        { id: "b", lat: "sai", lon: 111 },
        ...Array.from({ length: MAX_STOPS + 3 }, (_, i) => ({
          id: `z${i}`,
          lat: 10 + i,
          lon: 110,
        })),
      ]),
    );
    const m = await freshModule();
    const out = m.loadStops();
    expect(out).toHaveLength(MAX_STOPS);
    expect(out.every((s) => Number.isFinite(s.lat))).toBe(true);
  });
});

describe("routeMatchesStops — tuyến đã tính còn khớp danh sách không (CẢ CHUỖI)", () => {
  const A = { lat: 13, lon: 110.5 };
  const B = { lat: 14, lon: 111.5 };
  const C = { lat: 15, lon: 112.5 };
  const chain = (...pts: { lat: number; lon: number }[]) =>
    pts.reduce<RouteStop[]>((l, p) => addStop(l, p.lat, p.lon), []);

  it("chuỗi y hệt ⇒ khớp", () => {
    expect(routeMatchesStops([A, B, C], chain(A, B, C), C)).toBe(true);
  });

  it("HỒI QUY: bỏ một điểm GIỮA, điểm cuối giữ nguyên ⇒ KHÔNG khớp", () => {
    // lỗi thật: phép so cũ chỉ nhìn điểm cuối nên băng cảnh báo im, bản đồ
    // vẫn vẽ vạch xuyên qua đúng chỗ vừa loại
    expect(routeMatchesStops([A, B, C], chain(A, C), C)).toBe(false);
  });

  it("đổi THỨ TỰ hai điểm (cùng tập hợp) ⇒ KHÔNG khớp", () => {
    // thứ tự là kinh nghiệm thuyền trưởng — đổi thứ tự là đổi tuyến
    expect(routeMatchesStops([A, B, C], chain(A, C, B), B)).toBe(false);
  });

  it("thêm một điểm vào cuối ⇒ KHÔNG khớp", () => {
    expect(routeMatchesStops([A, B], chain(A, B, C), C)).toBe(false);
  });

  it("stops rỗng + dest đúng chỗ tuyến đã tính ⇒ khớp (hành vi cũ)", () => {
    expect(routeMatchesStops([C], [], C)).toBe(true);
  });

  it("stops rỗng + dest dời sang chỗ khác ⇒ KHÔNG khớp", () => {
    expect(routeMatchesStops([C], [], A)).toBe(false);
  });

  it("chấm lệch dưới ~100 m (cùng ô placeId) ⇒ vẫn khớp — đúng khuôn addStop", () => {
    expect(
      routeMatchesStops(
        [{ lat: 13.0004, lon: 110.4996 }, B],
        chain(A, B),
        B,
      ),
    ).toBe(true);
  });
});

describe("routeStartMatches — nơi XUẤT PHÁT còn khớp không", () => {
  const A = { lat: 13, lon: 110.5 };
  const B = { lat: 14, lon: 111.5 };

  it("cùng chỗ ⇒ khớp", () => {
    expect(routeStartMatches(A, { lat: 13, lon: 110.5 })).toBe(true);
  });

  it("HỒI QUY: đổi nơi xuất phát sau khi đã tính ⇒ KHÔNG khớp", () => {
    // lỗi thật: trước đây không có gì reset — ba con số giữ nguyên, bản đồ
    // vẫn vẽ vạch chạy từ cảng CŨ, không băng cảnh báo nào bật
    expect(routeStartMatches(A, B)).toBe(false);
  });

  it("chưa biết toạ độ (chọn định vị) ⇒ coi như khớp, không đoán bừa", () => {
    expect(routeStartMatches(A, null)).toBe(true);
  });

  it("lệch dưới ~100 m (cùng ô placeId) ⇒ vẫn khớp", () => {
    expect(routeStartMatches(A, { lat: 13.0004, lon: 110.4996 })).toBe(true);
  });
});

describe("RouteStop.name — thêm trường TUỲ CHỌN, bản ghi cũ vẫn đọc được", () => {
  beforeEach(() => _ls.clear());

  it("addStop không tên chạy y như cũ (không đẻ ra khoá name)", () => {
    const l = addStop([], 13, 110.5);
    expect(l[0]).toEqual({ id: "13.000,110.500", lat: 13, lon: 110.5 });
    expect("name" in l[0]).toBe(false);
  });

  it("addStop có tên thì giữ tên", () => {
    const l = addStop([], 13, 110.5, "Rạn ông Tư");
    expect(l[0].name).toBe("Rạn ông Tư");
  });

  it("bản ghi CŨ (không có name) vẫn hợp lệ — loadStops trả đủ, không bị loại", async () => {
    _ls.setItem(
      KEY,
      JSON.stringify([
        { id: "a", lat: 13, lon: 110.5 },
        { id: "b", lat: 14, lon: 111.5 },
      ]),
    );
    const m = await freshModule();
    const out = m.loadStops();
    expect(out.map((s) => s.id)).toEqual(["a", "b"]);
    expect(out[0].name).toBeUndefined();
  });

  it("bản ghi mới có name đọc lại giữ nguyên tên", async () => {
    _ls.setItem(
      KEY,
      JSON.stringify([{ id: "a", lat: 13, lon: 110.5, name: "Cảng nhà" }]),
    );
    const m = await freshModule();
    expect(m.loadStops()[0].name).toBe("Cảng nhà");
  });
});
