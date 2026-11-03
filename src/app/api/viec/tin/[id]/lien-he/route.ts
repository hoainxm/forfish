// GET /api/viec/tin/[id]/lien-he — SĐT CHỦ TIN TUYỂN (spec 17 §5: "Xem SĐT trong tin tuyển — đã đăng nhập, mọi vai").
// Chưa đăng nhập ⇒ 401 (identityFromRequest — app mời đăng nhập). Tin bị ẩn ⇒ 404. Trần mở số theo SĐT người xem
// (chống cào danh bạ chủ tàu).
import { NextResponse } from "next/server";
import { identityFromRequest } from "@/lib/api-identity";
import { normalizeVnPhone } from "@/lib/phone";
import { allowRequest, type RateStore } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { cauLoi, isUuidLike } from "@/lib/viec";
import { unavailable, vErr } from "@/lib/viec-server";

// nợ: đếm bộ nhớ một instance (lib/rate-limit) — chuyển sang bảng đếm chung khi thấy cào số trong log.
const RATE: RateStore = new Map();
const PER_10_MIN = { limit: 60, windowMs: 10 * 60 * 1000 };

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const who = await identityFromRequest(req);
  if (!who.ok) return who.res;
  const me = normalizeVnPhone(who.phone);
  if (!isUuidLike(id)) return vErr(404, "not_found");
  if (!allowRequest(RATE, me, Date.now(), PER_10_MIN)) return vErr(429, "rate_limited", { message: cauLoi("rate_limited") });
  const admin = createAdminClient();
  if (!admin) return unavailable();
  const { data, error } = await admin.from("job_posts").select("owner_phone, status").eq("id", id.toLowerCase()).maybeSingle();
  if (error) return unavailable();
  if (!data || (data.status === "an" && data.owner_phone !== me)) return vErr(404, "not_found", { message: cauLoi("not_found") });
  return NextResponse.json({ ok: true, phone: data.owner_phone as string });
}
