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

  /*  ⚠️ ĐỔI LUẬT 2026-08-02h — CHỦ DỰ ÁN CHỐT: "hết chỗ → TỪ CHỐI GHI và nói
      thật, KHÔNG đi xoá đồ của bà con để lấy chỗ."

      Luật cũ (nhường chỗ theo bậc hy sinh) nghe hợp lý nhưng hỏng ở ba chỗ, và
      cả ba đều nổ ĐÚNG LÚC ĐANG Ở NGOÀI BIỂN:
        · không có cầu dao "dọn không ăn thua" — trên iOS localStorage và Cache
          API dùng CHUNG hạn ngạch origin, nên máy đầy vì kho service worker sẽ
          ăn tới 4 bản dự báo mà không ghi nổi một byte;
        · trần bậc chỉ dừng trước `storm`, tức lưới gió/sóng và bản đồ cá VẪN bị
          xoá được để nhường chỗ cho một ghi chú vài KB;
        · nó chạy lúc MỞ MÀN (`useEffect` của sell-guide / boat-products), không
          phải lúc bà con gõ — vào ra màn vài chục lần là ăn dần kho, im lặng.

      Nay `saveUserJson` chỉ thử ghi rồi trả `false`. Mất một ghi chú còn hơn
      mất lưới gió sóng của cả chuyến. */
  it("máy chật → TỪ CHỐI GHI, KHÔNG xoá một bản dự báo nào", () => {
    QUOTA_CHARS = 3000;
    saveForecast("grid", "d16", { blob: big(1000) }, 1000);
    saveForecast("scalar", "cloud", { blob: big(1000) }, 2000);
    expect(
      saveUserJson("forfish.documents.v1", { blob: big(900) }),
      "ghi được thì đã không phải ca này",
    ).toBe(false);
    expect(loadForecast("scalar", "cloud"), "lớp dải màu bị ăn").not.toBeNull();
    expect(loadForecast("grid", "d16"), "LƯỚI GIÓ/SÓNG bị ăn").not.toBeNull();
  });

  it("máy chật → trả FALSE để màn hình báo đỏ, không kẹt vòng lặp", () => {
    QUOTA_CHARS = 500;
    expect(saveUserJson("forfish.crew.v1", { blob: big(2000) })).toBe(false);
    QUOTA_CHARS = 10;
    expect(saveUserJson("forfish.maintenance.v1", { blob: big(100) })).toBe(
      false,
    );
  });

  /*  Cổng chặn KHUÔN, không chỉ chặn ca: đường ghi dữ liệu bà con tự gõ không
      được phép biết tới bất kỳ hàm dọn dự báo nào. */
  it("user-store KHÔNG import đường dọn dự báo nào", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(
      join(process.cwd(), "src", "lib", "user-store.ts"),
      "utf8",
    ).replace(/\/\*[\s\S]*?\*\//g, "");
    expect(src).not.toMatch(/reclaimForecastSpace|dropOldest|removeItem/);
  });

  it("KHÔNG bao giờ đụng dữ liệu tự nhập khác để lấy chỗ", () => {
    QUOTA_CHARS = 3000;
    expect(saveUserJson("forfish.crew.v1", { blob: big(1000) })).toBe(true);
    saveForecast("grid", "d16", { blob: big(900) }, 1000);
    expect(saveUserJson("forfish.documents.v1", { blob: big(900) })).toBe(true);
    expect(localStorage.getItem("forfish.crew.v1")).not.toBeNull();
  });
});
