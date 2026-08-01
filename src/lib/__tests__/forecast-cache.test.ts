import { describe, it, expect, beforeEach } from "vitest";

/*
  localStorage mock (env node — không jsdom), khớp mẫu boat-store.test.
  QUOTA = số bản tối đa giả lập; vượt thì ném như máy thật (QuotaExceededError)
  để thử đúng đường "máy hết chỗ" — chỗ từng kẹt vĩnh viễn.
*/
let QUOTA = Infinity;
/* Trần theo DUNG LƯỢNG (byte UTF-16 = 2 × ký tự, như máy thật) — máy chật vì
   dung lượng chứ không vì số mục; đó đúng là trục mà bản cũ dọn nhầm (bỏ 4 bản
   điểm ~3 KB rồi tưởng đủ chỗ cho một lưới 16 ngày ~800 KB). Infinity = tắt,
   để các test cũ chạy như trước. */
let QUOTA_BYTES = Infinity;
const _ls = (() => {
  const m = new Map<string, string>();
  const usedBytes = () => {
    let n = 0;
    for (const [k, v] of m) n += (k.length + v.length) * 2;
    return n;
  };
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => {
      if (!m.has(k) && m.size >= QUOTA) {
        const e = new Error("QuotaExceededError");
        e.name = "QuotaExceededError";
        throw e;
      }
      const cur = m.has(k) ? (k.length + m.get(k)!.length) * 2 : 0;
      if (usedBytes() - cur + (k.length + String(v).length) * 2 > QUOTA_BYTES) {
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

import {
  saveForecast,
  loadForecast,
  loadAll,
  lastStorageFullAt,
  coordId,
  reclaimForecastSpace,
  savedAgoLabel,
} from "../forecast-cache";

const countNs = (ns: string) => {
  let n = 0;
  for (let i = 0; i < localStorage.length; i++) {
    if (localStorage.key(i)?.startsWith(`forfish.fc.${ns}.`)) n++;
  }
  return n;
};

beforeEach(() => {
  localStorage.clear();
  QUOTA = Infinity;
  QUOTA_BYTES = Infinity;
});

describe("save/load round-trip", () => {
  it("lưu rồi đọc lại đúng data + savedAt", () => {
    saveForecast("point", "a", { x: 1 }, 1000);
    const c = loadForecast<{ x: number }>("point", "a");
    expect(c?.data.x).toBe(1);
    expect(c?.savedAt).toBe(1000);
  });
  it("chưa lưu → null", () => {
    expect(loadForecast("point", "zzz")).toBeNull();
  });
  it("ghi đè bản mới", () => {
    saveForecast("point", "a", { x: 1 }, 1000);
    saveForecast("point", "a", { x: 2 }, 2000);
    expect(loadForecast<{ x: number }>("point", "a")?.data.x).toBe(2);
  });
});

describe("loadAll", () => {
  it("trả mọi bản trong namespace, mới nhất trước", () => {
    saveForecast("point", "a", { v: "cũ" }, 1000);
    saveForecast("point", "b", { v: "mới" }, 5000);
    saveForecast("point", "c", { v: "giữa" }, 3000);
    const all = loadAll<{ v: string }>("point");
    expect(all.map((e) => e.id)).toEqual(["b", "c", "a"]);
    expect(all[0].data.v).toBe("mới");
  });
  it("namespace khác không lẫn", () => {
    saveForecast("point", "a", { v: 1 }, 1000);
    expect(loadAll("grid")).toEqual([]);
  });
});

describe("trim MAX_ENTRIES", () => {
  it("giữ tối đa 40 bản mới nhất, xoá cũ nhất", () => {
    for (let i = 0; i < 50; i++) saveForecast("point", `p${i}`, { i }, i);
    expect(countNs("point")).toBe(40);
    expect(loadForecast("point", "p0")).toBeNull(); // cũ nhất bị xoá
    expect(loadForecast("point", "p49")).not.toBeNull(); // mới nhất còn
  });

  it("dọn TRƯỚC khi ghi → không bao giờ vượt trần dù ghi liên tục", () => {
    for (let i = 0; i < 45; i++) {
      expect(saveForecast("point", `p${i}`, { i }, i)).toBe(true);
      expect(countNs("point")).toBeLessThanOrEqual(40);
    }
  });

  it("ghi đè id cũ không đẩy số bản lên", () => {
    for (let i = 0; i < 40; i++) saveForecast("point", `p${i}`, { i }, i);
    saveForecast("point", "p10", { i: 999 }, 5000);
    expect(countNs("point")).toBe(40);
    expect(loadForecast<{ i: number }>("point", "p10")?.data.i).toBe(999);
  });
});

/*
  LỖI đã sửa (2026-07-25): trim() nằm SAU setItem trong CÙNG khối try → máy đầy
  thì setItem ném QuotaExceeded, trim KHÔNG BAO GIỜ chạy → kẹt vĩnh viễn, cả
  chuyến biển không lưu thêm được bản nào mà UI vẫn im.
*/
describe("máy hết chỗ (QuotaExceeded)", () => {
  it("đầy → bỏ bản cũ nhất rồi ghi lại được, KHÔNG kẹt vĩnh viễn", () => {
    QUOTA = 10;
    for (let i = 0; i < 10; i++) {
      expect(saveForecast("point", `p${i}`, { i }, i)).toBe(true);
    }
    // đã chật cứng: bản mới vẫn phải vào được (nhờ dọn bản cũ nhất)
    expect(saveForecast("point", "moi", { i: 99 }, 9999)).toBe(true);
    expect(loadForecast<{ i: number }>("point", "moi")?.data.i).toBe(99);
    expect(loadForecast("point", "p0")).toBeNull(); // cũ nhất nhường chỗ
    // và lần sau vẫn ghi được (không kẹt)
    expect(saveForecast("point", "moi2", { i: 100 }, 10000)).toBe(true);
  });

  it("dọn xuyên namespace: lưới gió cũ nhường chỗ cho dự báo điểm", () => {
    QUOTA = 6;
    for (let i = 0; i < 6; i++) saveForecast("grid", `d${i}`, { i }, i);
    expect(saveForecast("point", "a", { v: 1 }, 100)).toBe(true);
    expect(loadForecast("grid", "d0")).toBeNull();
    expect(loadForecast("point", "a")).not.toBeNull();
  });

  it("hết chỗ thật (không dọn được gì) → trả false + ghi mốc để UI nói thật", () => {
    QUOTA = 0;
    const before = lastStorageFullAt();
    expect(saveForecast("point", "a", { v: 1 }, 4242)).toBe(false);
    expect(lastStorageFullAt()).toBe(4242);
    expect(lastStorageFullAt()).not.toBe(before);
  });

  it("lưu được thì KHÔNG đánh dấu hết chỗ", () => {
    const before = lastStorageFullAt();
    expect(saveForecast("point", "a", { v: 1 }, 777777)).toBe(true);
    expect(lastStorageFullAt()).toBe(before);
  });
});

/*
  DỌN THEO BYTE, KHÔNG THEO SỐ BẢN (sửa 2026-07-31): lớp nặng chạy CUỐI trong
  mẻ tải sẵn (độ mặn · nước dâng · dòng chảy tầng sâu · lưới 16 ngày) trước đây
  không bao giờ lưu được — bỏ 12 bản điểm ghim tí xíu vẫn không ra nổi chỗ cho
  một bản mấy trăm KB.
*/
describe("máy hết chỗ — dọn theo DUNG LƯỢNG", () => {
  const big = (n: number) => "x".repeat(n);

  it("bản NẶNG vẫn vào được: bỏ bao nhiêu bản tí hon cũng bỏ, miễn đủ chỗ", () => {
    QUOTA_BYTES = 14000;
    for (let i = 0; i < 40; i++) saveForecast("point", `p${i}`, { i }, i);
    expect(saveForecast("grid", "d16", { blob: big(6000) }, 9999)).toBe(true);
    expect(loadForecast("grid", "d16")).not.toBeNull();
  });

  it("chỉ bỏ vừa đủ — bản mới nhất còn nguyên", () => {
    QUOTA_BYTES = 14000;
    for (let i = 0; i < 40; i++) saveForecast("point", `p${i}`, { i }, i);
    saveForecast("grid", "d3", { blob: big(500) }, 5000);
    expect(saveForecast("scalar", "cloud", { blob: big(5000) }, 9999)).toBe(true);
    expect(loadForecast("point", "p0")).toBeNull(); // cũ nhất nhường chỗ
    expect(loadForecast("point", "p39")).not.toBeNull(); // mới hơn còn
    expect(loadForecast("grid", "d3")).not.toBeNull();
  });

  it("ghi đè bản NẶNG của chính mình không tự xoá mình rồi mất chỗ", () => {
    QUOTA_BYTES = 13000;
    saveForecast("grid", "d16", { blob: big(6000) }, 1000);
    expect(saveForecast("grid", "d16", { blob: big(6000) }, 2000)).toBe(true);
    expect(loadForecast<{ blob: string }>("grid", "d16")?.savedAt).toBe(2000);
  });
});

/*
  NHƯỜNG CHỖ CHO DỮ LIỆU TỰ NHẬP — chọn nạn nhân theo GIÁ TRỊ, không theo tuổi
  (sửa 2026-08-01). `savedAt` của lớp nặng là GIỜ CHẠY CRON của snapshot, còn
  bản điểm-chạm tí hon lưu bằng Date.now ⇒ xếp theo tuổi thì lớp nặng luôn đứng
  đầu hàng bị bỏ: một ghi chú 3 KB xoá nguyên lưới gió/sóng 16 ngày.
*/
describe("reclaimForecastSpace — bỏ thứ RẺ trước, chừa lưới gió/sóng", () => {
  const big = (n: number) => "x".repeat(n);

  it("lưới gió/sóng CŨ HƠN vẫn được chừa, bản điểm-chạm mới hơn nhường chỗ", () => {
    saveForecast("grid", "d16", { blob: big(2000) }, 1000); // savedAt = giờ cron
    saveForecast("point", "a", { blob: big(50) }, 9000); // savedAt = Date.now
    expect(reclaimForecastSpace(100)).toBe(1);
    expect(loadForecast("grid", "d16")).not.toBeNull();
    expect(loadForecast("point", "a")).toBeNull();
  });

  it("thứ tự hy sinh: điểm → dải màu → dòng chảy tầng → lưới → bản đồ cá ghim", () => {
    saveForecast("fishmark", "m", { blob: big(60) }, 1000);
    saveForecast("grid", "d16", { blob: big(60) }, 1000);
    saveForecast("curdepth", "t150", { blob: big(60) }, 1000);
    saveForecast("scalar", "cloud", { blob: big(60) }, 1000);
    saveForecast("point", "a", { blob: big(60) }, 1000);
    const gone: string[] = [];
    for (const [ns, id] of [
      ["point", "a"],
      ["scalar", "cloud"],
      ["curdepth", "t150"],
      ["grid", "d16"],
      ["fishmark", "m"],
    ] as const) {
      reclaimForecastSpace(0);
      if (loadForecast(ns, id) === null && !gone.includes(ns)) gone.push(ns);
    }
    expect(gone).toEqual(["point", "scalar", "curdepth", "grid", "fishmark"]);
  });

  it("cùng bậc thì bỏ bản CŨ trước", () => {
    saveForecast("point", "moi", { blob: big(50) }, 9000);
    saveForecast("point", "cu", { blob: big(50) }, 1000);
    reclaimForecastSpace(0);
    expect(loadForecast("point", "cu")).toBeNull();
    expect(loadForecast("point", "moi")).not.toBeNull();
  });

  it("kho trống → trả 0, không ném", () => {
    expect(reclaimForecastSpace(5000)).toBe(0);
  });
});

describe("coordId", () => {
  it("gộp về lưới 0.25°", () => {
    expect(coordId(10.36, 108.09)).toBe(coordId(10.30, 108.12)); // cùng ô 0.25
    expect(coordId(10.0, 108.0)).toBe("10.00_108.00");
  });
});

describe("savedAgoLabel", () => {
  it("phút / giờ / ngày", () => {
    expect(savedAgoLabel(0, 5 * 60000)).toBe("lưu 5 phút trước");
    expect(savedAgoLabel(0, 3 * 3600000)).toBe("lưu 3 giờ trước");
    expect(savedAgoLabel(0, 2 * 86400000)).toBe("lưu 2 ngày trước");
  });
});
