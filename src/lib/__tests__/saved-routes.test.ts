import { describe, it, expect, beforeEach } from "vitest";

// localStorage mock (env node — không có jsdom). saved-routes.ts đi qua
// user-list-store/user-store nên gắn cả window lẫn globalThis. Cùng khuôn
// route-stops.test.ts — đừng chế khuôn thứ hai.
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
  loadSavedRoutes,
  persistSavedRoutes,
  savedRoutesReadFailed,
  addSavedRoute,
  removeSavedRoute,
  sameRoute,
  suggestName,
  MAX_SAVED_ROUTES,
  type SavedRoute,
} from "../saved-routes";
import type { RouteStop } from "../route-stops";

const KEY = "forfish.savedroutes.v1";

function stop(id: string, lat: number, lon: number, name?: string): RouteStop {
  return { id, lat, lon, ...(name ? { name } : {}) };
}

const A = stop("a", 13, 110);
const B = stop("b", 14, 111, "Rạn ông Tư");
const PORT = { lat: 13.7, lon: 109.2, label: "Cảng Quy Nhơn" };

function rec(over: Partial<SavedRoute> = {}): SavedRoute {
  return {
    id: "r1",
    name: "Đi Hoàng Sa",
    start: PORT,
    stops: [A, B],
    savedAt: 1000,
    ...over,
  };
}

beforeEach(() => {
  localStorage.clear();
  // đọc lại để cờ readFailed về sạch giữa các ca
  loadSavedRoutes();
});

describe("đọc / ghi — án lệ K4", () => {
  it("kho rỗng ⇒ danh sách rỗng, KHÔNG coi là đọc hỏng", () => {
    expect(loadSavedRoutes()).toEqual([]);
    expect(savedRoutesReadFailed()).toBe(false);
  });

  it("ghi rồi đọc lại ra đúng bản ghi", () => {
    expect(persistSavedRoutes([rec()])).toBe(true);
    expect(loadSavedRoutes()).toHaveLength(1);
    expect(loadSavedRoutes()[0].name).toBe("Đi Hoàng Sa");
  });

  it("ĐỌC HỎNG ⇒ KHOÁ CỬA GHI: persist trả false và KHÔNG đè bản gốc", () => {
    localStorage.setItem(KEY, "{{{ hỏng");
    loadSavedRoutes();
    expect(savedRoutesReadFailed()).toBe(true);
    expect(persistSavedRoutes([rec()])).toBe(false);
    // bản gốc còn nguyên để lần mở sau còn cứu được
    expect(localStorage.getItem(KEY)).toBe("{{{ hỏng");
  });

  it("bản ghi hỏng bị lọc, bản lành vẫn đọc được (không mất cả kho vì một dòng)", () => {
    localStorage.setItem(
      KEY,
      JSON.stringify([
        rec(),
        { id: "x", name: "thiếu chỗ ghé", start: null, stops: [], savedAt: 5 },
        { id: "y", name: "toạ độ hỏng", start: { lat: NaN, lon: 1, label: "" }, stops: [A], savedAt: 6 },
      ]),
    );
    const list = loadSavedRoutes();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe("r1");
  });

  it("start = null (chỗ tàu tôi) là HỢP LỆ — đường lưu ngoài biển không bị vứt", () => {
    localStorage.setItem(KEY, JSON.stringify([rec({ start: null })]));
    expect(loadSavedRoutes()).toHaveLength(1);
  });

  it("mới lưu nhất lên đầu", () => {
    localStorage.setItem(
      KEY,
      JSON.stringify([rec({ id: "cu", savedAt: 10 }), rec({ id: "moi", savedAt: 99 })]),
    );
    expect(loadSavedRoutes().map((r) => r.id)).toEqual(["moi", "cu"]);
  });
});

describe("addSavedRoute", () => {
  it("thêm vào ĐẦU danh sách", () => {
    const l = addSavedRoute([rec({ id: "cu" })], { name: "Mới", start: null, stops: [A] }, 2000);
    expect(l[0].name).toBe("Mới");
    expect(l).toHaveLength(2);
  });

  it("KHÔNG lưu đường rỗng chỗ ghé", () => {
    expect(addSavedRoute([], { name: "x", start: null, stops: [] }, 1)).toEqual([]);
  });

  it("tên để trống ⇒ tự đặt theo ĐIỂM ĐẾN, không đọc toạ độ ra làm tên", () => {
    const l = addSavedRoute([], { name: "   ", start: null, stops: [A, B] }, 1);
    expect(l[0].name).toBe("Đi Rạn ông Tư");
  });

  it("lưu lại ĐÚNG đường đã có ⇒ ĐÈ bản cũ, không đẻ bản thứ hai y hệt", () => {
    const first = addSavedRoute([], { name: "Lần 1", start: PORT, stops: [A, B] }, 1);
    const second = addSavedRoute(first, { name: "Lần 2", start: PORT, stops: [A, B] }, 2);
    expect(second).toHaveLength(1);
    expect(second[0].name).toBe("Lần 2");
  });

  it("khác NƠI XUẤT PHÁT thì là đường khác, giữ cả hai", () => {
    const first = addSavedRoute([], { name: "Từ cảng", start: PORT, stops: [A] }, 1);
    const second = addSavedRoute(first, { name: "Từ chỗ tàu", start: null, stops: [A] }, 2);
    expect(second).toHaveLength(2);
  });

  it("khác THỨ TỰ chỗ ghé thì là đường khác", () => {
    const first = addSavedRoute([], { name: "xuôi", start: null, stops: [A, B] }, 1);
    const second = addSavedRoute(first, { name: "ngược", start: null, stops: [B, A] }, 2);
    expect(second).toHaveLength(2);
  });

  it("đầy trần ⇒ bỏ bản CŨ NHẤT, KHÔNG chặn thao tác", () => {
    let l: SavedRoute[] = [];
    for (let i = 0; i < MAX_SAVED_ROUTES + 3; i++) {
      l = addSavedRoute(l, { name: `d${i}`, start: null, stops: [stop(`s${i}`, 13 + i, 110)] }, i + 1);
    }
    expect(l).toHaveLength(MAX_SAVED_ROUTES);
    expect(l[0].name).toBe(`d${MAX_SAVED_ROUTES + 2}`);
    expect(l.some((r) => r.name === "d0")).toBe(false);
  });

  it("KHÔNG cất kết quả đã tính — bản ghi chỉ có điểm, tên, mốc lưu", () => {
    const l = addSavedRoute([], { name: "x", start: PORT, stops: [A] }, 1);
    expect(Object.keys(l[0]).sort()).toEqual(
      ["id", "name", "savedAt", "start", "stops"].sort(),
    );
  });

  it("giữ LỰA CHỌN nơi xuất phát, không chỉ toạ độ", () => {
    const l = addSavedRoute(
      [],
      { name: "x", start: PORT, startId: "port:quy-nhon", stops: [A] },
      1,
    );
    expect(l[0].startId).toBe("port:quy-nhon");
  });

  it("không truyền startId ⇒ KHÔNG ghi khoá rỗng (bản ghi giữ đúng hình)", () => {
    const l = addSavedRoute([], { name: "x", start: null, stops: [A] }, 1);
    expect("startId" in l[0]).toBe(false);
  });
});

describe("removeSavedRoute / sameRoute / suggestName", () => {
  it("xoá đúng một đường theo id", () => {
    const l = [rec({ id: "a" }), rec({ id: "b" })];
    expect(removeSavedRoute(l, "a").map((r) => r.id)).toEqual(["b"]);
  });

  it("sameRoute: một bên có start, bên kia null ⇒ KHÁC", () => {
    expect(sameRoute({ start: PORT, stops: [A] }, { start: null, stops: [A] })).toBe(false);
  });

  it("suggestName: chỗ cuối không tên ⇒ nói số chỗ, không đọc toạ độ", () => {
    expect(suggestName([A, stop("c", 15, 112)])).toBe("Đường qua 2 chỗ");
    expect(suggestName([A])).toBe("Đường đi");
  });
});
