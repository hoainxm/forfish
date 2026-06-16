// Webhook SDWork → SDFish: nạp KH/thiết bị/vật tư vào DB RIÊNG (thay đọc-live).
// Verify HMAC SHA-256 (header x-sdwork-signature, secret SDWORK_WEBHOOK_SECRET)
// trên RAW body. Ghi bằng service-role (bypass RLS). Idempotent theo sdwork_ref.
// Hợp đồng event: docs/integration/sdwork-sso-contract.md.
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  toCustomerRow,
  toDeviceRow,
  toSupplyRow,
  verifyWebhookSignature,
  type WebhookEvent,
} from "@/lib/sdwork-webhook";

const TABLE: Record<WebhookEvent["entity"], string> = {
  customer: "customers",
  device: "devices",
  supply: "supplies",
};

export async function POST(req: Request) {
  const secret = process.env.SDWORK_WEBHOOK_SECRET ?? "";
  if (!secret) {
    return NextResponse.json({ ok: false, code: "not_configured" }, { status: 503 });
  }
  const raw = await req.text();
  const sig = req.headers.get("x-sdwork-signature") ?? "";
  if (!verifyWebhookSignature(raw, sig, secret)) {
    return NextResponse.json({ ok: false, code: "bad_signature" }, { status: 401 });
  }

  let payload: { events?: WebhookEvent[] };
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false, code: "bad_json" }, { status: 400 });
  }
  const events = Array.isArray(payload.events) ? payload.events : [];

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ ok: false, code: "not_configured" }, { status: 503 });
  }

  let applied = 0;
  for (const e of events) {
    const table = TABLE[e.entity];
    if (!table || !e.ref) continue;

    if (e.action === "delete") {
      await admin.from(table).delete().eq("sdwork_ref", e.ref);
      applied++;
      continue;
    }
    const row =
      e.entity === "customer"
        ? toCustomerRow(e)
        : e.entity === "device"
          ? toDeviceRow(e)
          : toSupplyRow(e);
    if (!row) continue;
    const { error } = await admin
      .from(table)
      .upsert({ ...row, updated_at: new Date().toISOString() }, { onConflict: "sdwork_ref" });
    if (!error) applied++;
  }

  return NextResponse.json({ ok: true, applied });
}
