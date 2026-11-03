// /api/viec/tin/[id] — MỘT TIN TUYỂN (spec 17 §6.1, §6.4).
//   GET   chi tiết (khách xem được). Tin bị nhân viên ẩn (`an`) chỉ chủ tin thấy. Tin đóng/hết hạn vẫn trả kèm
//         `status`/`expiresAt` để màn nói "Tin đã đóng" (link đã lưu không thành trang trắng). KHÔNG SĐT.
//   PATCH tin của CHÍNH MÌNH: { action: "gia-han" } (14 ngày từ hôm nay, mở lại tin đủ người — tính trần 5 tin mở) ·
//         { action: "du-nguoi" } (đóng tin; bị cấm vẫn đóng được) · { action: "sua", tin } (kiểm như đăng mới).
//         Tin bị ẩn ⇒ 403 `an`. Không phải chủ ⇒ 404 (không nói tin có tồn tại).
import { NextResponse } from "next/server";
import { readerOf, requireWriter } from "@/lib/kairos/server";
import { isBanned } from "@/lib/kairos/rate";
import { createAdminClient } from "@/lib/supabase/admin";
import { cauLoi, conChoDangTin, hanGiaHan, isUuidLike, parseTinPatch, validateTin } from "@/lib/viec";
import { demTinMo, PORT_IDS, POST_COLS, tinChuDto, tinDto, unavailable, vErr, type PostRow } from "@/lib/viec-server";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  const { id } = await params;
  const r = await readerOf(req);
  if (!r.ok) return r.res;
  if (!isUuidLike(id)) return vErr(404, "not_found");
  const admin = createAdminClient();
  if (!admin) return unavailable();
  const { data, error } = await admin.from("job_posts").select(POST_COLS).eq("id", id.toLowerCase()).maybeSingle();
  if (error) return unavailable();
  const row = data as PostRow | null;
  const cuaToi = !!row && !!r.phone && row.owner_phone === r.phone;
  if (!row || (row.status === "an" && !cuaToi)) return vErr(404, "not_found", { message: cauLoi("not_found") });
  return NextResponse.json({ ok: true, tin: cuaToi ? tinChuDto(row) : tinDto(row, r.phone) });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const w = await requireWriter(req, { allowBanned: true });
  if (!w.ok) return w.res;
  if (!isUuidLike(id)) return vErr(404, "not_found");
  const p = parseTinPatch(await req.json().catch(() => null));
  if (!p) return vErr(400, "bad_body");
  // đóng tin của mình là việc vô hại — bị cấm vẫn làm được; gia hạn / sửa là đăng lại nội dung ⇒ chặn
  if (p.action !== "du-nguoi" && isBanned(w.profile.banned_until, Date.now())) {
    return vErr(403, "banned", { until: w.profile.banned_until, message: cauLoi("banned") });
  }
  const admin = createAdminClient();
  if (!admin) return unavailable();
  const pid = id.toLowerCase();
  const { data, error } = await admin.from("job_posts").select(POST_COLS).eq("id", pid).maybeSingle();
  if (error) return unavailable();
  const row = data as PostRow | null;
  if (!row || row.owner_phone !== w.phone) return vErr(404, "not_found", { message: cauLoi("not_found") });
  if (row.status === "an") return vErr(403, "an", { message: cauLoi("an") });

  const now = Date.now();
  let patch: Record<string, unknown>;
  if (p.action === "du-nguoi") patch = { status: "du" };
  else if (p.action === "gia-han") {
    // tin này đang mở và còn hạn thì không tính là "mở thêm" một tin
    const dangMo = await demTinMo(admin, w.phone, new Date(now).toISOString(), pid);
    if (dangMo === null) return unavailable();
    if (!conChoDangTin(dangMo)) return vErr(409, "tran", { message: cauLoi("tran") });
    patch = { status: "mo", expires_at: hanGiaHan(now) };
  } else {
    const v = validateTin(p.tin, { portIds: PORT_IDS });
    if (!v.ok) return vErr(400, v.code, { message: cauLoi(v.code), ...(v.term ? { term: v.term } : {}) });
    patch = { ...v.value };
  }
  const { data: upd, error: e2 } = await admin
    .from("job_posts")
    .update(patch)
    .eq("id", pid)
    .eq("owner_phone", w.phone)
    .select(POST_COLS)
    .single();
  if (e2 || !upd) return unavailable();
  return NextResponse.json({ ok: true, tin: tinChuDto(upd as PostRow) });
}
