// GET /api/admin/viec?status=moi|da_xu_ly|bo_qua — HÀNG TRỰC VIỆC LÀM (spec 17 §8, §12.6). CHỈ ADMIN (tab admin-only).
// Trả (1) báo xấu gộp theo đích, nhiều người báo trước, kèm bản tin/hồ sơ; (2) tin đang ẩn (để Hiện lại).
// Không SĐT: chủ tin / người tìm tàu = profileId + tên Kairos (cấm đăng dùng chung /api/admin/kairos/action "ban").
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { storeOr503 } from "@/lib/kairos/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hoSoDangHien } from "@/lib/viec";
import { hoSoDto, POST_COLS, SEEKER_COLS, tinDto, unavailable, vErr, type PostRow, type SeekerRow } from "@/lib/viec-server";

type Report = { target_kind: "post" | "seeker"; target_id: string; reason: string | null; created_at: string };

export async function GET(req: Request) {
  const who = await requireAdmin();
  if (!who.ok) return vErr(who.status, who.code);
  const status = new URL(req.url).searchParams.get("status") ?? "moi";
  if (status !== "moi" && status !== "da_xu_ly" && status !== "bo_qua") return vErr(400, "bad_status");
  const admin = createAdminClient();
  if (!admin) return unavailable();
  const s = await storeOr503();
  if (!s.ok) return s.res;

  const [{ data: reps, error: e1 }, { data: anRows, error: e2 }] = await Promise.all([
    admin.from("job_reports").select("target_kind, target_id, reason, created_at").eq("status", status).order("created_at", { ascending: false }).limit(500),
    admin.from("job_posts").select(POST_COLS).eq("status", "an").order("created_at", { ascending: false }).limit(100),
  ]);
  if (e1 || e2) return unavailable();

  const groups = new Map<string, { kind: "post" | "seeker"; id: string; count: number; reasons: string[]; latestAt: string }>();
  for (const r of reps as Report[]) {
    const k = `${r.target_kind}:${r.target_id}`;
    const g = groups.get(k) ?? { kind: r.target_kind, id: r.target_id, count: 0, reasons: [], latestAt: r.created_at };
    g.count++;
    if (r.reason && g.reasons.length < 5) g.reasons.push(r.reason);
    if (r.created_at > g.latestAt) g.latestAt = r.created_at;
    groups.set(k, g);
  }
  const list = [...groups.values()].sort((a, b) => b.count - a.count || (a.latestAt < b.latestAt ? 1 : -1)).slice(0, 100);

  const postIds = list.filter((g) => g.kind === "post").map((g) => g.id);
  const seekerIds = list.filter((g) => g.kind === "seeker").map((g) => g.id);
  try {
    const [{ data: posts, error: e3 }, seekerProfiles] = await Promise.all([
      postIds.length ? admin.from("job_posts").select(POST_COLS).in("id", postIds) : Promise.resolve({ data: [], error: null }),
      seekerIds.length ? s.store.profilesByIds(seekerIds) : Promise.resolve([]),
    ]);
    if (e3) return unavailable();
    const { data: seekers, error: e4 } = seekerProfiles.length
      ? await admin.from("job_seekers").select(SEEKER_COLS).in("phone", seekerProfiles.map((p) => p.phone))
      : { data: [], error: null };
    if (e4) return unavailable();

    const allPosts = [...((posts ?? []) as PostRow[]), ...((anRows ?? []) as PostRow[])];
    const owners = await s.store.profilesByPhones([...new Set(allPosts.map((p) => p.owner_phone))]);
    const ownerOf = new Map(owners.map((p) => [p.phone, { profileId: p.id, ten: p.handle, banned: p.banned_until }]));
    const postView = (p: PostRow) => ({ ...tinDto(p, null), boatReg: p.boat_reg, chu: ownerOf.get(p.owner_phone) ?? null });
    const postById = new Map(((posts ?? []) as PostRow[]).map((p) => [p.id, postView(p)]));
    const seekerByPhone = new Map(((seekers ?? []) as SeekerRow[]).map((r) => [r.phone, r]));
    const now = Date.now();
    const seekerById = new Map(
      seekerProfiles.flatMap((p) => {
        const r = seekerByPhone.get(p.phone);
        return r ? [[p.id, { ...hoSoDto(r, p), dangHien: hoSoDangHien(r, now), chu: { profileId: p.id, ten: p.handle, banned: p.banned_until } }] as const] : [];
      }),
    );
    return NextResponse.json({
      ok: true,
      items: list.map((g) => ({ ...g, target: (g.kind === "post" ? postById.get(g.id) : seekerById.get(g.id)) ?? null })),
      an: ((anRows ?? []) as PostRow[]).map(postView),
    });
  } catch {
    return unavailable();
  }
}
