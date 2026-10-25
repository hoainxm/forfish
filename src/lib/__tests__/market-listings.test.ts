import { describe, expect, it } from "vitest";
import {
  laTinTam,
  rowToListing,
  tinTamTuDraft,
  validateDraft,
  validateDraftField,
  type ListingDraft,
} from "@/lib/market-listings-core";

function draft(over: Partial<ListingDraft> = {}): ListingDraft {
  return {
    side: "ban",
    posterKind: "ngu-dan",
    posterName: "Tàu ông Bảy",
    species: "Cá ngừ",
    ...over,
  };
}

describe("validateDraft", () => {
  it("draft đủ tên + loài + loại → hợp lệ", () => {
    expect(validateDraft(draft())).toBeNull();
  });
  it("thiếu tên hoặc loài → báo lỗi", () => {
    expect(validateDraft(draft({ posterName: "  " }))).toMatch(/tên/i);
    expect(validateDraft(draft({ species: "" }))).toMatch(/loài/i);
  });
  it("side lạ → báo lỗi", () => {
    expect(validateDraft(draft({ side: "xxx" as ListingDraft["side"] }))).toMatch(
      /tin bán hay tin mua/i,
    );
  });
  it("SĐT sai định dạng → báo lỗi; để trống thì bỏ qua", () => {
    expect(validateDraft(draft({ phone: "123" }))).toMatch(/điện thoại/i);
    expect(validateDraft(draft({ phone: "" }))).toBeNull();
    expect(validateDraft(draft({ phone: "0901234567" }))).toBeNull();
  });
});

describe("validateDraftField — ô nào sai (CC-02)", () => {
  it("thiếu tên → posterName (ô đang thu phải mở ra), thiếu loài → species", () => {
    expect(validateDraftField(draft({ posterName: " " }))?.field).toBe("posterName");
    expect(validateDraftField(draft({ species: "" }))?.field).toBe("species");
    expect(validateDraftField(draft({ phone: "123" }))?.field).toBe("phone");
    expect(validateDraftField(draft())).toBeNull();
  });
  it("câu lỗi khớp validateDraft (một nguồn)", () => {
    const d = draft({ posterName: "" });
    expect(validateDraftField(d)?.message).toBe(validateDraft(d));
  });
});

describe("tinTamTuDraft — thẻ tin hiện ngay sau khi đăng (CC-05)", () => {
  it("trim, ô trống bỏ, SĐT trống lấy số tài khoản, id có tiền tố tạm, mine", () => {
    const l = tinTamTuDraft(
      draft({ posterName: " Tàu ông Bảy ", quantity: "  ", phone: "", note: " ướp đá " }),
      { id: "1", accountPhone: "0900000777", today: "2026-10-25" },
    );
    expect(l.posterName).toBe("Tàu ông Bảy");
    expect(l.quantity).toBeUndefined();
    expect(l.phone).toBe("0900000777");
    expect(l.note).toBe("ướp đá");
    expect(l.status).toBe("open");
    expect(l.mine).toBe(true);
    expect(l.postedOn).toBe("2026-10-25");
    expect(laTinTam(l.id)).toBe(true);
    expect(laTinTam("row-1")).toBe(false);
  });
  it("SĐT bà con nhập thì giữ số đó", () => {
    expect(
      tinTamTuDraft(draft({ phone: "0901234567" }), {
        id: "2",
        accountPhone: "0900000777",
        today: "2026-10-25",
      }).phone,
    ).toBe("0901234567");
  });
});

describe("rowToListing", () => {
  /*  CHỦ TIN LÀ SĐT, KHÔNG PHẢI uuid (2026-08-16, thẩm định P0): app bỏ phiên
      Supabase từ 0026 nên `auth.uid()` luôn null — cờ "tin của tôi" nay so
      `owner_phone` với SĐT từ chuỗi cứng của máy. Xem migration 0035. */
  const baseRow = {
    id: "row-1",
    owner_phone: "0901234567",
    side: "ban",
    poster_kind: "ngu-dan",
    poster_name: "Tàu ông Bảy",
    species: "Cá ngừ",
    quantity: null,
    price_text: null,
    province: null,
    phone: null,
    note: null,
    status: "open",
    created_at: "2026-07-27T03:20:00.000Z",
  };

  it("map cột snake_case → camelCase + cắt ngày ISO", () => {
    const l = rowToListing(baseRow, "0901234567");
    expect(l.side).toBe("ban");
    expect(l.posterName).toBe("Tàu ông Bảy");
    expect(l.postedOn).toBe("2026-07-27");
    expect(l.mine).toBe(true);
    expect(l.status).toBe("open");
  });

  it("SĐT khác → mine=false", () => {
    expect(rowToListing(baseRow, "0909999999").mine).toBe(false);
    expect(rowToListing(baseRow, null).mine).toBe(false);
    expect(rowToListing({ ...baseRow, owner_phone: null }, "0901234567").mine).toBe(false);
    // khách chưa đăng nhập (phone rỗng) KHÔNG được nhận vơ tin của người khác
    expect(rowToListing(baseRow, "").mine).toBe(false);
    expect(rowToListing({ ...baseRow, owner_phone: null }, "").mine).toBe(false);
  });

  it("giá trị lạ được khoan dung (side/kind/status về mặc định an toàn)", () => {
    const weird = { ...baseRow, side: "??", poster_kind: "alien", status: "??" };
    const l = rowToListing(weird, null);
    expect(l.side).toBe("ban");
    expect(l.posterKind).toBe("ngu-dan");
    expect(l.status).toBe("open");
  });
});
