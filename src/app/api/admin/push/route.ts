// /api/admin/push — GỬI THÔNG BÁO cho từng user (theo SĐT) hoặc TOÀN BỘ user
// đã đăng ký Web Push (2026-07-28, Phase 3). GET trả thống kê số máy đã đăng
// ký; POST gửi thật qua web-push (VAPID) — endpoint đã chết (404/410) thì tự
// xóa khỏi bảng (dọn rác, không cần cron riêng). PHÂN QUYỀN (2026-07-30) qua
// requirePermission tab "thong-bao": GET=view · POST(gửi)=create.
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/admin-auth";
import { logActivity } from "@/lib/admin-activity-log";
import { isPushConfigured, sendPush } from "@/lib/push-send";
import { normalizeVnPhone } from "@/lib/phone";

const err = (status: number, code: string) =>
  NextResponse.json({ ok: false, code }, { status });

export async function GET() {
  const who = await requirePermission("thong-bao", "view");
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

  /* DANH SÁCH TÀI KHOẢN ĐÃ GẮN MÁY — để UI CHỌN thay vì gõ tay số (2026-08-01).
     Gõ tay sai một ký tự là gửi vào hư không mà không ai biết; và mô hình tinh
     thần cũng sai — việc thật là "chọn một TÀI KHOẢN", SĐT chỉ tình cờ là id
     của tài khoản trong app này. Chỉ liệt kê tài khoản CÓ máy: gửi cho tài
     khoản chưa gắn máy nào thì vốn không tới được ai. */
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("customer_phone")
    .not("customer_phone", "is", null);
  const byAccount = new Map<string, number>();
  for (const r of subs ?? []) {
    const k = (r as { customer_phone: string }).customer_phone;
    byAccount.set(k, (byAccount.get(k) ?? 0) + 1);
  }
  let names = new Map<string, string | null>();
  if (byAccount.size > 0) {
    const { data: cs } = await admin
      .from("customers")
      .select("phone, name")
      .in("phone", [...byAccount.keys()]);
    names = new Map(
      (cs ?? []).map((c) => [
        (c as { phone: string }).phone,
        (c as { name: string | null }).name ?? null,
      ]),
    );
  }
  const accounts = [...byAccount.entries()]
    .map(([phone, devices]) => ({ phone, name: names.get(phone) ?? null, devices }))
    .sort((a, b) => a.phone.localeCompare(b.phone));

  return NextResponse.json({
    ok: true,
    me: who,
    configured: await isPushConfigured(),
    total: total ?? 0,
    named: named ?? 0,
    anonymous: (total ?? 0) - (named ?? 0),
    accounts,
  });
}

export async function POST(req: Request) {
  const who = await requirePermission("thong-bao", "create");
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
  // CHUẨN HOÁ id tài khoản — cả app dùng normalizeVnPhone, riêng đường push
  // trước đây chỉ .trim() ⇒ "0938 635 689" hay dạng 84xxx là khớp trượt, gửi
  // cho 0 người mà im lặng.
  const targetAccount =
    body?.target === "phone" ? normalizeVnPhone(body.phone!.trim()) : null;
  if (targetAccount) q = q.eq("customer_phone", targetAccount);
  const { data, error } = await q;
  if (error) return err(500, "query_failed");

  const rows = data ?? [];
  /* GỬI HỤT CŨNG PHẢI ĐỂ LẠI DẤU VẾT (2026-08-01): trước đây nhánh này thoát
     sớm TRƯỚC logActivity, nên đúng ca cần soi nhất — bấm gửi mà không tới ai —
     lại là ca duy nhất không có dòng nhật ký nào. */
  if (rows.length === 0) {
    await logActivity(admin, {
      actorPhone: who.phone,
      actorRole: who.role,
      action: "push.send",
      target: targetAccount ?? "all",
      detail: { target: body?.target ?? "all", title, found: 0, sent: 0 },
    });
    return NextResponse.json({
      ok: true,
      found: 0,
      sent: 0,
      failed: 0,
      cleaned: 0,
    });
  }

  // sentAt đi kèm để service worker TỰ TÍNH tin trễ bao lâu lúc nó tới máy —
  // TTL 4 tuần nên tin hoàn toàn có thể nổ nhiều ngày sau (xem sw.js pushBodyVN)
  const payload = {
    title,
    body: message,
    url: body?.url || "/",
    sentAt: new Date().toISOString(),
  };
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

  await logActivity(admin, {
    actorPhone: who.phone,
    actorRole: who.role,
    action: "push.send",
    target: targetAccount ?? "all",
    detail: { target: body?.target ?? "all", title, found: rows.length, sent },
  });
  return NextResponse.json({
    ok: true,
    found: rows.length,
    sent,
    failed,
    cleaned: gone.length,
  });
}
