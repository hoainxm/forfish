/*
  DOCK 6 MỤC — Trang chủ · Kairos · Bản đồ · Tàu tôi · Chợ cá · Vật tư. Năm mục chốt
  2026-10-19 sau rà design Codex; anh Long thêm Kairos (đọc báo + mạng xã hội của bà
  con, 14-ba-spec-kairos §3.1) 2026-10-23 — đứng NGAY SAU Trang chủ. Thay dock cũ Trang chủ · Ra khơi · Tàu cá ·
  Bạn thuyền · Giao dịch, vốn chồng chéo: cửa hàng vật tư nằm cả trong Tàu cá
  (tab mặc định) lẫn sau Giao dịch, còn Bạn thuyền đứng riêng dù là sổ của chủ tàu.

  MỖI VIỆC MỘT CHỖ:
    · Tàu tôi  = hồ sơ tàu (/tau) + bạn thuyền (/nguoi) — sổ CHUNG của chủ tàu
    · Chợ cá   = giá cá, tin mua/bán, chỗ thu mua (/tien) — liên hệ trực tiếp
    · Vật tư   = mua đồ, giỏ, đơn mua (/cho) + kênh người bán (/ban-hang)
    · Bản đồ   = ngư trường + cảng/con nước (/cang)
    · Kairos   = dòng tin (/kairos) + trang công khai một bài (/k/[id])
  Sen Biển KHÔNG là mục dock: icon nổi ở mọi màn (bản đồ có bản riêng).

  Route cũ GIỮ NGUYÊN (deep-link nhắc việc, chip trợ lý, thông báo đẩy, tài liệu).
  Thuần (không React) để test được (dock-nav.test.ts).
*/

import { NHAN } from "./labels";

export type DockId = "trang-chu" | "kairos" | "ban-do" | "tau-toi" | "cho-ca" | "vat-tu";

/** Tên mục (aria-label) lấy từ bảng nhãn chuẩn — labels.test gác ≤2 chữ. */
export const DOCK: readonly { id: DockId; href: string; label: string }[] = [
  { id: "trang-chu", href: "/", label: NHAN.trangChu },
  { id: "kairos", href: "/kairos", label: NHAN.kairos },
  { id: "ban-do", href: "/ngu-truong", label: NHAN.banDo },
  { id: "tau-toi", href: "/tau", label: NHAN.tauToi },
  { id: "cho-ca", href: "/tien", label: NHAN.choCa },
  { id: "vat-tu", href: "/cho", label: NHAN.vatTu },
];

const KHU: readonly [DockId, readonly string[]][] = [
  ["kairos", ["/kairos", "/k"]],
  ["ban-do", ["/ngu-truong", "/cang"]],
  ["tau-toi", ["/tau", "/nguoi", "/giay-to", "/van-hanh", "/thuyen-vien"]],
  ["cho-ca", ["/tien", "/gia-ca"]],
  ["vat-tu", ["/cho", "/ban-hang"]],
];

const trong = (p: string, goc: string) => p === goc || p.startsWith(`${goc}/`);

/** Mục dock đang sáng ở `pathname`; null = màn không thuộc mục nào (đăng nhập, pháp lý…). */
export function dockActive(pathname: string): DockId | null {
  const p = pathname || "/";
  if (p === "/") return "trang-chu";
  for (const [id, goc] of KHU) if (goc.some((g) => trong(p, g))) return id;
  return null;
}
