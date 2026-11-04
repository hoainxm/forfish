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
import type { Vai } from "./vai";

export type DockId = "trang-chu" | "kairos" | "ban-do" | "tau-toi" | "viec-lam" | "cho-ca" | "vat-tu" | "ban-hang";

export type DockMuc = { id: DockId; href: string; label: string };

/** Mọi ô có thể có. Tên mục (aria-label) lấy từ bảng nhãn chuẩn — labels.test gác ≤2 chữ. */
const MUC: Record<DockId, DockMuc> = {
  "trang-chu": { id: "trang-chu", href: "/", label: NHAN.trangChu },
  kairos: { id: "kairos", href: "/kairos", label: NHAN.kairos },
  "ban-do": { id: "ban-do", href: "/ngu-truong", label: NHAN.banDo },
  "tau-toi": { id: "tau-toi", href: "/tau", label: NHAN.tauToi },
  "viec-lam": { id: "viec-lam", href: "/viec", label: NHAN.viecLam },
  "cho-ca": { id: "cho-ca", href: "/tien", label: NHAN.choCa },
  "vat-tu": { id: "vat-tu", href: "/cho", label: NHAN.vatTu },
  "ban-hang": { id: "ban-hang", href: "/ban-hang", label: NHAN.banHang },
};

/** MỌI ô có thể có trên dock của bất kỳ vai nào — app-shell dùng để biết màn nào "thuộc dock" (vẽ dock, chừa đáy). */
export const MOI_O_DOCK: readonly DockMuc[] = Object.values(MUC);

/** Dock mặc định (khách, chủ tàu, chưa chọn vai) — y như trước khi có vai. */
export const DOCK: readonly DockMuc[] = ["trang-chu", "kairos", "ban-do", "tau-toi", "cho-ca", "vat-tu"].map(
  (id) => MUC[id as DockId],
);

/*
  DOCK THEO VAI (spec 17 §4.1, 2026-11-03). Vai quyết định có những ô nào; ô Bản đồ của đi bạn / thu mua / đại lý chỉ có
  khi có gói (`banDo` = lib/vai coBanDo). Chủ tàu + chưa chọn vai + khách: DOCK mặc định, không đổi.
    · Đi bạn  : Trang chủ · Kairos · [Bản đồ] · Việc làm · Chợ cá · Vật tư
    · Thu mua : Trang chủ · Kairos · [Bản đồ] · Chợ cá · Vật tư
    · Đại lý  : Trang chủ · Kairos · [Bản đồ] · Bán hàng · Vật tư
  Bản đồ LUÔN ô thứ 3 khi có (khuôn tab bar cố định của Imou/TPLink — đổi vai/gói không phải học lại chỗ ô).
  Ô bị bỏ khỏi dock vẫn mở được bằng route.
*/
export function dockTheoVai(vai: Vai | null, banDo: boolean): readonly DockMuc[] {
  const ids: DockId[] =
    vai === "ngu-dan"
      ? ["trang-chu", "kairos", "ban-do", "viec-lam", "cho-ca", "vat-tu"]
      : vai === "thu-mua"
        ? ["trang-chu", "kairos", "ban-do", "cho-ca", "vat-tu"]
        : vai === "dai-ly"
          ? ["trang-chu", "kairos", "ban-do", "ban-hang", "vat-tu"]
          : ["trang-chu", "kairos", "ban-do", "tau-toi", "cho-ca", "vat-tu"];
  return ids
    .filter((id) => id !== "ban-do" || banDo)
    // thu mua: Chợ cá mở thẳng mục Mua bán (tin bán của bà con) thay vì bảng giá — spec 17 §12.4
    .map((id) => (vai === "thu-mua" && id === "cho-ca" ? { ...MUC[id], href: "/tien?muc=tin" } : MUC[id]));
}

/* Khu route của từng ô. Thứ tự quan trọng: `/ban-hang` thuộc ô Bán hàng nếu dock có ô đó, không thì về Vật tư. */
const KHU: readonly [DockId, readonly string[]][] = [
  ["kairos", ["/kairos", "/k"]],
  ["ban-do", ["/ngu-truong", "/hai-do", "/cang", "/lo-trinh"]], // /hai-do = chế độ Hải đồ (2026-11-04)
  ["tau-toi", ["/tau", "/nguoi", "/giay-to", "/van-hanh", "/thuyen-vien"]],
  ["viec-lam", ["/viec"]],
  ["cho-ca", ["/tien", "/gia-ca"]],
  ["ban-hang", ["/ban-hang"]],
  ["vat-tu", ["/cho", "/ban-hang"]],
];

const trong = (p: string, goc: string) => p === goc || p.startsWith(`${goc}/`);

/**
 * Bấm ô "Bản đồ" khi ĐANG ở chế độ Hải đồ ⇒ về bản đồ thường (tắt `moHaiDo`). Không có luật này thì Link
 * đi `/ngu-truong`, `ChuyenHaiDo` thấy cờ còn bật lại đẩy về `/hai-do` — bấm như không (anh Long 2026-11-04:
 * "chuyển lại ko được"). Lần sau dock mở kiểu bà con dùng CUỐI CÙNG.
 */
export function boHaiDoKhiBam(id: DockId, pathname: string): boolean {
  return id === "ban-do" && trong(pathname || "/", "/hai-do");
}

/**
 * Mục dock đang sáng ở `pathname`, trong số ô `co` đang có trên dock (mặc định: DOCK). null = màn không thuộc ô nào
 * đang hiện (đăng nhập, pháp lý, hay route của ô vai này không có — vd chủ tàu mở /viec).
 */
export function dockActive(pathname: string, co: readonly DockMuc[] = DOCK): DockId | null {
  const p = pathname || "/";
  if (p === "/") return "trang-chu";
  const coId = new Set(co.map((m) => m.id));
  for (const [id, goc] of KHU) if (coId.has(id) && goc.some((g) => trong(p, g))) return id;
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
  // ô Bán hàng (đại lý — spec 17 §4.1) nhận số đơn chờ; khi dock có ô đó thì Vật tư vẫn đếm như cũ (giỏ khi không có đơn)
  const n =
    id === "kairos"
      ? s.kairosChuaDoc
      : id === "ban-hang"
        ? s.donChoBan
        : id === "vat-tu"
          ? s.donChoBan > 0
            ? s.donChoBan
            : s.gioDong
          : 0;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/** Đuôi nối vào aria-label của ô khi có badge ("Kairos, 3 chưa đọc"); "" khi không. */
export function nhanBadgeDock(id: DockId, s: NguonBadge): string {
  const n = dockBadge(id, s);
  if (!n) return "";
  if (id === "kairos") return `, ${n} chưa đọc`;
  if (id === "ban-hang") return `, ${n} đơn chờ`;
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
