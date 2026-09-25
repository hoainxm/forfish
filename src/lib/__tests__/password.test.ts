import { describe, expect, it } from "vitest";
import {
  normalizePassword,
  PASSWORD_MIN_LENGTH,
  passwordProblem,
  passwordRuleHint,
} from "@/lib/password";

describe("normalizePassword", () => {
  it("bỏ khoảng trắng đầu/cuối", () => {
    expect(normalizePassword("  123456  ")).toBe("123456");
    expect(normalizePassword("abc \t\n")).toBe("abc");
    expect(normalizePassword("\n  matkhau")).toBe("matkhau");
  });

  it("giữ khoảng trắng giữa (mật khẩu cụm từ)", () => {
    expect(normalizePassword("hai ba bon")).toBe("hai ba bon");
    expect(normalizePassword("  cau ca bien  ")).toBe("cau ca bien");
  });

  it("không đổi mật khẩu sạch", () => {
    expect(normalizePassword("123456")).toBe("123456");
  });

  it("chuỗi rỗng / toàn khoảng trắng → rỗng", () => {
    expect(normalizePassword("")).toBe("");
    expect(normalizePassword("    ")).toBe("");
  });
});

describe("passwordProblem — luật DUY NHẤT: tự do, tối thiểu 6 ký tự", () => {
  it("đủ 6 ký tự trở lên → null (đạt), KHÔNG bắt chữ hoa/số/ký tự đặc biệt", () => {
    expect(passwordProblem("123456")).toBeNull();
    expect(passwordProblem("abcdef")).toBeNull(); // toàn chữ thường vẫn đạt
    expect(passwordProblem("      abcdef")).toBeNull(); // trim đầu rồi đếm
    expect(passwordProblem("hai ba bon")).toBeNull(); // có dấu cách giữa
    expect(passwordProblem("mật khẩu dài")).toBeNull();
  });

  it("dưới 6 ký tự (đếm sau khi trim) → câu nhắc, KHÔNG null", () => {
    expect(passwordProblem("123")).toBe("Mật khẩu cần ít nhất 6 ký tự.");
    expect(passwordProblem("")).toBe("Mật khẩu cần ít nhất 6 ký tự.");
    expect(passwordProblem("      ")).toBe("Mật khẩu cần ít nhất 6 ký tự."); // 6 dấu cách KHÔNG tính
    expect(passwordProblem(" 12345 ")).toBe("Mật khẩu cần ít nhất 6 ký tự."); // trim còn 5
  });

  it("đúng mốc PASSWORD_MIN_LENGTH", () => {
    expect(PASSWORD_MIN_LENGTH).toBe(6);
    expect(passwordProblem("x".repeat(PASSWORD_MIN_LENGTH))).toBeNull();
    expect(passwordProblem("x".repeat(PASSWORD_MIN_LENGTH - 1))).not.toBeNull();
  });
});

describe("passwordRuleHint — nhãn kiểm tra tại chỗ", () => {
  it("chưa gõ → mời + nói luật, ok=false", () => {
    const h = passwordRuleHint("");
    expect(h.ok).toBe(false);
    expect(h.text).toContain("ít nhất 6 ký tự");
    expect(h.text).not.toContain("đang có");
  });

  it("đang gõ mà thiếu → đếm rõ còn bao nhiêu, ok=false", () => {
    expect(passwordRuleHint("abc")).toEqual({
      ok: false,
      text: "Cần ít nhất 6 ký tự — đang có 3.",
    });
    // trim trước khi đếm: "  abc " = 3 ký tự thật
    expect(passwordRuleHint("  abc ").text).toBe(
      "Cần ít nhất 6 ký tự — đang có 3.",
    );
  });

  it("đủ dài → ok=true + số ký tự (đếm sau trim)", () => {
    expect(passwordRuleHint("abcdef")).toEqual({
      ok: true,
      text: "✓ Được rồi — mật khẩu đủ dài (6 ký tự).",
    });
    expect(passwordRuleHint("  bien dong  ").ok).toBe(true); // 9 ký tự sau trim
  });

  it("nhận minLength khác khi cần", () => {
    expect(passwordRuleHint("abcd", 4).ok).toBe(true);
    expect(passwordRuleHint("abc", 4).ok).toBe(false);
  });
});
