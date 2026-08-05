// /api/market-listings — CHỢ TIN MUA/BÁN (trục GIAO DỊCH).
//
// VÌ SAO CÓ ROUTE NÀY (2026-08-05): app bỏ phiên Supabase sau bản chuỗi-cứng
// (0037) nên `auth.uid()` NULL vĩnh viễn — client-direct + RLS auth.uid() chết
// cả đọc lẫn ghi (người đăng nhập vẫn bị "Cần đăng nhập"). Nay đi qua server
// bằng service-role + chuỗi cứng (identityFromRequest), định danh theo SĐT
// (owner_phone, migration 0043). Xem docs/app-map/02-architecture.md.
//
// GET  = feed: mọi tin 'open' + tin của mình (kể cả 'closed'). Khách vãng lai
//        (chưa đăng nhập) vẫn xem được tin đang mở (chợ là để cả làng cùng xem).
// POST = đăng tin mới, đứng tên SĐT tài khoản đang đăng nhập.
//
// ⚠️ KHÔNG cache ở service worker: GET gắn danh tính (cờ `mine`). Không nằm
// trong API_CACHE_ALLOW của sw.js.
import { NextResponse } from "next/server";
import { identityFromRequest } from "@/lib/api-identity";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeVnPhone } from "@/lib/phone";
import {
  rowToListing,
  validateDraft,
  type ListingSide,
  type PosterKind,
  type Row,
} from "@/lib/market-listings-core";

const TABLE = "market_listings";
/** Bao nhiêu tin gần nhất — đủ cho chợ một vùng, không phình vô hạn. */
const MAX_LISTINGS = 100;

const SELECT =
  "id,owner_phone,side,poster_kind,poster_name,species,quantity,price_text,province,phone,note,status,created_at";

const err = (status: number, code: string) =>
  NextResponse.json({ ok: false, code }, { status });

export async function GET(req: Request) {
  // anonymous=true: khách vãng lai vẫn thấy tin 'open'; chuỗi bị thu hồi vẫn 401.
  const who = await identityFromRequest(req, true);
  if (!who.ok) return who.res;
  const myPhone = who.phone ? normalizeVnPhone(who.phone) : null;

  const admin = createAdminClient();
  if (!admin) return err(503, "unavailable");

  // Tin đang mở cho mọi người + tin của mình (kể cả đã đóng). Lọc phía SERVER
  // theo SĐT — client không tự khai mình là ai.
  let q = admin.from(TABLE).select(SELECT);
  q = myPhone ? q.or(`status.eq.open,owner_phone.eq.${myPhone}`) : q.eq("status", "open");
  const { data, error } = await q
    .order("created_at", { ascending: false })
    .limit(MAX_LISTINGS);
  if (error) return err(500, "query_failed");

  return NextResponse.json({
    ok: true,
    listings: (data as Row[]).map((r) => rowToListing(r, myPhone)),
  });
}

export async function POST(req: Request) {
  const who = await identityFromRequest(req);
  if (!who.ok) return who.res;
  const ownerPhone = normalizeVnPhone(who.phone);

  const body = (await req.json().catch(() => null)) as {
    side?: string;
    posterKind?: string;
    posterName?: string;
    species?: string;
    quantity?: string;
    priceText?: string;
    province?: string;
    phone?: string;
    note?: string;
  } | null;
  if (!body) return err(400, "bad_body");

  const draft = {
    side: body.side as ListingSide,
    posterKind: (body.posterKind ?? "ngu-dan") as PosterKind,
    posterName: (body.posterName ?? "").toString(),
    species: (body.species ?? "").toString(),
    quantity: body.quantity,
    priceText: body.priceText,
    province: body.province,
    phone: body.phone,
    note: body.note,
  };
  const invalid = validateDraft(draft);
  if (invalid) return err(400, "invalid");

  const admin = createAdminClient();
  if (!admin) return err(503, "unavailable");

  // SĐT liên hệ: bà con nhập gì lấy nấy; để trống thì lấy SĐT tài khoản.
  const contact =
    draft.phone && draft.phone.trim() ? normalizeVnPhone(draft.phone) : ownerPhone;

  const { error } = await admin.from(TABLE).insert({
    owner_phone: ownerPhone,
    side: draft.side,
    poster_kind: draft.posterKind,
    poster_name: draft.posterName.trim(),
    species: draft.species.trim(),
    quantity: draft.quantity?.trim() || null,
    price_text: draft.priceText?.trim() || null,
    province: draft.province?.trim() || null,
    phone: contact || null,
    note: draft.note?.trim() || null,
  });
  if (error) return err(500, "insert_failed");

  return NextResponse.json({ ok: true });
}
