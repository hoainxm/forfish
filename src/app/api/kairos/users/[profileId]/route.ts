// GET /api/kairos/users/[profileId] — TRANG NGƯỜI DÙNG (14 §3.8, §7, AC13).
// Khách đọc được. `profileId` = uuid công khai (KHÔNG SĐT): tên, dòng phụ, số bài, đang theo
// dõi chưa, đã chặn chưa, ảnh bìa + Giới thiệu (0067), số người theo dõi / đang theo dõi,
// "cùng cảng" với người xem, mời đặt tên (trang mình), và trang bài đầu (cursor 20). Người mình đã chặn ⇒ `blockedByMe`,
// không trả bài (màn hiện "Bạn đã chặn người này" + Bỏ chặn).
import { NextResponse } from "next/server";
import { encodeCursor } from "@/lib/kairos/cursor";
import { parseFeedParams } from "@/lib/kairos/feed-query";
import { samePort, shouldAskName } from "@/lib/kairos/ho-so";
import { feedFilterFor, hydratePosts, kErr, kairosErrorResponse, PORT_IDS, profileCard, readerOf, storeOr503 } from "@/lib/kairos/server";
import { LIMITS } from "@/lib/kairos/types";
import { isUuid } from "@/lib/kairos/validate";

type Ctx = { params: Promise<{ profileId: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const { profileId } = await ctx.params;
  if (!isUuid(profileId)) return kErr(404, "not_found");
  const who = await readerOf(req);
  if (!who.ok) return who.res;
  const s = await storeOr503();
  if (!s.ok) return s.res;
  const { store } = s;
  try {
    const prof = await store.profileById(profileId.toLowerCase());
    if (!prof) return kErr(404, "not_found");
    const me = who.phone === prof.phone;
    const [following, blocked] = who.phone && !me
      ? await Promise.all([store.edgesFrom("follow", who.phone), store.edgesFrom("block", who.phone)])
      : [[], []];
    const blockedByMe = blocked.includes(prof.phone);
    const viewerProf = who.phone && !me ? await store.profileByPhone(who.phone) : null;
    const [card, viewerCard, postCount, counts] = await Promise.all([
      profileCard(store, prof),
      viewerProf ? profileCard(store, viewerProf) : Promise.resolve(null),
      store.countAuthorPosts(prof.phone),
      store.followCounts(prof.phone),
    ]);
    const user = {
      ...card.author,
      postCount,
      following: following.includes(prof.phone),
      blockedByMe,
      me,
      about: card.about,
      followers: counts.followers,
      followingCount: counts.following,
      samePort: !!viewerCard && samePort(card.portId, viewerCard.portId),
      // nợ: chưa có cột cờ agent (16-ba-spec-agent-kairos nháp) — luôn false; thêm cột khi agent lên
      isAgent: false,
      askName: me && shouldAskName(prof),
    };
    if (blockedByMe) return NextResponse.json({ ok: true, user, posts: [], next: null });

    const sp = new URL(req.url).searchParams;
    const parsed = parseFeedParams(new URLSearchParams({ author: prof.id, ...(sp.get("cursor") ? { cursor: sp.get("cursor")! } : {}) }), PORT_IDS);
    if (!parsed.ok) return kErr(400, parsed.code);
    const f = await feedFilterFor(store, parsed.value, who.phone, Date.now());
    if (!f.ok) return f.res;
    const rows = await store.listPosts(f.filter, LIMITS.pageSize + 1);
    const page = rows.slice(0, LIMITS.pageSize);
    const last = page[page.length - 1];
    const next = rows.length > LIMITS.pageSize && last ? encodeCursor({ at: last.feed_at, id: last.id }) : null;
    return NextResponse.json({ ok: true, user, posts: await hydratePosts(store, page, who.phone, f.blocked), next });
  } catch (e) {
    return kairosErrorResponse(e);
  }
}
