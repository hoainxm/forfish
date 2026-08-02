// CHỢ TIN MUA/BÁN (trục GIAO DỊCH, user chốt 2026-07-27) — chủ tàu tự ĐĂNG
// tin bán / tin mua, cả làng cùng xem để gọi thẳng. Ghi/đọc bảng Supabase
// `market_listings` (migration 0008, RLS owner-write / signed-in-read).
//
// Chưa cấu hình Supabase hoặc chưa đăng nhập → fetch trả null/[] và UI rơi về
// DEMO_LISTINGS (tin mẫu minh họa) — KHÔNG bao giờ bịa tin thật.
//
// Helper thuần (validateDraft, rowToListing) tách riêng để test ở
// src/lib/__tests__/market-listings.test.ts.

import { createClient } from "@/lib/supabase/client";
import { isValidVnPhone, normalizeVnPhone } from "@/lib/phone";
import { isNetworkAuthError, withDeadline } from "@/lib/auth-error";

const TABLE = "market_listings";

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
  /** true = tin mẫu minh họa, UI phải ghi rõ */
  demo?: boolean;
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

// ── Helper THUẦN (test được) ───────────────────────────────────────────────

/** Trả câu lỗi tiếng Việt nếu draft chưa hợp lệ, null nếu OK. */
export function validateDraft(d: ListingDraft): string | null {
  if (!d.posterName.trim()) return "Nhập tên (tàu hoặc cơ sở).";
  if (!d.species.trim()) return "Nhập loài cá.";
  if (d.side !== "mua" && d.side !== "ban") return "Chọn tin bán hay tin mua.";
  if (d.phone && d.phone.trim() && !isValidVnPhone(d.phone))
    return "Số điện thoại chưa đúng.";
  return null;
}

type Row = {
  id: string;
  owner_id: string | null;
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

const KINDS: PosterKind[] = ["ngu-dan", "nau", "vua", "nha-may", "cho"];

/** Dòng DB → MarketListing (khoan dung với giá trị lạ, không ném lỗi). */
export function rowToListing(r: Row, uid: string | null): MarketListing {
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
    mine: Boolean(uid && r.owner_id === uid),
  };
}

// ── CRUD Supabase ──────────────────────────────────────────────────────────

/**
 * Tin thật (đang mở + tin của mình). null = Supabase chưa cấu hình hoặc lỗi →
 * caller rơi về DEMO_LISTINGS. Mảng rỗng = đã cấu hình nhưng chưa có tin nào.
 */
export async function fetchListings(): Promise<MarketListing[] | null> {
  const supabase = createClient();
  if (!supabase) return null;
  /* ĐỒNG HỒ CHO CẢ HAI CÚ (D-PH9, soát 2026-08-02): không có trần thì ở sóng
     "sống mà chết" chợ tin kẹt `loading = true` VĨNH VIỄN — không bao giờ hiện
     "Chưa có tin nào", bà con ngồi nhìn tin mẫu tưởng chợ chỉ có bấy nhiêu.
     `getUser()` không nhận AbortSignal nên phải bọc đồng hồ ngoài; hết giờ chỉ
     mất cờ "tin của tôi", danh sách vẫn hiện. */
  const userRes = await withDeadline(supabase.auth.getUser(), 8000);
  const uid = userRes?.data?.user?.id ?? null;
  const { data, error } = await supabase
    .from(TABLE)
    .select(
      "id,owner_id,side,poster_kind,poster_name,species,quantity,price_text,province,phone,note,status,created_at",
    )
    .order("created_at", { ascending: false })
    .limit(100)
    .abortSignal(AbortSignal.timeout(12000));
  if (error || !data) return null;
  return (data as Row[]).map((r) => rowToListing(r, uid));
}

export async function createListing(
  d: ListingDraft,
): Promise<{ ok: boolean; error?: string }> {
  const err = validateDraft(d);
  if (err) return { ok: false, error: err };

  const supabase = createClient();
  if (!supabase) return { ok: false, error: "Chưa kết nối máy chủ." };

  // getUser() RESOLVE kèm `error` khi mất sóng (không reject) — bỏ `error` thì
  // người ĐANG đăng nhập bị báo "cần đăng nhập" chỉ vì sóng chập chờn. Nói đúng
  // chuyện: chưa gửi được vì sóng, không phải vì tài khoản.
  // Đồng hồ 8 giây: `getUser()` treo được (không nhận AbortSignal) ⇒ nút "Đăng
  // tin" kẹt mãi. Hết giờ = cũng là chuyện SÓNG, nói đúng như vậy.
  const authRes = await withDeadline(supabase.auth.getUser(), 8000);
  if (!authRes) {
    return { ok: false, error: "Chưa gửi được — máy chưa có sóng. Thử lại sau." };
  }
  const { data: userData, error: authError } = authRes;
  const user = userData?.user;
  if (!user && isNetworkAuthError(authError)) {
    return { ok: false, error: "Chưa gửi được — máy chưa có sóng. Thử lại sau." };
  }
  if (!user) return { ok: false, error: "Cần đăng nhập để đăng tin." };

  const phone =
    d.phone && d.phone.trim()
      ? normalizeVnPhone(d.phone)
      : (user.email?.split("@")[0] ?? null);

  const { error } = await supabase.from(TABLE).insert({
    owner_id: user.id,
    side: d.side,
    poster_kind: d.posterKind,
    poster_name: d.posterName.trim(),
    species: d.species.trim(),
    quantity: d.quantity?.trim() || null,
    price_text: d.priceText?.trim() || null,
    province: d.province?.trim() || null,
    phone,
    note: d.note?.trim() || null,
  });
  if (error) return { ok: false, error: "Đăng chưa được, thử lại." };
  return { ok: true };
}

export async function setListingStatus(
  id: string,
  status: "open" | "closed",
): Promise<boolean> {
  const supabase = createClient();
  if (!supabase) return false;
  const { error } = await supabase
    .from(TABLE)
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  return !error;
}

export async function deleteListing(id: string): Promise<boolean> {
  const supabase = createClient();
  if (!supabase) return false;
  const { error } = await supabase.from(TABLE).delete().eq("id", id);
  return !error;
}

// ── TIN MẪU minh họa (khi chưa có tin thật) ────────────────────────────────
// Không SĐT thật, UI ghi rõ "TIN MẪU". KHÔNG được bịa tin thật.
export const DEMO_LISTINGS: MarketListing[] = [
  {
    id: "demo-ml-sell-1",
    side: "ban",
    posterKind: "ngu-dan",
    posterName: "Tàu bà con (tin mẫu)",
    species: "Cá ngừ đại dương",
    quantity: "~1,2 tấn, câu tay, ướp đá chuẩn",
    priceText: "Muốn 130 nghìn/kg trở lên",
    province: "Khánh Hòa",
    note: "Về bến Hòn Rớ sáng mai, ai lấy cả lô gọi sớm.",
    status: "open",
    postedOn: "2026-07-26",
    demo: true,
  },
  {
    id: "demo-ml-buy-1",
    side: "mua",
    posterKind: "nha-may",
    posterName: "Nhà máy chế biến (tin mẫu)",
    species: "Cá ngừ sọc dưa",
    quantity: "Cần đều ~3 tấn/ngày",
    priceText: "Giá theo chợ, cộng thêm cho cá ướp đá chuẩn",
    province: "Khánh Hòa",
    note: "Yêu cầu cá ướp đá ngay khi lên khoang.",
    status: "open",
    postedOn: "2026-07-25",
    demo: true,
  },
  {
    id: "demo-ml-buy-2",
    side: "mua",
    posterKind: "vua",
    posterName: "Vựa hải sản (tin mẫu)",
    species: "Mực ống",
    quantity: "500 kg – 1 tấn/chuyến",
    priceText: "Báo giá theo ngày, ứng tổn cho mối quen",
    province: "Bà Rịa - Vũng Tàu",
    status: "open",
    postedOn: "2026-07-24",
    demo: true,
  },
];
