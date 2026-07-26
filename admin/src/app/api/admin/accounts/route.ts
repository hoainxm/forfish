// Quản lý tài khoản khách SDFish từ web quản trị (chuyển từ app chính sang
// 2026-07-26 — app ngư dân KHÔNG còn route admin nào).
// · GET    danh sách customers + trạng thái provision (có auth user chưa)
// · POST   tạo tài khoản tay: customers row + auth user (SĐT + mật khẩu tạm)
// · PATCH  đổi hạng basic/premium (+ hạn premium_until)
// · DELETE xoá tài khoản: auth user + customers row (UI bắt confirm)
// Ghi bằng service-role (bypass RLS) — MỌI method qua requireAdmin() trước.
// Webhook SDWork (bên app chính) vẫn là đường nạp CHÍNH; tạo tay cho ca lẻ.
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin-auth";
import { isValidVnPhone, normalizeVnPhone, phoneToEmail } from "@/lib/phone";

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

const err = (status: number, code: string) =>
  NextResponse.json({ ok: false, code }, { status });

async function guard(): Promise<Admin | NextResponse> {
  const who = await requireAdmin();
  if (!who.ok) return err(who.status, who.code);
  const admin = createAdminClient();
  if (!admin) return err(503, "not_configured");
  return admin;
}

/** auth user theo email ảo — supabase-js chưa có getUserByEmail nên phân trang */
async function findAuthUser(admin: Admin, email: string) {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw error;
    const hit = data.users.find((u) => u.email === email);
    if (hit) return hit;
    if (data.users.length < 200) return null;
  }
  return null;
}

export async function GET() {
  const admin = await guard();
  if (admin instanceof NextResponse) return admin;

  const { data: rows, error } = await admin
    .from("customers")
    .select("phone, name, tier, premium_until, sdwork_ref, updated_at")
    .order("updated_at", { ascending: false });
  if (error) return err(500, "query_failed");

  const provisioned = new Set<string>();
  try {
    for (let page = 1; page <= 20; page++) {
      const { data, error: e } = await admin.auth.admin.listUsers({
        page,
        perPage: 200,
      });
      if (e) throw e;
      for (const u of data.users) {
        if (u.email) provisioned.add(u.email.split("@")[0]);
      }
      if (data.users.length < 200) break;
    }
  } catch {
    // đối chiếu hỏng thì vẫn trả danh sách — cột "đăng nhập được" để trống
  }

  return NextResponse.json({
    ok: true,
    accounts: (rows ?? []).map((r) => ({
      phone: r.phone as string,
      name: (r.name as string) ?? null,
      tier: (r.tier as string) ?? "basic",
      premiumUntil: (r.premium_until as string) ?? null,
      fromSdwork: Boolean(r.sdwork_ref),
      updatedAt: (r.updated_at as string) ?? null,
      canLogin: provisioned.has(r.phone as string),
    })),
  });
}

export async function POST(req: Request) {
  const admin = await guard();
  if (admin instanceof NextResponse) return admin;

  const body = (await req.json().catch(() => null)) as {
    phone?: string;
    name?: string;
    password?: string;
    tier?: string;
    premiumUntil?: string | null;
  } | null;
  if (!body?.phone || !isValidVnPhone(body.phone)) return err(400, "bad_phone");
  if (!body.password || body.password.length < 6) return err(400, "bad_password");
  const tier = body.tier === "premium" ? "premium" : "basic";
  const phone = normalizeVnPhone(body.phone);

  const { error: upErr } = await admin.from("customers").upsert(
    {
      phone,
      name: body.name?.trim() || null,
      tier,
      premium_until: tier === "premium" ? (body.premiumUntil ?? null) : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "phone" },
  );
  if (upErr) return err(500, "upsert_failed");

  // cùng nếp webhook app chính: user đã tồn tại thì bỏ qua, KHÔNG đè mật khẩu
  const { error: authErr } = await admin.auth.admin.createUser({
    email: phoneToEmail(phone),
    password: body.password,
    email_confirm: true,
    user_metadata: { must_change_password: true },
  });
  const provisioned =
    !authErr || /registered|exist|already/i.test(authErr.message);
  return NextResponse.json({ ok: true, phone, provisioned });
}

export async function PATCH(req: Request) {
  const admin = await guard();
  if (admin instanceof NextResponse) return admin;

  const body = (await req.json().catch(() => null)) as {
    phone?: string;
    tier?: string;
    premiumUntil?: string | null;
  } | null;
  if (!body?.phone) return err(400, "bad_phone");
  if (body.tier !== "basic" && body.tier !== "premium")
    return err(400, "bad_tier");

  const { data, error } = await admin
    .from("customers")
    .update({
      tier: body.tier,
      premium_until:
        body.tier === "premium" ? (body.premiumUntil ?? null) : null,
      updated_at: new Date().toISOString(),
    })
    .eq("phone", normalizeVnPhone(body.phone))
    .select("phone");
  if (error) return err(500, "update_failed");
  if (!data || data.length === 0) return err(404, "not_found");
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const admin = await guard();
  if (admin instanceof NextResponse) return admin;

  const phoneRaw = new URL(req.url).searchParams.get("phone");
  if (!phoneRaw) return err(400, "bad_phone");
  const phone = normalizeVnPhone(phoneRaw);

  try {
    const authUser = await findAuthUser(admin, phoneToEmail(phone));
    if (authUser) await admin.auth.admin.deleteUser(authUser.id);
  } catch {
    return err(500, "auth_delete_failed");
  }
  const { error } = await admin.from("customers").delete().eq("phone", phone);
  if (error) return err(500, "delete_failed");
  return NextResponse.json({ ok: true });
}
