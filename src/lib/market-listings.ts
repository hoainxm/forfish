// CHỢ TIN MUA/BÁN (trục GIAO DỊCH, user chốt 2026-07-27) — chủ tàu tự ĐĂNG
// tin bán / tin mua, cả làng cùng xem để gọi thẳng.
//
// ⚠️ ĐỔI ĐƯỜNG ĐI 2026-08-16 (thẩm định P0 — DANH TÍNH TÁCH NÃO).
// Bản cũ gọi THẲNG Supabase browser client và tựa vào RLS `auth.uid()` (0008).
// Từ 0026 app không giữ phiên nữa (device token), nên `auth.uid()` luôn NULL:
//   · policy ĐỌC (`status='open' and auth.uid() is not null`) chặn hết ⇒ mọi
//     người dùng thật chỉ thấy TIN MẪU, tưởng chợ vắng;
//   · `createListing` hỏi `auth.getUser()` ⇒ luôn "Cần đăng nhập để đăng tin"
//     với đúng người đang đăng nhập.
// Nay mọi lượt đi qua route server `/api/me/market-listings` (identityFromRequest
// + service-role, chủ tin = `owner_phone`, migration 0035). File này chỉ còn
// hình dạng dữ liệu + helper thuần + lời gọi `authedFetch`.
//
// Helper thuần (validateDraft, rowToListing) tách riêng để test ở
// src/lib/__tests__/market-listings.test.ts.

import { authedFetch } from "@/lib/device-token-store";
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

/** Cột đọc từ `market_listings` — dùng CHUNG với route server (một danh sách,
 *  không hai bản chép tay). */
export const LISTING_COLS =
  "id,owner_phone,side,poster_kind,poster_name,species,quantity,price_text,province,phone,note,status,created_at";

export type ListingRow = {
  id: string;
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

const KINDS: PosterKind[] = ["ngu-dan", "nau", "vua", "nha-may", "cho"];

/** Dòng DB → MarketListing (khoan dung với giá trị lạ, không ném lỗi).
 *  `phone` = SĐT của NGƯỜI ĐANG GỌI (chuẩn hoá) để tính cờ `mine`; null/"" =
 *  khách chưa đăng nhập ⇒ không tin nào là của mình. */
export function rowToListing(
  r: ListingRow,
  viewerPhone: string | null,
): MarketListing {
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
    mine: Boolean(viewerPhone && r.owner_phone === viewerPhone),
  };
}

// ── Gọi route server (/api/me/market-listings) ─────────────────────────────

/*  ĐỒNG HỒ (giữ nguyên ý 2026-08-02h, nay do `authedFetch` cắm). Ca "sóng sống
    mà chết" ở cảng: không có trần thì nút kẹt "Đang đăng…" VĨNH VIỄN, bà con
    tưởng tin đã đăng, thật ra chưa, và mất chuyến bán. */
const READ_TIMEOUT_MS = 12000;
const WRITE_TIMEOUT_MS = 20000;

/** Kết quả đọc chợ tin — phân biệt cho được "chưa có tin nào" với "chưa tải
 *  được". Gộp hai thứ đó là màn hình nói dối: mất sóng mà lại khoe tin mẫu kèm
 *  câu "tin thật sẽ hiện khi bà con đăng". */
export type ListingsRead =
  | { ok: true; listings: MarketListing[] }
  /*  `chua-dang-nhap` — tin THẬT mang SĐT người đăng nên chỉ người có tài khoản
      mới đọc (ranh giới của RLS 0008, nay chốt ở route). Khách xem TIN MẪU. */
  | { ok: false; reason: "mang" | "chua-cau-hinh" | "chua-dang-nhap" };

/** Tin đang mở của cả làng + tin của chính mình (server đã lọc). */
export async function fetchListings(): Promise<ListingsRead> {
  const { res } = await authedFetch(
    "/api/me/market-listings",
    {},
    READ_TIMEOUT_MS,
  );
  if (!res) return { ok: false, reason: "mang" };
  const j = (await res.json().catch(() => null)) as
    | { ok?: boolean; code?: string; listings?: MarketListing[] }
    | null;
  if (res.ok && j?.ok && Array.isArray(j.listings)) {
    return { ok: true, listings: j.listings };
  }
  // 503 not_configured = demo mode (chưa nối Supabase) → UI hiện tin mẫu THẬT
  // thà (đúng bất biến demo mode), khác hẳn ca mất sóng.
  if (j?.code === "not_configured") return { ok: false, reason: "chua-cau-hinh" };
  // 401 = chưa đăng nhập (route đòi tài khoản vì tin thật mang SĐT) — KHÔNG
  // phải mất sóng, đừng báo "máy đang không có sóng" cho người đang có sóng.
  if (res.status === 401) return { ok: false, reason: "chua-dang-nhap" };
  return { ok: false, reason: "mang" };
}

export async function createListing(
  d: ListingDraft,
): Promise<{ ok: boolean; error?: string }> {
  const err = validateDraft(d);
  if (err) return { ok: false, error: err };

  const { res } = await authedFetch(
    "/api/me/market-listings",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(d),
    },
    WRITE_TIMEOUT_MS,
  );
  if (!res) {
    return { ok: false, error: "Chưa gửi được — máy chưa có sóng. Thử lại sau." };
  }
  const j = (await res.json().catch(() => null)) as
    | { ok?: boolean; code?: string }
    | null;
  if (res.ok && j?.ok) return { ok: true };
  if (j?.code === "login_required" || j?.code === "no_token")
    return { ok: false, error: "Cần đăng nhập để đăng tin." };
  if (j?.code === "not_configured")
    return { ok: false, error: "Chợ tin chưa mở trên máy chủ." };
  if (j?.code === "unavailable")
    return { ok: false, error: "Máy chủ đang bận — thử lại sau ít phút." };
  return { ok: false, error: "Đăng chưa được, thử lại." };
}

/** Đóng / mở lại tin. `false` = CHƯA đổi được (chỗ gọi phải báo, đừng im). */
export async function setListingStatus(
  id: string,
  status: "open" | "closed",
): Promise<boolean> {
  const { res } = await authedFetch(
    `/api/me/market-listings/${id}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    },
    WRITE_TIMEOUT_MS,
  );
  return Boolean(res?.ok);
}

/** Xoá tin của mình. `false` = CHƯA xoá được (chỗ gọi phải báo, đừng im). */
export async function deleteListing(id: string): Promise<boolean> {
  const { res } = await authedFetch(
    `/api/me/market-listings/${id}`,
    { method: "DELETE" },
    WRITE_TIMEOUT_MS,
  );
  return Boolean(res?.ok);
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
