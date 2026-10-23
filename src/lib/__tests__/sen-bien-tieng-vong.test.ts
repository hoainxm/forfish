// Tiếng vọng: micro thu lại chính giọng Sen Biển (anh Long 2026-10-23: "vừa nghe vừa nói ko ổn, lẫn lộn").
import { describe, expect, it } from "vitest";
import { laTiengVong, NGHE_SAU_DOC_MS, VONG_MS } from "@/lib/sen-bien/nghe";

const CAU = "Gió cấp 5, sóng cao 2 mét, bác cân nhắc trước khi ra khơi nghen.";

describe("laTiengVong — bỏ chữ micro thu từ loa", () => {
  it("đuôi câu Sen Biển vừa đọc (≥ 3 tiếng) ⇒ vọng", () => {
    expect(laTiengVong("trước khi ra khơi nghen", CAU, 300)).toBe(true);
    expect(laTiengVong("Sóng cao 2 mét bác", CAU, 1200)).toBe(true);
  });
  it("loa còn đang đọc (ms null) ⇒ vẫn bắt được", () => {
    expect(laTiengVong("cân nhắc trước khi ra khơi", CAU, null)).toBe(true);
  });
  it("câu đáp NGẮN không bao giờ là vọng — 'đi', 'thôi', 'về cảng'", () => {
    expect(laTiengVong("đi", "Dẫn về Sa Huỳnh, đi không?", 200)).toBe(false);
    expect(laTiengVong("về cảng", "Bác muốn về cảng nào?", 200)).toBe(false);
  });
  it("câu hỏi MỚI của bà con dù chung vài chữ ⇒ không vọng", () => {
    expect(laTiengVong("mai gió có mạnh không", CAU, 800)).toBe(false);
    expect(laTiengVong("giá cá ngừ hôm nay bao nhiêu", CAU, 800)).toBe(false);
  });
  it("quá VONG_MS sau khi loa im ⇒ không coi là vọng nữa", () => {
    expect(laTiengVong("trước khi ra khơi nghen", CAU, VONG_MS + 1)).toBe(false);
  });
  it("chưa nói gì ⇒ không vọng", () => {
    expect(laTiengVong("trước khi ra khơi nghen", null, 100)).toBe(false);
  });
  it("không phân biệt hoa thường / dấu câu", () => {
    expect(laTiengVong("SÓNG CAO, 2 MÉT!", CAU, 100)).toBe(true);
  });
  it("nghỉ sau khi loa im đủ dài cho loa ngoài/Bluetooth nhưng không làm bà con chờ", () => {
    expect(NGHE_SAU_DOC_MS).toBeGreaterThanOrEqual(300);
    expect(NGHE_SAU_DOC_MS).toBeLessThanOrEqual(800);
  });
});
