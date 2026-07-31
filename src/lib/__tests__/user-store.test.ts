import { describe, it, expect, beforeEach } from "vitest";

/*
  DỮ LIỆU TỰ NHẬP > DỰ BÁO. Giấy tờ/bạn thuyền bà con gõ tay mất là mất luôn;
  dự báo có sóng là tải lại được. Test canh đúng thứ tự nhường chỗ đó, và canh
  việc KHÔNG ghi được thì phải TRẢ FALSE (màn hình còn biết đường báo đỏ) chứ
  không nuốt im như ba màn cũ.

  localStorage mock đếm theo BYTE (giống máy thật), không đếm số mục — đúng cái
  trục mà bản cũ dọn nhầm.
*/
let QUOTA_CHARS = Infinity;
const _ls = (() => {
  const m = new Map<string, string>();
  const used = () => {
    let n = 0;
    for (const [k, v] of m) n += k.length + v.length;
    return n;
  };
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => {
      const cur = m.has(k) ? k.length + m.get(k)!.length : 0;
      if (used() - cur + k.length + String(v).length > QUOTA_CHARS) {
        const e = new Error("QuotaExceededError");
        e.name = "QuotaExceededError";
        throw e;
      }
      m.set(k, String(v));
    },
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() {
      return m.size;
    },
  } as unknown as Storage;
})();
(globalThis as unknown as { window: unknown }).window = { localStorage: _ls };
(globalThis as unknown as { localStorage: Storage }).localStorage = _ls;

import { saveUserJson } from "../user-store";
import { saveForecast, loadForecast } from "../forecast-cache";

const big = (n: number) => "x".repeat(n);

beforeEach(() => {
  localStorage.clear();
  QUOTA_CHARS = Infinity;
});

describe("saveUserJson", () => {
  it("ghi được thì trả true và đọc lại đúng", () => {
    expect(saveUserJson("forfish.documents.v1", [{ id: "a" }])).toBe(true);
    expect(localStorage.getItem("forfish.documents.v1")).toContain('"a"');
  });

  it("máy chật vì DỰ BÁO → bỏ bản dự báo cũ nhất, giấy tờ vẫn vào được", () => {
    QUOTA_CHARS = 3000;
    saveForecast("grid", "d16", { blob: big(1000) }, 1000);
    saveForecast("scalar", "cloud", { blob: big(1000) }, 2000);
    expect(saveUserJson("forfish.documents.v1", { blob: big(900) })).toBe(true);
    // bản dự báo CŨ NHẤT nhường chỗ, bản mới hơn còn nguyên
    expect(loadForecast("grid", "d16")).toBeNull();
    expect(loadForecast("scalar", "cloud")).not.toBeNull();
  });

  it("nhường hết dự báo mà vẫn không đủ → trả FALSE (để màn hình báo đỏ)", () => {
    QUOTA_CHARS = 500;
    expect(saveUserJson("forfish.crew.v1", { blob: big(2000) })).toBe(false);
  });

  it("không còn bản dự báo nào để nhường → trả false ngay, không kẹt vòng lặp", () => {
    QUOTA_CHARS = 10;
    expect(saveUserJson("forfish.maintenance.v1", { blob: big(100) })).toBe(
      false,
    );
  });

  it("KHÔNG bao giờ đụng dữ liệu tự nhập khác để lấy chỗ", () => {
    QUOTA_CHARS = 3000;
    expect(saveUserJson("forfish.crew.v1", { blob: big(1000) })).toBe(true);
    saveForecast("grid", "d16", { blob: big(900) }, 1000);
    expect(saveUserJson("forfish.documents.v1", { blob: big(900) })).toBe(true);
    expect(localStorage.getItem("forfish.crew.v1")).not.toBeNull();
  });
});
