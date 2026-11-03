// POST /api/viec/bao-xau — BÁO XẤU TIN TUYỂN / HỒ SƠ (spec 17 §6.1, khuôn báo xấu Kairos /api/kairos/reports).
// { kind: "post" | "seeker", id, reason? } — đăng nhập + chưa bị cấm. Một người một đích một lần (unique ở 0079 ⇒
// báo trùng 200 `dup`). 20 lượt/ngày (đếm trong bảng). Không tự báo mình. Tin có ≥5 người khác nhau báo (chưa xử lý)
// ⇒ TỰ ẨN (`status = 'an'`) chờ người trực ở /quan-tri › Việc làm. Hồ sơ không tự ẩn — người trực quyết.
import { NextResponse } from "next/server";
import { requireWriter, storeOr503 } from "@/lib/kairos/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cauLoi, DAY_MS, validateBaoXau } from "@/lib/viec";
import { unavailable, vErr } from "@/lib/viec-server";

const PER_DAY = 20;
const AUTO_HIDE_REPORTERS = 5;

export async function POST(req: Request) {
  const w = await requireWriter(req);
  if (!w.ok) return w.res;
  const v = validateBaoXau(await req.json().catch(() => null));
  if (!v.ok) return vErr(400, v.code, { message: cauLoi(v.code) });
  const { kind, id, reason } = v.value;
  const admin = createAdminClient();
  if (!admin) return unavailable();

  // đích phải có thật, và không phải của chính mình
  let chu: string | null = null;
  if (kind === "post") {
    const { data, error } = await admin.from("job_posts").select("owner_phone").eq("id", id).maybeSingle();
    if (error) return unavailable();
    chu = (data?.owner_phone as string | undefined) ?? null;
  } else {
    const s = await storeOr503();
    if (!s.ok) return s.res;
    const p = await s.store.profileById(id).catch(() => undefined);
    if (p === undefined) return unavailable();
    chu = p?.phone ?? null;
  }
  if (!chu) return vErr(404, "not_found", { message: cauLoi("not_found") });
  if (chu === w.phone) return vErr(400, "self", { message: cauLoi("self") });

  const { count, error: cErr } = await admin
    .from("job_reports")
    .select("id", { count: "exact", head: true })
    .eq("reporter_phone", w.phone)
    .gte("created_at", new Date(Date.now() - DAY_MS).toISOString());
  if (cErr) return unavailable();
  if ((count ?? 0) >= PER_DAY) return vErr(429, "rate_limited", { message: cauLoi("rate_limited") });

  const { error } = await admin.from("job_reports").insert({ reporter_phone: w.phone, target_kind: kind, target_id: id, reason });
  if (error) {
    if (error.code === "23505") return NextResponse.json({ ok: true, dup: true });
    return unavailable();
  }

  if (kind === "post") {
    const { count: n } = await admin
      .from("job_reports")
      .select("id", { count: "exact", head: true })
      .eq("target_kind", "post")
      .eq("target_id", id)
      .eq("status", "moi");
    // mỗi người một dòng (unique) ⇒ số dòng = số người báo; lỗi đếm thì thôi, người trực vẫn thấy báo xấu
    if ((n ?? 0) >= AUTO_HIDE_REPORTERS) await admin.from("job_posts").update({ status: "an" }).eq("id", id).eq("status", "mo");
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}
