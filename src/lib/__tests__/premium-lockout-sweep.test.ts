import { describe, it, expect } from "vitest";

import {
  featureAccessDecision,
  type FeatureAccessInput,
  type FeatureAccess,
  type PremiumMark,
} from "../tier";

/*  LUẬT MỞ/KHOÁ PREMIUM — chứng minh MECE trọn vẹn.

    Chủ dự án 2026-09-02: *"làm cái logic gì đơn giản, mece đảm bảo họ đã là
    premium nó luôn chạy, đã lưu rồi, đừng có đăng nhập tới lui nếu đã có
    premium trong máy rồi trừ khi họ đổi máy thôi"*.

    Bản cũ nhận 9 đầu vào = 288 tổ hợp, và chính nó đẻ ra chuỗi ngõ cụt phải vá
    suốt tháng 8. Bản mới nhận BA: đã cấu hình chưa · máy có chuỗi cứng chưa ·
    dấu hạng. Toàn bộ không gian trạng thái là 2 × 2 × 3 = 12 ca — quét HẾT
    được, không còn góc nào chưa ai soi. */

const MARKS: PremiumMark[] = ["premium", "basic", "unknown"];

/** TOÀN BỘ không gian trạng thái — 12 ca, không sót. */
function moiTrangThai(): FeatureAccessInput[] {
  const out: FeatureAccessInput[] = [];
  for (const configured of [true, false])
    for (const hasToken of [true, false])
      for (const mark of MARKS) out.push({ configured, hasToken, mark });
  return out;
}

describe("MECE — mọi trạng thái ra ĐÚNG MỘT kết quả, không sót ca nào", () => {
  it("quét đủ 12 ca, ca nào cũng ra một trong bốn kết quả hợp lệ", () => {
    const hopLe: FeatureAccess[] = ["checking", "login", "upgrade", "open"];
    const ca = moiTrangThai();
    expect(ca).toHaveLength(12);
    for (const i of ca) expect(hopLe).toContain(featureAccessDecision(i));
  });

  it("hàm THUẦN: cùng đầu vào cho cùng kết quả (không phụ thuộc giờ/mạng)", () => {
    for (const i of moiTrangThai()) {
      expect(featureAccessDecision(i)).toBe(featureAccessDecision({ ...i }));
    }
  });
});

describe("BẢO ĐẢM 1 — đã premium trong máy thì LUÔN chạy", () => {
  it("có chuỗi + dấu premium ⇒ 'open', không ca nào khác", () => {
    const ca = moiTrangThai().filter(
      (i) => i.configured && i.hasToken && i.mark === "premium",
    );
    expect(ca.length).toBeGreaterThan(0);
    for (const i of ca) expect(featureAccessDecision(i)).toBe("open");
  });

  it("KHÔNG hỏi mạng, KHÔNG hỏi phiên: mất sóng giữa biển vẫn mở", () => {
    /*  Luật mới không có đầu vào `online`/`hasUser`/`authReady` để mà hỏi —
        đó chính là điều làm nó không kẹt được. Ca này chốt bằng KIỂU: thêm
        mấy trường đó vào là TypeScript chối, nên không ai lén hỏi lại. */
    const i: FeatureAccessInput = {
      configured: true,
      hasToken: true,
      mark: "premium",
    };
    expect(Object.keys(i).sort()).toEqual(["configured", "hasToken", "mark"]);
    expect(featureAccessDecision(i)).toBe("open");
  });
});

describe("BẢO ĐẢM 2 — đổi máy thì phải đăng nhập lại (và CHỈ khi đó)", () => {
  it("không có chuỗi ⇒ 'login', dù dấu cũ còn ghi premium", () => {
    for (const mark of MARKS) {
      expect(
        featureAccessDecision({ configured: true, hasToken: false, mark }),
      ).toBe("login");
    }
  });

  it("máy dùng chung: đăng xuất xoá cả chuỗi lẫn dấu ⇒ người sau không thừa hưởng", () => {
    // sau đăng xuất: hasToken=false, mark bị clearTierMark đưa về unknown
    expect(
      featureAccessDecision({
        configured: true,
        hasToken: false,
        mark: "unknown",
      }),
    ).toBe("login");
  });
});

describe("BẢO ĐẢM 3 — vẫn đóng được khi đáng đóng (không mở bừa)", () => {
  it("dấu 'basic' (máy chủ đã nói hạng thường / hết hạn) ⇒ 'upgrade'", () => {
    expect(
      featureAccessDecision({
        configured: true,
        hasToken: true,
        mark: "basic",
      }),
    ).toBe("upgrade");
  });

  it("chưa từng biết hạng ⇒ 'checking', KHÔNG mở bừa", () => {
    expect(
      featureAccessDecision({
        configured: true,
        hasToken: true,
        mark: "unknown",
      }),
    ).toBe("checking");
  });

  it("không ca nào ra 'open' mà thiếu bằng chứng premium", () => {
    const moBua = moiTrangThai()
      .filter((i) => i.configured) // demo mode mở hết là CỐ Ý, không tính
      .filter((i) => featureAccessDecision(i) === "open")
      .filter((i) => !(i.hasToken && i.mark === "premium"));
    expect(moBua).toEqual([]);
  });
});

describe("Demo mode — chưa cấu hình Supabase thì mở hết (nếp chung mọi gate)", () => {
  it("configured=false ⇒ 'open' bất kể chuỗi/dấu", () => {
    for (const i of moiTrangThai().filter((x) => !x.configured)) {
      expect(featureAccessDecision(i)).toBe("open");
    }
  });
});
