// Khung soạn bài kiểu Facebook: chủ đề TỰ ĐOÁN theo chữ khi bà con chưa chọn (không bắt chọn như form).
import { describe, expect, it } from "vitest";
import { doanChuDe } from "@/components/kairos/composer-sheet";

describe("doanChuDe", () => {
  it("chuyện đi biển ⇒ Nghề cá; chuyện thường ⇒ Đời sống", () => {
    expect(doanChuDe("Sáng nay ra khơi gió nhẹ, ae đi cẩn thận nha")).toBe("nghe-ca");
    expect(doanChuDe("Mực về nhiều quá bà con")).toBe("nghe-ca");
    expect(doanChuDe("Giao lưu cuối tuần với anh em công ty")).toBe("doi-song");
    expect(doanChuDe("")).toBe("doi-song");
  });
});
