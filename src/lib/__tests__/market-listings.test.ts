import { describe, expect, it } from "vitest";
import { rowToListing, validateDraft, type ListingDraft } from "@/lib/market-listings";

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

describe("rowToListing", () => {
  const baseRow = {
    id: "row-1",
    owner_id: "user-1",
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
    const l = rowToListing(baseRow, "user-1");
    expect(l.side).toBe("ban");
    expect(l.posterName).toBe("Tàu ông Bảy");
    expect(l.postedOn).toBe("2026-07-27");
    expect(l.mine).toBe(true);
    expect(l.status).toBe("open");
  });

  it("owner khác → mine=false", () => {
    expect(rowToListing(baseRow, "user-2").mine).toBe(false);
    expect(rowToListing(baseRow, null).mine).toBe(false);
  });

  it("giá trị lạ được khoan dung (side/kind/status về mặc định an toàn)", () => {
    const weird = { ...baseRow, side: "??", poster_kind: "alien", status: "??" };
    const l = rowToListing(weird, null);
    expect(l.side).toBe("ban");
    expect(l.posterKind).toBe("ngu-dan");
    expect(l.status).toBe("open");
  });
});
