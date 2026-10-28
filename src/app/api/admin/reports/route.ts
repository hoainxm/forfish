// /api/admin/reports — BÁO CÁO SỐ LIỆU cho tab "Báo cáo" ở /quan-tri. Admin + quản lý
// được tick `bao-cao:view` ở tab Phân quyền (2026-10-28; trước đó admin-only).
// GET ?period=day|week|month|year → chuỗi theo kỳ (đăng ký, premium bán ra,
// bài + bình luận Kairos của bà con, đơn chợ vật tư) + ảnh chụp hiện tại (mở app,
// đủ đồ đi biển, máy theo loại) + người cấp premium nhiều nhất.
// Luật đếm (chỉ khách thật, giờ VN) ở lib/admin-reports — route chỉ đọc DB.
// Nguồn nào đọc hỏng ⇒ chuỗi đó = null + tên nguồn trong `failed`, phần còn lại
// vẫn trả (một bảng chưa apply migration không làm trắng cả báo cáo).
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin-auth";
import {
  type CustomerRow,
  type DeviceRow,
  type GrantRow,
  countSeries,
  devicesByPlatform,
  excludedPhones,
  isCountable,
  isSaleGrant,
  parsePeriod,
  rangeStartIso,
  topGranters,
  usageSnapshot,
} from "@/lib/admin-reports";
import { createAdminClient } from "@/lib/supabase/admin";

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

const err = (status: number, code: string) =>
  NextResponse.json({ ok: false, code }, { status });

const PAGE = 1000; // trần mỗi lượt select của PostgREST
// nợ: gộp số liệu trong bộ nhớ, trần 20 trang × 1000 dòng mỗi bảng (~20k) — vượt
// thì báo `truncated`; khi khách thật > ~10k thì chuyển sang RPC/view đếm trong DB.
const MAX_PAGES = 20;

type Read<T> = { rows: T[]; truncated: boolean } | null;

/** Đọc hết bảng theo trang. Lỗi ⇒ null (caller ghi vào `failed`, không ném). */
async function readAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>,
): Promise<Read<T>> {
  const rows: T[] = [];
  try {
    for (let p = 0; p < MAX_PAGES; p++) {
      const { data, error } = await build(p * PAGE, p * PAGE + PAGE - 1);
      if (error) return null;
      const batch = (data ?? []) as T[];
      rows.push(...batch);
      if (batch.length < PAGE) return { rows, truncated: false };
    }
    return { rows, truncated: true };
  } catch {
    return null;
  }
}

/** Tài khoản đăng nhập (auth.users): SĐT nằm ở phần trước @ của email ảo. */
async function readSignups(admin: Admin): Promise<Read<{ phone: string; created_at: string }>> {
  const rows: { phone: string; created_at: string }[] = [];
  try {
    for (let page = 1; page <= MAX_PAGES * 5; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) return null;
      for (const u of data.users)
        if (u.email) rows.push({ phone: u.email.split("@")[0], created_at: u.created_at });
      if (data.users.length < 200) return { rows, truncated: false };
    }
    return { rows, truncated: true };
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const who = await requirePermission("bao-cao", "view");
  if (!who.ok) return err(who.status, who.code);
  const admin = createAdminClient();
  if (!admin) return err(503, "not_configured");

  const period = parsePeriod(new URL(req.url).searchParams.get("period"));
  const nowMs = Date.now();
  const since = rangeStartIso(nowMs, period);

  const [customers, staff, signups, grants, devices, posts, comments, orders] = await Promise.all([
    readAll<CustomerRow>((a, b) =>
      admin
        .from("customers")
        .select("phone, account_kind, role, tier, premium_until, pwa_last_open_at, web_last_open_at, offline_ready_at")
        .order("id")
        .range(a, b),
    ),
    readAll<{ phone: string }>((a, b) => admin.from("staff_accounts").select("phone").order("phone").range(a, b)),
    readSignups(admin),
    readAll<GrantRow>((a, b) =>
      admin
        .from("premium_grants")
        .select("customer_phone, granted_by, action, created_at")
        .gte("created_at", since)
        .order("id")
        .range(a, b),
    ),
    readAll<DeviceRow>((a, b) =>
      admin.from("customer_devices").select("customer_phone, platform, last_seen_at").order("id").range(a, b),
    ),
    // chỉ bài BÀ CON (bỏ "bao" = báo tự gom, "chinh-thuc" = SDVICO đăng)
    readAll<{ author_phone: string | null; created_at: string }>((a, b) =>
      admin
        .from("kairos_posts")
        .select("author_phone, created_at")
        .eq("kind", "ba-con")
        .gte("created_at", since)
        .order("id")
        .range(a, b),
    ),
    readAll<{ author_phone: string | null; created_at: string }>((a, b) =>
      admin
        .from("kairos_comments")
        .select("author_phone, created_at")
        .gte("created_at", since)
        .order("id")
        .range(a, b),
    ),
    readAll<{ buyer_phone: string | null; created_at: string }>((a, b) =>
      admin
        .from("market_orders")
        .select("buyer_phone, created_at")
        .gte("created_at", since)
        .order("id")
        .range(a, b),
    ),
  ]);

  // Không đọc được danh sách loại trừ ⇒ KHÔNG đếm gì cả: số lẫn tài khoản thử
  // + nhân sự là số sai mà trông như đúng.
  if (!customers || !staff) return err(500, "query_failed");
  const excluded = excludedPhones(customers.rows, staff.rows.map((s) => s.phone));

  const failed: string[] = [];
  const truncated: string[] = [];
  const track = <T,>(name: string, r: Read<T>): T[] | null => {
    if (!r) {
      failed.push(name);
      return null;
    }
    if (r.truncated) truncated.push(name);
    return r.rows;
  };
  if (customers.truncated) truncated.push("customers");

  const series = <T,>(name: string, r: Read<T>, phone: (x: T) => string | null, at: (x: T) => string | null) => {
    const rows = track(name, r);
    if (!rows) return null;
    return countSeries(
      rows.filter((x) => isCountable(phone(x), excluded)).map(at),
      period,
      nowMs,
    );
  };

  const signupRows = track("signups", signups);
  const countableSignups = signupRows?.filter((u) => isCountable(u.phone, excluded)) ?? null;
  const grantRows = track("premium_grants", grants);
  const deviceRows = track("customer_devices", devices);

  return NextResponse.json({
    ok: true,
    period,
    generatedAt: new Date(nowMs).toISOString(),
    since,
    series: {
      signups: countableSignups ? countSeries(countableSignups.map((u) => u.created_at), period, nowMs) : null,
      premium: grantRows
        ? countSeries(
            grantRows.filter((g) => isSaleGrant(g) && isCountable(g.customer_phone, excluded)).map((g) => g.created_at),
            period,
            nowMs,
          )
        : null,
      posts: series("kairos_posts", posts, (x) => x.author_phone, (x) => x.created_at),
      comments: series("kairos_comments", comments, (x) => x.author_phone, (x) => x.created_at),
      orders: series("market_orders", orders, (x) => x.buyer_phone, (x) => x.created_at),
    },
    /** tổng tài khoản đăng nhập được của khách thật (mọi thời điểm) */
    accountsTotal: countableSignups?.length ?? null,
    snapshot: usageSnapshot(customers.rows, excluded, nowMs),
    granters: grantRows ? topGranters(grantRows, excluded, since) : null,
    platforms: deviceRows ? devicesByPlatform(deviceRows, excluded, nowMs) : null,
    failed,
    truncated,
  });
}
