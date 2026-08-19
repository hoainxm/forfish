"use client";

// CHỢ TIN MUA/BÁN (trục GIAO DỊCH, user chốt 2026-07-27) — chủ tàu tự ĐĂNG
// tin bán / tin mua, cả làng cùng xem để gọi thẳng.
//
// ⚠️ ĐỔI 2026-08-05: KHÔNG còn client-direct Supabase. App bỏ phiên Supabase
// sau bản chuỗi-cứng (0037) nên `auth.uid()` NULL vĩnh viễn → RLS `auth.uid()`
// chết cả đọc lẫn ghi, người ĐANG đăng nhập vẫn bị "Cần đăng nhập để đăng tin".
// Nay đọc/ghi qua ROUTE server /api/market-listings bằng chuỗi cứng
// (authedFetch → identityFromRequest), định danh theo SĐT. Helper THUẦN (types,
// validateDraft, rowToListing) nằm ở market-listings-core.ts để route dùng lại.
//
// Chưa cấu hình Supabase / mất sóng → xem `ListingsRead`: hai ca đó PHẢI phân
// biệt được (2026-08-16, thẩm định P0). App đã lên thật (2026-07-29): KHÔNG bịa
// tin mẫu — chợ rỗng thì hiện empty state.

import { authedFetch } from "@/lib/device-token-store";
import { validateDraft } from "@/lib/market-listings-core";
import type { ListingDraft, MarketListing } from "@/lib/market-listings-core";

export {
  SIDE_LABEL,
  POSTER_KIND_LABEL,
  validateDraft,
  rowToListing,
} from "@/lib/market-listings-core";
export type {
  ListingSide,
  PosterKind,
  MarketListing,
  ListingDraft,
} from "@/lib/market-listings-core";

/** Ghi chờ tối đa bấy nhiêu rồi coi như hỏng (nút phải trả về cho bà con). */
const WRITE_TIMEOUT_MS = 20000;
const READ_TIMEOUT_MS = 12000;

/** Kết quả đọc chợ tin — phân biệt cho được "chưa có tin nào" với "chưa tải
 *  được". Gộp hai thứ đó là màn hình nói dối: mất sóng mà lại khoe danh sách
 *  rỗng kèm câu "chợ chưa ai đăng". */
export type ListingsRead =
  | { ok: true; listings: MarketListing[] }
  /*  `chua-dang-nhap` — route cho khách vãng lai đọc tin 'open', nên ca này chỉ
      xảy ra khi chuỗi cứng bị thu hồi. */
  | { ok: false; reason: "mang" | "chua-cau-hinh" | "chua-dang-nhap" };

/**
 * Tin đang mở của cả làng + tin của chính mình (server đã lọc).
 *
 * OFFLINE-AN TOÀN: authedFetch tự có timeout + nuốt lỗi mạng (res=null); mọi
 * nhánh hỏng đều trả `{ok:false}`, KHÔNG ném, KHÔNG treo quay vòng.
 */
export async function fetchListings(): Promise<ListingsRead> {
  const { res } = await authedFetch(
    "/api/market-listings",
    { method: "GET" },
    READ_TIMEOUT_MS,
  );
  if (!res) return { ok: false, reason: "mang" };
  const j = (await res.json().catch(() => null)) as
    | { ok?: boolean; code?: string; listings?: MarketListing[] }
    | null;
  if (res.ok && j?.ok && Array.isArray(j.listings)) {
    return { ok: true, listings: j.listings };
  }
  // 503 unavailable = chưa nối Supabase (demo mode) — KHÔNG phải mất sóng.
  if (res.status === 503 || j?.code === "unavailable" || j?.code === "not_configured")
    return { ok: false, reason: "chua-cau-hinh" };
  // 401 = chuỗi cứng hỏng/thu hồi — đừng báo "máy đang không có sóng" cho
  // người đang có sóng.
  if (res.status === 401) return { ok: false, reason: "chua-dang-nhap" };
  return { ok: false, reason: "mang" };
}

export async function createListing(
  d: ListingDraft,
): Promise<{ ok: boolean; error?: string }> {
  const err = validateDraft(d);
  if (err) return { ok: false, error: err };

  const { res } = await authedFetch(
    "/api/market-listings",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
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
  if (res.ok) return { ok: true };

  if (res.status === 401 || j?.code === "login_required" || j?.code === "no_token")
    return { ok: false, error: "Cần đăng nhập để đăng tin." };
  if (res.status === 503 || j?.code === "unavailable" || j?.code === "not_configured")
    return { ok: false, error: "Chưa gửi được — thử lại sau." };
  if (j?.code === "invalid")
    return { ok: false, error: "Kiểm tra lại thông tin tin đăng." };
  return { ok: false, error: "Đăng chưa được, thử lại." };
}

/** Đóng / mở lại tin. `false` = CHƯA đổi được (chỗ gọi phải báo, đừng im). */
export async function setListingStatus(
  id: string,
  status: "open" | "closed",
): Promise<boolean> {
  const { res } = await authedFetch(
    `/api/market-listings/${id}`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    },
    WRITE_TIMEOUT_MS,
  );
  return Boolean(res?.ok);
}

/** Xoá tin của mình. `false` = CHƯA xoá được (chỗ gọi phải báo, đừng im). */
export async function deleteListing(id: string): Promise<boolean> {
  const { res } = await authedFetch(
    `/api/market-listings/${id}`,
    { method: "DELETE" },
    WRITE_TIMEOUT_MS,
  );
  return Boolean(res?.ok);
}
