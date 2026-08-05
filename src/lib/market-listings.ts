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
// Chưa cấu hình Supabase / mất sóng → fetch trả null; UI hiện empty state. App
// đã lên thật (2026-07-29): KHÔNG bịa tin mẫu.

import { authedFetch } from "@/lib/device-token-store";
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

/**
 * Tin thật (đang mở + tin của mình). null = chưa cấu hình / mất sóng / lỗi →
 * caller hiện empty state. Mảng rỗng = đã cấu hình nhưng chưa có tin nào.
 *
 * OFFLINE-AN TOÀN: authedFetch tự có timeout + nuốt lỗi mạng (res=null); mọi
 * nhánh hỏng đều trả null, KHÔNG ném, KHÔNG treo quay vòng.
 */
export async function fetchListings(): Promise<MarketListing[] | null> {
  const { res } = await authedFetch(
    "/api/market-listings",
    { method: "GET" },
    READ_TIMEOUT_MS,
  );
  if (!res || !res.ok) return null;
  const j = (await res.json().catch(() => null)) as
    | { ok?: boolean; listings?: MarketListing[] }
    | null;
  if (!j?.ok || !Array.isArray(j.listings)) return null;
  return j.listings;
}

export async function createListing(
  d: ListingDraft,
): Promise<{ ok: boolean; error?: string }> {
  const { res } = await authedFetch(
    "/api/market-listings",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(d),
    },
    WRITE_TIMEOUT_MS,
  );
  if (!res) return { ok: false, error: "Chưa gửi được — máy chưa có sóng. Thử lại sau." };
  if (res.ok) return { ok: true };

  const code = ((await res.json().catch(() => null)) as { code?: string } | null)?.code;
  if (res.status === 401) return { ok: false, error: "Cần đăng nhập để đăng tin." };
  if (res.status === 503) return { ok: false, error: "Chưa gửi được — thử lại sau." };
  if (code === "invalid") return { ok: false, error: "Kiểm tra lại thông tin tin đăng." };
  return { ok: false, error: "Đăng chưa được, thử lại." };
}

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

export async function deleteListing(id: string): Promise<boolean> {
  const { res } = await authedFetch(
    `/api/market-listings/${id}`,
    { method: "DELETE" },
    WRITE_TIMEOUT_MS,
  );
  return Boolean(res?.ok);
}
