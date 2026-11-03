// GET /api/viec/ho-so/[id]/lien-he — SĐT NGƯỜI TÌM TÀU (spec 17 §5, AC5): đã đăng nhập VÀ customers.vai = 'chu-tau'.
// Vai khác (thu mua, đi bạn, đại lý, chưa chọn) ⇒ 403 `vai` — SĐT bạn thuyền không hiện cho người lạ (chống quấy,
// chống môi giới lừa). Hồ sơ đã tắt ⇒ 404. Trần mở số theo SĐT người xem.
import { NextResponse } from "next/server";
import { identityFromRequest } from "@/lib/api-identity";
import { storeOr503 } from "@/lib/kairos/server";
import { normalizeVnPhone } from "@/lib/phone";
import { allowRequest, type RateStore } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { cauLoi, hoSoDangHien, isUuidLike } from "@/lib/viec";
import { unavailable, vaiCua, vErr } from "@/lib/viec-server";

// nợ: đếm bộ nhớ một instance (lib/rate-limit) — chuyển sang bảng đếm chung khi thấy cào số trong log.
const RATE: RateStore = new Map();
const PER_10_MIN = { limit: 60, windowMs: 10 * 60 * 1000 };

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const who = await identityFromRequest(req);
  if (!who.ok) return who.res;
  const me = normalizeVnPhone(who.phone);
  const admin = createAdminClient();
  if (!admin) return unavailable();
  // gác vai TRƯỚC mọi tra cứu khác — vai sai không được biết hồ sơ có tồn tại hay không
  const vai = await vaiCua(admin, me);
  if (!vai.ok) return unavailable();
  if (vai.vai !== "chu-tau") return vErr(403, "vai", { message: "Chỉ tài khoản Chủ tàu mới xem được số người tìm tàu." });
  if (!isUuidLike(id)) return vErr(404, "not_found");
  if (!allowRequest(RATE, me, Date.now(), PER_10_MIN)) return vErr(429, "rate_limited", { message: cauLoi("rate_limited") });
  const s = await storeOr503();
  if (!s.ok) return s.res;
  const profile = await s.store.profileById(id.toLowerCase()).catch(() => undefined);
  if (profile === undefined) return unavailable();
  if (!profile) return vErr(404, "not_found", { message: cauLoi("not_found") });
  const { data, error } = await admin.from("job_seekers").select("dang_tim, bat_luc").eq("phone", profile.phone).maybeSingle();
  if (error) return unavailable();
  if (!data || !hoSoDangHien(data as { dang_tim: boolean; bat_luc: string }, Date.now())) {
    return vErr(404, "not_found", { message: "Hồ sơ này đã tắt." });
  }
  return NextResponse.json({ ok: true, phone: profile.phone });
}
