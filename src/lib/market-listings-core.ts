// CHỢ TIN MUA/BÁN — HELPER THUẦN dùng chung CLIENT ↔ SERVER.
//
// Tách khỏi market-listings.ts (client, gọi authedFetch) để ROUTE server
// (/api/market-listings) tái dùng cùng một bộ luật map/validate mà không kéo
// theo code chỉ chạy ở trình duyệt. Chỉ import lib THUẦN (phone) — không fetch,
// không supabase, không window. Test ở src/lib/__tests__/market-listings.test.ts.

import { isValidVnPhone } from "@/lib/phone";

/** ban = chủ tàu có cá cần bán · mua = ai đó cần mua (chủ tàu hoặc đầu nậu). */
export type ListingSide = "mua" | "ban";
export type PosterKind = "ngu-dan" | "nau" | "vua" | "nha-may" | "cho";

export const SIDE_LABEL: Record<ListingSide, string> = {
  ban: "Cần bán",
  mua: "Cần mua",
};

export const POSTER_KIND_LABEL: Record<PosterKind, string> = {
  "ngu-dan": "Ngư dân",
  nau: "Nậu",
  vua: "Vựa / đại lý",
  "nha-may": "Nhà máy",
  cho: "Chợ đầu mối",
};

export interface MarketListing {
  id: string;
  side: ListingSide;
  posterKind: PosterKind;
  /** Tên hiển thị (tàu / vựa …) */
  posterName: string;
  species: string;
  quantity?: string;
  priceText?: string;
  province?: string;
  phone?: string;
  note?: string;
  status: "open" | "closed";
  /** ISO date ngày đăng */
  postedOn: string;
  /** true = tin của chính user đang đăng nhập (cho sửa/đóng/xóa) */
  mine?: boolean;
}

/** Phần chủ tàu nhập khi đăng tin. */
export interface ListingDraft {
  side: ListingSide;
  posterKind: PosterKind;
  posterName: string;
  species: string;
  quantity?: string;
  priceText?: string;
  province?: string;
  phone?: string;
  note?: string;
}

/** Ô nào sai — để form MỞ đúng nhóm ô đang thu và đặt câu lỗi ngay dưới ô
 *  (CC-02: trước đây câu "Nhập tên" nằm ở hàng đáy trong khi ô Tên đang ẩn). */
export type DraftField = "posterName" | "species" | "side" | "phone";

/** Lỗi đầu tiên theo thứ tự ô trên form; null nếu OK. */
export function validateDraftField(
  d: ListingDraft,
): { field: DraftField; message: string } | null {
  if (!d.posterName.trim())
    return { field: "posterName", message: "Nhập tên (tàu hoặc cơ sở)." };
  if (!d.species.trim()) return { field: "species", message: "Nhập loài cá." };
  if (d.side !== "mua" && d.side !== "ban")
    return { field: "side", message: "Chọn tin bán hay tin mua." };
  if (d.phone && d.phone.trim() && !isValidVnPhone(d.phone))
    return { field: "phone", message: "Số điện thoại chưa đúng." };
  return null;
}

/** Trả câu lỗi tiếng Việt nếu draft chưa hợp lệ, null nếu OK. */
export function validateDraft(d: ListingDraft): string | null {
  return validateDraftField(d)?.message ?? null;
}

/** Tiền tố id của tin VỪA ĐĂNG chưa kịp tải lại từ máy chủ (CC-05): thẻ hiện
 *  ngay, nhưng chưa có id thật nên chưa đóng/xoá được tới khi `refresh()` xong. */
export const TAM_ID_PREFIX = "tam-";

export function laTinTam(id: string): boolean {
  return id.startsWith(TAM_ID_PREFIX);
}

/** Dựng thẻ tin tại máy từ bản nháp vừa gửi THÀNH CÔNG — đúng luật route POST:
 *  trim, ô trống bỏ, SĐT trống thì lấy SĐT tài khoản, status open, mine.
 *  `idThat` = id máy chủ trả về ngay sau POST (2026-10-25) ⇒ thẻ có ⋯ luôn, không phải
 *  chờ tải lại; thiếu (máy chủ cũ) ⇒ id tạm có tiền tố. */
export function tinTamTuDraft(
  d: ListingDraft,
  opt: { id: string; accountPhone: string | null; today: string; idThat?: string | null },
): MarketListing {
  const trim = (s?: string) => (s && s.trim() ? s.trim() : undefined);
  return {
    id: opt.idThat && opt.idThat.trim() ? opt.idThat : TAM_ID_PREFIX + opt.id,
    side: d.side,
    posterKind: d.posterKind,
    posterName: d.posterName.trim(),
    species: d.species.trim(),
    quantity: trim(d.quantity),
    priceText: trim(d.priceText),
    province: trim(d.province),
    phone: trim(d.phone) ?? (opt.accountPhone || undefined),
    note: trim(d.note),
    status: "open",
    postedOn: opt.today,
    mine: true,
  };
}

export type Row = {
  id: string;
  /** SĐT chủ tin (định danh theo SĐT sau 0043). Cũ có thể còn owner_id, không đọc. */
  owner_phone: string | null;
  side: string;
  poster_kind: string;
  poster_name: string;
  species: string;
  quantity: string | null;
  price_text: string | null;
  province: string | null;
  phone: string | null;
  note: string | null;
  status: string | null;
  created_at: string;
};

export const KINDS: PosterKind[] = ["ngu-dan", "nau", "vua", "nha-may", "cho"];

/**
 * Dòng DB → MarketListing (khoan dung với giá trị lạ, không ném lỗi).
 * `myPhone` = SĐT tài khoản đang đăng nhập (đã chuẩn hoá) để đánh dấu tin của
 * mình. null = khách / chưa biết → mine=false.
 */
export function rowToListing(r: Row, myPhone: string | null): MarketListing {
  const side: ListingSide = r.side === "mua" ? "mua" : "ban";
  const posterKind = (KINDS as string[]).includes(r.poster_kind)
    ? (r.poster_kind as PosterKind)
    : "ngu-dan";
  return {
    id: r.id,
    side,
    posterKind,
    posterName: r.poster_name,
    species: r.species,
    quantity: r.quantity ?? undefined,
    priceText: r.price_text ?? undefined,
    province: r.province ?? undefined,
    phone: r.phone ?? undefined,
    note: r.note ?? undefined,
    status: r.status === "closed" ? "closed" : "open",
    postedOn: (r.created_at ?? "").slice(0, 10),
    mine: Boolean(myPhone && r.owner_phone === myPhone),
  };
}
