import { describe, expect, it } from "vitest";
import {
  rowToMarketListing,
  validateDraft,
  type ListingDraft,
} from "@/lib/market-listings";

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

describe("rowToMarketListing", () => {
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
    const l = rowToMarketListing(baseRow, "0901234567");
    expect(l.side).toBe("ban");
    expect(l.posterName).toBe("Tàu ông Bảy");
    expect(l.postedOn).toBe("2026-07-27");
    expect(l.mine).toBe(true);
    expect(l.status).toBe("open");
  });

  it("owner khác → mine=false", () => {
    expect(rowToMarketListing(baseRow, "0909999999").mine).toBe(false);
    expect(rowToMarketListing(baseRow, null).mine).toBe(false);
    // khách chưa đăng nhập (phone rỗng) KHÔNG được nhận vơ tin của người khác
    expect(rowToMarketListing(baseRow, "").mine).toBe(false);
    expect(rowToMarketListing({ ...baseRow, owner_phone: null }, "").mine).toBe(false);
  });

  it("giá trị lạ được khoan dung (side/kind/status về mặc định an toàn)", () => {
    const weird = { ...baseRow, side: "??", poster_kind: "alien", status: "??" };
    const l = rowToMarketListing(weird, null);
    expect(l.side).toBe("ban");
    expect(l.posterKind).toBe("ngu-dan");
    expect(l.status).toBe("open");
  });
});
