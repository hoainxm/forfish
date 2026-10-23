// GET /api/kairos/new-count?since=ISO&chip=… — "Có N bài mới" (14 §3.2, AC06).
// App gọi khi quay lại màn (visibilitychange) hoặc có sóng lại (online) — KHÔNG realtime, không
// gọi lúc mở app. Cùng bộ lọc với /feed; đếm tới 99. Khách đọc được.
import { NextResponse } from "next/server";
import { NEW_COUNT_CAP, parseFeedParams, parseSince } from "@/lib/kairos/feed-query";
import { feedFilterFor, kErr, kairosErrorResponse, PORT_IDS, readerOf, storeOr503 } from "@/lib/kairos/server";

export async function GET(req: Request) {
  const who = await readerOf(req);
  if (!who.ok) return who.res;
  const sp = new URL(req.url).searchParams;
  const now = Date.now();
  const since = parseSince(sp.get("since"), now);
  if (!since) return kErr(400, "bad_since");
  sp.delete("cursor");
  const parsed = parseFeedParams(sp, PORT_IDS);
  if (!parsed.ok) return kErr(400, parsed.code);
  const s = await storeOr503();
  if (!s.ok) return s.res;
  try {
    const f = await feedFilterFor(s.store, parsed.value, who.phone, now);
    if (!f.ok) return f.res;
    const n = await s.store.countPosts({ ...f.filter, cursor: null, newerThan: since }, NEW_COUNT_CAP);
    return NextResponse.json({ ok: true, n });
  } catch (e) {
    return kairosErrorResponse(e);
  }
}
