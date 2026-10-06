import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  BOAT_PAPER_FIELDS,
  countPaperFields,
  formatBoatNumber,
  kwToCv,
  loadBoats,
  parseBoatNumber,
  parseBuiltYear,
  saveBoats,
  showsUnderBoat,
  loadCurrentBoatId,
  saveCurrentBoatId,
  type Boat,
} from "@/lib/boats";

// Cùng pattern auth-scope.test.ts — stub window.localStorage (không cần jsdom).
function makeStore() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
  };
}
const store = makeStore();
vi.stubGlobal("window", { localStorage: store });

// clear + reset cờ readFailed (module-level, sticky theo thiết kế K4): đọc kho
// rỗng cho readFailed=false để mỗi ca bắt đầu sạch, không dính lỗi ca trước.
beforeEach(() => {
  store.clear();
  loadBoats();
});

describe("loadBoats — KHÔNG seed tàu mẫu (fix data 'dùng chung' 2026-07-02)", () => {
  it("chưa có gì → rỗng (không tạo 'Tàu của tôi' mặc định)", () => {
    expect(loadBoats()).toEqual([]);
  });

  it("mảng rỗng đã lưu → vẫn rỗng", () => {
    store.setItem("forfish.boats.v1", "[]");
    expect(loadBoats()).toEqual([]);
  });

  it("JSON hỏng → rỗng, không crash", () => {
    store.setItem("forfish.boats.v1", "{hỏng");
    expect(loadBoats()).toEqual([]);
  });

  it("có tàu thật đã lưu → trả đúng list", () => {
    const boats: Boat[] = [{ id: "b1", name: "Tàu câu Bình Minh", maTau: "BV-1234-TS" }];
    saveBoats(boats);
    expect(loadBoats()).toEqual(boats);
  });
});

describe("current boat id", () => {
  it("chưa chọn → null", () => {
    expect(loadCurrentBoatId()).toBe(null);
  });

  it("lưu rồi đọc lại", () => {
    saveCurrentBoatId("b1");
    expect(loadCurrentBoatId()).toBe("b1");
  });
});

// ── HỒ SƠ THEO GIẤY TỜ TÀU (2026-10-06) ─────────────────────────────────────
describe("parseBoatNumber — số kiểu Việt in trên giấy đăng kiểm", () => {
  it("dấu PHẨY thập phân đọc đúng (parseFloat cũ ra 55)", () => {
    expect(parseBoatNumber("55,60")).toEqual({ ok: true, value: 55.6 });
    expect(parseBoatNumber("5,25")).toEqual({ ok: true, value: 5.25 });
    expect(parseBoatNumber("18.00")).toEqual({ ok: true, value: 18 });
    expect(parseBoatNumber(" 566 ")).toEqual({ ok: true, value: 566 });
  });
  it("rỗng = chưa ghi (ô tuỳ chọn), không phải lỗi", () => {
    expect(parseBoatNumber("")).toEqual({ ok: true, value: undefined });
    expect(parseBoatNumber("   ")).toEqual({ ok: true, value: undefined });
  });
  it("chữ lạ / âm / hai dấu / vượt trần ⇒ lỗi, KHÔNG lặng lẽ cắt", () => {
    expect(parseBoatNumber("abc").ok).toBe(false);
    expect(parseBoatNumber("-3").ok).toBe(false);
    expect(parseBoatNumber("1,2,3").ok).toBe(false);
    expect(parseBoatNumber("566kW").ok).toBe(false);
    expect(parseBoatNumber("180", 100).ok).toBe(false);
  });
});

describe("parseBuiltYear", () => {
  it("4 số, 1950 … năm nay", () => {
    expect(parseBuiltYear("2018", 2026)).toEqual({ ok: true, value: 2018 });
    expect(parseBuiltYear("", 2026)).toEqual({ ok: true, value: undefined });
    expect(parseBuiltYear("18", 2026).ok).toBe(false);
    expect(parseBuiltYear("2030", 2026).ok).toBe(false);
    expect(parseBuiltYear("1900", 2026).ok).toBe(false);
  });
});

describe("kwToCv / formatBoatNumber / countPaperFields", () => {
  it("566 kW = 770 CV như giấy đăng kiểm in", () => {
    expect(kwToCv(566)).toBe(770);
  });
  it("in lại số theo dấu phẩy để đổ vào ô sửa", () => {
    expect(formatBoatNumber(55.6)).toBe("55,6");
    expect(formatBoatNumber(undefined)).toBe("");
  });
  it("đếm đúng ô theo giấy đã ghi; tàu cũ (4 ô) = 0", () => {
    const old: Boat = { id: "b", name: "Tàu", maTau: "X", lengthM: 15 };
    expect(countPaperFields(old)).toBe(0);
    expect(
      countPaperFields({ ...old, ownerName: "A", grossTonnage: 55.6, gear: "" }),
    ).toBe(2);
    expect(BOAT_PAPER_FIELDS.length).toBe(19);
  });
  it("tàu cũ đã lưu (chưa có ô mới) vẫn đọc được nguyên vẹn", () => {
    store.setItem(
      "forfish.boats.v1",
      JSON.stringify([{ id: "b1", name: "Cũ", maTau: "BV-1", lengthM: 12 }]),
    );
    expect(loadBoats()).toEqual([{ id: "b1", name: "Cũ", maTau: "BV-1", lengthM: 12 }]);
  });
});

describe("showsUnderBoat — mục trỏ vào tàu KHÔNG CÒN không được biến mất", () => {
  const known = new Set(["b1", "b2"]);
  it("đúng tàu đang xem / chưa gắn tàu ⇒ hiện", () => {
    expect(showsUnderBoat("b1", "b1", known)).toBe(true);
    expect(showsUnderBoat(undefined, "b1", known)).toBe(true);
    expect(showsUnderBoat(null, null, known)).toBe(true);
  });
  it("của tàu KHÁC còn tồn tại ⇒ không hiện ở tàu này", () => {
    expect(showsUnderBoat("b2", "b1", known)).toBe(false);
  });
  it("tàu của mục không còn trong danh sách ⇒ hiện ở tàu đang xem", () => {
    expect(showsUnderBoat("b9", "b1", known)).toBe(true);
    // máy mới chưa có tàu nào ⇒ giấy vẫn hiện, không trống trơn
    expect(showsUnderBoat("b9", undefined, new Set())).toBe(true);
  });
  it("danh sách tàu CHƯA NẠP xong ⇒ chưa gọi là mồ côi", () => {
    expect(showsUnderBoat("b9", "b1", null)).toBe(false);
  });
});
