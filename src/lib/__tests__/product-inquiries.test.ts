import { describe, expect, it } from "vitest";
import {
  validateInquiryDraft,
  type InquiryDraft,
} from "@/lib/product-inquiries";

function draft(over: Partial<InquiryDraft> = {}): InquiryDraft {
  return {
    phone: "0901234567",
    ...over,
  };
}

describe("validateInquiryDraft", () => {
  it("SĐT hợp lệ → hợp lệ", () => {
    expect(validateInquiryDraft(draft())).toBeNull();
  });
  it("thiếu SĐT hoặc sai định dạng → báo lỗi", () => {
    expect(validateInquiryDraft(draft({ phone: "" }))).toMatch(/điện thoại/i);
    expect(validateInquiryDraft(draft({ phone: "123" }))).toMatch(
      /điện thoại/i,
    );
  });
  it("kèm listingId/name/message vẫn hợp lệ nếu SĐT đúng", () => {
    expect(
      validateInquiryDraft(
        draft({
          listingId: "abc",
          listingTitle: "Lưới rê",
          vendorKind: "external",
          name: "Anh Hai",
          message: "Còn hàng không?",
        }),
      ),
    ).toBeNull();
  });
});
