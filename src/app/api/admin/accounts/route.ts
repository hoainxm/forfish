// /api/admin/accounts — quản lý tài khoản từ /quan-tri. HAI NẤC QUYỀN
// (2026-07-26 đợt 2 — lib/admin-auth.ts):
// · admin (env ADMIN_PHONES): GET/POST/PATCH/DELETE — kể cả tạo TÀI KHOẢN
//   QUẢN LÝ (role='manager') và hạ hạng/xoá
// · manager (customers.role='manager'): GET + PATCH action='grant' — KÍCH
//   HOẠT/GIA HẠN premium cho khách, MỖI LẦN 1 NĂM (nextPremiumUntil), mỗi lần
//   đều ghi LOG premium_grants (granted_by = SĐT người thao tác) → thống kê
//   được mỗi quản lý đang quản bao nhiêu account premium
// · PATCH action='reset-password' (2026-07-29): CHỈ admin — mật khẩu về tạm
//   cố định sd123456 (lib/temp-password), bật lại must_change_password
// Webhook SDWork vẫn là đường nạp khách CHÍNH — tạo tay dành cho ca lẻ.
// Ghi bằng service-role (bypass RLS) — mọi method qua requireStaff/requireAdmin.
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin, requireStaff } from "@/lib/admin-auth";
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

/** NV7 (ba-spec 10) — ghi 1 dòng NHẬT KÝ QUẢN TRỊ. Lỗi ghi KHÔNG chặn thao tác
 *  chính (R4); bảng chưa có (0027 chưa apply) → bỏ qua êm. */
async function writeAudit(
  admin: Admin,
  row: {
    actor: string;
    action: string;
    target?: string | null;
    detail?: string | null;
  },
): Promise<void> {
  try {
    await admin.from("admin_audit").insert({
      actor: row.actor,
      action: row.action,
      target: row.target ?? null,
      detail: row.detail ?? null,
    });
  } catch {
    /* bảng admin_audit chưa có → bỏ qua */
  }
}

export async function GET() {
  const who = await requireStaff();
  if (!who.ok) return err(who.status, who.code);
  const admin = createAdminClient();
  if (!admin) return err(503, "not_configured");

  const BASE_COLS =
    "phone, name, tier, premium_until, premium_activated_at, role, sdwork_ref, updated_at";
  // Cờ chăm khách (0025) — SELECT kèm; cột chưa có (migration chưa apply) thì
  // DEGRADE về select cũ (cờ = false) thay vì 500 vỡ cả danh sách. Kiểu hoá
  // Record để tránh Supabase infer union hỏng khi 2 select khác cột.
  let rows: Record<string, unknown>[] | null = null;
  const first = await admin
    .from("customers")
    .select(BASE_COLS + ", premium_used, contacted")
    .order("updated_at", { ascending: false });
  if (first.error) {
    const fallback = await admin
      .from("customers")
      .select(BASE_COLS)
      .order("updated_at", { ascending: false });
    if (fallback.error) return err(500, "query_failed");
    rows = fallback.data as unknown as Record<string, unknown>[];
  } else {
    rows = first.data as unknown as Record<string, unknown>[];
  }

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

  // NV3 — TRẠNG THÁI THU TIỀN mới nhất mỗi khách (mã CK + đối chiếu). Degrade
  // nếu bảng payments chưa có (0026 chưa apply).
  const latestPay = new Map<
    string,
    { code: string; reconciledStatus: string }
  >();
  try {
    const { data: pays } = await admin
      .from("payments")
      .select("customer_phone, code, reconciled_status, created_at")
      .order("created_at", { ascending: false });
    for (const p of (pays ?? []) as Record<string, unknown>[]) {
      const ph = p.customer_phone as string;
      if (!latestPay.has(ph))
        latestPay.set(ph, {
          code: p.code as string,
          reconciledStatus: (p.reconciled_status as string) ?? "pending",
        });
    }
  } catch {
    /* bảng payments chưa có → không trạng thái thu */
  }

  const accounts = (rows ?? []).map((r) => ({
    phone: r.phone as string,
    name: (r.name as string) ?? null,
    tier: (r.tier as string) ?? "basic",
    premiumUntil: (r.premium_until as string) ?? null,
    premiumActivatedAt: (r.premium_activated_at as string) ?? null,
    role: (r.role as string) ?? "customer",
    fromSdwork: Boolean(r.sdwork_ref),
    updatedAt: (r.updated_at as string) ?? null,
    canLogin: provisioned.has(r.phone as string),
    premiumUsed: Boolean(r.premium_used),
    contacted: Boolean(r.contacted),
    payment: latestPay.get(r.phone as string) ?? null,
  }));

  // R3/AC-8 — ĐẠI LÝ (manager) CHỈ thấy khách MÌNH cấp premium (granted_by).
  // Admin thấy hết. Scope ở SERVER, không chỉ ẩn UI. Bảng log chưa có / đại lý
  // chưa cấp ai → thấy RỖNG (an toàn, không lộ khách người khác).
  let visible = accounts;
  if (who.role === "manager") {
    const owned = new Set<string>();
    try {
      const { data: g } = await admin
        .from("premium_grants")
        .select("customer_phone")
        .eq("granted_by", who.phone);
      for (const row of g ?? []) owned.add(row.customer_phone as string);
    } catch {
      /* premium_grants chưa có → đại lý thấy rỗng */
    }
    visible = accounts.filter((a) => owned.has(a.phone));
  }

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
    accounts: visible,
    grantStats,
  });
}

export async function POST(req: Request) {
  // TẠO tài khoản (khách hoặc TÀI KHOẢN QUẢN LÝ) — chỉ admin
  const who = await requireAdmin();
  if (!who.ok) return err(who.status, who.code);
  const admin = createAdminClient();
  if (!admin) return err(503, "not_configured");

  const body = (await req.json().catch(() => null)) as {
    phone?: string;
    name?: string;
    password?: string;
    role?: string;
    activatePremium?: boolean;
  } | null;
  if (!body?.phone || !isValidVnPhone(body.phone)) return err(400, "bad_phone");
  if (!body.password || body.password.length < 6)
    return err(400, "bad_password");
  // admin (toàn quyền) chỉ admin hiện tại tạo được — POST đã gated requireAdmin
  // ở trên nên an toàn. Dùng để lập TÀI KHOẢN ADMIN CHUNG thay vì gán SĐT cá
  // nhân vào ADMIN_PHONES (env chỉ giữ 1 số bootstrap break-glass).
  const role =
    body.role === "admin"
      ? "admin"
      : body.role === "manager"
        ? "manager"
        : "customer";
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
  await writeAudit(admin, {
    actor: who.phone,
    action: "create_account",
    target: phone,
    detail: `role=${role}${activate ? " +premium" : ""}`,
  });
  return NextResponse.json({ ok: true, phone, provisioned, logged });
}

export async function PATCH(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    phone?: string;
    action?: string;
  } | null;
  if (!body?.phone) return err(400, "bad_phone");
  const phone = normalizeVnPhone(body.phone);
  const nowIso = new Date().toISOString();

  if (body.action === "set_flag") {
    // NV2 (ba-spec 10) — đổi CỜ CHĂM KHÁCH: premium_used | contacted. Staff;
    // manager CHỈ đổi được khách MÌNH cấp premium (R3, scope server).
    const b = body as { flag?: string; value?: boolean };
    const flag =
      b.flag === "premium_used"
        ? "premium_used"
        : b.flag === "contacted"
          ? "contacted"
          : null;
    if (!flag) return err(400, "bad_flag");
    const who = await requireStaff();
    if (!who.ok) return err(who.status, who.code);
    const admin = createAdminClient();
    if (!admin) return err(503, "not_configured");

    if (who.role === "manager") {
      const { data: g } = await admin
        .from("premium_grants")
        .select("customer_phone")
        .eq("granted_by", who.phone)
        .eq("customer_phone", phone)
        .limit(1);
      if (!g || g.length === 0) return err(403, "not_your_customer");
    }

    const { data, error } = await admin
      .from("customers")
      .update({ [flag]: b.value === true, updated_at: nowIso })
      .eq("phone", phone)
      .select("phone");
    if (error) return err(500, "update_failed");
    if (!data || data.length === 0) return err(404, "not_found");
    await writeAudit(admin, {
      actor: who.phone,
      action: "set_flag",
      target: phone,
      detail: `${flag}=${b.value === true}`,
    });
    return NextResponse.json({
      ok: true,
      action: "set_flag",
      flag,
      value: b.value === true,
    });
  }

  if (body.action === "record_payment") {
    // NV3 (ba-spec 10) — GHI NHẬN THU TIỀN bằng MÃ CK. Chỉ mã, KHÔNG số tiền
    // (R1/AC-4). reconciled_status='pending' → chờ SDWork xác nhận (NV4/NV5).
    // Staff; manager CHỈ ghi cho khách MÌNH cấp (R3).
    const b = body as { code?: string };
    const code = (b.code ?? "").trim();
    if (!code) return err(400, "bad_code");
    const who = await requireStaff();
    if (!who.ok) return err(who.status, who.code);
    const admin = createAdminClient();
    if (!admin) return err(503, "not_configured");

    if (who.role === "manager") {
      const { data: g } = await admin
        .from("premium_grants")
        .select("customer_phone")
        .eq("granted_by", who.phone)
        .eq("customer_phone", phone)
        .limit(1);
      if (!g || g.length === 0) return err(403, "not_your_customer");
    }

    const { error } = await admin.from("payments").insert({
      customer_phone: phone,
      code,
      agent_phone: who.phone,
      reconciled_status: "pending",
    });
    if (error) return err(500, "insert_failed");
    await writeAudit(admin, {
      actor: who.phone,
      action: "record_payment",
      target: phone,
      detail: `code=${code}`,
    });
    return NextResponse.json({
      ok: true,
      action: "record_payment",
      code,
      reconciledStatus: "pending",
    });
  }

  if (body.action === "grant") {
    // KÍCH HOẠT / GIA HẠN premium (1 năm/lần) — admin + manager đều được
    const who = await requireStaff();
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
    await writeAudit(admin, {
      actor: who.phone,
      action,
      target: phone,
      detail: `premium_until=${until}`,
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
    await writeAudit(admin, {
      actor: who.phone,
      action: "downgrade",
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

    await writeAudit(admin, {
      actor: who.phone,
      action: "reset_password",
      target: phone,
    });
    return NextResponse.json({
      ok: true,
      action: "reset-password",
      tempPassword: TEMP_RESET_PASSWORD,
    });
  }

  return err(400, "bad_action");
}

export async function DELETE(req: Request) {
  // XOÁ — chỉ admin
  const who = await requireAdmin();
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
  return NextResponse.json({ ok: true });
}
