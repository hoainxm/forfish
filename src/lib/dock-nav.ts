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

/*
  BADGE SỐ ĐỎ TRÊN DOCK (rà FB 2026-10-25, VO-APP-03 + K3-08 — QUYET-DINH mục A): CHỈ HAI Ô có người khác
  đang chờ mình — Kairos (tin chuông chưa đọc: ai bình luận/trả lời bài mình) và Vật tư (đơn chờ xác nhận
  của người bán; không có gian hàng thì số dòng giỏ chưa thanh toán). Trang chủ · Bản đồ · Tàu tôi · Chợ cá
  KHÔNG badge (Thông báo ở Trang chủ đã có số trong màn — badge thêm là đếm hai lần). Toàn bộ đọc kho máy,
  KHÔNG request; mất sóng số vẫn đúng với lần cuối có sóng. Chữ trên chấm: `nhanDem` của lib/kairos/chuong.ts.
*/
export type NguonBadge = {
  /** tin Kairos chưa đọc (cùng sổ với chuông: forfish.inbox.v2 + inbox.read.v1) */
  kairosChuaDoc: number;
  /** đơn chờ xác nhận của người bán (cờ forfish.mshop.v1 trường `pending`, khu bán hàng ghi) */
  donChoBan: number;
  /** số dòng giỏ vật tư (forfish.mcart.v1) */
  gioDong: number;
};

/** Số trên badge của một ô dock; 0 = không vẽ. */
export function dockBadge(id: DockId, s: NguonBadge): number {
  const n = id === "kairos" ? s.kairosChuaDoc : id === "vat-tu" ? (s.donChoBan > 0 ? s.donChoBan : s.gioDong) : 0;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/** Đuôi nối vào aria-label của ô khi có badge ("Kairos, 3 chưa đọc"); "" khi không. */
export function nhanBadgeDock(id: DockId, s: NguonBadge): string {
  const n = dockBadge(id, s);
  if (!n) return "";
  if (id === "kairos") return `, ${n} chưa đọc`;
  return s.donChoBan > 0 ? `, ${n} đơn chờ` : `, ${n} món trong giỏ`;
}

/**
 * Đơn chờ của người bán từ bản thô cờ `forfish.mshop.v1` (trường `pending` — khu bán hàng ghi khi mở
 * /ban-hang có sóng). Ngăn khác SĐT, JSON hỏng, chưa có gian hàng hay chưa có trường ⇒ 0. Không đi qua
 * `loadShopFlag` vì hàm đó cố ý chỉ giữ hasShop/status/at.
 */
export function donChoTuCo(raw: string | null | undefined, bucket: string): number {
  if (!raw) return 0;
  try {
    const s = JSON.parse(raw) as { phone?: unknown; hasShop?: unknown; pending?: unknown };
    if (!s || s.phone !== bucket || s.hasShop !== true) return 0;
    return typeof s.pending === "number" && Number.isFinite(s.pending) && s.pending > 0 ? Math.floor(s.pending) : 0;
  } catch {
    return 0;
  }
}

/** Sự kiện window để màn khác báo dock đọc lại kho (chuông báo đã đọc, kênh bán ghi `pending`…). */
export const DOCK_BADGE_EVENT = "forfish-dock-badge";
