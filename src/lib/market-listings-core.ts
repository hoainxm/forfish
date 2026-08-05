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

/** Trả câu lỗi tiếng Việt nếu draft chưa hợp lệ, null nếu OK. */
export function validateDraft(d: ListingDraft): string | null {
  if (!d.posterName.trim()) return "Nhập tên (tàu hoặc cơ sở).";
  if (!d.species.trim()) return "Nhập loài cá.";
  if (d.side !== "mua" && d.side !== "ban") return "Chọn tin bán hay tin mua.";
  if (d.phone && d.phone.trim() && !isValidVnPhone(d.phone))
    return "Số điện thoại chưa đúng.";
  return null;
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
