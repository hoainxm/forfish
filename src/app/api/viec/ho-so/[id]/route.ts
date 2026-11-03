// GET /api/viec/ho-so/[id] — MỘT HỒ SƠ TÌM TÀU (spec 17 §12.3). `id` = kairos_profiles.id.
// Chủ tàu (vai `chu-tau`) xem được hồ sơ đang hiện; chính chủ xem được hồ sơ của mình dù đang tắt; vai khác ⇒ 403 `vai`.
// KHÔNG SĐT.
import { NextResponse } from "next/server";
import { identityFromRequest } from "@/lib/api-identity";
import { storeOr503 } from "@/lib/kairos/server";
import { normalizeVnPhone } from "@/lib/phone";
import { createAdminClient } from "@/lib/supabase/admin";
import { cauLoi, hoSoDangHien, isUuidLike } from "@/lib/viec";
import { hoSoDto, SEEKER_COLS, unavailable, vaiCua, vErr, type SeekerRow } from "@/lib/viec-server";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const who = await identityFromRequest(req);
  if (!who.ok) return who.res;
  const me = normalizeVnPhone(who.phone);
  if (!isUuidLike(id)) return vErr(404, "not_found");
  const admin = createAdminClient();
  if (!admin) return unavailable();
  const s = await storeOr503();
  if (!s.ok) return s.res;
  const profile = await s.store.profileById(id.toLowerCase()).catch(() => undefined);
  if (profile === undefined) return unavailable();
  const chinhChu = !!profile && profile.phone === me;
  if (!chinhChu) {
    const vai = await vaiCua(admin, me);
    if (!vai.ok) return unavailable();
    if (vai.vai !== "chu-tau") return vErr(403, "vai", { message: "Chỉ tài khoản Chủ tàu mới xem được hồ sơ người tìm tàu." });
  }
  if (!profile) return vErr(404, "not_found", { message: cauLoi("not_found") });
  const { data, error } = await admin.from("job_seekers").select(SEEKER_COLS).eq("phone", profile.phone).maybeSingle();
  if (error) return unavailable();
  const row = data as SeekerRow | null;
  if (!row || (!chinhChu && !hoSoDangHien(row, Date.now()))) return vErr(404, "not_found", { message: "Hồ sơ này đã tắt." });
  return NextResponse.json({ ok: true, hoSo: hoSoDto(row, profile), cuaToi: chinhChu });
}
