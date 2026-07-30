// /api/admin/push — GỬI THÔNG BÁO cho từng user (theo SĐT) hoặc TOÀN BỘ user
// đã đăng ký Web Push (2026-07-28, Phase 3). GET trả thống kê số máy đã đăng
// ký; POST gửi thật qua web-push (VAPID) — endpoint đã chết (404/410) thì tự
// xóa khỏi bảng (dọn rác, không cần cron riêng). requireStaff.
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/admin-auth";
import { isPushConfigured, sendPush } from "@/lib/push-send";

const err = (status: number, code: string) =>
  NextResponse.json({ ok: false, code }, { status });

export async function GET() {
  const who = await requireStaff();
  if (!who.ok) return err(who.status, who.code);
  const admin = createAdminClient();
  if (!admin) return err(503, "not_configured");

  const { count: total } = await admin
    .from("push_subscriptions")
    .select("id", { count: "exact", head: true });
  const { count: named } = await admin
    .from("push_subscriptions")
    .select("id", { count: "exact", head: true })
    .not("customer_phone", "is", null);

  return NextResponse.json({
    ok: true,
    me: who,
    configured: await isPushConfigured(),
    total: total ?? 0,
    named: named ?? 0,
    anonymous: (total ?? 0) - (named ?? 0),
  });
}

export async function POST(req: Request) {
  const who = await requireStaff();
  if (!who.ok) return err(who.status, who.code);
  const admin = createAdminClient();
  if (!admin) return err(503, "not_configured");
  if (!(await isPushConfigured())) return err(503, "vapid_not_configured");

  const body = (await req.json().catch(() => null)) as {
    target?: "all" | "phone";
    phone?: string;
    title?: string;
    body?: string;
    url?: string;
  } | null;
  const title = body?.title?.trim();
  const message = body?.body?.trim();
  if (!title || !message) return err(400, "missing_content");
  if (body?.target === "phone" && !body.phone?.trim())
    return err(400, "missing_phone");

  let q = admin
    .from("push_subscriptions")
    .select("id,endpoint,p256dh,auth_key");
  if (body?.target === "phone") {
    q = q.eq("customer_phone", body.phone!.trim());
  }
  const { data, error } = await q;
  if (error) return err(500, "query_failed");

  const rows = data ?? [];
  if (rows.length === 0)
    return NextResponse.json({ ok: true, sent: 0, failed: 0, cleaned: 0 });

  const payload = { title, body: message, url: body?.url || "/" };
  const results = await Promise.all(
    rows.map((r) =>
      sendPush(
        { endpoint: r.endpoint, p256dh: r.p256dh, authKey: r.auth_key },
        payload,
      ).then((res) => ({ id: r.id as string, ...res })),
    ),
  );

  const sent = results.filter((r) => r.ok).length;
  const gone = results.filter((r) => !r.ok && r.gone).map((r) => r.id);
  const failed = results.length - sent - gone.length;

  if (gone.length > 0) {
    await admin.from("push_subscriptions").delete().in("id", gone);
  }

  return NextResponse.json({
    ok: true,
    sent,
    failed,
    cleaned: gone.length,
  });
}
