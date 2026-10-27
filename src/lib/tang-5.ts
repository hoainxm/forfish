/**
 * TẦNG 5 TRANG CHỦ — CHỌN MỘT KHỐI (quyết định D, rà FB 2026-10-25, TC-09/TC-11).
 *
 * Trang chủ chỉ có MỘT khối mời gọi dưới dải khẩn, chọn theo ƯU TIÊN CỐ ĐỊNH, không
 * luân phiên theo ngày (bà con thấy "hôm nay app nói khác hôm qua" là mất tin):
 *   1. Chọn cảng nhà — mở khoá khối to nhất của Trang chủ (Biển hôm nay + Con nước).
 *   2. Bật chuông báo bão — tầng 1 về nội dung, nhưng chỉ khi máy có push và đang tắt.
 *   3. Cài app — như cũ (iPhone chưa cài PWA thì không có push ⇒ Cài app tự lên thay).
 * Khối trên biến mất (đã làm / không áp dụng / đã Ẩn) thì khối dưới mới hiện.
 * NGOẠI LỆ (2026-10-27, anh Long: "thẻ cài app hiện song song với thẻ chọn cảng nhà"): khối "cang-nha" vẽ KÈM thẻ Cài app
 * (install-prompt KhoiTang5) — người mới chưa khai cảng nhà trước đây không bao giờ thấy lời mời cài.
 * Mất sóng ⇒ không khối nào (luật tầng 5 §12: mời vào ngõ cụt là vô ích).
 *
 * Nhắc chuông dùng CÙNG KHUÔN sổ với nhắc cài (`InstallNudgeState`, khoá riêng
 * `forfish.chuongNudge.v1`): ≤3 lần, mỗi lần cách ≥7 ngày, "Ẩn" = hoãn 7 ngày.
 */

import { INSTALL_NUDGE_MAX, type InstallNudgeState } from "@/lib/install-nudge";

export const CHUONG_NUDGE_KEY = "forfish.chuongNudge.v1";
/** Hai lần nhắc chuông cách nhau ít nhất bấy nhiêu (dài hơn nhắc cài 1 ngày: tin bão là việc lớn, nhắc dày là nài). */
export const CHUONG_NUDGE_GAP_MS = 7 * 24 * 60 * 60 * 1000;

export type KhoiTang5 = "cang-nha" | "chuong" | "cai-app" | null;

export type TrangThaiTang5 = {
  online: boolean;
  /** đã có cảng nhà / cảng dự báo để Biển hôm nay hiện được */
  coCangNha: boolean;
  /** máy có Web Push (serviceWorker + PushManager) */
  pushHoTro: boolean;
  /** "off" = chưa đăng ký trên máy này; "on" = đã bật; "unknown" = chưa tra xong */
  pushState: "off" | "on" | "unknown";
  /** sổ nhắc chuông (khoá CHUONG_NUDGE_KEY) */
  chuongNudge: InstallNudgeState;
  /** thẻ Cài app còn hiện được (chưa cài standalone…) — thẻ tự quyết phần còn lại */
  caiAppHienDuoc: boolean;
  now: number;
};

/** Lần này có nên nhắc bật chuông không — THUẦN, cùng dạng `shouldShowInstallNudge`. */
export function nenNhacChuong(s: InstallNudgeState, now: number): boolean {
  if (s.dismissed) return false;
  if (s.count >= INSTALL_NUDGE_MAX) return false;
  if (s.snoozeUntil != null && now < s.snoozeUntil) return false;
  if (s.lastAt != null && now - s.lastAt < CHUONG_NUDGE_GAP_MS) return false;
  return true;
}

/** Khối tầng 5 nào hiện — THUẦN. */
export function chonKhoiTang5(t: TrangThaiTang5): KhoiTang5 {
  if (!t.online) return null;
  if (!t.coCangNha) return "cang-nha";
  if (t.pushHoTro && t.pushState === "off" && nenNhacChuong(t.chuongNudge, t.now)) return "chuong";
  if (t.caiAppHienDuoc) return "cai-app";
  return null;
}
