import { describe, expect, it } from "vitest";
import { BL_NHANH, DOC_TOI_DA, chuDeDoc, nenHoanAnh } from "@/lib/kairos/de-dung";

describe("chuDeDoc — chữ để đọc to một bài", () => {
  it("bài báo: tên báo + tiêu đề có dấu chấm + tóm tắt", () => {
    expect(chuDeDoc({ kind: "bao", outlet: "Báo Bình Định", title: "Tàu cá cập cảng an toàn", summary: "Sáng nay 30 tàu đã về." })).toBe(
      "Tin Báo Bình Định. Tàu cá cập cảng an toàn. Sáng nay 30 tàu đã về.",
    );
  });
  it("tiêu đề có dấu hỏi thì giữ, không thêm chấm", () => {
    expect(chuDeDoc({ kind: "bao", title: "Bão về khi nào?" })).toBe("Bão về khi nào?");
  });
  it("bài bà con: tên + nội dung, gộp khoảng trắng", () => {
    expect(chuDeDoc({ kind: "ba-con", body: "Mực   về\nnhiều lắm", author: { handle: "Bảy Mực" } })).toBe("Bảy Mực viết: Mực về nhiều lắm");
  });
  it("bài trống ⇒ rỗng (nút Nghe ẩn)", () => {
    expect(chuDeDoc({ kind: "ba-con", body: "  " })).toBe("");
  });
  it("bài dài: cắt ở dấu câu, không quá trần", () => {
    const dai = "Câu một khá dài để thử. ".repeat(60);
    const out = chuDeDoc({ kind: "ba-con", body: dai });
    expect([...out].length).toBeLessThanOrEqual(DOC_TOI_DA);
    expect(out.endsWith(".")).toBe(true);
  });
});

describe("nenHoanAnh — mạng yếu thì hoãn ảnh", () => {
  it("không biết mạng ⇒ tải bình thường", () => {
    expect(nenHoanAnh(undefined)).toBe(false);
    expect(nenHoanAnh({})).toBe(false);
  });
  it("Tiết kiệm dữ liệu hoặc 2G ⇒ hoãn", () => {
    expect(nenHoanAnh({ saveData: true, effectiveType: "4g" })).toBe(true);
    expect(nenHoanAnh({ effectiveType: "2g" })).toBe(true);
    expect(nenHoanAnh({ effectiveType: "slow-2g" })).toBe(true);
  });
  it("3G/4G ⇒ tải", () => {
    expect(nenHoanAnh({ effectiveType: "3g" })).toBe(false);
    expect(nenHoanAnh({ effectiveType: "4g", saveData: false })).toBe(false);
  });
});

describe("BL_NHANH — câu bình luận nhanh", () => {
  it("mỗi câu ≤ 2 chữ (luật nhãn nút)", () => {
    for (const c of BL_NHANH) expect(c.split(/\s+/).length).toBeLessThanOrEqual(2);
  });
});
