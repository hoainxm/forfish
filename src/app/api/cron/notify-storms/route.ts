// /api/cron/notify-storms — PUSH BÃO TỰ ĐỘNG mỗi 30 phút (2026-08-18, audit P7).
//
// Trước bản này app có `/api/storms` + Web Push + cron nhưng KHÔNG ai nối ba
// thứ lại: tin bão chỉ tới máy nào đang MỞ app. Bà con để điện thoại trong túi
// ở cảng, bão hình thành lúc 2 giờ sáng — không gì đánh thức họ. Đây là thứ
// audit gọi là "im ở chỗ quan trọng nhất".
//
// LUẬT (thuần, có test — lib/storm-push.ts): đẩy khi bão MỚI, LÊN CẤP, hoặc vẫn
// `danger` mà >12h chưa nhắc. Giờ khuya 22h–5h VN chỉ `danger` đi. Khử trùng
// bằng chính bảng push_messages (sent_by = 'system:storm', url mang khoá + cấp)
// — không migration. Target `all` (mọi máy đã bật thông báo, kể cả chưa đăng
// nhập — đó là lý do đăng ký ẩn danh tồn tại).
//
// AUTH: Bearer CRON_SECRET như các cron khác (Vercel Cron tự gắn header).
// OFFLINE: toàn bộ ở máy chủ; máy bà con mất sóng thì Apple/Google giữ tin và
// đẩy khi có sóng — sw.js tự in "TIN CŨ N GIỜ" từ `sentAt` = giờ phát tin.
import { GET as layTinBao } from "@/app/api/storms/route";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPushConfigured, sendPushMany } from "@/lib/push-send";
import {
  decideStormPushes,
  STORM_PUSH_SENT_BY,
  STORM_RECENT_WINDOW_MS,
  type SentStormRecord,
} from "@/lib/storm-push";
import type { StormCheck } from "@/lib/storms";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return Response.json({ ok: false, code: "unauthorized" }, { status: 401 });
  }
  const admin = createAdminClient();
  if (!admin) return Response.json({ ok: false, code: "not_configured" }, { status: 503 });
  if (!(await isPushConfigured())) {
    return Response.json({ ok: false, code: "vapid_not_configured" }, { status: 503 });
  }

  // GỌI THẲNG handler nội bộ của /api/storms (cùng process, không qua mạng, cùng
  // cache 30 phút của nó). Cả hai nguồn hỏng → 503 → lượt này thôi, KHÔNG suy
  // "không có bão".
  const now = Date.now();
  let check: StormCheck;
  try {
    const res = await layTinBao();
    if (!res.ok) return Response.json({ ok: false, code: "storms_unavailable" }, { status: 503 });
    check = (await res.json()) as StormCheck;
  } catch (e) {
    console.error("[notify-storms] lấy tin bão HỎNG:", (e as Error)?.message);
    return Response.json({ ok: false, code: "storms_unavailable" }, { status: 503 });
  }
  if (!check.ok) return Response.json({ ok: false, code: "storms_unavailable" }, { status: 503 });

  // sổ đã gửi 48h gần nhất — đọc lỗi thì DỪNG, không gửi bừa (gửi trùng còn tệ
  // hơn gửi trễ 30 phút: bà con tắt thông báo là mất kênh vĩnh viễn)
  const { data: recent, error: recentErr } = await admin
    .from("push_messages")
    .select("url, created_at")
    .eq("sent_by", STORM_PUSH_SENT_BY)
    .gte("created_at", new Date(now - STORM_RECENT_WINDOW_MS).toISOString());
  if (recentErr) {
    console.error("[notify-storms] đọc sổ đã gửi HỎNG:", recentErr.message);
    return Response.json({ ok: false, code: "query_failed" }, { status: 500 });
  }

  const plans = decideStormPushes(check.storms, (recent ?? []) as SentStormRecord[], now);
  if (plans.length === 0) {
    return Response.json({ ok: true, storms: check.storms.length, pushed: [] });
  }

  const { data: subs, error: subErr } = await admin
    .from("push_subscriptions")
    .select("id,endpoint,p256dh,auth_key");
  if (subErr) return Response.json({ ok: false, code: "query_failed" }, { status: 500 });
  const rows = (subs ?? []).map((r) => ({
    id: r.id as string,
    endpoint: r.endpoint as string,
    p256dh: r.p256dh as string,
    authKey: r.auth_key as string,
  }));

  const pushed: { key: string; reason: string; devices: number; sent: number; failed: number }[] = [];
  const goneAll = new Set<string>();
  for (const p of plans) {
    // GHI HỘP THƯ TRƯỚC (0023): id đi kèm payload để máy báo về; và chính dòng
    // này là "đã gửi" cho lượt cron sau — ghi hỏng thì bỏ qua cơn này lượt này
    // (không đẩy mà không có sổ ⇒ lượt sau đẩy lại ⇒ trùng).
    const { data: msg, error: insErr } = await admin
      .from("push_messages")
      .insert({
        title: p.title,
        body: p.body,
        url: p.url,
        target: "all",
        target_phone: null,
        sent_by: STORM_PUSH_SENT_BY,
        devices: rows.length,
        sent: 0,
      })
      .select("id")
      .maybeSingle();
    if (insErr || !msg) {
      console.error("[notify-storms] ghi push_messages HỎNG:", insErr?.message);
      continue;
    }
    const messageId = (msg as { id: string }).id;
    if (rows.length === 0) {
      pushed.push({ key: p.key, reason: p.reason, devices: 0, sent: 0, failed: 0 });
      continue;
    }
    // chỉ đẩy tới máy còn sống sau các cơn trước trong cùng lượt
    const live = rows.filter((r) => !goneAll.has(r.id));
    const { sent, goneIds, failed } = await sendPushMany(live, {
      title: p.title,
      body: p.body,
      url: p.url,
      sentAt: new Date(p.sentAtMs).toISOString(),
      messageId,
      tag: p.tag,
    });
    for (const id of goneIds) goneAll.add(id);
    await admin.from("push_messages").update({ sent }).eq("id", messageId);
    pushed.push({ key: p.key, reason: p.reason, devices: live.length, sent, failed });
  }
  if (goneAll.size > 0) {
    await admin.from("push_subscriptions").delete().in("id", [...goneAll]);
  }

  return Response.json({ ok: true, storms: check.storms.length, pushed });
}
