import { describe, expect, it } from "vitest";
import {
  applySynonyms, convertNumberWords, extractQty, normalizeUtterance, vnNumberToInt, wordCount,
} from "@/lib/assistant/normalize";

/*  CHUẨN HOÁ CÂU NÓI (14 §4.1, 13 AC-T02/T03): không dấu, viết tắt, giọng miền
    cùng ra một chuỗi; số tiếng Việt thành số; "mốt" là ngày kia còn "một" là 1.  */

describe("assistant-normalize", () => {
  it("số tiếng Việt → số (13 AC-T03)", () => {
    expect(vnNumberToInt("hai")).toBe(2);
    expect(vnNumberToInt("một chục")).toBe(10);
    expect(vnNumberToInt("nửa tá")).toBe(6);
    expect(vnNumberToInt("2")).toBe(2);
    expect(vnNumberToInt("02")).toBe(2);
    expect(vnNumberToInt("mười lăm")).toBe(15);
    expect(vnNumberToInt("hai mươi")).toBe(20);
    expect(vnNumberToInt("hai chục")).toBe(20);
    expect(vnNumberToInt("hai mươi lăm")).toBe(25);
    expect(vnNumberToInt("một trăm")).toBe(100);
    expect(vnNumberToInt("nửa")).toBe(0.5);
    expect(vnNumberToInt("vài")).toBe(3);
    expect(vnNumberToInt("bà")).toBe(3); // đơn lẻ không phân biệt được — chỗ gọi (convertNumberWords) mới có ngữ cảnh
    expect(vnNumberToInt("xyz")).toBeNull();
    expect(vnNumberToInt("")).toBeNull();
  });

  it("chỉ đổi số khi có đơn vị/nhân tử theo sau — không phá 'mốt', 'bà', 'muối', 'mấy người'", () => {
    expect(convertNumberWords("hai cay da")).toBe("2 cay da");
    expect(convertNumberWords("muoi thung nuoc da")).toBe("10 thung nuoc da");
    expect(convertNumberWords("bao muoi")).toBe("bao muoi");
    expect(convertNumberWords("mot co mua khong")).toBe("mot co mua khong");
    expect(convertNumberWords("may nguoi")).toBe("may nguoi");
    expect(convertNumberWords("tu ngay mai")).toBe("tu ngay mai");
    expect(convertNumberWords("hai chuc lit dau")).toBe("20 lit dau");
    expect(convertNumberWords("nua ta pin")).toBe("6 pin");
    expect(convertNumberWords("02 thung")).toBe("2 thung");
  });

  it("không dấu / viết tắt / giọng miền cùng ra một chuỗi (13 AC-T02)", () => {
    const a = normalizeUtterance("bữa nay biển có êm hông");
    const b = normalizeUtterance("hom nay bien co em khong");
    const c = normalizeUtterance("nay biển có êm ko");
    expect(a).toBe("hom nay bien co em khong");
    expect(b).toBe(a);
    expect(c).toBe("nay bien co em khong");
    expect(normalizeUtterance("tui có mấy tàu")).toBe("toi co may tau");
    expect(normalizeUtterance("mở chợ nha")).toBe("mo cho");
    expect(normalizeUtterance("về cảng nhà")).toBe("ve cang nha");
    expect(normalizeUtterance("gọi SDVICO giúp")).toBe("goi sdvico");
    expect(normalizeUtterance("mai sóng cao không")).toBe("ngay mai song khong");
    expect(normalizeUtterance("mốt có mưa không")).toBe("ngay kia co mua khong");
    expect(normalizeUtterance("mua một cây đá")).toBe("mua 1 cay da");
    expect(normalizeUtterance("thêm nhớt vào giỏ")).toBe("them dau nhot vao gio");
    expect(normalizeUtterance("dầu diesel bao nhiêu")).toBe("dau do bao nhieu");
  });

  it("không ném; rỗng → ''; cắt 300 ký tự", () => {
    expect(normalizeUtterance("")).toBe("");
    expect(normalizeUtterance(null as unknown as string)).toBe("");
    expect(normalizeUtterance("a".repeat(1000)).length).toBeLessThanOrEqual(300);
    expect(applySynonyms("")).toBe("");
  });

  it("extractQty bắt 'N đơn-vị phần-còn-lại', kẹp 1..999", () => {
    expect(extractQty("2 thung dau nhot")).toEqual({ qty: 2, unit: "thung", rest: "dau nhot" });
    expect(extractQty("0,5 cay da")).toEqual({ qty: 1, unit: "cay", rest: "da" });
    expect(extractQty("5000 lit dau")).toEqual({ qty: 999, unit: "lit", rest: "dau" });
    expect(extractQty("3 pin")).toEqual({ qty: 3, unit: undefined, rest: "pin" });
    expect(extractQty("dau nhot")).toBeNull();
  });

  it("wordCount đếm chữ", () => {
    expect(wordCount("")).toBe(0);
    expect(wordCount("mo cho")).toBe(2);
  });
});
