// Webhook SDWork → SDFish: nạp KH/thiết bị/vật tư vào DB RIÊNG (thay đọc-live).
// Verify HMAC SHA-256 (header x-sdwork-signature, secret SDWORK_WEBHOOK_SECRET)
// trên RAW body. Ghi bằng service-role (bypass RLS). Idempotent theo sdwork_ref.
// Hợp đồng event: docs/integration/sdwork-sso-contract.md.
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { phoneToEmail } from "@/lib/phone";
import {
  passwordSyncIntent,
  toCustomerRow,
  toDeviceRow,
  toSupplyRow,
  verifyWebhookSignature,
  type WebhookEvent,
} from "@/lib/sdwork-webhook";

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

// Đồng bộ mật khẩu đăng nhập (SĐT + mật khẩu) — 1 credential cho cả 2 app.
//  · chưa có user → TẠO (must_change_password=true).
//  · đã có + KHÔNG reset → bỏ qua (không ghi đè mật khẩu KH có thể đã tự đổi).
//  · đã có + reset=true (SDWork chủ động đặt lại) → updateUserById đặt mật khẩu
//    mới + bật must_change_password (lần tới ép đổi). Tra id qua RPC 0003.
// KHÔNG log password.
async function syncAuthPassword(
  admin: Admin,
  phone: string,
  password: string,
  reset: boolean,
) {
  const { error } = await admin.auth.admin.createUser({
    email: phoneToEmail(phone),
    password,
    email_confirm: true,
    user_metadata: { must_change_password: true },
  });
  if (!error) return; // tạo mới xong
  const exists = /registered|exist|already/i.test(error.message);
  if (!exists) throw error;
  if (!reset) return; // đã tồn tại, không yêu cầu reset → giữ nguyên

  const { data: uid, error: rpcErr } = await admin.rpc(
    "auth_user_id_by_phone",
    { p_phone: phone },
  );
  if (rpcErr || !uid) throw rpcErr ?? new Error("user_not_found");
  const { error: updErr } = await admin.auth.admin.updateUserById(uid as string, {
    password,
    user_metadata: { must_change_password: true },
  });
  if (updErr) throw updErr;
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

    // customer kèm mật khẩu → đồng bộ tài khoản đăng nhập (tạo/đặt-lại).
    // Gap B: lỗi đồng bộ KHÔNG chặn ingest nhưng PHẢI hiện trong response để
    // đối soát (provisioned:false = KH chưa đăng nhập được).
    let provisioned: boolean | undefined;
    if (e.entity === "customer") {
      const intent = passwordSyncIntent(e);
      if (intent.password) {
        try {
          await syncAuthPassword(
            admin,
            (row as { phone: string }).phone,
            intent.password,
            intent.reset,
          );
          provisioned = true;
        } catch {
          provisioned = false;
        }
      }
    }
    results.push({ ...base, ok: true, provisioned });
  }

  const applied = results.filter((r) => r.ok).length;
  return NextResponse.json({ ok: true, applied, results });
}
