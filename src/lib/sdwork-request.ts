// Dựng NỘI DUNG yêu cầu gửi sang CRM SDWork (Edge Function forfish-gateway,
// action "request" → bảng consultation_requests). THUẦN — test được, không network.
//
// Vì sao tách ra: (1) route /api/sdvico/request cần test được cách ráp câu;
// (2) tiền tố "[ForFish]" là DẤU NHẬN DIỆN để phía kinh doanh SDWork lọc đúng
// yêu cầu đến từ app ngư dân (xem docs/contracts/sdwork-assets.contract.md
// §"request"). Đổi tiền tố này = đổi bộ lọc phía CRM, phải báo hai bên.

import { topicLabel } from "@/lib/sdvico-catalog";

/** Tiền tố nhận diện yêu cầu đến từ app SDFish (phía CRM lọc theo cụm này). */
export const REQUEST_SOURCE_TAG = "[ForFish]";

/** Giới hạn độ dài để không đẩy câu quá dài sang CRM. */
export const PRODUCT_MAX = 120;
export const DETAIL_MAX = 500;

/**
 * Ráp `message` cho consultation_requests:
 *   "[ForFish] <nhãn chủ đề> · <tên sản phẩm> — <ghi chú>"
 * Sản phẩm/ghi chú rỗng thì bỏ vế tương ứng.
 */
export function buildRequestMessage(input: {
  topic?: string;
  productName?: string;
  detail?: string;
}): string {
  const product = (input.productName ?? "").trim().slice(0, PRODUCT_MAX);
  const detail = (input.detail ?? "").trim().slice(0, DETAIL_MAX);
  return (
    `${REQUEST_SOURCE_TAG} ${topicLabel(input.topic ?? "khac")}` +
    (product ? ` · ${product}` : "") +
    (detail ? ` — ${detail}` : "")
  );
}
