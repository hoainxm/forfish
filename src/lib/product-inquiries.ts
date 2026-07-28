// YÊU CẦU HỎI MUA/TƯ VẤN từ danh mục sản phẩm (2026-07-28, Phase 2) — bảng
// riêng `product_inquiries`. Phạm vi: sản phẩm SDVICO vẫn dùng nút "Hỏi mua"
// cũ → CRM (không đụng, kênh bán hàng đang chạy thật); bảng này phục vụ sản
// phẩm ĐƠN VỊ NGOÀI SDWork — trước đây chỉ hiện SĐT, giờ bà con "Để lại yêu
// cầu" và admin quản lý trong /quan-tri tab "Yêu cầu".
//
// Helper thuần (validateInquiryDraft) tách riêng để test ở
// src/lib/__tests__/product-inquiries.test.ts.

import { isValidVnPhone } from "@/lib/phone";

export type InquiryStatus = "moi" | "da_lien_he" | "xong";

export const INQUIRY_STATUS_LABEL: Record<InquiryStatus, string> = {
  moi: "Mới",
  da_lien_he: "Đã liên hệ",
  xong: "Xong",
};

export interface InquiryDraft {
  listingId?: string;
  listingTitle?: string;
  vendorKind?: "sdvico" | "external";
  phone: string;
  name?: string;
  message?: string;
}

/** Trả câu lỗi tiếng Việt nếu draft chưa hợp lệ, null nếu OK. */
export function validateInquiryDraft(d: InquiryDraft): string | null {
  if (!d.phone?.trim() || !isValidVnPhone(d.phone))
    return "Nhập số điện thoại hợp lệ để được gọi lại.";
  return null;
}

export interface ProductInquiry {
  id: string;
  listingId: string | null;
  listingTitle: string | null;
  vendorKind: string | null;
  customerPhone: string;
  customerName: string | null;
  message: string | null;
  status: InquiryStatus;
  createdAt: string;
  handledBy: string | null;
  handledAt: string | null;
  note: string | null;
}
