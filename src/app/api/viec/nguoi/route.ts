// GET /api/viec/nguoi — DANH SÁCH HỒ SƠ TÌM TÀU (spec 17 §6.3 tab "Tìm người", §12.3). CHỈ vai `chu-tau` (403 `vai`).
// Hồ sơ đang hiện = dang_tim + bat_luc trong 30 ngày. Lọc port | tinh (hồ sơ có ít nhất một cảng khớp) · nghe · viTri.
// KHÔNG SĐT — id = kairos_profiles.id, tên = handle; SĐT chỉ qua /api/viec/ho-so/[id]/lien-he.
import { NextResponse } from "next/server";
import { FISHING_PORTS } from "@/data/fishing-ports";
import { identityFromRequest } from "@/lib/api-identity";
import { storeOr503 } from "@/lib/kairos/server";
import { normalizeVnPhone } from "@/lib/phone";
import { createAdminClient } from "@/lib/supabase/admin";
import { cangCuaTinh, cauLoi, mocTatHoSo, parseLoc } from "@/lib/viec";
import { hoSoDto, PORT_IDS, SEEKER_COLS, unavailable, vaiCua, vErr, type SeekerRow } from "@/lib/viec-server";

export async function GET(req: Request) {
  const who = await identityFromRequest(req);
  if (!who.ok) return who.res;
  const admin = createAdminClient();
  if (!admin) return unavailable();
  const vai = await vaiCua(admin, normalizeVnPhone(who.phone));
  if (!vai.ok) return unavailable();
  if (vai.vai !== "chu-tau") return vErr(403, "vai", { message: "Chỉ tài khoản Chủ tàu mới xem được danh sách người tìm tàu." });
  const s = await storeOr503();
  if (!s.ok) return s.res;

  const loc = parseLoc(new URL(req.url).searchParams, PORT_IDS);
  let q = admin
    .from("job_seekers")
    .select(SEEKER_COLS)
    .eq("dang_tim", true)
    .gte("bat_luc", mocTatHoSo(Date.now()))
    .order("bat_luc", { ascending: false })
    .limit(100);
  if (loc.port) q = q.contains("ports", [loc.port]);
  else if (loc.tinh) {
    const ids = cangCuaTinh(loc.tinh, FISHING_PORTS);
    if (ids.length === 0) return NextResponse.json({ ok: true, items: [], luc: Date.now() });
    q = q.overlaps("ports", ids);
  }
  if (loc.nghe) q = q.contains("nghe", [loc.nghe]);
  if (loc.viTri) q = q.contains("vi_tri", [loc.viTri]);
  const { data, error } = await q;
  if (error) return unavailable();
  const rows = data as SeekerRow[];
  let profiles;
  try {
    profiles = await s.store.profilesByPhones(rows.map((r) => r.phone));
  } catch {
    return vErr(503, "unavailable", { message: cauLoi("unavailable") });
  }
  const byPhone = new Map(profiles.map((p) => [p.phone, p]));
  // hồ sơ Kairos thiếu (không lẽ xảy ra — PUT đi qua requireWriter) ⇒ bỏ, KHÔNG lùi về SĐT làm id
  const items = rows.flatMap((r) => {
    const p = byPhone.get(r.phone);
    return p ? [hoSoDto(r, p)] : [];
  });
  return NextResponse.json({ ok: true, items, luc: Date.now() });
}
