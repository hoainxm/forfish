import { beforeEach, describe, expect, it } from "vitest";
import {
  HAN_MS,
  clearListState,
  saveListState,
  takeListState,
} from "@/lib/market/list-state";

/*  sessionStorage giả — không cần jsdom, và ép được ca "máy không giữ được".
    Gắn vào `window` vì lib đọc `window.sessionStorage`. */
function gan(opts: { day?: boolean; nem?: boolean } = {}) {
  const m = new Map<string, string>();
  const kho = {
    get length() {
      return m.size;
    },
    key: (i: number) => [...m.keys()][i] ?? null,
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (opts.day) throw new DOMException("QuotaExceededError");
      m.set(k, v);
    },
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
  } as Storage;
  const w = { sessionStorage: kho } as unknown as Window & typeof globalThis;
  if (opts.nem) {
    Object.defineProperty(w, "sessionStorage", {
      get() {
        throw new Error("bị chặn");
      },
    });
  }
  (globalThis as { window?: unknown }).window = w;
  return m;
}

type Mon = { id: string; ten: string };
const snap = (over: Partial<Parameters<typeof saveListState<Mon>>[1]> = {}) => ({
  q: "nhot",
  filters: { nhom: "co-dien", gan: true, xep: "moi" },
  items: [{ id: "p1", ten: "Nhớt Castrol" }] as Mon[],
  total: 42,
  page: 3,
  scrollY: 1280,
  ...over,
});

beforeEach(() => {
  gan();
});

describe("list-state — giữ danh sách qua một lần rời màn (11 §5b.2)", () => {
  it("ghi rồi đọc lại ĐÚNG mọi thứ bà con đã chọn", () => {
    expect(saveListState("tim", snap())).toBe(true);
    const r = takeListState<Mon>("tim");
    expect(r, "phải lấy lại được").not.toBeNull();
    expect(r!.q).toBe("nhot");
    expect(r!.filters).toEqual({ nhom: "co-dien", gan: true, xep: "moi" });
    expect(r!.items).toHaveLength(1);
    expect(r!.total, "tổng số món khớp").toBe(42);
    expect(r!.page, "đã tải tới trang 3 — không bắt tải lại từ trang 1").toBe(3);
    expect(r!.scrollY, "đúng chỗ đang cuộn").toBe(1280);
  });

  it("`extra` đi kèm (thẻ shop, lưới gần bà con) giữ nguyên qua một lượt ghi–đọc", () => {
    expect(saveListState("shop", { ...snap(), extra: { shop: { name: "Đại lý Hải Đăng" } } })).toBe(true);
    const r = takeListState<Mon>("shop");
    expect(r!.extra).toEqual({ shop: { name: "Đại lý Hải Đăng" } });
    expect(takeListState<Mon>("tim")?.extra, "không ghi thì không có").toBeUndefined();
  });

  it("ĐỌC XONG LÀ XOÁ: quay lại thì khôi phục, vào lại lần nữa là việc mới", () => {
    saveListState("tim", snap());
    expect(takeListState<Mon>("tim")).not.toBeNull();
    expect(
      takeListState<Mon>("tim"),
      "lần thứ hai phải rỗng — nếu không, gõ chữ tìm mới mà máy nhả kết quả cũ",
    ).toBeNull();
  });

  it("quá hạn 10 phút → coi như chưa có, tải mới (giá không được cũ)", () => {
    saveListState("tim", snap());
    const chuaQua = takeListState<Mon>("tim", Date.now() + HAN_MS - 1000);
    expect(chuaQua).not.toBeNull();

    saveListState("tim", snap());
    expect(takeListState<Mon>("tim", Date.now() + HAN_MS + 1000)).toBeNull();
  });

  it("hai danh sách không đè nhau", () => {
    saveListState("tim", snap({ q: "nhot" }));
    saveListState("trang-chu", snap({ q: "da cay", page: 1 }));
    expect(takeListState<Mon>("trang-chu")!.q).toBe("da cay");
    expect(takeListState<Mon>("tim")!.q, "ngăn kia còn nguyên").toBe("nhot");
  });

  it("xoá ngăn: sau khi đặt hàng xong danh sách cũ hết nghĩa", () => {
    saveListState("tim", snap());
    clearListState("tim");
    expect(takeListState<Mon>("tim")).toBeNull();
    // xoá ngăn không tồn tại: không được ném
    expect(() => clearListState("khong-co")).not.toThrow();
  });

  it("máy hết chỗ → trả false, KHÔNG ném (mất bản chụp thì tải lại, không mất gì của bà con)", () => {
    gan({ day: true });
    expect(saveListState("tim", snap())).toBe(false);
    expect(takeListState<Mon>("tim")).toBeNull();
  });

  it("kho bị chặn (Safari riêng tư) → mọi đường đều im, không ném", () => {
    gan({ nem: true });
    expect(saveListState("tim", snap())).toBe(false);
    expect(takeListState<Mon>("tim")).toBeNull();
    expect(() => clearListState("tim")).not.toThrow();
  });

  it("ngăn chứa rác (JSON hỏng / items không phải mảng) → coi như chưa có", () => {
    const m = gan();
    m.set("forfish.mlist.v1", "{oops");
    expect(takeListState<Mon>("tim")).toBeNull();

    const m2 = gan();
    m2.set("forfish.mlist.v1", JSON.stringify({ tim: { q: "x", items: "khong-phai-mang", at: Date.now() } }));
    expect(takeListState<Mon>("tim")).toBeNull();
  });
});
