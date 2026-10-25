import { beforeEach, describe, expect, it } from "vitest";
import {
  coChuMoi,
  docNhapYeuCau,
  duDeGui,
  loiTungO,
  luuNhapYeuCau,
  oDauSai,
  xoaNhapYeuCau,
  type RequestFormDraft,
} from "@/lib/market/request-form";
import { validateRequestDraft } from "@/lib/market/validate";
import type { Address } from "@/lib/market/types";

/*  sessionStorage giả — cùng khuôn market-list-state.test.ts; ép được ca "máy không giữ được". */
function gan(opts: { day?: boolean } = {}) {
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
  (globalThis as { window?: unknown }).window = { sessionStorage: kho };
  return m;
}

const HOM_NAY = "2026-10-25";
const tot = (over: Partial<RequestFormDraft> = {}): RequestFormDraft => ({
  title: "Chân vịt inox 3 cánh",
  qty: "2",
  unit: "cái",
  description: "",
  needBy: "",
  pay: "cod",
  ...over,
});
const diaChi: Address = { name: "Tư", phone: "0912345678", province: "Khánh Hòa", detail: "Cảng Hòn Rớ", isPort: true };

beforeEach(() => {
  gan();
});

describe("request-form — lỗi theo ô (VT-11)", () => {
  it("form đủ ⇒ không ô nào sai, và cổng cuối cũng cho qua", () => {
    const d = tot();
    expect(loiTungO(d, HOM_NAY)).toEqual({});
    expect(validateRequestDraft({ title: d.title, qty: 2, unit: d.unit, address: diaChi, paymentMethod: "cod" }, HOM_NAY)).toBeNull();
  });

  it("mỗi ô sai mang ĐÚNG câu của validateRequestDraft (một lỗi, một cách nói)", () => {
    const loi = loiTungO(tot({ title: "ab", qty: "0", unit: "", needBy: "2026-10-24" }), HOM_NAY);
    expect(loi.title).toBe("Ghi tên món cần đặt (3–120 chữ).");
    expect(loi.qty).toBe("Số lượng từ 1 đến 9999.");
    expect(loi.unit).toBe("Ghi đơn vị (cái, bộ, thùng…).");
    expect(loi.needBy).toBe("Ngày cần hàng không được trước hôm nay.");
    // cùng câu với cổng cuối cho ô đầu
    expect(validateRequestDraft({ title: "ab", qty: 0, unit: "", address: diaChi, paymentMethod: "cod" }, HOM_NAY)).toBe(loi.title);
  });

  it("số lượng: chữ rỗng / 10000 là sai; 9999 là đúng; ngày hôm nay là đúng", () => {
    expect(loiTungO(tot({ qty: "" }), HOM_NAY).qty).toBeTruthy();
    expect(loiTungO(tot({ qty: "10000" }), HOM_NAY).qty).toBeTruthy();
    expect(loiTungO(tot({ qty: "9999" }), HOM_NAY).qty).toBeUndefined();
    expect(loiTungO(tot({ needBy: HOM_NAY }), HOM_NAY).needBy).toBeUndefined();
  });

  it("ô đầu sai theo thứ tự màn: tên → số lượng → đơn vị → ngày", () => {
    expect(oDauSai({})).toBeNull();
    expect(oDauSai({ unit: "x", qty: "y" })).toBe("qty");
    expect(oDauSai({ needBy: "x" })).toBe("needBy");
  });

  it("nút Gửi: mờ tới khi tên món ≥3 chữ (khoảng trắng không tính)", () => {
    expect(duDeGui("")).toBe(false);
    expect(duDeGui("  ab ")).toBe(false);
    expect(duDeGui("dây")).toBe(true);
  });

  it("coChuMoi: chỉ khi khác bản đầu — đổi cách trả tiền cũng tính", () => {
    const goc = tot({ title: "", qty: "1" });
    expect(coChuMoi(goc, goc)).toBe(false);
    expect(coChuMoi({ ...goc, title: "x" }, goc)).toBe(true);
    expect(coChuMoi({ ...goc, pay: "chuyen_khoan" }, goc)).toBe(true);
  });
});

describe("request-form — nháp trong phiên", () => {
  it("ghi rồi đọc lại y nguyên; xoá thì hết", () => {
    const d = tot({ description: "đời 2019", needBy: "2026-11-01", pay: "chuyen_khoan" });
    expect(luuNhapYeuCau(d)).toBe(true);
    expect(docNhapYeuCau()).toEqual(d);
    xoaNhapYeuCau();
    expect(docNhapYeuCau()).toBeNull();
  });

  it("bản méo (thiếu trường / JSON hỏng / pay lạ) ⇒ null hoặc pay về cod — không nhả rác vào form", () => {
    const m = gan();
    m.set("forfish.yeucau-nhap.v1", "{ hỏng");
    expect(docNhapYeuCau()).toBeNull();
    m.set("forfish.yeucau-nhap.v1", JSON.stringify({ title: "x" }));
    expect(docNhapYeuCau()).toBeNull();
    m.set("forfish.yeucau-nhap.v1", JSON.stringify({ ...tot(), pay: "vang" }));
    expect(docNhapYeuCau()?.pay).toBe("cod");
  });

  it("máy chật ⇒ ghi trả false, không ném", () => {
    gan({ day: true });
    expect(luuNhapYeuCau(tot())).toBe(false);
    expect(docNhapYeuCau()).toBeNull();
  });

  it("không có window (server) ⇒ im lặng", () => {
    delete (globalThis as { window?: unknown }).window;
    expect(luuNhapYeuCau(tot())).toBe(false);
    expect(docNhapYeuCau()).toBeNull();
    expect(() => xoaNhapYeuCau()).not.toThrow();
  });
});
