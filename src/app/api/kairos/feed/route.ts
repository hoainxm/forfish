// GET /api/kairos/feed — DÒNG TIN KAIROS (14 §3.2, §7, AC02/AC03/AC13/AC14).
//
// Khách đọc được (identityFromRequest anonymous). 20 bài/trang theo (feed_at desc, id desc),
// con trỏ mờ `next`; kèm 2 bình luận nhiều Hay nhất mỗi bài. Trang đầu chip "Mới" (không lọc
// người/cảng) trả thêm `pinned` — bài Chính thức còn ghim, đã bỏ khỏi `posts` để khỏi lặp.
// Lọc chip phía máy chủ: chủ đề · cảng (Cảng tôi / Bến) · tỉnh/vùng (Gần tôi) · theo dõi · người.
// Thói quen đọc KHÔNG gửi lên — app tự xếp lại trong trang (lib/kairos/xep-bai.ts).
//
// ⚠️ KHÔNG cache ở service worker: gắn danh tính (hayByMe, mine, chặn). Không vào API_CACHE_ALLOW.
import { NextResponse } from "next/server";
import { encodeCursor } from "@/lib/kairos/cursor";
import { parseFeedParams } from "@/lib/kairos/feed-query";
import { feedFilterFor, hydratePosts, kErr, kairosErrorResponse, PORT_IDS, readerOf, storeOr503 } from "@/lib/kairos/server";
import { LIMITS } from "@/lib/kairos/types";

export async function GET(req: Request) {
  const who = await readerOf(req);
  if (!who.ok) return who.res;
  const parsed = parseFeedParams(new URL(req.url).searchParams, PORT_IDS);
  if (!parsed.ok) return kErr(400, parsed.code);
  const s = await storeOr503();
  if (!s.ok) return s.res;
  const { store } = s;
  const p = parsed.value;
  const now = Date.now();
  try {
    const f = await feedFilterFor(store, p, who.phone, now);
    if (!f.ok) return f.res;
    const rows = await store.listPosts(f.filter, LIMITS.pageSize + 1);
    const page = rows.slice(0, LIMITS.pageSize);
    const last = page[page.length - 1];
    const next = rows.length > LIMITS.pageSize && last ? encodeCursor({ at: last.feed_at, id: last.id }) : null;

    const firstMoi = !p.cursor && p.chip === "moi" && !p.ports && !p.authorProfileId;
    const pinnedRows = firstMoi ? await store.pinnedPosts(new Date(now).toISOString()) : [];
    const pinnedIds = new Set(pinnedRows.map((r) => r.id));
    const [posts, pinned] = await Promise.all([
      hydratePosts(store, page.filter((r) => !pinnedIds.has(r.id)), who.phone, f.blocked),
      hydratePosts(store, pinnedRows, who.phone, f.blocked),
    ]);
    return NextResponse.json({ ok: true, posts, pinned, next, at: new Date(now).toISOString() });
  } catch (e) {
    return kairosErrorResponse(e);
  }
}
