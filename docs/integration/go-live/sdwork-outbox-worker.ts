// Edge Function CRM: sdfish-outbox-push — worker đẩy outbox sang SDFish.
// Deploy (trong repo CRM):
//   supabase functions new sdfish-outbox-push     # dán file này vào index.ts
//   supabase functions deploy sdfish-outbox-push --project-ref exueouggmbjtjvsvpfya
//   supabase secrets set SDFISH_WEBHOOK_URL=https://<sdfish-domain>/api/sdwork/webhook \
//     SDWORK_WEBHOOK_SECRET=<hex 32 — GIỐNG SDFish> --project-ref exueouggmbjtjvsvpfya
// (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY: Supabase tự inject sẵn.)
//
// Chạy bởi pg_cron mỗi phút (xem sdwork-outbox.sql mục IV). Mỗi lần chạy:
// lấy ≤100 event đến hạn (customer trước — spec §6) → ký HMAC → POST →
// đánh dấu theo results[] từng event (KHÔNG theo applied) → backoff/dead-letter.
// KHÔNG log password (spec §9); xoá password khỏi outbox sau khi gửi OK.
import { createClient } from "jsr:@supabase/supabase-js@2";

// BATCH 100 → 25 (sửa 2026-07-21): SDFish xử lý TUẦN TỰ từng event (upsert + có
// thể tạo auth user). Lô 100 vượt giới hạn thời gian của Vercel → bị cắt giữa
// chừng → worker ghi `network_error`, lùi giờ, lặp mãi. Sự cố thật: 646 event
// kẹt, thử 3 lần đều `network_error`. Lô 25 chạy gọn trong hạn; cron 1 phút/lần
// vẫn rút hết 646 event trong ~26 phút.
const BATCH = 25;
const MAX_ATTEMPTS = 8;
// Backoff: 1m, 5m, 30m, 2h, 6h, 12h, 24h (spec §5)
const BACKOFF_MIN = [1, 5, 30, 120, 360, 720, 1440];

type OutboxRow = {
  id: number;
  entity: "customer" | "device" | "supply";
  action: "upsert" | "delete";
  ref: string;
  data: Record<string, unknown>;
  attempts: number;
};

async function hmacHex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function nextTry(attempts: number): string {
  const min = BACKOFF_MIN[Math.min(attempts - 1, BACKOFF_MIN.length - 1)];
  return new Date(Date.now() + min * 60_000).toISOString();
}

Deno.serve(async () => {
  const url = Deno.env.get("SDFISH_WEBHOOK_URL");
  const secret = Deno.env.get("SDWORK_WEBHOOK_SECRET");
  if (!url || !secret) {
    return Response.json({ ok: false, code: "worker_not_configured" }, { status: 503 });
  }
  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Lấy batch đến hạn — customer lên đầu để KH có trước thiết bị/vật tư (RLS khớp)
  const { data: rows, error: qErr } = await db
    .from("sdfish_outbox")
    .select("id, entity, action, ref, data, attempts")
    .is("sent_at", null).eq("dead", false)
    .lte("next_try_at", new Date().toISOString())
    .order("id", { ascending: true })
    .limit(BATCH);
  if (qErr) return Response.json({ ok: false, code: "query_failed" }, { status: 500 });
  if (!rows?.length) return Response.json({ ok: true, pushed: 0 });

  const batch = (rows as OutboxRow[]).sort((a, b) =>
    a.entity === b.entity ? a.id - b.id
      : a.entity === "customer" ? -1 : b.entity === "customer" ? 1 : a.id - b.id,
  );
  const body = JSON.stringify({
    events: batch.map(({ entity, action, ref, data }) => ({ entity, action, ref, data })),
  });
  const sig = await hmacHex(secret, body);

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-sdwork-signature": sig },
      body,
      // 10s → 30s: phải LỚN HƠN maxDuration phía SDFish (60s) là không cần, nhưng
      // phải đủ cho lô 25 event; 10s là nguyên nhân `network_error` hàng loạt
      // 2026-07-21. Giữ dưới hạn chờ cron (timeout_milliseconds := 30000).
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    // timeout/mạng → cả batch retry backoff
    for (const r of batch) await bump(db, r, "network_error");
    return Response.json({ ok: false, code: "network_error" });
  }

  if (res.status === 401) {
    // Secret lệch — DỪNG, không retry mù (spec §4). CỐ Ý không bump attempts:
    // 401 không tự lành, đốt retry là vô ích và sẽ đẩy hàng loạt vào dead-letter.
    //
    // NHƯNG phải để lại DẤU VẾT TRONG BẢNG (sửa 2026-07-21): trước đây nhánh này
    // thoát hoàn toàn lặng lẽ → outbox đứng im ở attempts=0, last_error=null,
    // cron vẫn quay mỗi phút, nhìn bảng KHÔNG thấy gì bất thường. Mất nhiều giờ
    // mới lần ra vì phải mở log Edge Function mới biết. Giờ ghi last_error để
    // truy vấn đối soát thấy ngay, mà VẪN không tăng attempts (next_try_at giữ
    // nguyên → khớp lại secret là chảy ngay, không phải chờ backoff).
    console.error("sdfish-outbox-push: 401 bad_signature — SECRET LỆCH 2 BÊN, dừng.");
    await db.from("sdfish_outbox")
      .update({ last_error: "bad_signature_stop (secret lệch 2 bên — KHÔNG tự lành)" })
      .in("id", batch.map((r) => r.id));
    return Response.json({ ok: false, code: "bad_signature_stop" }, { status: 500 });
  }
  if (!res.ok) {
    // 503 not_configured / 5xx → retry sau
    for (const r of batch) await bump(db, r, `http_${res.status}`);
    return Response.json({ ok: false, code: `http_${res.status}` });
  }

  const payload = await res.json() as {
    results?: { ref: string; entity: string; ok: boolean; code?: string; provisioned?: boolean }[];
  };
  const results = payload.results ?? [];
  let sent = 0;
  const alerts: string[] = [];

  for (const row of batch) {
    const r = results.find((x) => x.ref === row.ref && x.entity === row.entity);
    if (r?.ok) {
      // Gửi OK → sent + xoá password khỏi outbox (không giữ plaintext — spec §9)
      const cleaned = { ...row.data };
      delete (cleaned as Record<string, unknown>).password;
      await db.from("sdfish_outbox")
        .update({ sent_at: new Date().toISOString(), last_error: null, data: cleaned })
        .eq("id", row.id);
      sent++;
      if (r.provisioned === false) {
        // Dữ liệu vào nhưng TẠO TÀI KHOẢN LỖI → KH chưa đăng nhập được — alert
        alerts.push(`provisioned:false ref=${row.ref}`);
      }
    } else {
      await bump(db, row, r?.code ?? "missing_in_results");
    }
  }

  if (alerts.length) console.error("sdfish-outbox-push ALERT:", alerts.join("; "));
  return Response.json({ ok: true, pushed: sent, total: batch.length, alerts });
});

async function bump(
  db: ReturnType<typeof createClient>,
  row: OutboxRow,
  code: string,
) {
  const attempts = row.attempts + 1;
  await db.from("sdfish_outbox").update({
    attempts,
    last_error: code,
    next_try_at: nextTry(attempts),
    dead: attempts >= MAX_ATTEMPTS,   // dead-letter — xử tay + alert
  }).eq("id", row.id);
  if (attempts >= MAX_ATTEMPTS) {
    console.error(`sdfish-outbox-push DEAD-LETTER id=${row.id} ref=${row.ref} code=${code}`);
  }
}
