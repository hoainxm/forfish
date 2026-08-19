import { beforeEach, describe, expect, it } from "vitest";

// localStorage mock (env node) — cùng mẫu với forecast-grid-offline
const store = new Map<string, string>();
let choDoc = true; // false = mô phỏng máy chặn đọc (Safari riêng tư)
let choGhi = true; // false = mô phỏng kho đầy → setItem ném
const _ls = {
  getItem: (k: string) => {
    if (!choDoc) throw new Error("storage bị chặn");
    return store.has(k) ? store.get(k)! : null;
  },
  setItem: (k: string, v: string) => {
    if (!choGhi) throw new Error("QuotaExceededError");
    store.set(k, String(v));
  },
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() {
    return store.size;
  },
} as unknown as Storage;
(globalThis as unknown as { window: unknown }).window = { localStorage: _ls };
(globalThis as unknown as { localStorage: Storage }).localStorage = _ls;

import { _resetBoatsForTest, addBoat, removeBoat, subscribeBoats } from "../boat-store";
import { readUserList } from "../user-list-store";

/*  CỔNG CHẶN KHUÔN — GHI HỎNG KHÔNG ĐƯỢC ĐỂ LẠI TRẠNG THÁI NỬA VỜI
 *  (2026-08-16, thẩm định P1).
 *
 *  Hai ca thật, cùng một nếp:
 *   · `removeBoat` xoá hồ sơ CON (giấy tờ, bảo dưỡng, gán SDVICO) TRƯỚC, rồi
 *     ghi danh sách tàu và vứt kết quả ⇒ ghi hỏng thì con mất, cha còn.
 *   · đường đọc danh sách tự nhập trả mảng rỗng khi JSON hỏng ⇒ cú ghi kế tiếp
 *     đè lên chuỗi gốc.
 *
 *  Bất biến: hoặc đổi được TẤT CẢ, hoặc KHÔNG ĐỔI GÌ.
 */

const BOATS_KEY = "forfish.boats.v1";

beforeEach(() => {
  store.clear();
  choDoc = true;
  choGhi = true;
  _resetBoatsForTest();
});

describe("removeBoat — kho từ chối ghi thì KHÔNG được xoá hồ sơ con", () => {
  it("ghi được: xoá cha rồi mới xoá con", () => {
    store.set(
      BOATS_KEY,
      JSON.stringify([
        { id: "b1", name: "Tàu 1" },
        { id: "b2", name: "Tàu 2" },
      ]),
    );
    subscribeBoats(() => {}); // nạp sổ tàu từ kho, đúng đường app đi
    const daXoa: string[] = [];
    expect(addBoat({ id: "b3", name: "Tàu 3" })).toBe(true);
    expect(removeBoat("b3", (id) => daXoa.push(id))).toBe(true);
    expect(daXoa).toEqual(["b3"]);
    const sau = readUserList<{ id: string }>(BOATS_KEY);
    expect(sau.list?.map((b) => b.id)).toEqual(["b1", "b2"]);
  });

  it("kho đầy: KHÔNG xoá hồ sơ con, danh sách tàu giữ nguyên", () => {
    store.set(
      BOATS_KEY,
      JSON.stringify([
        { id: "b1", name: "Tàu 1" },
        { id: "b2", name: "Tàu 2" },
      ]),
    );
    subscribeBoats(() => {});
    expect(addBoat({ id: "b3", name: "Tàu 3" })).toBe(true);
    choGhi = false; // kho đầy từ đây
    const daXoa: string[] = [];
    expect(removeBoat("b3", (id) => daXoa.push(id))).toBe(false);
    // ĐÚNG cái lỗi cũ: trước bản vá `daXoa` = ["b3"] trong khi tàu b3 vẫn còn
    expect(daXoa).toEqual([]);
    const sau = readUserList<{ id: string }>(BOATS_KEY);
    expect(sau.list?.map((b) => b.id)).toContain("b3");
  });

  it("kho đầy: addBoat trả false và KHÔNG bịa tàu trên màn hình", () => {
    store.set(BOATS_KEY, JSON.stringify([{ id: "b1", name: "Tàu 1" }]));
    subscribeBoats(() => {});
    expect(addBoat({ id: "b2", name: "Tàu 2" })).toBe(true);
    choGhi = false;
    expect(addBoat({ id: "b3", name: "Tàu 3" })).toBe(false);
    const sau = readUserList<{ id: string }>(BOATS_KEY);
    expect(sau.list?.map((b) => b.id)).not.toContain("b3");
  });
});

describe("readUserList — khuôn ba nhánh mà tủ giấy tờ nay dùng lại", () => {
  it("JSON hỏng → KHÔNG đọc được (đừng ghi đè), không phải 'rỗng'", () => {
    store.set("forfish.documents.v1", "[{'id':");
    const r = readUserList("forfish.documents.v1");
    expect(r.ok).toBe(false);
    expect(r.list).toBeNull();
  });

  it("khoá giữ thứ KHÔNG phải mảng ('null', object) → cũng là không đọc được", () => {
    store.set("forfish.documents.v1", "null");
    expect(readUserList("forfish.documents.v1").ok).toBe(false);
    store.set("forfish.documents.v1", '{"a":1}');
    expect(readUserList("forfish.documents.v1").ok).toBe(false);
  });

  it("chưa có khoá → đọc ĐƯỢC, list null (màn tự quyết dựng sổ mẫu)", () => {
    const r = readUserList("forfish.documents.v1");
    expect(r).toEqual({ ok: true, list: null });
  });
});
