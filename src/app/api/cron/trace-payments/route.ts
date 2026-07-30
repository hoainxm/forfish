// SDFish — NV4 (ba-spec 10): TRACE TIỀN — bắn MÃ CK khách đã trả sang SDWork để
// SDWork đối chiếu sao kê. Cron kéo các payment reconciled_status='pending' CHƯA
// bắn (traced_at IS NULL), POST sang SDWORK_TRACE_URL ký HMAC (cùng secret
// SDWORK_WEBHOOK_SECRET như webhook 2 chiều). Bắn 2xx → set traced_at (không bắn
// lại). Lỗi → GIỮ (traced_at null) thử lại cron sau (AC-6). SDWork đối chiếu xong
// bắn webhook payment_reconciled về → NV5 set reconciled_status='reconciled'.
//
// Vercel Cron (Authorization: Bearer CRON_SECRET). Thiếu env → no-op (degrade).
// ⚠️ tiền THẬT + đối soát ở SDWork; SDFish chỉ chuyển MÃ (không số tiền, R1).
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { signOutbound } from "@/lib/sdwork-outbound";

export const maxDuration = 60;

const TIMEOUT_MS = 6000;
const BATCH = 100;

export async function POST(req: Request) {
  // Vercel Cron gắn Bearer CRON_SECRET — bắt buộc, chống gọi trộm.
  const secret = process.env.CRON_SECRET ?? "";
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, code: "unauthorized" }, { status: 401 });
  }

  const url = process.env.SDWORK_TRACE_URL;
  const hmacSecret = process.env.SDWORK_WEBHOOK_SECRET ?? "";
  if (!url || !hmacSecret) {
    // chưa cấu hình đầu nhận SDWork → không bắn, cũng không lỗi (degrade)
    return NextResponse.json({ ok: true, skipped: "not_configured" });
  }

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ ok: true, skipped: "not_configured" });

  // hàng chờ bắn: đã ghi thu (pending) mà CHƯA bắn (traced_at null)
  const { data: pending, error } = await admin
    .from("payments")
    .select("id, customer_phone, code, agent_phone, created_at")
    .eq("reconciled_status", "pending")
    .is("traced_at", null)
    .order("created_at", { ascending: true })
    .limit(BATCH);
  if (error) {
    // bảng chưa có (0026/0027 chưa apply) hoặc lỗi query → không chặn cron
    return NextResponse.json({ ok: true, skipped: "no_table" });
  }

  let sent = 0;
  let failed = 0;
  for (const p of pending ?? []) {
    const payload = {
      code: p.code as string,
      phone: p.customer_phone as string,
      agent: (p.agent_phone as string) ?? null,
      recordedAt: p.created_at as string,
    };
    const raw = JSON.stringify(payload);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-sdfish-signature": signOutbound(raw, hmacSecret),
        },
        body: raw,
        signal: ctrl.signal,
      });
      if (res.ok) {
        // bắn thành công → đánh dấu đã bắn (rời hàng chờ, KHÔNG bắn lại)
        await admin
          .from("payments")
          .update({ traced_at: new Date().toISOString() })
          .eq("id", p.id as string);
        sent++;
      } else {
        failed++; // GIỮ traced_at null → cron sau thử lại (AC-6)
      }
    } catch {
      failed++;
    } finally {
      clearTimeout(timer);
    }
  }

  return NextResponse.json({ ok: true, queued: (pending ?? []).length, sent, failed });
}
