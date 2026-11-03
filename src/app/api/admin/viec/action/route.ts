// POST /api/admin/viec/action — THAO TÁC NGƯỜI TRỰC VIỆC LÀM (spec 17 §8). CHỈ ADMIN.
// { action: "an" | "hien" | "xu-ly" | "bo-qua", kind: "post" | "seeker", id }
//   an    tin ⇒ status 'an' · hồ sơ ⇒ dang_tim = false. Báo xấu của đích chuyển 'da_xu_ly'.
//   hien  tin 'an' ⇒ 'mo' (hết hạn thì vẫn hết hạn — chủ tin tự Gia hạn). Hồ sơ không "hiện hộ" — chủ hồ sơ tự bật.
//   xu-ly / bo-qua  chỉ đóng báo xấu của đích.
// Cấm đăng KHÔNG ở đây: dùng chung /api/admin/kairos/action { action: "ban", profileId } — cùng luật banned_until.
// Nhật ký: kairos_audit (best-effort, auditQuiet) — nợ: chuyển sang admin_activity khi có mã hành động việc làm.
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { auditQuiet, clientIp, storeOr503 } from "@/lib/kairos/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isUuidLike } from "@/lib/viec";
import { unavailable, vErr } from "@/lib/viec-server";

const ACTIONS = new Set(["an", "hien", "xu-ly", "bo-qua"]);

export async function POST(req: Request) {
  const who = await requireAdmin();
  if (!who.ok) return vErr(who.status, who.code);
  const b = (await req.json().catch(() => null)) as { action?: unknown; kind?: unknown; id?: unknown } | null;
  const action = typeof b?.action === "string" && ACTIONS.has(b.action) ? b.action : null;
  const kind = b?.kind === "post" || b?.kind === "seeker" ? b.kind : null;
  if (!action || !kind || !isUuidLike(b?.id)) return vErr(400, "bad_body");
  if (action === "hien" && kind === "seeker") return vErr(400, "bad_body");
  const id = (b!.id as string).toLowerCase();
  const admin = createAdminClient();
  if (!admin) return unavailable();
  const s = await storeOr503();
  if (!s.ok) return s.res;

  if (action === "an" || action === "hien") {
    if (kind === "post") {
      const { data, error } = await admin
        .from("job_posts")
        .update({ status: action === "an" ? "an" : "mo" })
        .eq("id", id)
        .select("id");
      if (error) return unavailable();
      if (!data?.length) return vErr(404, "not_found");
    } else {
      const p = await s.store.profileById(id).catch(() => undefined);
      if (p === undefined) return unavailable();
      if (!p) return vErr(404, "not_found");
      const { error } = await admin.from("job_seekers").update({ dang_tim: false }).eq("phone", p.phone);
      if (error) return unavailable();
    }
  }
  if (action !== "hien") {
    const { error } = await admin
      .from("job_reports")
      .update({ status: action === "bo-qua" ? "bo_qua" : "da_xu_ly" })
      .eq("target_kind", kind)
      .eq("target_id", id)
      .eq("status", "moi");
    if (error) return unavailable();
  }
  await auditQuiet(s.store, {
    actor: `staff:${who.phone}`,
    actor_kind: "staff",
    action: `viec_${action}`,
    target_type: kind === "post" ? "job_post" : "job_seeker",
    target_id: id,
    detail: { action, kind },
    ip: clientIp(req),
  });
  return NextResponse.json({ ok: true });
}
