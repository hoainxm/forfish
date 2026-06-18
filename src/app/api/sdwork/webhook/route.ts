// Webhook SDWork → SDFish: nạp KH/thiết bị/vật tư vào DB RIÊNG (thay đọc-live).
// Verify HMAC SHA-256 (header x-sdwork-signature, secret SDWORK_WEBHOOK_SECRET)
// trên RAW body. Ghi bằng service-role (bypass RLS). Idempotent theo sdwork_ref.
// Hợp đồng event: docs/integration/sdwork-sso-contract.md.
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { phoneToEmail } from "@/lib/phone";
import {
  toCustomerRow,
  toDeviceRow,
  toSupplyRow,
  verifyWebhookSignature,
  type WebhookEvent,
} from "@/lib/sdwork-webhook";

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

// Provision tài khoản đăng nhập (SĐT + mật khẩu) khi customer event kèm
// password. Tạo lần đầu (must_change_password=true); ĐÃ tồn tại → bỏ qua, KHÔNG
// ghi đè mật khẩu KH có thể đã đổi (reset mật khẩu = Đợt 2). KHÔNG log password.
async function provisionAuthUser(admin: Admin, phone: string, password: string) {
  const { error } = await admin.auth.admin.createUser({
    email: phoneToEmail(phone),
    password,
    email_confirm: true,
    user_metadata: { must_change_password: true },
  });
  // "đã đăng ký" = đã provision trước → bình thường, bỏ qua
  if (error && !/registered|exist|already/i.test(error.message)) {
    throw error;
  }
}

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

  // Kết quả per-event (Gap A: partial-fail không còn câm — SDWork đánh dấu
  // outbox chính xác theo ref thay vì đoán qua applied count).
  type EventResult = {
    ref: string;
    entity: string;
    action: string;
    ok: boolean;
    code?: string;
    provisioned?: boolean; // chỉ customer có password: tạo được auth user?
  };
  const results: EventResult[] = [];

  for (const e of events) {
    const base = { ref: e.ref, entity: e.entity, action: e.action };
    const table = TABLE[e.entity];
    if (!table || !e.ref) {
      results.push({ ...base, ok: false, code: "bad_event" });
      continue;
    }

    if (e.action === "delete") {
      const { error } = await admin.from(table).delete().eq("sdwork_ref", e.ref);
      results.push({ ...base, ok: !error, code: error ? "delete_failed" : undefined });
      continue;
    }
    const row =
      e.entity === "customer"
        ? toCustomerRow(e)
        : e.entity === "device"
          ? toDeviceRow(e)
          : toSupplyRow(e);
    if (!row) {
      results.push({ ...base, ok: false, code: "missing_required" });
      continue;
    }
    const { error } = await admin
      .from(table)
      .upsert({ ...row, updated_at: new Date().toISOString() }, { onConflict: "sdwork_ref" });
    if (error) {
      results.push({ ...base, ok: false, code: "upsert_failed" });
      continue;
    }

    // customer kèm mật khẩu → provision tài khoản đăng nhập (SĐT + mk).
    // Gap B: lỗi provision KHÔNG chặn ingest nhưng PHẢI hiện trong response để
    // đối soát (provisioned:false = KH chưa đăng nhập được).
    let provisioned: boolean | undefined;
    if (e.entity === "customer" && typeof e.data.password === "string" && e.data.password) {
      try {
        await provisionAuthUser(admin, (row as { phone: string }).phone, e.data.password);
        provisioned = true;
      } catch {
        provisioned = false;
      }
    }
    results.push({ ...base, ok: true, provisioned });
  }

  const applied = results.filter((r) => r.ok).length;
  return NextResponse.json({ ok: true, applied, results });
}
