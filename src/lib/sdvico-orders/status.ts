// Nhãn + màu + tab cho ĐƠN SDVICO — THUẦN. Màu dùng lại cặp token của chip đơn
// chợ (ORDER_STATUS_CHIP, không hex). Nhãn chip ≤2 chữ (labels.ts); câu đầy đủ
// dùng ở trang chi tiết.
import { ORDER_STATUS_CHIP } from "@/lib/market/order-state";
import { NHAN } from "@/lib/labels";
import type { SdvicoOrderStatus } from "./types";

export const SDVICO_STATUS_CHIP_LABEL: Record<SdvicoOrderStatus, string> = {
  dang_chuan_bi: NHAN.chuanBi,
  dang_giao: NHAN.dangGiao,
  da_giao: NHAN.daGiao,
  da_huy: NHAN.daHuy,
};

/** Câu trạng thái đầy đủ (trang chi tiết). */
export const SDVICO_STATUS_TEXT: Record<SdvicoOrderStatus, string> = {
  dang_chuan_bi: "Đang chuẩn bị hàng",
  dang_giao: "Đang giao hàng",
  da_giao: "Đã giao hàng",
  da_huy: "Đơn đã huỷ",
};

export const SDVICO_STATUS_CHIP: Record<SdvicoOrderStatus, { bg: string; fg: string }> = {
  dang_chuan_bi: ORDER_STATUS_CHIP.da_xac_nhan,
  dang_giao: ORDER_STATUS_CHIP.dang_giao,
  da_giao: ORDER_STATUS_CHIP.hoan_thanh,
  da_huy: ORDER_STATUS_CHIP.da_huy,
};

/**
 * Tab `/cho/don` cho đơn SDVICO — cùng nghĩa tab chợ: "Chờ nhận" = đã giao, chờ
 * khách bấm Đã nhận (đơn SDVICO không có thao tác đó ⇒ không vào tab này).
 */
export type BuyerOrderTab = "dang_xu_ly" | "cho_nhan" | "xong" | "huy";
export function sdvicoTab(status: SdvicoOrderStatus): BuyerOrderTab {
  return status === "da_giao" ? "xong" : status === "da_huy" ? "huy" : "dang_xu_ly";
}
