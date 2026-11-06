import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CANG_THEO_MA_TINH,
  CANG_TU_DONG_KEY,
  cangTheoSoTau,
  chonCangTuDanhSachTau,
  docDauTuDong,
  maTinhTuSoTau,
  thuTuGanCangNha,
} from "@/lib/cang-theo-so-tau";
import { cangTheoId, datCangNha, docCangNha } from "@/lib/cang-nha";

// Cùng pattern cang-nha.test.ts — stub window.localStorage (không cần jsdom).
const map = new Map<string, string>();
let hong = false;
const store = {
  getItem: (k: string) => map.get(k) ?? null,
  setItem: (k: string, v: string) => {
    if (hong) throw new Error("QuotaExceededError");
    map.set(k, v);
  },
  removeItem: (k: string) => void map.delete(k),
  clear: () => map.clear(),
};
vi.stubGlobal("window", { localStorage: store, dispatchEvent: () => true });

beforeEach(() => {
  map.clear();
  hong = false;
});

describe("mã tỉnh trong số đăng ký", () => {
  it("đọc đúng các dạng thật trong S-Tracking", () => {
    expect(maTinhTuSoTau("BĐ-97989-TS")).toBe("BĐ");
    expect(maTinhTuSoTau("QNg-90123-TS")).toBe("QNG");
    expect(maTinhTuSoTau("BTh-96684-TS")).toBe("BTH");
    expect(maTinhTuSoTau("ĐNa 90001 TS")).toBe("ĐNA");
    expect(maTinhTuSoTau(" kg.94762-TS")).toBe("KG");
  });
  it("số rác / trống ⇒ null", () => {
    expect(maTinhTuSoTau("VT64528530_19M9520")).toBeNull();
    expect(maTinhTuSoTau("test")).toBeNull();
    expect(maTinhTuSoTau(null)).toBeNull();
    expect(maTinhTuSoTau("")).toBeNull();
  });
  it("Bình Thuận (BTh) không lẫn Bến Tre (BT)", () => {
    expect(cangTheoSoTau("BTh-96684-TS")).toBe("phan-thiet");
    expect(cangTheoSoTau("BT-93925-TS")).toBe("binh-dai");
  });
  it("mọi cảng trong bảng đều có trong danh mục, có toạ độ", () => {
    for (const [ma, id] of Object.entries(CANG_THEO_MA_TINH)) {
      const c = cangTheoId(id);
      expect(c, `${ma} → ${id}`).not.toBeNull();
      expect(Number.isFinite(c!.lat) && Number.isFinite(c!.lon)).toBe(true);
    }
  });
  it("mã lạ ⇒ không đoán", () => {
    expect(cangTheoSoTau("XX-12345-TS")).toBeNull();
  });
});

describe("chọn cảng từ nhiều tàu", () => {
  it("tỉnh nhiều tàu nhất thắng", () => {
    expect(chonCangTuDanhSachTau(["KG-1234-TS", "BĐ-97989-TS", "BĐ-90001-TS"])).toEqual({ portId: "quy-nhon", soTau: "BĐ-97989-TS" });
  });
  it("hoà ⇒ tàu đứng trước", () => {
    expect(chonCangTuDanhSachTau(["KG-1234-TS", "BĐ-97989-TS"])?.portId).toBe("tac-cau");
  });
  it("không tàu nào đọc được ⇒ null", () => {
    expect(chonCangTuDanhSachTau([null, "test", ""])).toBeNull();
    expect(chonCangTuDanhSachTau([])).toBeNull();
  });
});

describe("thuTuGanCangNha", () => {
  it("máy chưa có cảng nhà ⇒ gắn + ghi dấu", () => {
    const d = thuTuGanCangNha(["BĐ-97989-TS"]);
    expect(d?.portId).toBe("quy-nhon");
    expect(docCangNha()?.portId).toBe("quy-nhon");
    expect(docDauTuDong()).toMatchObject({ portId: "quy-nhon", soTau: "BĐ-97989-TS" });
  });
  it("KHÔNG đè cảng nhà bà con đã chọn", () => {
    expect(datCangNha("tinh-ky")).toBe(true);
    expect(thuTuGanCangNha(["BĐ-97989-TS"])).toBeNull();
    expect(docCangNha()?.portId).toBe("tinh-ky");
    expect(map.has(CANG_TU_DONG_KEY)).toBe(false);
  });
  it("đã tự gắn một lần ⇒ không gắn lại (bà con xoá rồi thì app không giành)", () => {
    map.set(CANG_TU_DONG_KEY, JSON.stringify({ portId: "quy-nhon", soTau: "BĐ-1-TS", luc: 1 }));
    expect(thuTuGanCangNha(["KG-1234-TS"])).toBeNull();
    expect(docCangNha()).toBeNull();
  });
  it("máy hết chỗ ⇒ không ghi dấu, không ném, lần sau thử lại", () => {
    hong = true;
    expect(thuTuGanCangNha(["BĐ-97989-TS"])).toBeNull();
    expect(map.has(CANG_TU_DONG_KEY)).toBe(false);
    hong = false;
    expect(thuTuGanCangNha(["BĐ-97989-TS"])?.portId).toBe("quy-nhon");
  });
});
