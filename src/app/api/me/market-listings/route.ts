// /api/me/market-listings — CHỢ TIN MUA/BÁN (2026-08-16, thẩm định P0).
//   GET:  tin đang mở của cả làng + tin của chính người gọi (kể cả đã đóng).
//   POST: đăng tin mới, đứng tên SĐT của người gọi.
//
// VÌ SAO CÓ ROUTE NÀY: bảng `market_listings` (0008) dựng RLS trên `auth.uid()`,
// kể cả chiều ĐỌC. Từ 0026 app ngư dân không giữ phiên Supabase nữa (device
// token), nên `auth.uid()` luôn NULL ⇒ client gọi thẳng Supabase thì KHÔNG đọc
// được tin thật và KHÔNG đăng được tin nào. Nay đi qua đây: định danh bằng
// `identityFromRequest`, ghi/đọc bằng service-role, chủ tin là `owner_phone`
// (migration 0035) — cùng khuôn `/api/me/orders`.
//
// Online-only (SW bỏ qua POST và không cache /api/me/*): chợ tin là chuyện ở
// bờ, không có lời hứa offline nào ở đây. Client báo thật khi mất sóng.
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { identityFromRequest } from "@/lib/api-identity";
import { normalizeVnPhone } from "@/lib/phone";
import {
  LISTING_COLS,
  rowToMarketListing,
  validateDraft,
  type ListingDraft,
  type ListingRow,
} from "@/lib/market-listings";

const err = (status: number, code: string) =>
  NextResponse.json({ ok: false, code }, { status });

export async function GET(req: Request) {
  /*  ⚠️ ĐÒI ĐĂNG NHẬP — KHÔNG `anonymous` (sửa 2026-08-18, thẩm định P1).
      LỖI DO CHÍNH BẢN VÁ TRƯỚC ĐẺ RA: khi chuyển chợ tin từ Supabase-client
      sang route service-role, tôi để `anonymous: true` cho "khách cũng xem
      được chợ". Nhưng bảng này có cột `phone` — SĐT THẬT của người đăng, và
      route trả thẳng ra. RLS cũ (0008) đòi `auth.uid() is not null` ở CHIỀU
      ĐỌC đúng vì lý do đó; service-role bypass RLS nên ranh giới ấy nằm hết ở
      đây. Kết quả: bất kỳ ai không đăng nhập cũng quét được danh bạ SĐT của cả
      làng — nới quyền riêng tư mà không ai duyệt.
      Nay giữ nguyên ranh giới cũ: chưa đăng nhập → 401, client hiện TIN MẪU +
      mời đăng nhập (đúng hành vi trước 2026-08-16). Muốn mở công khai thì phải
      là quyết định sản phẩm có duyệt, và lúc đó phải CẮT `phone` khỏi payload
      cho khách, không phải bỏ cổng. */
  const who = await identityFromRequest(req);
  if (!who.ok) return who.res;
  if (!who.phone) return err(401, "login_required");

  const admin = createAdminClient();
  if (!admin) return err(503, "not_configured");

  const { data, error } = await admin
    .from("market_listings")
    .select(LISTING_COLS)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return err(500, "query_failed");

  /*  LỌC Ở SERVER, KHÔNG Ở CLIENT: tin đã ĐÓNG của người khác không có lý do gì
      rời khỏi máy chủ. Client cũ lọc `status==='open' || mine` sau khi đã nhận
      hết — nay cắt ngay từ đây. */
  const listings = (data ?? [])
    .map((r) => rowToMarketListing(r as ListingRow, who.phone))
    .filter((l) => l.status === "open" || l.mine);

  return NextResponse.json({ ok: true, listings });
}

export async function POST(req: Request) {
  const who = await identityFromRequest(req);
  if (!who.ok) return who.res;
  if (!who.phone) return err(401, "login_required");

  const admin = createAdminClient();
  if (!admin) return err(503, "not_configured");

  const body = (await req.json().catch(() => null)) as ListingDraft | null;
  if (!body) return err(400, "bad_body");
  const draft: ListingDraft = {
    side: body.side,
    posterKind: body.posterKind,
    posterName: String(body.posterName ?? ""),
    species: String(body.species ?? ""),
    quantity: body.quantity,
    priceText: body.priceText,
    province: body.province,
    phone: body.phone,
    note: body.note,
  };
  if (validateDraft(draft)) return err(400, "invalid_draft");

  /*  SĐT LIÊN HỆ mặc định là SĐT tài khoản — bà con để trống thì cả làng vẫn
      gọi được, đó là điểm sống của chợ tin. Gõ số khác (số vựa, số người nhà)
      thì tôn trọng số đã gõ. */
  const phone = draft.phone?.trim()
    ? normalizeVnPhone(draft.phone)
    : who.phone;

  const { data, error } = await admin
    .from("market_listings")
    .insert({
      owner_phone: who.phone,
      side: draft.side,
      poster_kind: draft.posterKind,
      poster_name: draft.posterName.trim(),
      species: draft.species.trim(),
      quantity: draft.quantity?.trim() || null,
      price_text: draft.priceText?.trim() || null,
      province: draft.province?.trim() || null,
      phone,
      note: draft.note?.trim() || null,
    })
    .select("id")
    .maybeSingle();
  if (error) return err(500, "insert_failed");

  return NextResponse.json({ ok: true, id: data?.id });
}
