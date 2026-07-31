// /api/admin/accounts — quản lý tài khoản từ /quan-tri. PHÂN QUYỀN (2026-07-30
// — lib/admin-auth.ts + staff-permissions.ts) trên tab "tai-khoan":
// · GET                     → view   (admin + quản lý có cờ view)
// · POST tạo KHÁCH          → create; tạo TÀI KHOẢN QUẢN LÝ (role='manager')
//                             vẫn ADMIN-ONLY CỨNG dù có cờ create
// · PATCH action='grant'    → edit   (kích hoạt/gia hạn premium 1 năm + log)
// · PATCH action='downgrade'→ ADMIN-ONLY CỨNG (hạ hạng — thao tác nhạy cảm)
// · PATCH action='reset-password' → ADMIN-ONLY CỨNG (đặt lại mật khẩu tạm)
// · DELETE                  → delete (admin + quản lý có cờ delete)
// Mỗi lần cấp/hạ đều ghi LOG premium_grants (granted_by = SĐT người thao tác).
// Webhook SDWork vẫn là đường nạp khách CHÍNH — tạo tay dành cho ca lẻ.
// Ghi bằng service-role (bypass RLS).
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin, requirePermission } from "@/lib/admin-auth";
import { logActivity } from "@/lib/admin-activity-log";
import { isAdminPhone, parseAdminPhones } from "@/lib/admin";
import { isValidVnPhone, normalizeVnPhone, phoneToEmail } from "@/lib/phone";
import { TEMP_RESET_PASSWORD } from "@/lib/temp-password";
import { nextPremiumUntil, resolveTier } from "@/lib/tier";

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

const err = (status: number, code: string) =>
  NextResponse.json({ ok: false, code }, { status });

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

/** Ghi log cấp/hạ premium — log hỏng KHÔNG chặn thao tác chính, nhưng trả cờ
 *  `logged` để UI nói thật (không im lặng nuốt lỗi). */
async function writeGrantLog(
  admin: Admin,
  row: {
    customer_phone: string;
    granted_by: string;
    action: "activate" | "renew" | "downgrade";
    premium_until: string | null;
  },
): Promise<boolean> {
  try {
    const { error } = await admin.from("premium_grants").insert(row);
    return !error;
  } catch {
    return false;
  }
}

export async function GET() {
  const who = await requirePermission("tai-khoan", "view");
  if (!who.ok) return err(who.status, who.code);
  const admin = createAdminClient();
  if (!admin) return err(503, "not_configured");

  const { data: rows, error } = await admin
    .from("customers")
    .select(
      "phone, name, tier, premium_until, premium_activated_at, role, sdwork_ref, updated_at, staff_used, staff_guided, staff_note_by, staff_note_at",
    )
    .order("updated_at", { ascending: false });
  if (error) return err(500, "query_failed");

  // đối chiếu auth: SĐT nào đăng nhập được (đã provision)
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

  // QUẢN TRỊ VIÊN = env ADMIN_PHONES HOẶC role='admin' (2026-07-31, hai nguồn
  // — xem lib/admin-auth.ts). Trả cờ thật + nguồn để UI dán nhãn khỏi lẫn với
  // quản lý.
  const adminPhones = parseAdminPhones(process.env.ADMIN_PHONES);

  const accounts = (rows ?? []).map((r) => ({
    phone: r.phone as string,
    name: (r.name as string) ?? null,
    tier: (r.tier as string) ?? "basic",
    premiumUntil: (r.premium_until as string) ?? null,
    premiumActivatedAt: (r.premium_activated_at as string) ?? null,
    role: (r.role as string) ?? "customer",
    /** admin THẬT — env HOẶC role='admin' */
    isAdmin:
      isAdminPhone(r.phone as string, adminPhones) || r.role === "admin",
    fromSdwork: Boolean(r.sdwork_ref),
    updatedAt: (r.updated_at as string) ?? null,
    canLogin: provisioned.has(r.phone as string),
    // ghi chú theo dõi onboarding của staff (0018)
    staffUsed: Boolean(r.staff_used),
    staffGuided: Boolean(r.staff_guided),
    noteBy: (r.staff_note_by as string) ?? null,
    noteAt: (r.staff_note_at as string) ?? null,
  }));

  // THỐNG KÊ THEO NGƯỜI CẤP: mỗi khách tính theo lần cấp GẦN NHẤT
  // (activate/renew); "đang quản" = khách đó hiện còn premium hiệu lực.
  const grantStats: { by: string; managing: number; totalGrants: number }[] =
    [];
  try {
    const { data: grants, error: gErr } = await admin
      .from("premium_grants")
      .select("customer_phone, granted_by, action, created_at")
      .in("action", ["activate", "renew"])
      .order("created_at", { ascending: false })
      .limit(5000);
    if (!gErr && grants) {
      const now = Date.now();
      const premiumNow = new Set(
        accounts
          .filter((a) => resolveTier(a.tier, a.premiumUntil, now) === "premium")
          .map((a) => a.phone),
      );
      const latestBy = new Map<string, string>(); // khách → người cấp gần nhất
      const total = new Map<string, number>();
      for (const g of grants) {
        const phone = g.customer_phone as string;
        const by = g.granted_by as string;
        if (!latestBy.has(phone)) latestBy.set(phone, by);
        total.set(by, (total.get(by) ?? 0) + 1);
      }
      const managing = new Map<string, number>();
      for (const [phone, by] of latestBy) {
        if (premiumNow.has(phone))
          managing.set(by, (managing.get(by) ?? 0) + 1);
      }
      for (const by of new Set([...total.keys(), ...managing.keys()])) {
        grantStats.push({
          by,
          managing: managing.get(by) ?? 0,
          totalGrants: total.get(by) ?? 0,
        });
      }
      grantStats.sort((a, b) => b.managing - a.managing);
    }
  } catch {
    /* bảng log chưa có (0004 chưa apply) → thống kê trống, danh sách vẫn trả */
  }

  return NextResponse.json({
    ok: true,
    me: { phone: who.phone, role: who.role },
    accounts,
    grantStats,
  });
}

export async function POST(req: Request) {
  // TẠO tài khoản. Đọc body TRƯỚC để chọn cổng quyền: tạo NHÂN SỰ (quản lý
  // hoặc quản trị viên) ADMIN-ONLY CỨNG; tạo KHÁCH cần cờ tai-khoan:create.
  // Hai luồng tách hẳn trên UI (user 2026-07-31): khách ở tab Tài khoản, nhân
  // sự ở tab Phân quyền — nhưng chung một route vì cùng là một hàng customers.
  const body = (await req.json().catch(() => null)) as {
    phone?: string;
    name?: string;
    password?: string;
    role?: string;
    activatePremium?: boolean;
  } | null;
  const role =
    body?.role === "manager"
      ? "manager"
      : body?.role === "admin"
        ? "admin"
        : "customer";
  const who =
    role === "customer"
      ? await requirePermission("tai-khoan", "create")
      : await requireAdmin();
  if (!who.ok) return err(who.status, who.code);
  const admin = createAdminClient();
  if (!admin) return err(503, "not_configured");

  if (!body?.phone || !isValidVnPhone(body.phone)) return err(400, "bad_phone");
  if (!body.password || body.password.length < 6)
    return err(400, "bad_password");
  const phone = normalizeVnPhone(body.phone);
  const now = new Date().toISOString();

  // tạo kèm premium = một lần KÍCH HOẠT chuẩn (1 năm + log) — không nhập hạn tay
  const activate = Boolean(body.activatePremium);
  const until = activate ? nextPremiumUntil(null, Date.now()) : null;

  const { error: upErr } = await admin.from("customers").upsert(
    {
      phone,
      name: body.name?.trim() || null,
      role,
      ...(activate
        ? { tier: "premium", premium_until: until, premium_activated_at: now }
        : {}),
      updated_at: now,
    },
    { onConflict: "phone" },
  );
  if (upErr) return err(500, "upsert_failed");

  let logged = true;
  if (activate) {
    logged = await writeGrantLog(admin, {
      customer_phone: phone,
      granted_by: who.phone,
      action: "activate",
      premium_until: until,
    });
  }

  // provision auth — cùng nếp webhook: đã tồn tại thì bỏ qua, KHÔNG đè mật khẩu
  const { error: authErr } = await admin.auth.admin.createUser({
    email: phoneToEmail(phone),
    password: body.password,
    email_confirm: true,
    user_metadata: { must_change_password: true },
  });
  const provisioned =
    !authErr || /registered|exist|already/i.test(authErr.message);
  await logActivity(admin, {
    actorPhone: who.phone,
    // requireAdmin (tạo quản lý) không trả role → mặc định 'admin'
    actorRole: (who as { role?: "admin" | "manager" }).role ?? "admin",
    action: "account.create",
    target: phone,
    detail: { role, activatePremium: activate },
  });
  return NextResponse.json({ ok: true, phone, provisioned, logged });
}

export async function PATCH(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    phone?: string;
    action?: string;
    used?: boolean;
    guided?: boolean;
  } | null;
  if (!body?.phone) return err(400, "bad_phone");
  const phone = normalizeVnPhone(body.phone);
  const nowIso = new Date().toISOString();

  if (body.action === "grant") {
    // KÍCH HOẠT / GIA HẠN premium (1 năm/lần) — cần cờ tai-khoan:edit
    const who = await requirePermission("tai-khoan", "edit");
    if (!who.ok) return err(who.status, who.code);
    const admin = createAdminClient();
    if (!admin) return err(503, "not_configured");

    const { data: cur, error: qErr } = await admin
      .from("customers")
      .select("tier, premium_until")
      .eq("phone", phone)
      .maybeSingle();
    if (qErr) return err(500, "query_failed");
    if (!cur) return err(404, "not_found");

    const isActive =
      resolveTier(
        cur.tier as string,
        cur.premium_until as string | null,
        Date.now(),
      ) === "premium";
    // còn hạn → cộng nối vào hạn cũ; hết hạn/chưa có → 1 năm từ bây giờ
    const until = nextPremiumUntil(
      isActive ? (cur.premium_until as string | null) : null,
      Date.now(),
    );
    const action = isActive ? ("renew" as const) : ("activate" as const);

    const { error } = await admin
      .from("customers")
      .update({
        tier: "premium",
        premium_until: until,
        premium_activated_at: nowIso,
        updated_at: nowIso,
      })
      .eq("phone", phone);
    if (error) return err(500, "update_failed");

    const logged = await writeGrantLog(admin, {
      customer_phone: phone,
      granted_by: who.phone,
      action,
      premium_until: until,
    });
    await logActivity(admin, {
      actorPhone: who.phone,
      actorRole: who.role,
      action: "account.grant",
      target: phone,
      detail: { grant: action, premiumUntil: until },
    });
    return NextResponse.json({ ok: true, action, premiumUntil: until, logged });
  }

  if (body.action === "downgrade") {
    // HẠ HẠNG — chỉ admin (quản lý không được hạ khách của người khác)
    const who = await requireAdmin();
    if (!who.ok) return err(who.status, who.code);
    const admin = createAdminClient();
    if (!admin) return err(503, "not_configured");

    const { data, error } = await admin
      .from("customers")
      .update({
        tier: "basic",
        premium_until: null,
        premium_activated_at: null,
        updated_at: nowIso,
      })
      .eq("phone", phone)
      .select("phone");
    if (error) return err(500, "update_failed");
    if (!data || data.length === 0) return err(404, "not_found");

    const logged = await writeGrantLog(admin, {
      customer_phone: phone,
      granted_by: who.phone,
      action: "downgrade",
      premium_until: null,
    });
    await logActivity(admin, {
      actorPhone: who.phone,
      actorRole: "admin",
      action: "account.downgrade",
      target: phone,
    });
    return NextResponse.json({ ok: true, action: "downgrade", logged });
  }

  if (body.action === "reset-password") {
    // ĐẶT LẠI MẬT KHẨU — chỉ admin (manager không được reset tài khoản khách).
    // Mật khẩu về tạm cố định sd123456; must_change_password bật lại để khách
    // bị bắt tự đổi ngay lần đăng nhập kế. Phiên cũ của khách không thu hồi
    // được từ đây (supabase-js chưa có admin signOut theo id) — nhưng lần
    // đăng nhập mới sẽ tự đá phiên cũ (signOut scope 'others' ở /login).
    const who = await requireAdmin();
    if (!who.ok) return err(who.status, who.code);
    const admin = createAdminClient();
    if (!admin) return err(503, "not_configured");

    let authUser: Awaited<ReturnType<typeof findAuthUser>>;
    try {
      authUser = await findAuthUser(admin, phoneToEmail(phone));
    } catch {
      return err(500, "auth_lookup_failed");
    }
    if (!authUser) return err(404, "not_provisioned");

    const { error } = await admin.auth.admin.updateUserById(authUser.id, {
      password: TEMP_RESET_PASSWORD,
      // giữ metadata cũ (full_name…) — updateUserById GHI ĐÈ cả object
      user_metadata: { ...authUser.user_metadata, must_change_password: true },
    });
    if (error) return err(500, "reset_failed");

    await logActivity(admin, {
      actorPhone: who.phone,
      actorRole: "admin",
      action: "account.reset-password",
      target: phone,
    });
    return NextResponse.json({
      ok: true,
      action: "reset-password",
      tempPassword: TEMP_RESET_PASSWORD,
    });
  }

  if (body.action === "set-flags") {
    // GHI CHÚ THEO DÕI onboarding (0018): đã/chưa SỬ DỤNG · đã/chưa HƯỚNG DẪN
    // TRỰC TIẾP — cần cờ tai-khoan:edit (admin toàn quyền). Chỉ vá cờ được gửi.
    const who = await requirePermission("tai-khoan", "edit");
    if (!who.ok) return err(who.status, who.code);
    const admin = createAdminClient();
    if (!admin) return err(503, "not_configured");

    const patch: Record<string, unknown> = {
      staff_note_by: who.phone,
      staff_note_at: nowIso,
    };
    if (typeof body.used === "boolean") patch.staff_used = body.used;
    if (typeof body.guided === "boolean") patch.staff_guided = body.guided;
    if (Object.keys(patch).length <= 2) return err(400, "nothing_to_update");

    const { data, error } = await admin
      .from("customers")
      .update(patch)
      .eq("phone", phone)
      .select("phone");
    if (error) return err(500, "update_failed");
    if (!data || data.length === 0) return err(404, "not_found");

    await logActivity(admin, {
      actorPhone: who.phone,
      actorRole: who.role,
      action: "account.set-flags",
      target: phone,
      detail: {
        ...(typeof body.used === "boolean" ? { used: body.used } : {}),
        ...(typeof body.guided === "boolean" ? { guided: body.guided } : {}),
      },
    });
    return NextResponse.json({
      ok: true,
      action: "set-flags",
      noteBy: who.phone,
      noteAt: nowIso,
    });
  }

  return err(400, "bad_action");
}

export async function DELETE(req: Request) {
  // XOÁ tài khoản — cần cờ tai-khoan:delete (admin toàn quyền)
  const who = await requirePermission("tai-khoan", "delete");
  if (!who.ok) return err(who.status, who.code);
  const admin = createAdminClient();
  if (!admin) return err(503, "not_configured");

  const phoneRaw = new URL(req.url).searchParams.get("phone");
  if (!phoneRaw) return err(400, "bad_phone");
  const phone = normalizeVnPhone(phoneRaw);

  // xoá auth user trước (đăng nhập tắt ngay), rồi tới dữ liệu customers
  try {
    const authUser = await findAuthUser(admin, phoneToEmail(phone));
    if (authUser) await admin.auth.admin.deleteUser(authUser.id);
  } catch {
    return err(500, "auth_delete_failed");
  }
  const { error } = await admin.from("customers").delete().eq("phone", phone);
  if (error) return err(500, "delete_failed");
  await logActivity(admin, {
    actorPhone: who.phone,
    actorRole: who.role,
    action: "account.delete",
    target: phone,
  });
  return NextResponse.json({ ok: true });
}
