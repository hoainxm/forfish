/*
  DOCK 5 MỤC — Trang chủ · Bản đồ · Tàu tôi · Chợ cá · Vật tư (chủ dự án chốt
  2026-10-19 sau rà design Codex). Thay dock cũ Trang chủ · Ra khơi · Tàu cá ·
  Bạn thuyền · Giao dịch, vốn chồng chéo: cửa hàng vật tư nằm cả trong Tàu cá
  (tab mặc định) lẫn sau Giao dịch, còn Bạn thuyền đứng riêng dù là sổ của chủ tàu.

  MỖI VIỆC MỘT CHỖ:
    · Tàu tôi  = hồ sơ tàu (/tau) + bạn thuyền (/nguoi) — sổ CHUNG của chủ tàu
    · Chợ cá   = giá cá, tin mua/bán, chỗ thu mua (/tien) — liên hệ trực tiếp
    · Vật tư   = mua đồ, giỏ, đơn mua (/cho) + kênh người bán (/ban-hang)
    · Bản đồ   = ngư trường + cảng/con nước (/cang)
  Sen Biển KHÔNG là mục dock: icon nổi ở mọi màn (bản đồ có bản riêng).

  Route cũ GIỮ NGUYÊN (deep-link nhắc việc, chip trợ lý, thông báo đẩy, tài liệu).
  Thuần (không React) để test được (dock-nav.test.ts).
*/

export type DockId = "trang-chu" | "ban-do" | "tau-toi" | "cho-ca" | "vat-tu";

export const DOCK: readonly { id: DockId; href: string; label: string }[] = [
  { id: "trang-chu", href: "/", label: "Trang chủ" },
  { id: "ban-do", href: "/ngu-truong", label: "Bản đồ" },
  { id: "tau-toi", href: "/tau", label: "Tàu tôi" },
  { id: "cho-ca", href: "/tien", label: "Chợ cá" },
  { id: "vat-tu", href: "/cho", label: "Vật tư" },
];

const KHU: readonly [DockId, readonly string[]][] = [
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
