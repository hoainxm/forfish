// /api/viec/ho-so — HỒ SƠ TÌM TÀU CỦA CHÍNH MÌNH (spec 17 §6.2, §5 "đã đăng nhập, mọi vai", một SĐT một hồ sơ).
//   GET  hồ sơ của tôi (null = chưa có) + `dangHien` (bật và chưa quá 30 ngày từ lần bật) + tên Kairos.
//   PUT  tạo/sửa — đăng nhập + chưa bị cấm (Kairos). `dangTim: true` ⇒ ghi `bat_luc = now` (bật lại tính 30 ngày mới);
//        tắt thì giữ `bat_luc` cũ. SĐT = SĐT chuỗi, không từ body. Tên hiện = kairos_profiles.handle (không hỏi thêm).
import { NextResponse } from "next/server";
import { identityFromRequest } from "@/lib/api-identity";
import { requireWriter, storeOr503 } from "@/lib/kairos/server";
import { normalizeVnPhone } from "@/lib/phone";
import { createAdminClient } from "@/lib/supabase/admin";
import { cauLoi, hoSoDangHien, validateHoSo } from "@/lib/viec";
import { hoSoDto, PORT_IDS, SEEKER_COLS, unavailable, vErr, type SeekerRow } from "@/lib/viec-server";

export async function GET(req: Request) {
  const who = await identityFromRequest(req);
  if (!who.ok) return who.res;
  const phone = normalizeVnPhone(who.phone);
  const admin = createAdminClient();
  if (!admin) return unavailable();
  const s = await storeOr503();
  if (!s.ok) return s.res;
  const [{ data, error }, profile] = await Promise.all([
    admin.from("job_seekers").select(SEEKER_COLS).eq("phone", phone).maybeSingle(),
    s.store.profileByPhone(phone).catch(() => null),
  ]);
  if (error) return unavailable();
  const row = data as SeekerRow | null;
  return NextResponse.json({
    ok: true,
    ten: profile?.handle ?? null,
    hoSo: row && profile ? hoSoDto(row, profile) : null,
    dangTim: row?.dang_tim ?? false,
    dangHien: row ? hoSoDangHien(row, Date.now()) : false,
    batLuc: row?.bat_luc ?? null,
  });
}

export async function PUT(req: Request) {
  const w = await requireWriter(req);
  if (!w.ok) return w.res;
  const v = validateHoSo(await req.json().catch(() => null), { portIds: PORT_IDS });
  if (!v.ok) return vErr(400, v.code, { message: cauLoi(v.code), ...(v.term ? { term: v.term } : {}) });
  const admin = createAdminClient();
  if (!admin) return unavailable();
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("job_seekers")
    .upsert({ ...v.value, phone: w.phone, ...(v.value.dang_tim ? { bat_luc: now } : {}) }, { onConflict: "phone" })
    .select(SEEKER_COLS)
    .single();
  if (error || !data) return unavailable();
  const row = data as SeekerRow;
  return NextResponse.json({
    ok: true,
    ten: w.profile.handle,
    hoSo: hoSoDto(row, w.profile),
    dangTim: row.dang_tim,
    dangHien: hoSoDangHien(row, Date.now()),
    batLuc: row.bat_luc,
  });
}
