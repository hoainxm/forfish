// /api/push/subscribe — Đăng ký/hủy nhận Web Push (2026-07-28, Phase 3).
// Dùng được cả khi CHƯA đăng nhập (customer_phone = null → chỉ nhận thông
// báo BROADCAST toàn bộ, không nhận thông báo nhắm theo SĐT). Đã đăng nhập
// thì gắn SĐT từ session (server tự đọc, client không tự khai SĐT).
// Ghi bằng service-role (bảng không có RLS policy cho client).
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  validatePushSubscription,
  type PushSubscriptionInput,
} from "@/lib/push-subscriptions";

const err = (status: number, code: string) =>
  NextResponse.json({ ok: false, code }, { status });

async function currentPhone(): Promise<string | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  const email = data?.user?.email;
  return email ? email.split("@")[0] : null;
}

export async function POST(req: Request) {
  const admin = createAdminClient();
  if (!admin) return err(503, "not_configured");

  const body = (await req.json().catch(() => null)) as {
    subscription?: PushSubscriptionInput;
    userAgent?: string;
  } | null;
  const invalid = validatePushSubscription(body?.subscription);
  if (invalid) return err(400, "invalid_subscription");
  const sub = body!.subscription!;

  const phone = await currentPhone();
  const nowIso = new Date().toISOString();
  const { error } = await admin.from("push_subscriptions").upsert(
    {
      customer_phone: phone,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth_key: sub.keys.auth,
      user_agent: body?.userAgent?.slice(0, 300) || null,
      last_seen_at: nowIso,
    },
    { onConflict: "endpoint" },
  );
  if (error) return err(500, "insert_failed");
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const admin = createAdminClient();
  if (!admin) return err(503, "not_configured");

  const body = (await req.json().catch(() => null)) as {
    endpoint?: string;
  } | null;
  if (!body?.endpoint) return err(400, "bad_endpoint");

  const { error } = await admin
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", body.endpoint);
  if (error) return err(500, "delete_failed");
  return NextResponse.json({ ok: true });
}
