import { describe, it, expect } from "vitest";
import {
  HANDLE_COOLDOWN_MS,
  canChangeHandle,
  defaultHandle,
  handleNorm,
  sublineFor,
  validateHandle,
} from "@/lib/kairos/ten-goi";

const code = (s: unknown) => {
  const r = validateHandle(s);
  return r.ok ? "ok" : r.code;
};

describe("ten-goi — khoá chuẩn hoá (handle_norm)", () => {
  it("không phân biệt hoa, dấu, khoảng trắng thừa, dấu câu", () => {
    expect(handleNorm("Bà Con")).toBe("ba con");
    expect(handleNorm("  ba   con ")).toBe("ba con");
    expect(handleNorm("BÁ CỒN")).toBe("ba con");
    expect(handleNorm("Đức_Long")).toBe(handleNorm("duc long"));
    expect(handleNorm("Tư.Sa-Huỳnh")).toBe("tu sa huynh");
  });
});

describe("ten-goi — validateHandle", () => {
  it("2–20 ký tự (đếm ký tự, không đếm byte)", () => {
    expect(code("A")).toBe("handle_short");
    expect(code("Bé")).toBe("ok");
    expect(code("Đ".repeat(20))).toBe("ok");
    expect(code("Đ".repeat(21))).toBe("handle_long");
    expect(code("   ")).toBe("handle_short");
    expect(code(42)).toBe("handle_short");
  });

  it("chỉ chữ, số, khoảng trắng, . - _ ; phải có chữ cái", () => {
    expect(code("Tư Sa Huỳnh 79")).toBe("ok");
    expect(code("anh_ba.ca-ngu")).toBe("ok");
    expect(code("1234")).toBe("handle_chars");
    expect(code("Ba@con")).toBe("handle_chars");
    expect(code("Ba <b>")).toBe("handle_chars");
  });

  it("làm sạch: NFC + gộp khoảng trắng", () => {
    const r = validateHandle("  Tư   Sa  Huỳnh ");
    expect(r.ok && r.value.handle).toBe("Tư Sa Huỳnh");
    expect(r.ok && r.value.norm).toBe("tu sa huynh");
  });

  it.each(["SDVICO", "sd vico chính thức", "SDFish", "ForFish", "Kairos", "Quản trị viên", "VnExpress", "Báo Tuổi Trẻ", "Thanh Niên", "Kiểm ngư 4", "Cảnh sát biển", "Biên phòng Sa Huỳnh", "UBND xã", "Công an phường", "Bộ Nông nghiệp", "Sở Thủy sản", "Cục Kiểm ngư"])(
    "cấm giả danh: %s",
    (name) => expect(code(name)).toBe("handle_reserved"),
  );

  it("tên người thường có 'Bảo', 'Bò', 'Cúc' vẫn được", () => {
    expect(code("Văn Bảo")).toBe("ok");
    expect(code("Bảo Sa Huỳnh")).toBe("ok");
    expect(code("Bò Sữa")).toBe("ok");
    expect(code("Cúc Phan Thiết")).toBe("ok");
  });

  it("cấm chữ bậy và tên Trung Quốc đặt cho quần đảo", () => {
    expect(code("đéo sợ")).toBe("bad_words");
    expect(code("Xisha fan")).toBe("sovereignty");
    expect(code("Trường Sa 79")).toBe("ok");
  });
});

describe("ten-goi — đổi tên 1 lần/30 ngày", () => {
  const now = Date.parse("2026-10-23T00:00:00Z");
  it("chưa đổi lần nào ⇒ được", () => expect(canChangeHandle(null, now).ok).toBe(true));
  it("đổi 29 ngày trước ⇒ chưa được, báo ngày được đổi", () => {
    const r = canChangeHandle(now - 29 * 86_400_000, now);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Date.parse(r.nextAt)).toBe(now - 29 * 86_400_000 + HANDLE_COOLDOWN_MS);
  });
  it("đủ 30 ngày ⇒ được", () => expect(canChangeHandle(new Date(now - HANDLE_COOLDOWN_MS), now).ok).toBe(true));
  it("giờ hỏng / tương lai ⇒ chặn (an toàn)", () => {
    expect(canChangeHandle("hỏng", now).ok).toBe(false);
    expect(canChangeHandle(now + 86_400_000, now).ok).toBe(false);
  });
});

describe("ten-goi — tên mặc định", () => {
  it("lấy customers.name khi hợp lệ và chưa ai dùng", () => {
    expect(defaultHandle("Nguyễn Văn Tư", "0901234567", () => false)).toBe("Nguyễn Văn Tư");
  });
  it("tên trùng / không hợp lệ ⇒ 'Bà con' + 4 số cuối", () => {
    expect(defaultHandle("Nguyễn Văn Tư", "0901234567", (n) => n === "nguyen van tu")).toBe("Bà con 4567");
    expect(defaultHandle("SDVICO", "0901234567", () => false)).toBe("Bà con 4567");
    expect(defaultHandle(null, "+84 901 234 567", () => false)).toBe("Bà con 4567");
  });
  it("'Bà con 4567' cũng trùng ⇒ thêm số", () => {
    const taken = new Set(["ba con 4567", "ba con 4567 2"]);
    expect(defaultHandle(null, "0901234567", (n) => taken.has(n))).toBe("Bà con 4567 3");
  });
  it("trùng mãi ⇒ null (route trả 503, không ghi bừa)", () => {
    expect(defaultHandle(null, "0901234567", () => true)).toBeNull();
  });
  it("tên mặc định luôn qua validateHandle", () => {
    expect(validateHandle(defaultHandle(null, "0901234567", () => false)).ok).toBe(true);
  });
});

describe("ten-goi — dòng phụ + ảnh đại diện", () => {
  it("cảng nhà ⇒ 'Cảng X', không lặp chữ Cảng", () => {
    expect(sublineFor({ portName: "Sa Huỳnh" })).toBe("Cảng Sa Huỳnh");
    expect(sublineFor({ portName: "Cảng cá Quỳnh Lập" })).toBe("Cảng cá Quỳnh Lập");
    expect(sublineFor({ portName: "Đảo Nam Du" })).toBe("Đảo Nam Du");
  });
  it("không cảng ⇒ tên cơ sở bên mua; không gì ⇒ ''", () => {
    expect(sublineFor({ businessName: "Vựa cá Bà Tư" })).toBe("Vựa cá Bà Tư");
    expect(sublineFor({})).toBe("");
  });

});
